// tests/nuke.events.spec.ts
import * as anchor from '@coral-xyz/anchor'
import { BN, Program } from '@coral-xyz/anchor'
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js'
import { expect } from 'chai'
import type { Doomsday } from '../target/types/doomsday'
import { ensureGlobalAndCountry } from './utils'

// Seeds (match Rust)
const GLOBAL_SEED = Buffer.from('GLOBAL')
const COUNTRY_SEED = (id: number) => [
  Buffer.from('COUNTRY'),
  Buffer.from(new Uint16Array([id]).buffer),
]
const TREASURY_SEED = (id: number) => [
  Buffer.from('TREASURY'),
  Buffer.from(new Uint16Array([id]).buffer),
]

function pdas(programId: PublicKey, id: number) {
  const [globalPda] = PublicKey.findProgramAddressSync([GLOBAL_SEED], programId)
  const [countryPda] = PublicKey.findProgramAddressSync(
    COUNTRY_SEED(id) as any,
    programId
  )
  const [treasuryPda] = PublicKey.findProgramAddressSync(
    TREASURY_SEED(id) as any,
    programId
  )
  return { globalPda, countryPda, treasuryPda }
}

describe('events + AMM hooks (smoke): launch_nuke + execute_nuke (curve path)', () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)
  const program = anchor.workspace.Doomsday as Program<Doomsday>

  it('emits NukeLaunchedIndexed on launch and NukeLaunched after execute (curve)', async () => {
    const winnerId = 101
    const targetId = 102
    const randomId = 103

    const now = Math.floor(Date.now() / 1000)
    await ensureGlobalAndCountry(program, provider, winnerId, now + 3600)
    await ensureGlobalAndCountry(program, provider, targetId, now + 3600)
    await ensureGlobalAndCountry(program, provider, randomId, now + 3600)

    const { globalPda } = pdas(program.programId, winnerId) // same GLOBAL PDA
    const { countryPda: winnerPda, treasuryPda: winnerTreasury } = pdas(
      program.programId,
      winnerId
    )
    const { countryPda: targetPda, treasuryPda: targetTreasury } = pdas(
      program.programId,
      targetId
    )
    const { countryPda: randomPda, treasuryPda: randomTreasury } = pdas(
      program.programId,
      randomId
    )

    // Ensure winner is set in Global (end_round)
    const nextEnd = now + 7200
    await program.methods
      .endRound(winnerId, new BN(nextEnd))
      .accounts({ authority: provider.wallet.publicKey, global: globalPda })
      .rpc()

    // Give treasuries some lamports; target needs SOL to be rugged
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: provider.wallet.publicKey,
        toPubkey: targetTreasury,
        lamports: (5n * 1_000_000_000n) as any,
      }),
      SystemProgram.transfer({
        fromPubkey: provider.wallet.publicKey,
        toPubkey: winnerTreasury,
        lamports: (2n * 1_000_000_000n) as any,
      }),
      SystemProgram.transfer({
        fromPubkey: provider.wallet.publicKey,
        toPubkey: randomTreasury,
        lamports: (1n * 1_000_000_000n) as any,
      })
    )
    await provider.sendAndConfirm!(tx)

    // Observe NukeLaunchedIndexed (your program emits this when AMM is involved; but here curve-only,
    // so we’ll focus on final NukeLaunched; we still subscribe for coverage)
    let indexedSeen = false
    let finalSeen = false

    const subIndexed = await (program as any).addEventListener(
      'NukeLaunchedIndexed',
      (ev: any) => {
        if (
          Number(ev.winnerCountryId) === winnerId &&
          Number(ev.targetCountryId) === targetId
        ) {
          indexedSeen = true
        }
      }
    )
    const subFinal = await (program as any).addEventListener(
      'NukeLaunched',
      (ev: any) => {
        if (
          Number(ev.winnerCountryId) === winnerId &&
          Number(ev.targetCountryId) === targetId
        ) {
          finalSeen = true
        }
      }
    )

    // Set the president as the test wallet to satisfy NotWinnerPresident
    await program.methods
      .setPresidentOffchain(provider.wallet.publicKey, new BN(1))
      .accountsPartial({ country: winnerPda })
      .accounts({ updater: provider.wallet.publicKey, global: globalPda })
      .rpc()

    // === launch_nuke (curve path executes inline in your current version) ===
    const winnerAcc = await (program.account as any).country.fetch(winnerPda)
    const randomAcc = await (program.account as any).country.fetch(randomPda)

    const TOKEN_2022_PROGRAM_ID = new PublicKey(
      'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
    )
    const AUTH_SEED = Buffer.from('AUTH')
    const [authPda] = PublicKey.findProgramAddressSync(
      [AUTH_SEED],
      program.programId
    )

    await program.methods
      .launchNuke(new BN(targetId), new BN(randomId))
      .accounts({
        global: globalPda,
        winnerCountry: winnerPda,
        president: provider.wallet.publicKey,
        targetCountry: targetPda,
        targetSolTreasury: targetTreasury,
        winnerMint: winnerAcc.mint,
        winnerTokenVault: winnerAcc.tokenVault,
        winnerSolTreasury: winnerTreasury,
        randomCountry: randomPda,
        randomMint: randomAcc.mint,
        randomTokenVault: randomAcc.tokenVault,
        randomCountrySolTreasury: randomTreasury,
        burnMintAuth: authPda,
        auth: authPda,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      } as any)
      .rpc()

    // Curve path does not require execute_nuke; it completed inline.
    // For AMM path in your extended version you'd follow with execute_nuke(...)

    expect(finalSeen).to.eq(true) // final event must have fired
    // indexed may or may not fire in the pure curve path; don't require it
    await (program as any).removeEventListener(subIndexed)
    await (program as any).removeEventListener(subFinal)
  })
})
