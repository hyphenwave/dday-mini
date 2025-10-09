'use client'
import { useState, useEffect, useRef } from 'react'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { Header } from './components/Header'
import { LeftSidebar } from './components/LeftSidebar'
import { WorldMap } from './components/WorldMap'
import { Leaderboard } from './components/Leaderboard'
import { Chat } from './components/Chat'
import { Intel } from './components/Intel'
import { CountryInfoCard } from './components/CountryInfoCard'
import { BuySellModal } from './components/BuySellModal'
import { NukeLaunchModal } from './components/NukeLaunchModal'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs'
import {
  mockCountries,
  mockMessages,
  Country,
  ChatMessage,
} from './lib/mockData'
import { BarChart3, MessageSquare, Target, Wallet } from 'lucide-react'
import { useDrop, useDrag, useDragLayer } from 'react-dnd'
import { getEmptyImage } from 'react-dnd-html5-backend'

const CHAT_LOCATION_KEY = 'doomsday-chat-location'

interface DraggedChatItem {
  from: 'left' | 'right'
}

function useChatTabDrag(
  from: 'left' | 'right',
  onDragState: (dragging: boolean) => void
): (node: HTMLButtonElement | null) => void {
  const [{}, dragRef, previewRef] = useDrag(
    () => ({
      type: 'CHAT_PANEL',
      item: { from } as DraggedChatItem,
      collect: (monitor) => {
        onDragState(monitor.isDragging())
        return {}
      },
    }),
    [from, onDragState]
  )

  useEffect(() => {
    // Remove the default drag ghost; rely on subtle tab styling while dragging
    previewRef(getEmptyImage(), { captureDraggingState: true })
  }, [previewRef])

  return dragRef
}

function RightSidebar({
  activeTab,
  setActiveTab,
  countries,
  handleCountryClick,
  messages,
  handleSendMessage,
  showChatInRight,
  chatDragHandle,
  isDraggingChat,
  dragOrigin,
}: {
  activeTab: string
  setActiveTab: (tab: string) => void
  countries: Country[]
  handleCountryClick: (country: Country) => void
  messages: ChatMessage[]
  handleSendMessage: (message: string) => void
  showChatInRight: boolean
  chatDragHandle: (node: HTMLButtonElement | null) => void
  isDraggingChat: boolean
  dragOrigin: 'left' | 'right' | null
}) {
  return (
    <div className="w-96 bg-[#050914] border-l border-[#1a1f3a] flex flex-col min-h-0">
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex-1 flex flex-col min-h-0"
      >
        <TabsList className="w-full grid grid-cols-3 bg-[#0a0f1e] border-b border-[#1a1f3a] rounded-none h-14">
          <TabsTrigger
            value="leaderboard"
            className="data-[state=active]:bg-[#1a1f3a] data-[state=active]:text-[#3BE2FF] rounded-none cursor-pointer"
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Leaderboard
          </TabsTrigger>
          {showChatInRight && (
            <TabsTrigger
              value="chat"
              className="data-[state=active]:bg-[#1a1f3a] data-[state=active]:text-[#3BE2FF] rounded-none"
              ref={chatDragHandle}
              style={{
                cursor: 'grab',
                opacity: isDraggingChat ? 0.4 : 1,
                transform: isDraggingChat ? 'scale(0.98)' : undefined,
              }}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Chat
            </TabsTrigger>
          )}
          <TabsTrigger
            value="intel"
            className="data-[state=active]:bg-[#1a1f3a] data-[state=active]:text-[#3BE2FF] rounded-none cursor-pointer"
          >
            <Target className="h-4 w-4 mr-2" />
            Intel
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="leaderboard"
          className="flex-1 m-0 overflow-hidden min-h-0"
        >
          <Leaderboard
            countries={countries}
            onCountrySelect={handleCountryClick}
          />
        </TabsContent>

        {showChatInRight && (
          <TabsContent value="chat" className="flex-1 m-0 min-h-0">
            <Chat
              messages={messages}
              onSendMessage={handleSendMessage}
              isDragging={isDraggingChat && dragOrigin === 'right'}
            />
          </TabsContent>
        )}

        <TabsContent
          value="intel"
          className="flex-1 m-0 overflow-hidden min-h-0"
        >
          <Intel />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function AppContent() {
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null)
  const [tradeCountry, setTradeCountry] = useState<Country | null>(null)
  const [buySellModalOpen, setBuySellModalOpen] = useState(false)
  const [modalBaseSymbol, setModalBaseSymbol] = useState<'SOL' | 'ETH'>('ETH')
  const [nukeModalOpen, setNukeModalOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('leaderboard')
  const [messages, setMessages] = useState<ChatMessage[]>(mockMessages)

  const [chatLocation, setChatLocation] = useState<'left' | 'right'>('right')
  const [isDraggingChat, setIsDraggingChat] = useState(false)
  const [dragOrigin, setDragOrigin] = useState<'left' | 'right' | null>(null)
  const chatPreviewRef = useRef<HTMLDivElement | null>(null)

  const dragRightRef = useChatTabDrag('right', (dragging) => {
    setIsDraggingChat(dragging)
    setDragOrigin(dragging ? 'right' : null)
  })
  const dragLeftRef = useChatTabDrag('left', (dragging) => {
    setIsDraggingChat(dragging)
    setDragOrigin(dragging ? 'left' : null)
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = window.localStorage.getItem(CHAT_LOCATION_KEY)
    if (saved === 'left' || saved === 'right') {
      setChatLocation(saved)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(CHAT_LOCATION_KEY, chatLocation)
  }, [chatLocation])

  // Round end time (24 hours from now)
  const roundEndTime = new Date(Date.now() + 24 * 60 * 60 * 1000)

  const handleCountryClick = (country: Country) => {
    setSelectedCountry(country)
  }

  const handleCloseCountryCard = () => {
    setSelectedCountry(null)
  }

  const handleBuySell = () => {
    setTradeCountry(selectedCountry)
    setBuySellModalOpen(true)
  }

  const openSwapFromBadge = () => {
    // Open swap with SOL as base and a default country without affecting selectedCountry
    setModalBaseSymbol('SOL')
    const defaultCountry =
      tradeCountry ??
      selectedCountry ??
      (mockCountries.length > 0 ? mockCountries[0] : null)
    setTradeCountry(defaultCountry)
    setBuySellModalOpen(true)
  }

  const handleNuke = () => {
    setNukeModalOpen(true)
  }

  const handleViewChat = () => {
    if (chatLocation === 'right') {
      setActiveTab('chat')
    }
  }

  const handleDragToLeft = () => {
    setChatLocation('left')
    // When chat leaves the right sidebar, ensure the right sidebar shows a valid tab
    setActiveTab('leaderboard')
  }

  const handleDragToRight = () => {
    setChatLocation('right')
    // When chat arrives on right, switch to chat tab for visibility
    setActiveTab('chat')
  }

  const handleSendMessage = (message: string) => {
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      author: 'You',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=You',
      role: 'Citizen',
      message,
      timestamp: new Date(),
    }
    setMessages([...messages, newMessage])
  }

  // Drop zone for moving chat to left sidebar
  const [{ isOverLeft }, dropLeftRef] = useDrop(
    () => ({
      accept: 'CHAT_PANEL',
      drop: (item: { from: 'left' | 'right' } | undefined) => {
        handleDragToLeft()
      },
      collect: (monitor) => ({
        isOverLeft: monitor.isOver(),
      }),
    }),
    []
  )

  // Drop zone for moving chat back to right sidebar
  const [{ isOverRight }, dropRightRef] = useDrop(
    () => ({
      accept: 'CHAT_PANEL',
      drop: (item: { from: 'left' | 'right' } | undefined) => {
        handleDragToRight()
      },
      collect: (monitor) => ({
        isOverRight: monitor.isOver(),
      }),
    }),
    []
  )

  return (
    <div className="h-screen w-screen bg-[#050914] flex flex-col overflow-hidden">
      {/* Header */}
      <Header roundEndTime={roundEndTime} />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <div
          ref={(node) => {
            dropLeftRef(node)
          }}
          className="relative flex flex-col min-h-0"
          style={{
            backgroundColor: isOverLeft
              ? 'rgba(59, 226, 255, 0.15)'
              : 'transparent',
            transition: 'background-color 0.2s ease',
            border: isOverLeft
              ? '1px solid rgba(59, 226, 255, 0.3)'
              : '1px solid transparent',
            boxShadow: isOverLeft
              ? '0 0 20px rgba(59, 226, 255, 0.25)'
              : 'none',
          }}
        >
          <LeftSidebar
            showChat={chatLocation === 'left'}
            messages={messages}
            onSendMessage={handleSendMessage}
            chatLocation={chatLocation}
            dragLeftRef={dragLeftRef}
            dragRightRef={dragRightRef}
            isDragging={isDraggingChat}
            key={`left-${chatLocation}`}
          />
        </div>

        {/* Map Area */}
        <div className="flex-1 relative bg-black min-h-0">
          <WorldMap
            countries={mockCountries}
            onCountryClick={handleCountryClick}
            selectedCountry={selectedCountry}
          />

          {/* Country Info Card */}
          {selectedCountry && (
            <CountryInfoCard
              country={selectedCountry}
              onBuySell={handleBuySell}
              onNuke={handleNuke}
              onViewChat={handleViewChat}
              onClose={handleCloseCountryCard}
            />
          )}

          {/* Bottom Wallet Display */}
          <div
            className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-[#0a0f1e] border border-[#3BE2FF] rounded-xl px-5 py-3 shadow-xl"
            style={{ minWidth: 340 }}
          >
            <div className="text-[#3BE2FF] text-sm font-mono text-center">
              0xc8C1c63b.....10A47930A
            </div>
            <button
              onClick={openSwapFromBadge}
              className="mt-2 w-full bg-[#3BE2FF] text-black text-sm py-2 rounded-lg cursor-pointer hover:bg-[#3BE2FF]/85"
            >
              Swap
            </button>
          </div>
        </div>

        {/* Right Sidebar - Tabs */}
        <div
          ref={(node) => {
            dropRightRef(node)
          }}
          className="relative flex flex-col min-h-0"
          style={{
            backgroundColor: isOverRight
              ? 'rgba(59, 226, 255, 0.15)'
              : 'transparent',
            transition: 'background-color 0.2s ease',
            border: isOverRight
              ? '1px solid rgba(59, 226, 255, 0.3)'
              : '1px solid transparent',
            boxShadow: isOverRight
              ? '0 0 20px rgba(59, 226, 255, 0.25)'
              : 'none',
          }}
        >
          <RightSidebar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            countries={mockCountries}
            handleCountryClick={handleCountryClick}
            messages={messages}
            handleSendMessage={handleSendMessage}
            showChatInRight={chatLocation === 'right'}
            chatDragHandle={dragRightRef}
            isDraggingChat={isDraggingChat}
            dragOrigin={dragOrigin}
            key={`right-${chatLocation}`}
          />
        </div>
      </div>

      {/* Modals */}
      <BuySellModal
        country={tradeCountry}
        open={buySellModalOpen}
        onClose={() => setBuySellModalOpen(false)}
        onCountryChange={setTradeCountry}
        baseSymbol={modalBaseSymbol}
      />

      <NukeLaunchModal
        country={selectedCountry}
        open={nukeModalOpen}
        onClose={() => setNukeModalOpen(false)}
        onLaunch={() => {
          console.log('Nuke launched at', selectedCountry?.name)
        }}
      />

      {/* Minimal drag preview chip */}
      <MiniDragPreview />
    </div>
  )
}

export default function App() {
  return (
    <DndProvider backend={HTML5Backend}>
      <AppContent />
    </DndProvider>
  )
}

function MiniDragPreview() {
  const { isDragging, itemType, clientOffset } = useDragLayer((monitor) => ({
    isDragging: monitor.isDragging(),
    itemType: monitor.getItemType(),
    clientOffset: monitor.getClientOffset(),
  }))

  if (!isDragging || itemType !== 'CHAT_PANEL' || !clientOffset) return null

  const style: React.CSSProperties = {
    position: 'fixed',
    left: clientOffset.x + 10, // slight offset so it appears next to the cursor
    top: clientOffset.y + 12,
    pointerEvents: 'none',
    zIndex: 9999,
  }

  return (
    <div
      style={style}
      className="px-2 py-1 rounded-full bg-[#0a0f1e]/90 border border-[#3BE2FF] text-[#3BE2FF] text-xs shadow-lg flex items-center gap-1"
    >
      <MessageSquare className="h-3.5 w-3.5" />
      Chat
    </div>
  )
}
