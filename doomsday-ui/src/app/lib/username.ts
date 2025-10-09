'use client'

import type { Connection, PublicKey } from '@solana/web3.js'
import type { WalletContextState } from '@solana/wallet-adapter-react'

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function buildUsernameMessage(
  owner: PublicKey,
  username: string,
  nonce: string,
  description?: string
): Uint8Array {
  const lines = [
    'Doomsday Username',
    `Address: ${owner.toBase58()}`,
    `Username: ${username}`,
    description ? `Description: ${description}` : undefined,
    `Nonce: ${nonce}`,
  ]
  const text = lines.filter(Boolean).join('\n')
  return new TextEncoder().encode(text)
}

export async function signUsernameMessage(
  wallet: WalletContextState,
  owner: PublicKey,
  username: string,
  description?: string
): Promise<{ message: Uint8Array; signatureHex: string }> {
  if (!wallet.signMessage)
    throw new Error('Wallet does not support message signing')
  const nonce = crypto.getRandomValues(new Uint32Array(1))[0].toString(16)
  const message = buildUsernameMessage(owner, username, nonce, description)
  const signature = await wallet.signMessage!(message)
  return { message, signatureHex: toHex(signature) }
}

// Placeholder: Replace with actual on-chain fetch once program is ready
export async function fetchUsernameOnchain(
  _connection: Connection,
  _owner: PublicKey
): Promise<string | null> {
  return null
}

// Placeholder: Replace with actual on-chain transaction once program is ready
export async function saveUsernameOnchain(
  connection: Connection,
  wallet: WalletContextState,
  owner: PublicKey,
  username: string,
  description?: string
): Promise<void> {
  // For now, just sign so the flow is complete. Integrate your program here.
  await signUsernameMessage(wallet, owner, username, description)
  void connection // silence unused until integrated
}
