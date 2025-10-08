import * as anchor from '@coral-xyz/anchor'
import { Program } from '@coral-xyz/anchor'
import { PublicKey } from '@solana/web3.js'
import { expect } from 'chai'
import { Doomsday } from '../target/types/doomsday'
import { ensureGlobalAndCountry } from './utils'

describe('indexer: pause controls and end_round', () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)
  const program = anchor.workspace.Doomsday as Program<Doomsday>
  const wallet = provider.wallet as anchor.Wallet
  const connection = provider.connection

  const airdrop = async (to: PublicKey, lamports: number) => {
    console.log('airdropping to', to.toBase58())
    const sig = await connection.requestAirdrop(to, lamports)
    await connection.confirmTransaction(sig, 'finalized')
  }

  it('toggles global pause and country pause; ends round', async () => {
    const id = 21
    const now = Math.floor(Date.now() / 1000)
    await airdrop((wallet as any).publicKey, 2_000_000_000)
    const { globalPda, countryPda } = await ensureGlobalAndCountry(
      program,
      provider as any,
      id,
      now - 1 // make round ended so end_round is permitted
    )

    // set_pause(true)
    await program.methods
      .setPause(true)
      .accounts({ authority: (wallet as any).publicKey })
      .rpc()
    let g = await program.account.global.fetch(globalPda)
    expect(g.paused, 'global should be paused').to.eq(true)

    // set_pause(false)
    await program.methods
      .setPause(false)
      .accounts({ authority: (wallet as any).publicKey })
      .rpc()
    g = await program.account.global.fetch(globalPda)
    expect(g.paused, 'global should be unpaused').to.eq(false)

    // set_country_pause(true)
    await program.methods
      .setCountryPause(true)
      .accountsPartial({
        country: countryPda,
      })
      .accounts({
        authority: (wallet as any).publicKey,
      })
      .rpc()
    let c = await program.account.country.fetch(countryPda)
    expect(c.paused, 'country should be paused').to.eq(true)

    // set_country_pause(false)
    await program.methods
      .setCountryPause(false)
      .accountsPartial({
        country: countryPda,
      })
      .accounts({
        authority: (wallet as any).publicKey,
      })
      .rpc()
    c = await program.account.country.fetch(countryPda)
    expect(c.paused, 'country should be unpaused').to.eq(false)

    // end_round to set winner and next end time
    const nextEnd = now + 7200
    const gBefore = await program.account.global.fetch(globalPda)
    await program.methods
      .endRound(id, new anchor.BN(nextEnd))
      .accounts({ authority: (wallet as any).publicKey })
      .rpc()
    const gAfter = await program.account.global.fetch(globalPda)
    expect(gAfter.roundIndex, 'round index must increment').to.eq(
      gBefore.roundIndex + 1
    )
    expect(gAfter.winnerCountryId, 'winner country id must be set').to.eq(id)
    expect(Number(gAfter.roundEndsAtUnix), 'next end time updated').to.eq(
      nextEnd
    )
  })
})
