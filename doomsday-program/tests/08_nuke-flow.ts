import * as anchor from '@coral-xyz/anchor'
import { Program, BN } from '@coral-xyz/anchor'
import { ComputeBudgetProgram, Keypair, PublicKey } from '@solana/web3.js'
import { expect } from 'chai'
import { Doomsday } from '../target/types/doomsday'
import { derivePdas, ensureGlobalAndCountry, solBal, toSol } from './utils'

const LAMPORTS_PER_SOL = 1_000_000_000

describe('nuke + second prize flow — treasuries and burn logs', () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)
  const program = anchor.workspace.Doomsday as Program<Doomsday>
  const connection = provider.connection
  const wallet = provider.wallet as anchor.Wallet

  const airdrop = async (to: PublicKey, lamports: number) => {
    const sig = await connection.requestAirdrop(to, lamports)
    await connection.confirmTransaction(sig, 'finalized')
  }

  it('sets president, ends round, nukes target and executes second prize', async () => {
    const now = Math.floor(Date.now() / 1000)
    const idWinner = 100
    const idTarget = 101
    const idRandom = 102

    // Ensure 3 countries exist and are tradable immediately (round ended)
    const {
      globalPda: g1,
      countryPda: winnerPda,
      solTreasuryPda: winnerSolTreasury,
      authPda,
    } = await ensureGlobalAndCountry(
      program as any,
      provider as any,
      idWinner,
      now - 1
    )
    const { countryPda: targetPda, solTreasuryPda: targetSolTreasury } =
      await ensureGlobalAndCountry(
        program as any,
        provider as any,
        idTarget,
        now - 1
      )
    const { countryPda: randomPda, solTreasuryPda: randomSolTreasury } =
      await ensureGlobalAndCountry(
        program as any,
        provider as any,
        idRandom,
        now - 1
      )

    // Create volume across three countries: 20, 15, 10 SOL
    const buyOn = async (
      id: number,
      pda: PublicKey,
      solTreasury: PublicKey,
      lamports: number,
      who?: Keypair
    ) => {
      const buyer = who ?? Keypair.generate()
      await airdrop(buyer.publicKey, lamports + 2 * LAMPORTS_PER_SOL)
      const c = await program.account.country.fetch(pda)
      const setCU = ComputeBudgetProgram.setComputeUnitLimit({ units: 500_000 })
      await program.methods
        .buyOnCurve(new BN(1), new BN(lamports))
        .accountsPartial({ country: pda, solTreasury })
        .accounts({
          payer: buyer.publicKey,
          mint: c.mint,
          tokenVault: c.tokenVault,
        })
        .preInstructions([setCU])
        .signers([buyer])
        .rpc()
    }
    await buyOn(idWinner, winnerPda, winnerSolTreasury, 20 * LAMPORTS_PER_SOL)
    await buyOn(idRandom, randomPda, randomSolTreasury, 15 * LAMPORTS_PER_SOL)
    await buyOn(idTarget, targetPda, targetSolTreasury, 10 * LAMPORTS_PER_SOL)

    // Set president (wallet) and end round with winner=idWinner
    await program.methods
      .setPresidentOffchain(wallet.publicKey, new BN(1_000_000))
      .accountsPartial({
        country: winnerPda,
      })
      .accounts({ updater: wallet.publicKey })
      .rpc()
    await program.methods
      .endRound(idWinner, new BN(now + 3600))
      /* .accountsPartial({
        global: g1,
      }) */
      .accounts({ authority: wallet.publicKey })
      .rpc()

    const winnerBefore = await program.account.country.fetch(winnerPda)
    const targetBefore = await solBal(connection, targetSolTreasury)
    const winnerTreasuryBefore = await solBal(connection, winnerSolTreasury)
    const randomTreasuryBefore = await solBal(connection, randomSolTreasury)

    console.log(
      '[pre-nuke] target SOL:',
      targetBefore.lamports,
      `(${toSol(targetBefore.lamports)} SOL)`
    )
    console.log(
      '[pre-nuke] winner SOL:',
      winnerTreasuryBefore.lamports,
      `(${toSol(winnerTreasuryBefore.lamports)} SOL)`
    )
    console.log(
      '[pre-nuke] random SOL:',
      randomTreasuryBefore.lamports,
      `(${toSol(randomTreasuryBefore.lamports)} SOL)`
    )
    console.log(
      '[pre-nuke] winner supply_burned:',
      winnerBefore.supplyBurned.toString()
    )

    // Launch nuke: target=idTarget, random=idRandom
    await program.methods
      .launchNuke(idTarget, idRandom, null)
      .accountsPartial({
        global: g1,
        winnerCountry: winnerPda,
        targetCountry: targetPda,
        targetSolTreasury,
        winnerSolTreasury,
        randomCountrySolTreasury: randomSolTreasury,
        burnMintAuth: authPda,
        auth: authPda,
      })
      .accounts({
        president: wallet.publicKey,
        winnerMint: winnerBefore.mint,
        winnerTokenVault: winnerBefore.tokenVault,
      })
      .rpc()

    const targetAfter = await solBal(connection, targetSolTreasury)
    const winnerTreasuryAfter = await solBal(connection, winnerSolTreasury)
    const randomTreasuryAfter = await solBal(connection, randomSolTreasury)
    const winnerAfter = await program.account.country.fetch(winnerPda)

    const solRug = BigInt(targetBefore.lamports) // 100% rugged per constants
    const toBuyback = solRug / BigInt(2)
    const toRandom = solRug - toBuyback

    console.log(
      '[post-nuke] target Δ:',
      BigInt(targetAfter.lamports) - BigInt(targetBefore.lamports),
      `(${toSol(
        BigInt(targetAfter.lamports) - BigInt(targetBefore.lamports)
      )} SOL)`
    )
    console.log(
      '[post-nuke] winner Δ:',
      BigInt(winnerTreasuryAfter.lamports) -
        BigInt(winnerTreasuryBefore.lamports),
      `(${toSol(
        BigInt(winnerTreasuryAfter.lamports) -
          BigInt(winnerTreasuryBefore.lamports)
      )} SOL)`
    )
    console.log(
      '[post-nuke] random Δ:',
      BigInt(randomTreasuryAfter.lamports) -
        BigInt(randomTreasuryBefore.lamports),
      `(${toSol(
        BigInt(randomTreasuryAfter.lamports) -
          BigInt(randomTreasuryBefore.lamports)
      )} SOL)`
    )
    console.log(
      '[post-nuke] winner supply_burned Δ:',
      BigInt(winnerAfter.supplyBurned.toString()) -
        BigInt(winnerBefore.supplyBurned.toString())
    )

    expect(BigInt(targetAfter.lamports)).to.eq(BigInt(0))
    expect(
      BigInt(winnerTreasuryAfter.lamports) -
        BigInt(winnerTreasuryBefore.lamports)
    ).to.eq(toBuyback)
    expect(
      BigInt(randomTreasuryAfter.lamports) -
        BigInt(randomTreasuryBefore.lamports)
    ).to.eq(toRandom)
    expect(winnerAfter.supplyBurned.toString()).to.be.greaterThan(
      Number(winnerBefore.supplyBurned.toString())
    )

    // Execute second prize - spend prize pot on buyback/burn
    const globalBefore = await program.account.global.fetch(g1)
    const potBefore = BigInt(globalBefore.prizePotLamports.toString())
    console.log(
      '[second prize] prize pot before:',
      potBefore.toString(),
      `(${toSol(potBefore)} SOL)`
    )

    await program.methods
      .executeSecondPrize(null)
      .accountsPartial({
        global: g1,
        winnerCountry: winnerPda,
        winnerSolTreasury,
        burnMintAuth: authPda,
        auth: authPda,
      })
      .accounts({
        winnerMint: winnerAfter.mint,
        winnerTokenVault: winnerAfter.tokenVault,
      })
      .rpc()

    const globalAfter = await program.account.global.fetch(g1)
    const potAfter = BigInt(globalAfter.prizePotLamports.toString())
    const winnerAfter2 = await program.account.country.fetch(winnerPda)
    console.log(
      '[second prize] prize pot after:',
      potAfter.toString(),
      `(${toSol(potAfter)} SOL)`
    )
    console.log(
      '[second prize] winner supply_burned Δ:',
      BigInt(winnerAfter2.supplyBurned.toString()) -
        BigInt(winnerAfter.supplyBurned.toString())
    )
    expect(potAfter).to.eq(BigInt(0))
    expect(Number(winnerAfter2.supplyBurned.toString())).to.be.greaterThan(
      Number(winnerAfter.supplyBurned.toString())
    )
  })
})
