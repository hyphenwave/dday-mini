import { Connection, PublicKey } from '@solana/web3.js'
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token'

export type TopHolder = {
  owner: PublicKey
  tokenAccount: PublicKey
  amountRaw: bigint
}

export type FindTopHolderOpts = {
  excludeTokenAccounts?: Set<string>
  excludeOwners?: Set<string>
  preferToken2022?: boolean
}

/**
 * Returns the owner of the largest single token account for a mint, honoring excludes.
 */
export async function findTopHolderForMint(
  connection: Connection,
  mint: PublicKey,
  opts: FindTopHolderOpts = {}
): Promise<TopHolder | null> {
  const {
    excludeTokenAccounts = new Set<string>(),
    excludeOwners = new Set<string>(),
    preferToken2022 = true,
  } = opts

  const programIds = preferToken2022
    ? [TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID]
    : [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]

  for (const programId of programIds) {
    try {
      // web3.js types don't expose the programId overload in typings; use any-cast
      const largest = await (connection as any).getTokenLargestAccounts(mint, {
        programId,
      })
      if (!largest?.value?.length) continue

      for (const entry of largest.value) {
        const tokenAccPubkey = new PublicKey(entry.address)
        if (excludeTokenAccounts.has(tokenAccPubkey.toBase58())) continue

        const amountRaw = BigInt(entry.amount ?? '0')
        if (amountRaw === 0n) continue

        const acctInfo = await connection.getParsedAccountInfo(tokenAccPubkey)
        const parsed: any = acctInfo.value?.data
        const ownerStr: string | undefined =
          parsed?.parsed?.info?.owner || parsed?.info?.owner
        if (!ownerStr) continue
        if (excludeOwners.has(ownerStr)) continue

        const owner = new PublicKey(ownerStr)
        return { owner, tokenAccount: tokenAccPubkey, amountRaw }
      }
    } catch {
      // try next program id
      continue
    }
  }

  return null
}
