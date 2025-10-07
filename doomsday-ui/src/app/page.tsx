'use client'

import { useState, useEffect } from 'react'
import { Connection, PublicKey } from '@solana/web3.js'
import { AnchorProvider, Program } from '@coral-xyz/anchor'
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'

// Mock data for demonstration
const mockCountries = [
  {
    id: 1,
    name: 'United States',
    marketCap: 1500000,
    president: '0x123...',
    isActive: true,
    hasNuke: false,
  },
  {
    id: 2,
    name: 'China',
    marketCap: 1200000,
    president: '0x456...',
    isActive: true,
    hasNuke: false,
  },
  {
    id: 3,
    name: 'Germany',
    marketCap: 800000,
    president: '0x789...',
    isActive: true,
    hasNuke: false,
  },
  {
    id: 4,
    name: 'Japan',
    marketCap: 750000,
    president: '0xabc...',
    isActive: true,
    hasNuke: false,
  },
  {
    id: 5,
    name: 'United Kingdom',
    marketCap: 600000,
    president: '0xdef...',
    isActive: true,
    hasNuke: false,
  },
]

const mockChatMessages = [
  {
    id: 1,
    sender: '0x123...',
    message: 'USA is dominating this round! 🇺🇸',
    countryId: 1,
    timestamp: Date.now() - 1000,
  },
  {
    id: 2,
    sender: '0x456...',
    message: 'China will rise! 🐉',
    countryId: 2,
    timestamp: Date.now() - 2000,
  },
  {
    id: 3,
    sender: '0x789...',
    message: 'Germany strong! 🇩🇪',
    countryId: 3,
    timestamp: Date.now() - 3000,
  },
]

export default function WorldPvP() {
  const { publicKey, connected } = useWallet()
  const [selectedCountry, setSelectedCountry] = useState<number | null>(null)
  const [chatMessage, setChatMessage] = useState('')
  const [selectedChatChannel, setSelectedChatChannel] = useState('global')
  const [countries, setCountries] = useState(mockCountries)
  const [chatMessages, setChatMessages] = useState(mockChatMessages)
  const [gameStats, setGameStats] = useState({
    currentRound: 1,
    roundTimeLeft: 29 * 24 * 60 * 60, // 29 days in seconds
    activeCountries: 211,
    totalCountries: 211,
  })

  const handleBuyTokens = (countryId: number, amount: number) => {
    // In a real implementation, this would call the Solana program
    console.log(`Buying ${amount} tokens for country ${countryId}`)
    // Update local state for demo
    setCountries((prev) =>
      prev.map((country) =>
        country.id === countryId
          ? { ...country, marketCap: country.marketCap + amount * 100 }
          : country
      )
    )
  }

  const handleSendMessage = () => {
    if (!chatMessage.trim()) return

    const newMessage = {
      id: Date.now(),
      sender: publicKey?.toString().slice(0, 8) + '...' || 'Anonymous',
      message: chatMessage,
      countryId:
        selectedChatChannel === 'global' ? null : parseInt(selectedChatChannel),
      timestamp: Date.now(),
    }

    setChatMessages((prev) => [newMessage, ...prev])
    setChatMessage('')
  }

  const formatTimeLeft = (seconds: number) => {
    const days = Math.floor(seconds / (24 * 60 * 60))
    const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60))
    const minutes = Math.floor((seconds % (60 * 60)) / 60)
    return `${days}d ${hours}h ${minutes}m`
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 text-white">
      {/* Header */}
      <header className="bg-black/20 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold">🌍 World PvP</h1>
              <div className="hidden sm:flex items-center space-x-6 text-sm">
                <div>Round {gameStats.currentRound}</div>
                <div>⏰ {formatTimeLeft(gameStats.roundTimeLeft)}</div>
                <div>
                  🌎 {gameStats.activeCountries}/{gameStats.totalCountries}{' '}
                  Countries
                </div>
              </div>
            </div>
            <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700" />
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Game Area */}
          <div className="lg:col-span-3 space-y-6">
            {/* World Map */}
            <div className="bg-black/20 backdrop-blur-sm rounded-xl p-6 border border-white/10">
              <h2 className="text-xl font-bold mb-4">🗺️ World Map</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {countries.slice(0, 20).map((country) => (
                  <div
                    key={country.id}
                    className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedCountry === country.id
                        ? 'border-yellow-400 bg-yellow-400/20'
                        : 'border-white/20 hover:border-white/40'
                    } ${!country.isActive ? 'opacity-50' : ''}`}
                    onClick={() => setSelectedCountry(country.id)}
                  >
                    <div className="text-center">
                      <div className="text-2xl mb-2">
                        {country.hasNuke ? '💣' : '🏴'}
                      </div>
                      <div className="font-semibold text-sm">
                        {country.name}
                      </div>
                      <div className="text-xs text-gray-300">
                        ${(country.marketCap / 1000).toFixed(0)}k
                      </div>
                      {country.president && (
                        <div className="text-xs text-yellow-400 mt-1">
                          👑 {country.president.slice(0, 6)}...
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Country Details */}
            {selectedCountry && (
              <div className="bg-black/20 backdrop-blur-sm rounded-xl p-6 border border-white/10">
                <h3 className="text-lg font-bold mb-4">
                  {countries.find((c) => c.id === selectedCountry)?.name}{' '}
                  Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold mb-2">Token Information</h4>
                    <div className="space-y-2 text-sm">
                      <div>
                        Market Cap: $
                        {countries
                          .find((c) => c.id === selectedCountry)
                          ?.marketCap.toLocaleString()}
                      </div>
                      <div>
                        Status:{' '}
                        {countries.find((c) => c.id === selectedCountry)
                          ?.isActive
                          ? 'Active'
                          : 'Eliminated'}
                      </div>
                      <div>
                        President:{' '}
                        {
                          countries.find((c) => c.id === selectedCountry)
                            ?.president
                        }
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Buy Tokens</h4>
                    <div className="space-y-3">
                      <input
                        type="number"
                        placeholder="Amount"
                        className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-300"
                      />
                      <button
                        onClick={() => handleBuyTokens(selectedCountry, 1000)}
                        className="w-full bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg font-semibold transition-colors"
                        disabled={!connected}
                      >
                        Buy Tokens
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Leaderboard */}
            <div className="bg-black/20 backdrop-blur-sm rounded-xl p-6 border border-white/10">
              <h3 className="text-lg font-bold mb-4">🏆 Leaderboard</h3>
              <div className="space-y-3">
                {countries
                  .sort((a, b) => b.marketCap - a.marketCap)
                  .slice(0, 10)
                  .map((country, index) => (
                    <div
                      key={country.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <div className="flex items-center space-x-2">
                        <span className="font-bold">#{index + 1}</span>
                        <span>{country.name}</span>
                        {country.hasNuke && <span>💣</span>}
                      </div>
                      <span className="text-gray-300">
                        ${(country.marketCap / 1000).toFixed(0)}k
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Chat */}
            <div className="bg-black/20 backdrop-blur-sm rounded-xl p-6 border border-white/10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold">💬 Chat</h3>
                <select
                  value={selectedChatChannel}
                  onChange={(e) => setSelectedChatChannel(e.target.value)}
                  className="bg-white/10 border border-white/20 rounded px-2 py-1 text-sm"
                >
                  <option value="global">Global</option>
                  {countries.slice(0, 5).map((country) => (
                    <option key={country.id} value={country.id.toString()}>
                      {country.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="h-64 overflow-y-auto space-y-2 mb-4">
                {chatMessages
                  .filter(
                    (msg) =>
                      selectedChatChannel === 'global' ||
                      msg.countryId === parseInt(selectedChatChannel)
                  )
                  .map((message) => (
                    <div key={message.id} className="text-sm">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-blue-400">
                          {message.sender}
                        </span>
                        <span className="text-gray-400">
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="text-gray-200">{message.message}</div>
                    </div>
                  ))}
              </div>

              <div className="flex space-x-2">
                <input
                  type="text"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-300"
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                />
                <button
                  onClick={handleSendMessage}
                  className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-semibold transition-colors"
                  disabled={!connected}
                >
                  Send
                </button>
              </div>
            </div>

            {/* Game Stats */}
            <div className="bg-black/20 backdrop-blur-sm rounded-xl p-6 border border-white/10">
              <h3 className="text-lg font-bold mb-4">📊 Game Stats</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span>Current Round:</span>
                  <span className="font-semibold">
                    {gameStats.currentRound}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Time Left:</span>
                  <span className="font-semibold">
                    {formatTimeLeft(gameStats.roundTimeLeft)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Active Countries:</span>
                  <span className="font-semibold">
                    {gameStats.activeCountries}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Your Holdings:</span>
                  <span className="font-semibold">$0</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
