import { Button } from './ui/button'
import { Settings } from 'lucide-react'
import { SettingsModal } from './SettingsModal'
import { useEffect, useState } from 'react'
import { ConnectWalletButton } from './ConnectWalletButton'
import { useWallet, useConnection } from '@solana/wallet-adapter-react'
import { LAMPORTS_PER_SOL } from '@solana/web3.js'

interface HeaderProps {
  roundEndTime: Date
}

export function Header({ roundEndTime }: HeaderProps) {
  const [timeRemaining, setTimeRemaining] = useState('')
  const { publicKey } = useWallet()
  const { connection } = useConnection()
  const [solBalance, setSolBalance] = useState<string>('0.0000')

  useEffect(() => {
    let mounted = true
    const fetchBalance = async () => {
      try {
        if (publicKey) {
          const lamports = await connection.getBalance(publicKey)
          if (mounted) setSolBalance((lamports / LAMPORTS_PER_SOL).toFixed(4))
        } else {
          if (mounted) setSolBalance('0.0000')
        }
      } catch (e) {
        console.error('balance error', e)
      }
    }
    fetchBalance()
    return () => {
      mounted = false
    }
  }, [publicKey, connection])
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date().getTime()
      const distance = roundEndTime.getTime() - now

      if (distance < 0) {
        setTimeRemaining('ROUND ENDED')
        return
      }

      const days = Math.floor(distance / (1000 * 60 * 60 * 24))
      const hours = Math.floor(
        (distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
      )
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((distance % (1000 * 60)) / 1000)

      setTimeRemaining(`${days}d ${hours}h ${minutes}m ${seconds}s`)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)

    return () => clearInterval(interval)
  }, [roundEndTime])

  return (
    <header className="h-20 border-b border-[#1a1f3a] bg-[#050914] flex items-center justify-between px-6">
      {/* Left: Logo and Round */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <h1 className="text-[#3BE2FF] tracking-tight">DOOMSDAY</h1>
          <div className="bg-[#1a1f3a] px-3 py-1 rounded">
            <span className="text-[#3BE2FF] text-sm">EPOCH: 9</span>
          </div>
        </div>
      </div>

      {/* Center: Countdown Timer */}
      <div className="flex flex-col items-center">
        <div className="text-xs text-gray-400 mb-1">ROUND ENDS IN</div>
        <div className="text-2xl text-white tracking-wider font-mono">
          {timeRemaining}
        </div>
      </div>

      {/* Right: Wallet and Settings */}
      <div className="flex items-center gap-3">
        {publicKey && (
          <div className="flex flex-col items-end">
            <div className="text-xs text-gray-400">Balance</div>
            <div className="text-white">{solBalance} SOL</div>
          </div>
        )}
        <ConnectWalletButton forceOpen={false} />
        <Button
          variant="ghost"
          size="icon"
          className="text-gray-400 hover:text-white"
          onClick={() => setSettingsOpen(true)}
        >
          <Settings className="h-5 w-5" />
        </Button>
      </div>
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </header>
  )
}
