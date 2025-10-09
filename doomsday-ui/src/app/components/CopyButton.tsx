'use client'

import { useState } from 'react'
import { Button } from './ui/button'
import { Check, Copy } from 'lucide-react'

interface CopyButtonProps {
  value: string
  className?: string
  size?: 'sm' | 'default' | 'lg' | 'icon'
}

export function CopyButton({
  value,
  className,
  size = 'icon',
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch (e) {
      // Fallback: try legacy execCommand
      const textarea = document.createElement('textarea')
      textarea.value = value
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      try {
        document.execCommand('copy')
        setCopied(true)
        setTimeout(() => setCopied(false), 1200)
      } finally {
        document.body.removeChild(textarea)
      }
    }
  }

  return (
    <Button
      type="button"
      size={size}
      onClick={handleCopy}
      className={
        className ||
        'bg-transparent hover:bg-[#1a1f3a] text-gray-300 hover:text-white px-2'
      }
      aria-label={copied ? 'Copied' : 'Copy'}
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </Button>
  )
}
