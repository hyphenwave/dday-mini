'use client'

import { useMemo } from 'react'
import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react'
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom'
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare'

type Props = { children: React.ReactNode; endpoint?: string }

export function SolanaWalletProviders({ children, endpoint }: Props) {
  const cluster =
    typeof window !== 'undefined'
      ? localStorage.getItem('solana-cluster') || 'mainnet-beta'
      : 'mainnet-beta'

  const rpc = useMemo(() => {
    if (endpoint) return endpoint
    if (cluster === 'devnet') {
      return (
        process.env.NEXT_PUBLIC_RPC_URL_DEVNET ||
        'https://api.devnet.solana.com'
      )
    }
    return (
      process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com'
    )
  }, [endpoint, cluster])

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter({
        /*network: 'mainnet-beta' */
      }),
    ],
    []
  )

  return (
    <ConnectionProvider endpoint={rpc}>
      <WalletProvider wallets={wallets} autoConnect>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  )
}
