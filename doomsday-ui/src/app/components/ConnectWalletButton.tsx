'use client'

import { useCallback, useMemo, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { Button } from './ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from './ui/dropdown-menu'
import { Copy, LogOut, Wallet as WalletIcon } from 'lucide-react'
import { truncateAddress } from '../lib/utils'

export function ConnectWalletButton({
  forceOpen,
}: { forceOpen?: boolean } = {}) {
  const {
    wallets,
    connected,
    connecting,
    publicKey,
    select,
    connect,
    disconnect,
  } = useWallet()
  const [open, setOpen] = useState(false)

  // Allow external trigger to open wallet picker (e.g., from Swap)
  if (forceOpen && !open) {
    setTimeout(() => setOpen(true), 0)
  }
  const address = useMemo(
    () => (publicKey ? publicKey.toBase58() : ''),
    [publicKey]
  )

  const handleChooseWallet = useCallback(
    async (name: string) => {
      try {
        select(name)
        await connect()
        setOpen(false)
      } catch (e) {
        console.error('Wallet connect error:', e)
      }
    },
    [select, connect]
  )

  const handleDisconnect = useCallback(async () => {
    try {
      await disconnect()
      setOpen(false)
    } catch (e) {
      console.error('Wallet disconnect error:', e)
    }
  }, [disconnect])

  if (connected && address) {
    return (
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="bg-[#1a1f3a] border-[#3BE2FF] text-[#3BE2FF] hover:bg-[#3BE2FF]/10"
          >
            <WalletIcon className="h-4 w-4 mr-2" />
            {truncateAddress(address)}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-56 bg-[#0a0f1e] text-white border-[#1a1f3a]"
        >
          <DropdownMenuLabel className="text-xs text-gray-400">
            Connected
          </DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => navigator.clipboard.writeText(address)}
            className="cursor-pointer focus:bg-[#1a1f3a]"
          >
            <Copy className="h-4 w-4 mr-2" /> Copy address
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-[#1a1f3a]" />
          <DropdownMenuItem
            onClick={handleDisconnect}
            className="text-red-400 focus:bg-[#1a1f3a] cursor-pointer"
          >
            <LogOut className="h-4 w-4 mr-2" /> Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="bg-[#1a1f3a] border-[#3BE2FF] text-[#3BE2FF] hover:bg-[#3BE2FF]/10"
          disabled={connecting}
        >
          Connect Wallet
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-64 bg-[#0a0f1e] text-white border-[#1a1f3a]"
      >
        <DropdownMenuLabel className="text-xs text-gray-400">
          Select a wallet
        </DropdownMenuLabel>
        {wallets.map((w) => (
          <DropdownMenuItem
            key={w.adapter.name}
            onClick={() => handleChooseWallet(w.adapter.name)}
            className="cursor-pointer focus:bg-[#1a1f3a]"
          >
            <img src={w.adapter.icon} alt="" className="h-4 w-4 mr-2 rounded" />
            <span className="flex-1">{w.adapter.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
