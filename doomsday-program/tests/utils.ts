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
