import * as anchor from '@coral-xyz/anchor'
import { Program } from '@coral-xyz/anchor'
import { expect } from 'chai'
import { Doomsday } from '../target/types/doomsday'
import { ensureGlobalAndCountry } from './utils'

describe('indexer: freeze_curve', () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)
  const program = anchor.workspace.Doomsday as Program<Doomsday>

  it('freezes curve and blocks further buys', async () => {
    const id = 12
    const now = Math.floor(Date.now() / 1000)
    const { countryPda } = await ensureGlobalAndCountry(
      program,
      provider as any,
      id,
      now + 3600
    )
    await program.methods
      .freezeCurve()
      .accountsPartial({
        country: countryPda,
      })
      .accounts({
        authority: (provider.wallet as any).publicKey,
      })
      .rpc()
    const c = await program.account.country.fetch(countryPda)
    expect(c.curveFrozen).to.eq(true)
  })
})
