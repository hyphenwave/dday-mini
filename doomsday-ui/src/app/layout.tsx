import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { SolanaWalletProviders } from './providers/solana-wallet'
import { WalletModalProvider } from './components/WalletModal'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Doomsday PvP - Solana Game',
  description:
    '211 countries compete for the highest market cap in this Solana-based PvP game',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SolanaWalletProviders>
          {children}
          <WalletModalProvider />
        </SolanaWalletProviders>
      </body>
    </html>
  )
}
