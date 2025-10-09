'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from './ui/dialog'
import * as VisuallyHidden from '@radix-ui/react-visually-hidden'
import { Switch } from './ui/switch'

interface Props {
  open: boolean
  onClose: () => void
}

export function SettingsModal({ open, onClose }: Props) {
  const [cluster, setCluster] = useState('mainnet-beta')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const c = localStorage.getItem('solana-cluster') || 'mainnet-beta'
    setCluster(c)
  }, [open])

  const onToggle = (checked: boolean) => {
    const next = checked ? 'devnet' : 'mainnet-beta'
    setCluster(next)
    if (typeof window !== 'undefined') {
      localStorage.setItem('solana-cluster', next)
      window.location.reload()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#0a0f1e] text-white border-[#3BE2FF] w-[280px] max-w-[280px] p-3">
        <VisuallyHidden.Root>
          <DialogTitle>Settings</DialogTitle>
        </VisuallyHidden.Root>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-400">Use Devnet</div>
            <div className="text-xs text-gray-500">Toggle and reload</div>
          </div>
          <Switch
            checked={cluster === 'devnet'}
            onCheckedChange={onToggle}
            className="data-[state=checked]:bg-[#3BE2FF] data-[state=unchecked]:bg-[#1a1f3a]"
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
