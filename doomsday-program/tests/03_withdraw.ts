import * as anchor from '@coral-xyz/anchor'
import { Program, BN } from '@coral-xyz/anchor'
import { Keypair, PublicKey, SystemProgram } from '@solana/web3.js'
import { expect } from 'chai'
import { Doomsday } from '../target/types/doomsday'
import { derivePdas, ensureGlobalAndCountry, solBal } from './utils'

const LAMPORTS_PER_SOL = 1_000_000_000

describe('withdraw protocol fees', async () => {
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

  before(async () => {
    const id = 1
    const now = Math.floor(Date.now() / 1000)
    const { globalPda, countryPda, solTreasuryPda } =
      await ensureGlobalAndCountry(program, provider, id, now + 3600)
  })

  it('accrues protocol fee via buy and withdraws it', async () => {
    const id = 1
    const now = Math.floor(Date.now() / 1000)

    const { protocolTreasuryPda, globalPda, countryPda, solTreasuryPda } =
      derivePdas(program.programId, id)
    // ensure global + country exist
    //  await ensureGlobalAndCountry(program, provider, id, now + 3600)

    // make a buy to create protocol fees
    const buyer = Keypair.generate()
    const buyerAta = new PublicKey(0) // not needed for fee accrual check
    await connection.requestAirdrop(buyer.publicKey, 10 * LAMPORTS_PER_SOL)
    await connection.confirmTransaction(
      await connection.requestAirdrop(buyer.publicKey, 0),
      'finalized'
    )

    const beforeProt = await solBal(connection, protocolTreasuryPda)
    const beforePrize = await program.account.global.fetch(globalPda)
    console.log('Before buy — protocol lamports:', beforeProt.lamports)
    console.log(
      'Before buy — prize pot lamports:',
      beforePrize.prizePotLamports.toString()
    )

    // minimal buy to trigger fees
    await program.methods
      .buyOnCurve(new BN(1), new BN(5 * LAMPORTS_PER_SOL))
      .accountsPartial({ country: countryPda, solTreasury: solTreasuryPda })
      .accounts({
        payer: buyer.publicKey,
        mint: (await program.account.country.fetch(countryPda)).mint,
        tokenVault: (
          await program.account.country.fetch(countryPda)
        ).tokenVault,
      })
      .signers([buyer])
      .rpc()

    const midProt = await solBal(connection, protocolTreasuryPda)
    const afterPrize = await program.account.global.fetch(globalPda)
    console.log(
      'After buy — protocol lamports:',
      midProt.lamports,
      ' Δ=',
      BigInt(midProt.lamports) - BigInt(beforeProt.lamports)
    )
    console.log(
      'After buy — prize pot lamports:',
      afterPrize.prizePotLamports.toString(),
      ' Δ=',
      BigInt(afterPrize.prizePotLamports.toString()) -
        BigInt(beforePrize.prizePotLamports.toString())
    )
    expect(BigInt(midProt.lamports)).to.be.greaterThan(beforeProt.lamports)

    // withdraw as authority
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
    console.log(
      'Withdraw — recipient before:',
      recBefore.lamports,
      ' after:',
      recAfter.lamports,
      ' Δ=',
      BigInt(recAfter.lamports) - BigInt(recBefore.lamports)
    )
    expect(BigInt(recAfter.lamports)).to.be.greaterThan(recBefore.lamports)
  })
})
