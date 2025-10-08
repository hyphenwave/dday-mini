import * as anchor from '@coral-xyz/anchor'
import { Program, BN } from '@coral-xyz/anchor'
import {
  TOKEN_2022_PROGRAM_ID,
  createInitializeMint2Instruction,
  getMinimumBalanceForRentExemptMint,
} from '@solana/spl-token'
import { Keypair, PublicKey, SystemProgram, Transaction } from '@solana/web3.js'
import { Doomsday } from '../target/types/doomsday'

const LAMPORTS_PER_SOL = BigInt(1_000_000_000)
export const toSol = (lamports: number | bigint) =>
  (BigInt(lamports) / LAMPORTS_PER_SOL).toString() +
  '.' +
  (BigInt(lamports) % LAMPORTS_PER_SOL)
    .toString()
    .padStart(9, '0')
    .replace(/0+$/, '')

export async function solBal(connection: any, pk: any) {
  const lamports = await connection.getBalance(pk, 'finalized')
  return { lamports, sol: toSol(lamports) }
}

export async function tokenBal(connection: any, ata: any) {
  // works for Token-2022 too; if ATA doesn't exist yet, treat as zero
  try {
    const resp = await connection.getTokenAccountBalance(ata, 'finalized')
    // resp.value.amount is a string in base units
    return {
      amount: resp.value.amount,
      uiAmount: resp.value.uiAmount, // may be null if decimals unknown
      decimals: resp.value.decimals,
    }
  } catch (_) {
    return { amount: '0', uiAmount: 0, decimals: 9 }
  }
}

export async function mintInfo(connection: any, mint: any) {
  const info = await connection.getParsedAccountInfo(mint, 'confirmed')
  const data: any = info.value?.data
  const decimals = data?.parsed?.info?.decimals
  const supply = data?.parsed?.info?.supply // string (base units)
  return { decimals, supply }
}

// ---------- PDAs & bootstrap helpers ----------
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

export function derivePdas(programId: PublicKey, id: number) {
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
  const [protocolTreasuryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('PROTO_TREASURY')],
    programId
  )
  return { globalPda, countryPda, solTreasuryPda, authPda, protocolTreasuryPda }
}

export async function createMint2022(
  provider: anchor.AnchorProvider,
  mintAuthority: PublicKey,
  decimals = 9
) {
  const mint = Keypair.generate()
  const lamports = await getMinimumBalanceForRentExemptMint(provider.connection)
  const tx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: provider.wallet.publicKey,
      newAccountPubkey: mint.publicKey,
      space: 82,
      lamports,
      programId: TOKEN_2022_PROGRAM_ID,
    }),
    createInitializeMint2Instruction(
      mint.publicKey,
      decimals,
      mintAuthority,
      null,
      TOKEN_2022_PROGRAM_ID
    )
  )
  await provider.sendAndConfirm!(tx, [mint])
  return mint.publicKey
}

export async function ensureGlobalAndCountry(
  program: Program<Doomsday>,
  provider: anchor.AnchorProvider,
  id: number,
  roundEndsUnix: number
) {
  const { globalPda, countryPda, solTreasuryPda, authPda } = derivePdas(
    program.programId,
    id
  )
  const conn = provider.connection
  const globalInfo = await conn.getAccountInfo(globalPda)

  if (!globalInfo) {
    await program.methods
      .initGlobal(new BN(roundEndsUnix))
      .accounts({ authority: provider.wallet.publicKey })
      .rpc()
  }

  const countryInfo = await conn.getAccountInfo(countryPda)

  let mintPk: PublicKey | null = null
  if (!countryInfo) {
    mintPk = await createMint2022(provider, authPda, 9)
    await program.methods
      .initCountry(id, new BN(0), new BN(0))
      .accounts({ global: globalPda, mint: mintPk })
      .rpc()
  }

  return { globalPda, countryPda, solTreasuryPda, authPda, mintPk }
}
