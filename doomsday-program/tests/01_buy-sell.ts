// tests/continuous_linear_curve.spec.ts
import * as fs from 'fs'
import * as path from 'path'
import * as anchor from '@coral-xyz/anchor'
import { Program, BN } from '@coral-xyz/anchor'
import {
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createInitializeMint2Instruction,
  getMinimumBalanceForRentExemptMint,
} from '@solana/spl-token'
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from '@solana/web3.js'
import { expect } from 'chai'

import { Doomsday } from '../target/types/doomsday'
import { solBal, tokenBal, ensureGlobalAndCountry } from './utils'

// -------- CONFIG --------
const INPUT_JSON = path.resolve(__dirname, '..', 'countries.json') // [{ id: 1, name?: string }, ...]
const TOKEN_DECIMALS = 9
const LAMPORTS_PER_SOL = 1_000_000_000
const USD_PER_SOL = 230 // just for pretty printing

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

function derivePdas(programId: PublicKey, id: number) {
  const [globalPda] = PublicKey.findProgramAddressSync([GLOBAL_SEED], programId)
  const [countryPda] = PublicKey.findProgramAddressSync(
    COUNTRY_SEED(id) as any,
    programId
  )
  const [solTreasuryPda] = PublicKey.findProgramAddressSync(
    TREASURY_SEED(id) as any,
    programId
  )
  const [authPda] = PublicKey.findProgramAddressSync([AUTH_SEED], programId)
  const [protocolTreasuryPda] = PublicKey.findProgramAddressSync(
    [PROTO_TREASURY_SEED],
    programId
  )
  return { globalPda, countryPda, solTreasuryPda, authPda, protocolTreasuryPda }
}

describe('continuous linear curve — lean scenario', () => {
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
        space: 82,
        lamports,
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      createInitializeMint2Instruction(
        mint.publicKey,
        decimals,
        mintAuthority,
        null,
        TOKEN_2022_PROGRAM_ID
      )
    )
    await provider.sendAndConfirm!(tx, [mint])
    return mint.publicKey
  }

  let id = 1
  before('init fresh: global + one country', async () => {
    // Prefer first ID from countries.json if present
    try {
      const arr = JSON.parse(fs.readFileSync(INPUT_JSON, 'utf8')) as Array<{
        id: number
      }>
      if (Array.isArray(arr) && arr[0]?.id) id = arr[0].id
    } catch (_) {}

    await airdrop(wallet.publicKey, 500e9)
    const now = Math.floor(Date.now() / 1000)

    /* const { globalPda, countryPda, solTreasuryPda } =
      await ensureGlobalAndCountry(program, provider, id, now + 3600) */

    const { globalPda, countryPda, solTreasuryPda, authPda } = derivePdas(
      program.programId,
      id
    )
    // sanity: these accounts now exist
    const c = await program.account.country.fetch(countryPda)

    expect(c.solTreasury.toBase58()).to.eq(solTreasuryPda.toBase58())
  })

  it('performs sequential buys & sells; prints prices and deltas', async () => {
    const {
      globalPda,
      countryPda,
      solTreasuryPda,
      /*authPda,*/ // not needed here
    } = derivePdas(program.programId, id)

    const priceEvents: Record<
      number,
      { priceLamportsPerToken: string; mode: any; stepIndex: string }
    > = {}
    const listener = program.addEventListener('countryPrice', (ev: any) => {
      priceEvents[ev.country] = {
        priceLamportsPerToken: ev.priceLamportsPerToken.toString(),
        mode: ev.mode, // { curve: {}, amm: {} } enum-variant object
        stepIndex: ev.stepIndex.toString(),
      }
    })

    const countryAcc = await program.account.country.fetch(countryPda)
    const mintPk = countryAcc.mint
    const tokenVaultAta = countryAcc.tokenVault

    const buyerA = wallet.publicKey
    const buyerAata = getAssociatedTokenAddressSync(
      mintPk,
      buyerA,
      false,
      TOKEN_2022_PROGRAM_ID
    )

    // second buyer
    const buyerB = Keypair.generate()
    await airdrop(buyerB.publicKey, 500 * LAMPORTS_PER_SOL)
    const buyerBata = getAssociatedTokenAddressSync(
      mintPk,
      buyerB.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID
    )

    const setCU = ComputeBudgetProgram.setComputeUnitLimit({
      units: 500_000,
    })

    const buyOnce = async (
      payer: Keypair | PublicKey,
      payerAta: PublicKey,
      solAmount: number
    ) => {
      const payerPk = payer instanceof PublicKey ? payer : payer.publicKey
      const before = await tokenBal(connection, payerAta)
      await program.methods
        .buyOnCurve(new BN(1), new BN(solAmount))
        .accountsPartial({ country: countryPda, solTreasury: solTreasuryPda })
        .accounts({ payer: payerPk, mint: mintPk, tokenVault: tokenVaultAta })
        .preInstructions([setCU])
        .signers(payer instanceof PublicKey ? [] : [payer])
        .rpc()
      const after = await tokenBal(connection, payerAta)
      return BigInt(after.amount) - BigInt(before.amount)
    }

    const sellOnce = async (
      seller: Keypair | PublicKey,
      sellerAta: PublicKey,
      tokens: bigint
    ) => {
      const sellerPk = seller instanceof PublicKey ? seller : seller.publicKey
      const beforeSol = await solBal(connection, sellerPk)
      await program.methods
        .sellOnCurve(new BN(1), new BN(tokens.toString()))
        .accountsPartial({ country: countryPda, solTreasury: solTreasuryPda })
        .accounts({
          seller: sellerPk,
          mint: mintPk,
          sellerAta,
          tokenVault: tokenVaultAta,
        })
        .signers(seller instanceof PublicKey ? [] : [seller])
        .rpc()
      const afterSol = await solBal(connection, sellerPk)
      return BigInt(afterSol.lamports) - BigInt(beforeSol.lamports)
    }

    // ---- Buys ----
    const sol10 = 10 * LAMPORTS_PER_SOL
    const buyA1 = await buyOnce(buyerA, buyerAata, sol10)
    const buyA2 = await buyOnce(buyerA, buyerAata, sol10)
    const buyB1 = await buyOnce(buyerB, buyerBata, sol10)
    const buyA3 = await buyOnce(buyerA, buyerAata, sol10)

    console.log('A buy #1 tokens:', buyA1.toString())
    console.log('A buy #2 tokens:', buyA2.toString())
    console.log('B buy #1 tokens:', buyB1.toString())
    console.log('A buy #3 tokens:', buyA3.toString())

    // Expect diminishing returns
    // expect(buyA2 < buyA1).to.eq(true)
    expect(buyB1 < buyA2).to.eq(true)
    expect(buyA3 < buyA2).to.eq(true)

    // ---- Price snapshot via view (returns current price and step) ----

    await priceSnapshot(program, countryPda, id, priceEvents)

    // ---- Sells ----
    const profitB = await sellOnce(buyerB, buyerBata, buyB1)
    const profitA = await sellOnce(buyerA, buyerAata, buyA1)
    const profitA2 = await sellOnce(buyerA, buyerAata, buyA2)
    const profitA3 = await sellOnce(buyerA, buyerAata, buyA3)

    console.log('A realized Δ lamports:', profitA.toString())
    console.log('A realized Δ lamports #2:', profitA2.toString())
    console.log('A realized Δ lamports #3:', profitA3.toString())
    console.log('B realized Δ lamports:', profitB.toString())
    console.log(
      'A realized SOL/USD:',
      (Number(profitA) / LAMPORTS_PER_SOL).toFixed(6),
      '$' + ((Number(profitA) / LAMPORTS_PER_SOL) * USD_PER_SOL).toFixed(2)
    )
    console.log(
      'B realized SOL/USD:',
      (Number(profitB) / LAMPORTS_PER_SOL).toFixed(6),
      '$' + ((Number(profitB) / LAMPORTS_PER_SOL) * USD_PER_SOL).toFixed(2)
    )

    await priceSnapshot(program, countryPda, id, priceEvents)
    // sanity: treasury should remain solvent
    const t = await solBal(connection, solTreasuryPda)
    console.log('Treasury', t)
    expect(t.lamports).to.be.greaterThan(0)

    program.removeEventListener(listener)
  })
})

const priceSnapshot = async (
  program: Program<Doomsday>,
  countryPda: PublicKey,
  id: number,
  priceEvents: Record<
    number,
    { priceLamportsPerToken: string; mode: any; stepIndex: string }
  >
) => {
  await program.methods
    .getCountryPrice()
    .accounts({ country: countryPda })
    .rpc()

  const priceInfo = priceEvents[id] ?? null
  console.log('priceInfo', priceInfo)
  console.log('priceEvents', priceEvents)

  const priceSol = Number(priceInfo.priceLamportsPerToken) / LAMPORTS_PER_SOL
  const priceUsd = priceSol * USD_PER_SOL
  console.log(
    '~spot price (SOL):',
    priceSol.toFixed(9),
    'USD:',
    priceUsd.toFixed(9)
  )
}
