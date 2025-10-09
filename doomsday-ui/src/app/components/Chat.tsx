import { useState } from 'react'
import { ChatMessage, mockCountries } from '../lib/mockData'
import { ScrollArea } from './ui/scroll-area'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Send, Smile, AlertTriangle, ChevronDown } from 'lucide-react'
import { Badge } from './ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'

interface ChatProps {
  messages: ChatMessage[]
  onSendMessage?: (message: string) => void
  panelRef?: (node: HTMLDivElement | null) => void
  isDragging?: boolean
}

export function Chat({
  messages,
  onSendMessage,
  panelRef,
  isDragging,
}: ChatProps) {
  const [selectedChannel, setSelectedChannel] = useState<string>('global')
  const [messageText, setMessageText] = useState('')
  const [hasInsufficientBalance, setHasInsufficientBalance] = useState(false)

  const handleSend = () => {
    if (messageText.trim() && onSendMessage) {
      onSendMessage(messageText)
      setMessageText('')
    }
  }

  const formatTime = (date: Date) => {
    const hours = date.getHours().toString().padStart(2, '0')
    const minutes = date.getMinutes().toString().padStart(2, '0')
    return `${hours}:${minutes}`
  }

  // Get channel display name
  const getChannelName = () => {
    if (selectedChannel === 'global') return '🌍 Global Chat'
    const country = mockCountries.find((c) => c.id === selectedChannel)
    return country ? `${country.flag} ${country.name}` : 'Global Chat'
  }

  // Filter messages based on channel
  const filteredMessages =
    selectedChannel === 'global'
      ? messages
      : messages.filter((msg) => msg.country?.toLowerCase() === selectedChannel)

  return (
    <div
      ref={panelRef}
      className="h-full flex flex-col min-h-0"
      style={isDragging ? { opacity: 0.6 } : undefined}
    >
      {/* Channel Selector */}
      <div className="p-3 border-b border-[#1a1f3a]">
        <DropdownMenu>
          <DropdownMenuTrigger className="w-full flex items-center justify-between bg-[#0a0f1e] rounded-lg px-4 py-2 hover:bg-[#1a1f3a] transition-colors">
            <span className="text-white text-sm">{getChannelName()}</span>
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-56 bg-[#0a0f1e] border-[#3BE2FF] text-white"
            align="start"
          >
            <DropdownMenuItem
              onClick={() => setSelectedChannel('global')}
              className={`cursor-pointer ${
                selectedChannel === 'global' ? 'bg-[#1a1f3a]' : ''
              } focus:bg-[#1a1f3a] focus:text-white`}
            >
              <span className="mr-2">🌍</span>
              Global Chat
            </DropdownMenuItem>
            <div className="px-2 py-1.5 text-xs text-gray-400">
              COUNTRY CHATS
            </div>
            {mockCountries.map((country) => (
              <DropdownMenuItem
                key={country.id}
                onClick={() => setSelectedChannel(country.id)}
                className={`cursor-pointer ${
                  selectedChannel === country.id ? 'bg-[#1a1f3a]' : ''
                } focus:bg-[#1a1f3a] focus:text-white`}
              >
                <span className="mr-2">{country.flag}</span>
                {country.name}
                <Badge
                  variant="outline"
                  className="ml-auto text-xs border-[#3BE2FF] text-[#3BE2FF]"
                >
                  Token Gated
                </Badge>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-4">
          {filteredMessages.length === 0 && selectedChannel !== 'global' && (
            <div className="text-center text-gray-500 text-sm py-8">
              No messages in this channel yet. Be the first to chat!
            </div>
          )}
          {filteredMessages.map((msg) => (
            <div key={msg.id} className="flex gap-3">
              {/* Avatar */}
              <img
                src={msg.avatar}
                alt={msg.author}
                className="w-8 h-8 rounded-full flex-shrink-0"
              />

              {/* Message Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white text-sm">{msg.author}</span>
                  <Badge
                    variant="outline"
                    className={`text-xs px-1.5 py-0 ${
                      msg.role === 'President'
                        ? 'border-[#F9C80E] text-[#F9C80E]'
                        : 'border-gray-600 text-gray-400'
                    }`}
                  >
                    {msg.role}
                  </Badge>
                  <span className="text-xs text-gray-500">
                    {formatTime(msg.timestamp)}
                  </span>
                </div>
                <div className="text-sm text-gray-300">{msg.message}</div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Access Control Banner */}
      {hasInsufficientBalance && selectedChannel !== 'global' && (
        <div className="px-4 py-2 bg-[#FF4B4B]/10 border-t border-[#FF4B4B]/20">
          <div className="flex items-center gap-2 text-xs text-[#FF4B4B]">
            <AlertTriangle className="h-4 w-4" />
            <span>
              You need to hold {getChannelName()} tokens to chat. Buy tokens to
              participate.
            </span>
          </div>
        </div>
      )}

      {/* Message Composer */}
      <div className="p-4 border-t border-[#1a1f3a]">
        <div className="flex gap-2">
          <Input
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSend()
            }}
            placeholder={
              hasInsufficientBalance && selectedChannel !== 'global'
                ? 'Hold tokens to chat...'
                : 'Type a message...'
            }
            disabled={hasInsufficientBalance && selectedChannel !== 'global'}
            className="bg-[#0a0f1e] border-[#1a1f3a] text-white placeholder:text-gray-600"
          />
          <Button
            variant="ghost"
            size="icon"
            className="text-gray-400 hover:text-white"
            disabled={hasInsufficientBalance && selectedChannel !== 'global'}
          >
            <Smile className="h-5 w-5" />
          </Button>
          <Button
            onClick={handleSend}
            disabled={
              !messageText.trim() ||
              (hasInsufficientBalance && selectedChannel !== 'global')
            }
            className="bg-[#3BE2FF] text-black hover:bg-[#3BE2FF]/80"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
            <input type="checkbox" className="rounded border-gray-600" />
            <span>Send nuke alert with message</span>
          </label>
        </div>
      </div>
    </div>
  )
}
