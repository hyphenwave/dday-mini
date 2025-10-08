import * as anchor from '@coral-xyz/anchor'
import { Program } from '@coral-xyz/anchor'
import { expect } from 'chai'
import { Doomsday } from '../target/types/doomsday'
import { ensureGlobalAndCountry } from './utils'

describe('indexer: set_country_quote_offchain', () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)
  const program = anchor.workspace.Doomsday as Program<Doomsday>

  it('updates quote fields', async () => {
    const id = 11
    const now = Math.floor(Date.now() / 1000)
    const { countryPda } = await ensureGlobalAndCountry(
      program,
      provider as any,
      id,
      now + 3600
    )
    await program.methods
      .setCountryQuoteOffchain(
        new anchor.BN(1_000_000),
        new anchor.BN(2_000_000),
        { curve: {} },
        new anchor.BN(now)
      )
      .accountsPartial({
        country: countryPda,
      })
      .accounts({
        updater: (provider.wallet as any).publicKey,
      })
      .rpc()
    const c = await program.account.country.fetch(countryPda)
    expect(c.quotePriceQ64.toString()).to.eq('1000000')
  })
})
