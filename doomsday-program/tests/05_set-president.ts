import * as anchor from '@coral-xyz/anchor'
import { Program } from '@coral-xyz/anchor'
import { PublicKey, Keypair } from '@solana/web3.js'
import { expect } from 'chai'
import { Doomsday } from '../target/types/doomsday'
import { derivePdas, ensureGlobalAndCountry } from './utils'

describe('indexer: set_president_offchain', () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)
  const program = anchor.workspace.Doomsday as Program<Doomsday>

  it('sets president; other countries unaffected; can change president later', async () => {
    const idA = 10
    const idB = 11
    const now = Math.floor(Date.now() / 1000)

    const { countryPda: countryA } = await ensureGlobalAndCountry(
      program,
      provider as any,
      idA,
      now + 3600
    )
    const { countryPda: countryB } = await ensureGlobalAndCountry(
      program,
      provider as any,
      idB,
      now + 3600
    )

    // 1) Set initial president for country A
    const presidentA1 = Keypair.generate().publicKey
    await program.methods
      .setPresidentOffchain(presidentA1, new anchor.BN(123_456))
      .accountsPartial({
        country: countryA,
      })
      .accounts({
        updater: (provider.wallet as any).publicKey,
      })
      .rpc()
    const a1 = await program.account.country.fetch(countryA)
    const b1 = await program.account.country.fetch(countryB)
    expect(a1.president.toBase58(), 'country A president should be set').to.eq(
      presidentA1.toBase58()
    )
    expect(
      b1.president.toBase58(),
      'country B president should not equal country A’s new president'
    ).to.not.eq(presidentA1.toBase58())

    // 2) Change president for country A to a different key
    const presidentA2 = Keypair.generate().publicKey
    await program.methods
      .setPresidentOffchain(presidentA2, new anchor.BN(654_321))
      .accountsPartial({
        country: countryA,
      })
      .accounts({
        updater: (provider.wallet as any).publicKey,
      })
      .rpc()
    const a2 = await program.account.country.fetch(countryA)
    expect(
      a2.president.toBase58(),
      'country A president should update to a new key'
    ).to.eq(presidentA2.toBase58())
    expect(
      a2.president.toBase58(),
      'country A new president should differ from previous president'
    ).to.not.eq(presidentA1.toBase58())

    // 3) Ensure country B remains unaffected throughout
    const b2 = await program.account.country.fetch(countryB)
    expect(
      b2.president.toBase58(),
      'country B president unchanged throughout test'
    ).to.eq(b1.president.toBase58())
  })
})
