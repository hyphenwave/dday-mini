import * as fs from 'fs'
import * as path from 'path'
import * as anchor from '@coral-xyz/anchor'
import { Program, BN } from '@coral-xyz/anchor'
import {
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createInitializeMint2Instruction,
  getMinimumBalanceForRentExemptMint,
  createMintToInstruction,
  getOrCreateAssociatedTokenAccount,
  createTransferCheckedInstruction,
} from '@solana/spl-token'
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from '@solana/web3.js'
import { expect } from 'chai'

// -------- CONFIG --------
const INPUT_JSON = path.resolve(__dirname, 'countries.json') // [{ "id": 1, "name": "United States" }, ...]
const OUTPUT_JSON = path.resolve(__dirname, 'countries.out.json') // will be (over)written
const TOKEN_DECIMALS = 9

// Program idl type name must match your IDL name:
//   anchor build → target/types/doomsday.ts  (adjust import if different)
import { Doomsday } from '../target/types/doomsday'
import { solBal, tokenBal } from './utils'

// PDA seeds (must match your Rust)
const GLOBAL_SEED = Buffer.from('GLOBAL')
const COUNTRY_SEED = (id: number) => [
  Buffer.from('COUNTRY'),
  Buffer.from(new Uint16Array([id]).buffer),
]
const TREASURY_SEED = (id: number) => [
  Buffer.from('TREASURY'),
  Buffer.from(new Uint16Array([id]).buffer),
]
const AUTH_SEED = Buffer.from('AUTH')
const PROTO_TREASURY_SEED = Buffer.from('PROTO_TREASURY')

describe('Doomsday — curve→AMM happy path', () => {
  const baseProvider = anchor.AnchorProvider.env()
  const finalizedProvider = new anchor.AnchorProvider(
    baseProvider.connection,
    baseProvider.wallet,
    { commitment: 'finalized', preflightCommitment: 'finalized' }
  )
  anchor.setProvider(finalizedProvider)
  const provider = anchor.getProvider() as anchor.AnchorProvider
  const connection = provider.connection
  const wallet = provider.wallet as anchor.Wallet
  const program = anchor.workspace.Doomsday as Program<Doomsday>

  let globalPda: PublicKey
  let protocolTreasuryPda: PublicKey
  let authPda: PublicKey
  let burnMintAuthPda: PublicKey
  let globalBump = 0

  // Utilities
  const airdrop = async (to: PublicKey, lamports: number) => {
    const sig = await connection.requestAirdrop(to, lamports)
    await connection.confirmTransaction(sig, 'finalized')
  }

  const createMint2022 = async (
    mintAuthority: PublicKey,
    decimals = TOKEN_DECIMALS
  ) => {
    const mint = Keypair.generate()
    const lamports = await getMinimumBalanceForRentExemptMint(connection)
    const tx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: mint.publicKey,
        space: 82, // Mint size
        lamports,
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      createInitializeMint2Instruction(
        mint.publicKey,
        decimals,
        mintAuthority,
        null, // no freeze authority
        TOKEN_2022_PROGRAM_ID
      )
    )
    await provider.sendAndConfirm!(tx, [mint])
    return mint.publicKey
  }

  const derivePdas = (countryId: number) => {
    const [countryPda] = PublicKey.findProgramAddressSync(
      COUNTRY_SEED(countryId) as any,
      program.programId
    )
    const [solTreasuryPda] = PublicKey.findProgramAddressSync(
      TREASURY_SEED(countryId) as any,
      program.programId
    )
    return { countryPda, solTreasuryPda }
  }

  before('init global + PDAs', async () => {
    ;[globalPda, globalBump] = PublicKey.findProgramAddressSync(
      [GLOBAL_SEED],
      program.programId
    )
    ;[protocolTreasuryPda] = PublicKey.findProgramAddressSync(
      [PROTO_TREASURY_SEED],
      program.programId
    )
    ;[authPda] = PublicKey.findProgramAddressSync(
      [AUTH_SEED],
      program.programId
    )
    // burn_mint_auth shares same seed as auth in your code
    ;[burnMintAuthPda] = PublicKey.findProgramAddressSync(
      [AUTH_SEED],
      program.programId
    )

    // Fund the test wallet a bit
    await airdrop(wallet.publicKey, 1000e9) // 1000 SOL

    // Initialize Global (round ends in ~1h)
    const now = Math.floor(Date.now() / 1000)
    const roundEnds = new BN(now + 3600)

    const tx = await program.methods
      .initGlobal(roundEnds)
      .accounts({
        authority: wallet.publicKey,
        // global: globalPda,
        //protocolTreasury: protocolTreasuryPda,
        //auth: authPda,
        // burnMintAuth: burnMintAuthPda,
        //systemProgram: SystemProgram.programId,
      })
      .rpc()
    // console.log('init_global tx', tx);
    console.log('globalPda', globalPda.toBase58())
    console.log('Init Global Transaction hash: ', tx.toString())
    const g = await program.account.global.fetch(globalPda)
    expect(g.roundIndex).to.eq(1)
  })

  it('loads countries.json, creates mints, inits countries, trades on curve, and writes countries.out.json', async () => {
    const input: Array<{ id: number; name?: string }> = JSON.parse(
      fs.readFileSync(INPUT_JSON, 'utf8')
    )
    const results: any[] = []

    // Listen for CountryPrice events (used by get_country_price)
    const priceEvents: Record<
      number,
      { price: string; mode: any; stepIndex: string }
    > = {}
    const listener = program.addEventListener('countryPrice', (ev: any) => {
      priceEvents[ev.country] = {
        price: ev.priceLamportsPerToken.toString(),
        mode: ev.mode, // { curve: {}, amm: {} } enum-variant object
        stepIndex: ev.stepIndex.toString(),
      }
    })

    try {
      for (const row of input) {
        const countryId = row.id
        const { countryPda, solTreasuryPda } = derivePdas(countryId)

        // --- create Token-2022 mint (mint authority is the AUTH PDA) ---
        const mintPk = await createMint2022(burnMintAuthPda, TOKEN_DECIMALS)

        // --- derive & (auto)create reserve vault ATA (AUTH PDA owner) ---
        const tokenVaultAta = getAssociatedTokenAddressSync(
          mintPk,
          burnMintAuthPda,
          true,
          TOKEN_2022_PROGRAM_ID
        )

        // init_if_needed in your program will lazily create the ATA during InitCountry,
        // but to be explicit we can pre-create by calling a no-op transfer if needed.
        // (Not necessary; your #[account(init,... associated_token)] handles it.)

        // --- init_country ---
        // choose modest virtual reserves (not used by step pricing; safe placeholders)
        const vSol = new BN(0)
        const vTok = new BN(0)

        console.log('initCountryTx', countryId, vSol, vTok)
        const initCountryTx = await program.methods
          .initCountry(countryId, vSol, vTok)
          .accounts({
            global: globalPda,
            // authority: wallet.publicKey,
            mint: mintPk,
            // tokenVault: tokenVaultAta,
            // solTreasury: solTreasuryPda, // ← must exist → patch in Rust makes it init
            // burnMintAuth: burnMintAuthPda,
            // tokenProgram: TOKEN_2022_PROGRAM_ID,
            //associatedTokenProgram: anchor.utils.token.ASSOCIATED_PROGRAM_ID, // from @coral-xyz/anchor
            //systemProgram: SystemProgram.programId,
          })
          .rpc()
        console.log('init_country tx', countryId + ' ' + initCountryTx)

        // --- BUY on curve ---
        // Create buyer ATA implicitly via CPI (init_if_needed) in buy_on_curve
        const solInLamports = 10e9 // 10 SOL
        const minTokensOut = 1 // accept whatever >=1 token

        const additionalComputeBudgetInstruction =
          ComputeBudgetProgram.setComputeUnitLimit({
            units: 55555500,
          })
        console.log(await solBal(connection, solTreasuryPda))
        const buyTx = await program.methods
          .buyOnCurve(new BN(minTokensOut), new BN(solInLamports))
          .accountsPartial({ country: countryPda, solTreasury: solTreasuryPda })
          .accounts({
            payer: wallet.publicKey,
            mint: mintPk,
            tokenVault: tokenVaultAta,
          })
          .preInstructions([additionalComputeBudgetInstruction])
          .rpc()

        console.log('buy_on_curve tx', buyTx)
        console.log(await solBal(connection, solTreasuryPda))
        const countryAccBuy = await program.account.country.fetch(countryPda)
        //   console.log('countryAccBuy', countryAccBuy)
        const sellerAta = getAssociatedTokenAddressSync(
          mintPk,
          wallet.publicKey,
          false,
          TOKEN_2022_PROGRAM_ID
        )
        console.log(await tokenBal(connection, tokenVaultAta))
        console.log(await tokenBal(connection, sellerAta))
        // --- FETCH PRICE (event-based) ---
        await program.methods
          .getCountryPrice()
          .accounts({ country: countryPda })
          .rpc()

        const priceInfo = priceEvents[countryId] ?? null
        console.log('priceInfo', priceInfo)
        console.log('priceEvents', priceEvents)

        // --- SELL on curve ---
        const tokensToSell = new BN(10e9) // sell 1 token
        const minSolOut = new BN(1) // any positive SOL
        const sellTx = await program.methods
          .sellOnCurve(minSolOut, tokensToSell)
          .accountsPartial({ country: countryPda, solTreasury: solTreasuryPda })
          .accounts({
            seller: wallet.publicKey,
            //global: globalPda,
            //country: countryPda,
            mint: mintPk,
            sellerAta: getAssociatedTokenAddressSync(
              mintPk,
              wallet.publicKey,
              false,
              TOKEN_2022_PROGRAM_ID
            ),
            tokenVault: tokenVaultAta,
            //solTreasury: solTreasuryPda,
            //protocolTreasury: protocolTreasuryPda,
            //tokenProgram: TOKEN_2022_PROGRAM_ID,
            //systemProgram: SystemProgram.programId,
          })
          .rpc()
        // console.log('sell_on_curve tx', sellTx);

        // --- Collect account state for output JSON ---
        const countryAcc = await program.account.country.fetch(countryPda)
        results.push({
          id: countryId,
          name: row.name ?? null,
          mint: mintPk.toBase58(),
          tokenVault: tokenVaultAta.toBase58(),
          solTreasury: solTreasuryPda.toBase58(),
          mode: Object.keys(countryAcc.mode)[0], // "curve" or "amm"
          currentStepIndex: countryAcc.currentStepIndex.toString(),
          soldInCurrentStep: countryAcc.soldInCurrentStep.toString(),
          supplyMinted: countryAcc.supplyMinted.toString(),
          supplyBurned: countryAcc.supplyBurned.toString(),
          buyTx,
          sellTx,
          price: priceInfo
            ? {
                lamportsPerToken: priceInfo.price,
                stepIndex: priceInfo.stepIndex,
                mode: Object.keys(priceInfo.mode)[0],
              }
            : null,
        })

        // keep tests quick: only do a handful if file is large
        if (results.length >= 1) break
      }

      fs.writeFileSync(
        OUTPUT_JSON,
        JSON.stringify(
          {
            global: {
              programId: program.programId.toBase58(),
              globalPda: globalPda.toBase58(),
              protoTreasuryPda: protocolTreasuryPda.toBase58(),
              authPda: authPda.toBase58(),
              burnMintAuthPda: burnMintAuthPda.toBase58(),
            },
            countries: results,
          },
          null,
          2
        )
      )

      console.log(`\nWrote ${results.length} records → ${OUTPUT_JSON}\n`)

      // Basic assertions on first record
      expect(results.length).to.be.greaterThan(0)
      expect(results[0].mint).to.match(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/)
    } finally {
      await program.removeEventListener(listener)
    }
  })
})
