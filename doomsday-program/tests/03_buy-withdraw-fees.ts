import * as anchor from '@coral-xyz/anchor'
import { Program, BN } from '@coral-xyz/anchor'
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SystemProgram,
} from '@solana/web3.js'
import { expect } from 'chai'
import { Doomsday } from '../target/types/doomsday'
import {
  derivePdas,
  ensureGlobalAndCountry,
  solBal,
  tokenBal,
  toSol,
} from './utils'
import {
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
} from '@solana/spl-token'

const LAMPORTS_PER_SOL = 1_000_000_000

describe('buy then withdraw protocol fees', () => {
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

  const airdrop = async (to: PublicKey, lamports: number) => {
    const sig = await connection.requestAirdrop(to, lamports)
    await connection.confirmTransaction(sig, 'finalized')
  }

  const id = 42

  it('buys to accrue fees then withdraws protocol fees', async () => {
    await airdrop(wallet.publicKey, 20 * LAMPORTS_PER_SOL)
    const now = Math.floor(Date.now() / 1000)
    const { globalPda, countryPda, solTreasuryPda } =
      await ensureGlobalAndCountry(program, provider, id, now + 3600)
    const { protocolTreasuryPda } = derivePdas(program.programId, id)

    const country = await program.account.country.fetch(countryPda)
    const mintPk = country.mint
    const tokenVaultAta = country.tokenVault

    // Buyer accounts
    const buyer = Keypair.generate()
    await airdrop(buyer.publicKey, 20 * LAMPORTS_PER_SOL)
    const buyerAta = getAssociatedTokenAddressSync(
      mintPk,
      buyer.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID
    )

    const setCU = ComputeBudgetProgram.setComputeUnitLimit({ units: 500_000 })

    // Balances before
    const beforeProt = await solBal(connection, protocolTreasuryPda)
    const beforePrize = await program.account.global.fetch(globalPda)
    console.log(
      '[before buy] protocol:',
      beforeProt.lamports,
      `(${toSol(beforeProt.lamports)} SOL)`
    )
    console.log(
      '[before buy] prize pot:',
      beforePrize.prizePotLamports.toString(),
      `(${toSol(BigInt(beforePrize.prizePotLamports.toString()))} SOL)`
    )

    // Do a buy to accrue protocol fee and prize tax
    await program.methods
      .buyOnCurve(new BN(1), new BN(5 * LAMPORTS_PER_SOL))
      .accountsPartial({ country: countryPda, solTreasury: solTreasuryPda })
      .accounts({
        payer: buyer.publicKey,
        mint: mintPk,
        tokenVault: tokenVaultAta,
      })
      .preInstructions([setCU])
      .signers([buyer])
      .rpc()

    const midProt = await solBal(connection, protocolTreasuryPda)
    const afterPrize = await program.account.global.fetch(globalPda)
    const deltaProt = BigInt(midProt.lamports) - BigInt(beforeProt.lamports)
    console.log(
      '[after buy] protocol:',
      midProt.lamports,
      `(${toSol(midProt.lamports)} SOL)`,
      'Δ',
      deltaProt.toString(),
      `(${toSol(deltaProt)} SOL)`
    )
    const prizeAfterLam = BigInt(afterPrize.prizePotLamports.toString())
    const prizeBeforeLam = BigInt(beforePrize.prizePotLamports.toString())
    const deltaPrize = prizeAfterLam - prizeBeforeLam
    console.log(
      '[after buy] prize pot:',
      afterPrize.prizePotLamports.toString(),
      `(${toSol(prizeAfterLam)} SOL)`,
      'Δ',
      deltaPrize.toString(),
      `(${toSol(deltaPrize)} SOL)`
    )
    expect(midProt.lamports).to.be.greaterThan(beforeProt.lamports)

    // Withdraw fees to recipient
    const recipient = Keypair.generate()
    const recBefore = await solBal(connection, recipient.publicKey)

    await program.methods
      .withdrawProtocolFees(new BN(midProt.lamports))
      .accounts({
        authority: wallet.publicKey,
        recipient: recipient.publicKey,
      })
      .rpc()

    const recAfter = await solBal(connection, recipient.publicKey)
    const deltaRec = BigInt(recAfter.lamports) - BigInt(recBefore.lamports)
    console.log(
      '[withdraw] recipient before:',
      recBefore.lamports,
      `(${toSol(recBefore.lamports)} SOL)`,
      'after:',
      recAfter.lamports,
      `(${toSol(recAfter.lamports)} SOL)`,
      'Δ',
      deltaRec.toString(),
      `(${toSol(deltaRec)} SOL)`
    )
    expect(recAfter.lamports).to.be.greaterThan(recBefore.lamports)
  })

  it('rejects withdrawProtocolFees by unauthorized signer', async () => {
    const outsider = Keypair.generate()
    await airdrop(outsider.publicKey, 10 * LAMPORTS_PER_SOL)
    const {
      protocolTreasuryPda,
      globalPda,
      countryPda,
      solTreasuryPda,
      authPda,
    } = derivePdas(program.programId, id)
    const country = await program.account.country.fetch(countryPda)
    const mintPk = country.mint
    const tokenVaultAta = country.tokenVault
    // Do a buy to accrue protocol fee and prize tax
    await program.methods
      .buyOnCurve(new BN(1), new BN(5 * LAMPORTS_PER_SOL))
      .accountsPartial({ country: countryPda, solTreasury: solTreasuryPda })
      .accounts({
        payer: outsider.publicKey,
        mint: mintPk,
        tokenVault: tokenVaultAta,
      })
      .signers([outsider])
      .rpc()

    let threw = false
    try {
      await program.methods
        .withdrawProtocolFees(new BN(1))
        .accounts({
          authority: wallet.publicKey,
          recipient: outsider.publicKey,
        })
        .signers([outsider])
        .rpc()
    } catch (_) {
      threw = true
    }
    // ensure authority is still set correctly
    const g = await program.account.global.fetch(globalPda)
    expect(g.authority.toBase58()).to.eq(wallet.publicKey.toBase58())
    expect(threw).to.eq(true)
  })
})
