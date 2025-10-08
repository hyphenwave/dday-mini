import * as anchor from '@coral-xyz/anchor'
import { Program } from '@coral-xyz/anchor'
import { Keypair, PublicKey } from '@solana/web3.js'
import { expect } from 'chai'
import { Doomsday } from '../target/types/doomsday'

const LAMPORTS_PER_SOL = 1_000_000_000

const GLOBAL_SEED = Buffer.from('GLOBAL')

function deriveGlobal(programId: PublicKey) {
  const [globalPda] = PublicKey.findProgramAddressSync([GLOBAL_SEED], programId)
  return { globalPda }
}

const decodeUpdaters = (arr: any[]) =>
  arr.map((k: any) => new PublicKey(k).toBase58())

describe('authorized updaters — add/remove', async () => {
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

  const { globalPda } = deriveGlobal(program.programId)
  // ensure fresh global per test run
  before(async () => {
    await airdrop(wallet.publicKey, 10 * LAMPORTS_PER_SOL)
    const now = Math.floor(Date.now() / 1000)
    const info = await connection.getAccountInfo(globalPda)
    if (!info) {
      await program.methods
        .initGlobal(new anchor.BN(now + 3600))
        .accounts({ authority: wallet.publicKey })
        .rpc()
    }
  })
  const newUpdater = Keypair.generate()
  const outsider = Keypair.generate()

  it('seeds authority in authorized_updaters after init_global', async () => {
    const g1 = await program.account.global.fetch(globalPda)
    const updaters1 = decodeUpdaters(g1.authorizedUpdaters as any[])
    expect(g1.authority.toBase58()).to.eq(wallet.publicKey.toBase58())
    expect(updaters1).to.include(wallet.publicKey.toBase58())
  })

  it('authorized updater can add a new updater', async () => {
    await airdrop(newUpdater.publicKey, 2 * LAMPORTS_PER_SOL)
    await program.methods
      .addAuthorizedUpdater(newUpdater.publicKey)
      .accounts({ updater: wallet.publicKey })
      .rpc()

    const g2 = await program.account.global.fetch(globalPda)
    const updaters2 = decodeUpdaters(g2.authorizedUpdaters as any[])
    expect(updaters2).to.include(newUpdater.publicKey.toBase58())
  })

  it('unauthorized outsider cannot remove an updater', async () => {
    await airdrop(outsider.publicKey, 2 * LAMPORTS_PER_SOL)
    let threw = false
    try {
      await program.methods
        .removeAuthorizedUpdater(newUpdater.publicKey)
        .accounts({ updater: outsider.publicKey })
        .signers([outsider])
        .rpc()
    } catch (_) {
      threw = true
    }
    expect(threw).to.eq(true)
  })

  it('authority can remove itself when another updater exists; other updater re-adds authority', async () => {
    // ensure newUpdater exists in list
    let g = await program.account.global.fetch(globalPda)
    let ups = decodeUpdaters(g.authorizedUpdaters as any[])
    if (!ups.includes(newUpdater.publicKey.toBase58())) {
      await program.methods
        .addAuthorizedUpdater(newUpdater.publicKey)
        .accounts({ updater: wallet.publicKey })
        .rpc()
      g = await program.account.global.fetch(globalPda)
      ups = decodeUpdaters(g.authorizedUpdaters as any[])
    }

    // remove authority using authority itself
    await program.methods
      .removeAuthorizedUpdater(wallet.publicKey)
      .accounts({ updater: wallet.publicKey })
      .rpc()
    let gAfterRemove = await program.account.global.fetch(globalPda)
    let upsAfterRemove = decodeUpdaters(
      gAfterRemove.authorizedUpdaters as any[]
    )
    expect(upsAfterRemove).to.not.include(wallet.publicKey.toBase58())

    // re-add authority using newUpdater (still authorized)
    await program.methods
      .addAuthorizedUpdater(wallet.publicKey)
      .accounts({ updater: newUpdater.publicKey })
      .signers([newUpdater])
      .rpc()
    const gAfterAdd = await program.account.global.fetch(globalPda)
    const upsAfterAdd = decodeUpdaters(gAfterAdd.authorizedUpdaters as any[])
    expect(upsAfterAdd).to.include(wallet.publicKey.toBase58())
  })

  it('non-authorities cannot remove the authority key', async () => {
    // Ensure authority in list
    let g = await program.account.global.fetch(globalPda)
    let ups = decodeUpdaters(g.authorizedUpdaters as any[])
    if (!ups.includes(wallet.publicKey.toBase58())) {
      await program.methods
        .addAuthorizedUpdater(wallet.publicKey)
        .accounts({ updater: newUpdater.publicKey })
        .signers([newUpdater])
        .rpc()
    }
    // outsider attempt
    let threwA = false
    try {
      await program.methods
        .removeAuthorizedUpdater(wallet.publicKey)
        .accounts({ updater: outsider.publicKey })
        .signers([outsider])
        .rpc()
    } catch (_) {
      threwA = true
    }
    expect(threwA).to.eq(true)
    // other updater attempt
    let threwB = false
    try {
      await program.methods
        .removeAuthorizedUpdater(wallet.publicKey)
        .accounts({ updater: newUpdater.publicKey })
        .signers([newUpdater])
        .rpc()
    } catch (_) {
      threwB = true
    }
    expect(threwB).to.eq(true)
  })

  it('authorized updater can remove previously added updater', async () => {
    await program.methods
      .removeAuthorizedUpdater(newUpdater.publicKey)
      .accounts({ updater: wallet.publicKey })
      .rpc()
    const g4 = await program.account.global.fetch(globalPda)
    const updaters4 = decodeUpdaters(g4.authorizedUpdaters as any[])
    expect(updaters4).to.not.include(newUpdater.publicKey.toBase58())
  })

  it('removed updater can no longer act as updater', async () => {
    let threw2 = false
    try {
      await program.methods
        .addAuthorizedUpdater(Keypair.generate().publicKey)
        .accounts({ updater: newUpdater.publicKey })
        .signers([newUpdater])
        .rpc()
    } catch (_) {
      threw2 = true
    }
    expect(threw2).to.eq(true)
  })
})
