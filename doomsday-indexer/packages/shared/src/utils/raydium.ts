import * as anchor from '@coral-xyz/anchor'
import { PublicKey, TransactionInstruction } from '@solana/web3.js'

// Compute seeding amounts so Raydium initial price >= curve price * safety
export function computeSeedAmounts(
  rsLamports: anchor.BN,
  rtTokens: anchor.BN,
  vs: anchor.BN,
  vt: anchor.BN,
  safety = 0.995
) {
  const num = rsLamports.add(vs) // (RS + VS)
  const den = rtTokens.add(vt) // (RT + VT)
  if (den.isZero()) throw new Error('No tokens on curve')

  // p_curve ≈ integer lamports/token
  const pCurve = num.div(den)
  const safetyMicros = Math.floor(1_000_000 * safety)
  const pTarget = pCurve.muln(safetyMicros).divn(1_000_000)
  if (pTarget.isZero()) throw new Error('Target price underflow')

  const solSeed = rsLamports // seed all SOL
  const tokenFromPrice = solSeed.div(pTarget)
  const tokenSeed = rtTokens.lt(tokenFromPrice) ? rtTokens : tokenFromPrice

  return { solSeed, tokenSeed }
}

// Placeholder: assemble Raydium ix datas with your external SDK
// These are opaque byte arrays expected by on-chain program
export interface RaydiumIxs {
  createIxData: Buffer
  depositIxData: Buffer
}

export function buildRaydiumIxs(_params: Record<string, unknown>): RaydiumIxs {
  // Intentionally leave SDK integration to the caller, return stubs
  return { createIxData: Buffer.alloc(0), depositIxData: Buffer.alloc(0) }
}

export type RemainingMeta = {
  pubkey: PublicKey
  isSigner: boolean
  isWritable: boolean
}

export function encodeIxData(ix: TransactionInstruction): {
  data: Buffer
  remaining: RemainingMeta[]
  programId: PublicKey
} {
  return {
    data: ix.data,
    remaining: ix.keys.map((k) => ({
      pubkey: k.pubkey,
      isSigner: k.isSigner,
      isWritable: k.isWritable,
    })),
    programId: ix.programId,
  }
}

// Build withdraw instruction via SDK and transform for our program call
export async function buildWithdrawForProgram(raydiumBuilder: {
  allInstructions: TransactionInstruction[]
}) {
  const rayIx = raydiumBuilder.allInstructions[0]
  return encodeIxData(rayIx)
}

// Build swap instruction via SDK and transform for our program call
export async function buildSwapForProgram(raydiumBuilder: {
  allInstructions: TransactionInstruction[]
}) {
  const rayIx = raydiumBuilder.allInstructions[0]
  return encodeIxData(rayIx)
}
