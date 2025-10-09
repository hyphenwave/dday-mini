'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from './ui/dialog'
import * as VisuallyHidden from '@radix-ui/react-visually-hidden'
import { Button } from './ui/button'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { saveUsernameOnchain } from '../lib/username'

interface Props {
  open: boolean
  onClose: () => void
  onSaved?: (username: string) => void
}

export function UsernameModal({ open, onClose, onSaved }: Props) {
  const [username, setUsername] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const wallet = useWallet()
  const { publicKey, signMessage } = wallet
  const { connection } = useConnection()

  const usernameLength = username.trim().length
  const isUsernameValid = usernameLength >= 2 && usernameLength <= 15
  const canSubmit = !!publicKey && !!signMessage && isUsernameValid

  const onSubmit = async () => {
    if (!publicKey || !signMessage) return
    try {
      setSubmitting(true)
      await saveUsernameOnchain(connection, wallet, publicKey, username.trim())
      onSaved && onSaved(username.trim())
      onClose()
    } catch (e) {
      console.error(e)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#0a0f1e] border border-[#3BE2FF] text-white w-[280px] max-w-[280px] p-4">
        <VisuallyHidden.Root>
          <DialogTitle>Set Username</DialogTitle>
          <DialogDescription>
            Sign a message to set your username
          </DialogDescription>
        </VisuallyHidden.Root>
        <div className="space-y-3">
          <div className="text-sm text-gray-400">Choose a Username</div>
          <div className="text-xs text-gray-400">
            Please enter between 2 and 15 characters.
          </div>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter username"
            className="w-full bg-[#111425] border border-[#1a1f3a] rounded px-3 py-2 outline-none"
          />
          <Button
            onClick={onSubmit}
            disabled={!canSubmit || submitting}
            className="w-full h-10 bg-[#3BE2FF] text-black hover:bg-[#3BE2FF]/80 disabled:opacity-50"
          >
            {submitting ? 'Signing…' : 'Sign & Save'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
