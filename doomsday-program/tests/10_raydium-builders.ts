// tests/raydium.seed.spec.ts
import * as anchor from '@coral-xyz/anchor'
import { BN, Program } from '@coral-xyz/anchor'
import { Keypair, PublicKey, SystemProgram } from '@solana/web3.js'
import { expect } from 'chai'
import { Raydium } from '@raydium-io/raydium-sdk-v2'
import type { Doomsday } from '../target/types/doomsday'
import { ensureGlobalAndCountry } from './utils'

// ===== Constants (mainnet IDs; for local forks, keep these)
const NATIVE_MINT = new PublicKey('So11111111111111111111111111111111111111112')
const TOKEN_2022_PROGRAM_ID = new PublicKey(
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
)
const TOKEN_PROGRAM_ID = new PublicKey(
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
)
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'
)

// PDA seeds (must match Rust)
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
  return { globalPda, countryPda, solTreasuryPda, authPda }
}

// Helpers to transform Raydium builder instructions → remainingAccounts metas
function metasFromIx(ix: any) {
  return ix.keys.map((k: any) => ({
    pubkey: k.pubkey,
    isWritable: !!k.isWritable,
    isSigner: !!k.isSigner,
  }))
}
function unionMetas(a: any[], b: any[]) {
  const seen = new Set<string>()
  const out: any[] = []
  for (const m of [...a, ...b]) {
    const key = `${m.pubkey.toBase58()}-${m.isWritable ? 1 : 0}-${
      m.isSigner ? 1 : 0
    }`
    if (!seen.has(key)) {
      seen.add(key)
      out.push(m)
    }
  }
  return out
}

describe('freeze_curve + seed_raydium_pool', () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)
  const program = anchor.workspace.Doomsday as Program<Doomsday>

  it('freezes curve, builds Raydium create+deposit, and seeds with program-owned LP', async () => {
    const id = 81
    const now = Math.floor(Date.now() / 1000)
    await ensureGlobalAndCountry(program, provider, id, now + 3600)

    const { globalPda, countryPda, solTreasuryPda, authPda } = derivePdas(
      program.programId,
      id
    )
    const country = await (program.account as any).country.fetch(countryPda)
    const countryMint: PublicKey = country.mint
    const tokenVault: PublicKey = country.tokenVault

    // 1) freeze_curve
    await program.methods
      .freezeCurve()
      .accounts({
        authority: provider.wallet.publicKey,
        global: globalPda,
        country: countryPda,
      })
      .rpc()

    const frozen = await (program.account as any).country.fetch(countryPda)
    expect(!!frozen.curveFrozen).to.eq(true)

    // 2) Build Raydium createPool + deposit using SDK v2 (direct import)
    const ray = await Raydium.load({
      connection: provider.connection,
      owner: (provider.wallet as any).payer ?? Keypair.generate(),
      disableLoadToken: false,
    })

    // base = country token (Token-2022), quote = WSOL
    const baseMint = countryMint
    const quoteMint = NATIVE_MINT

    // Seed sizes (small for test; on real runs compute from curve to keep price ≥ curve)
    const baseAmount = new BN(1_000_000) // 0.001 tokens @ 9dp
    const quoteAmount = new BN(1_000_000) // 0.001 SOL (lamports)

    const baseVault = tokenVault
    // PDA WSOL ATA placeholder for builder; your on-chain seeding uses the real one
    const [wsolVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('WSOL_VAULT_TEST'), authPda.toBuffer()],
      program.programId
    )
    const quoteVault = wsolVaultPda

    const { builder: createBuilder, extInfo } = await ray.cpmm.createPool({
      baseMint,
      quoteMint,
      baseAmount,
      quoteAmount,
      baseVault,
      quoteVault,
      owner: authPda, // LP owner = AUTH PDA
    })
    const createIx = createBuilder.allInstructions[0]

    const poolId = extInfo?.poolId ?? PublicKey.unique()
    const { builder: depositBuilder } = await ray.cpmm.deposit({
      poolId,
      owner: authPda,
      baseVault,
      quoteVault,
      baseAmount,
      quoteAmount,
      fixedSide: 'base',
    })
    const depositIx = depositBuilder.allInstructions[0]

    const lpMint: PublicKey = extInfo?.lpMint ?? PublicKey.unique()
    const [lpOwnerLpAta] = PublicKey.findProgramAddressSync(
      [Buffer.from('LP_VAULT_TEST'), authPda.toBuffer()],
      program.programId
    )

    // 3) Invoke your seeding ix (CPI path if Raydium is present)
    const union = unionMetas(metasFromIx(createIx), metasFromIx(depositIx))

    await program.methods
      .seedRaydiumPool(
        createIx.programId,
        poolId,
        PublicKey.unique(),
        PublicKey.unique(),
        lpMint,
        new BN(0),
        new BN(0),
        [...createIx.data],
        [...depositIx.data]
      )
      .accounts({
        authority: provider.wallet.publicKey,
        global: globalPda,
        country: countryPda,
        countryMint,
        tokenVault,
        solTreasury: solTreasuryPda,
        wsolAta: wsolVaultPda,
        lpMintAcc: lpMint,
        lpOwnerLpAtaAcc: lpOwnerLpAta,
        burnMintAuth: authPda,
        auth: authPda,
        tokenProgram2022: TOKEN_2022_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      } as any)
      .remainingAccounts(union)
      .rpc()

    const after = await (program.account as any).country.fetch(countryPda)
    expect(after.mode as number).to.eq(1) // MarketMode::Amm
    expect(new PublicKey(after.raydiumLpMint).toBase58()).to.eq(
      lpMint.toBase58()
    )
    expect(new PublicKey(after.raydiumLpVault).toBase58()).to.eq(
      lpOwnerLpAta.toBase58()
    )
  })
})
