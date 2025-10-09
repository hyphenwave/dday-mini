import { mockCountries, ChatMessage } from '../lib/mockData'
import { ScrollArea } from './ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { Wallet, MessageSquare } from 'lucide-react'
import { Chat } from './Chat'

interface LeftSidebarProps {
  showChat?: boolean
  messages?: ChatMessage[]
  onSendMessage?: (message: string) => void
  chatLocation: 'left' | 'right'
  dragLeftRef: (node: HTMLButtonElement | null) => void
  dragRightRef: (node: HTMLButtonElement | null) => void
  isDragging: boolean
}

export function LeftSidebar({
  showChat = false,
  messages = [],
  onSendMessage,
  chatLocation,
  dragLeftRef,
  dragRightRef,
  isDragging,
}: LeftSidebarProps) {
  if (showChat) {
    return (
      <div className="w-80 bg-[#050914] border-r border-[#1a1f3a] flex flex-col min-h-0">
        <Tabs
          key="left-with-chat"
          defaultValue="chat"
          className="flex-1 flex flex-col min-h-0"
        >
          <TabsList className="w-full grid grid-cols-2 bg-[#0a0f1e] border-b border-[#1a1f3a] rounded-none h-14">
            <TabsTrigger
              value="wallet"
              className="data-[state=active]:bg-[#1a1f3a] data-[state=active]:text-[#3BE2FF] rounded-none cursor-pointer"
            >
              <Wallet className="h-4 w-4 mr-2" />
              Wallet
            </TabsTrigger>
            <TabsTrigger
              value="chat"
              ref={dragLeftRef}
              style={{ cursor: 'grab', opacity: isDragging ? 0.4 : 1 }}
              className="data-[state=active]:bg-[#1a1f3a] data-[state=active]:text-[#3BE2FF] rounded-none"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Chat
            </TabsTrigger>
          </TabsList>

          <TabsContent value="wallet" className="flex-1 m-0 min-h-0">
            <WalletContent />
          </TabsContent>

          <TabsContent value="chat" className="flex-1 m-0 min-h-0">
            <Chat
              messages={messages}
              onSendMessage={onSendMessage}
              isDragging={isDragging}
            />
          </TabsContent>
        </Tabs>
      </div>
    )
  }

  return (
    <div className="w-64 bg-[#050914] border-r border-[#1a1f3a] flex flex-col">
      <Tabs
        key="left-wallet-only"
        defaultValue="wallet"
        className="flex-1 flex flex-col min-h-0"
      >
        <TabsList className="w-full grid grid-cols-1 bg-[#0a0f1e] border-b border-[#1a1f3a] rounded-none h-14">
          <TabsTrigger
            value="wallet"
            className="data-[state=active]:bg-[#1a1f3a] data-[state=active]:text-[#3BE2FF] rounded-none cursor-pointer"
          >
            <Wallet className="h-4 w-4 mr-2" />
            Wallet
          </TabsTrigger>
        </TabsList>
        <TabsContent value="wallet" className="flex-1 m-0 overflow-hidden">
          <WalletContent />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function WalletContent() {
  return (
    <>
      {/* Top Info */}
      <div className="p-4 border-b border-[#1a1f3a]">
        <div className="space-y-3">
          <div>
            <div className="text-xs text-gray-400 mb-1">Your Wallet</div>
            <div className="text-[#3BE2FF] text-sm font-mono truncate">
              0xc8C1c63b.....10A47930A
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-[#1a1f3a] rounded p-2">
              <div className="text-xs text-gray-400">EPOCH</div>
              <div className="text-[#3BE2FF]">9</div>
            </div>
            <div className="bg-[#1a1f3a] rounded p-2">
              <div className="text-xs text-gray-400">Countries</div>
              <div className="text-white">211</div>
            </div>
          </div>
          <div className="bg-[#1a1f3a] rounded p-2">
            <div className="text-xs text-gray-400">World Population</div>
            <div className="text-white">300m</div>
          </div>
        </div>
      </div>

      {/* Citizen of Section */}
      <div className="p-4 border-b border-[#1a1f3a]">
        <div className="text-xs text-gray-400 mb-3">CITIZEN OF:</div>
        <ScrollArea className="h-48">
          <div className="space-y-2">
            {mockCountries.slice(0, 6).map((country) => (
              <div
                key={country.id}
                className="flex items-center justify-between text-sm"
              >
                <div className="flex items-center gap-2">
                  <span>{country.flag}</span>
                  <span className="text-white">{country.name}</span>
                </div>
                <span className="text-[#3BE2FF]">0.2%</span>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </>
  )
}
