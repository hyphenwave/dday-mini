'use client'

import { useMemo, useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogTitle } from './ui/dialog'
import { Button } from './ui/button'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'
import { truncateAddress } from '../lib/utils'
import { CopyButton } from './CopyButton'
import * as VisuallyHidden from '@radix-ui/react-visually-hidden'

interface Props {
  open: boolean
  onClose: () => void
}

export function WalletModal({ open, onClose }: Props) {
  const {
    wallets,
    publicKey,
    connected,
    connecting,
    select,
    connect,
    disconnect,
  } = useWallet()
  const { connection } = useConnection()
  const address = useMemo(
    () => (publicKey ? publicKey.toBase58() : ''),
    [publicKey]
  )
  const [balance, setBalance] = useState<string>('0.0000')

  useEffect(() => {
    let mounted = true
    const run = async () => {
      if (publicKey) {
        const lamports = await connection.getBalance(publicKey)
        if (mounted) setBalance((lamports / LAMPORTS_PER_SOL).toFixed(4))
      } else {
        if (mounted) setBalance('0.0000')
      }
    }
    run()
    return () => {
      mounted = false
    }
  }, [publicKey, connection])

  const handleChoose = async (
    name: (typeof wallets)[number]['adapter']['name']
  ) => {
    try {
      const wallet = wallets.find((w) => w.adapter.name === name)
      if (wallet) {
        select(wallet.adapter.name)
        await Promise.resolve()
        await connect()
      } else {
        throw new Error(`Wallet with name "${name}" not found`)
      }
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#0a0f1e] text-white border-[#3BE2FF] w-[280px] max-w-[280px] p-4">
        <VisuallyHidden.Root>
          <DialogTitle>Wallet</DialogTitle>
        </VisuallyHidden.Root>
        {connected && address ? (
          <div className="space-y-4">
            <div>
              <div className="text-xs text-gray-400 mb-1">Wallet</div>
              <div className="flex items-center justify-between bg-[#050914] rounded px-2 py-1 border border-[#1a1f3a]">
                <div className="font-mono text-sm">
                  {truncateAddress(address, 8, 8)}
                </div>
                <CopyButton value={address} />
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">Balance</div>
              <div className="text-2xl text-[#3BE2FF] font-semibold">
                {balance} SOL
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                onClick={() => disconnect()}
                className="flex-1 h-10 bg-[#FF4B4B] border border-[#FF4B4B] text-white hover:bg-[#FF4B4B]/80"
              >
                Disconnect
              </Button>
              <Button
                onClick={onClose}
                className="flex-1 h-10 bg-[#3BE2FF] border border-[#3BE2FF] text-black hover:bg-[#3BE2FF]/80"
              >
                Close
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-xs text-gray-400 mb-2">Select a wallet</div>
            {wallets.map((w) => (
              <Button
                key={w.adapter.name}
                onClick={() => handleChoose(w.adapter.name)}
                disabled={connecting}
                className="w-full justify-start bg-[#1a1f3a] border border-[#3BE2FF] text-white hover:bg-[#3BE2FF]/10"
              >
                <img
                  src={w.adapter.icon}
                  alt=""
                  className="h-4 w-4 mr-2 rounded"
                />
                {w.adapter.name}
              </Button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export const walletModalController = {
  _setOpen: null as null | ((o: boolean) => void),
  open() {
    this._setOpen && this._setOpen(true)
  },
  close() {
    this._setOpen && this._setOpen(false)
  },
}

export function WalletModalProvider() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    walletModalController._setOpen = setOpen
    return () => {
      walletModalController._setOpen = null
    }
  }, [])
  return <WalletModal open={open} onClose={() => setOpen(false)} />
}
