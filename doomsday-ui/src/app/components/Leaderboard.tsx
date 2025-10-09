import { Country } from '../lib/mockData'
import { TrendingUp, TrendingDown, Users, Crown, Wallet } from 'lucide-react'
import { ScrollArea } from './ui/scroll-area'
import { useState } from 'react'

interface LeaderboardProps {
  countries: Country[]
  onCountrySelect: (country: Country) => void
}

type LeaderboardView = 'countries' | 'presidents' | 'holders'

interface HolderData {
  id: string
  name: string
  country: Country
  holdings: number
  value: number
  avatar: string
}

// Mock holder data
const mockHolders: HolderData[] = [
  {
    id: '1',
    name: 'WhaleKing',
    country: { name: 'USA', flag: '🇺🇸' } as Country,
    holdings: 125000,
    value: 156250,
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=WhaleKing',
  },
  {
    id: '2',
    name: 'DiamondHands',
    country: { name: 'Brazil', flag: '🇧🇷' } as Country,
    holdings: 98000,
    value: 122500,
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=DiamondHands',
  },
  {
    id: '3',
    name: 'MoonWalker',
    country: { name: 'China', flag: '🇨🇳' } as Country,
    holdings: 87500,
    value: 109375,
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=MoonWalker',
  },
  {
    id: '4',
    name: 'CryptoLord',
    country: { name: 'Russia', flag: '🇷🇺' } as Country,
    holdings: 76000,
    value: 95000,
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=CryptoLord',
  },
  {
    id: '5',
    name: 'TokenMaster',
    country: { name: 'Japan', flag: '🇯🇵' } as Country,
    holdings: 65000,
    value: 81250,
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=TokenMaster',
  },
]

export function Leaderboard({ countries, onCountrySelect }: LeaderboardProps) {
  const [view, setView] = useState<LeaderboardView>('countries')

  const sortedCountries = [...countries].sort(
    (a, b) => b.marketCap - a.marketCap
  )
  const topThree = sortedCountries.slice(0, 3)
  const sortedHolders = [...mockHolders].sort((a, b) => b.value - a.value)

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden">
      {/* Top 3 Winner Projection */}
      <div className="p-4 border-b border-[#1a1f3a]">
        <div className="text-xs text-gray-400 mb-3">WINNER PROJECTION</div>
        <div className="flex gap-2">
          {topThree.map((country, index) => (
            <div
              key={country.id}
              className="flex-1 bg-gradient-to-b from-[#1a1f3a] to-[#0a0f1e] rounded-lg p-3 border border-[#2a2f4a] cursor-pointer hover:border-[#3BE2FF]/30 transition-colors"
              onClick={() => onCountrySelect(country)}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">{country.flag}</span>
                <span
                  className={`text-xs px-2 py-1 rounded ${
                    index === 0
                      ? 'bg-[#F9C80E] text-black'
                      : index === 1
                      ? 'bg-gray-400 text-black'
                      : 'bg-orange-600 text-white'
                  }`}
                >
                  #{index + 1}
                </span>
              </div>
              <div className="text-xs text-white truncate">{country.name}</div>
              <div className="text-[#3BE2FF] text-sm mt-1">
                ${(country.marketCap / 1000).toFixed(1)}K
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* View Selector */}
      <div className="p-3 border-b border-[#1a1f3a]">
        <div className="flex gap-1 bg-[#050914] rounded-lg p-1">
          <button
            onClick={() => setView('countries')}
            className={`flex-1 py-2 px-3 rounded text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer ${
              view === 'countries'
                ? 'bg-[#3BE2FF] text-black'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Users className="h-3 w-3" />
            Countries
          </button>
          <button
            onClick={() => setView('presidents')}
            className={`flex-1 py-2 px-3 rounded text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer ${
              view === 'presidents'
                ? 'bg-[#3BE2FF] text-black'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Crown className="h-3 w-3" />
            Presidents
          </button>
          <button
            onClick={() => setView('holders')}
            className={`flex-1 py-2 px-3 rounded text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer ${
              view === 'holders'
                ? 'bg-[#3BE2FF] text-black'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Wallet className="h-3 w-3" />
            Holders
          </button>
        </div>
      </div>

      {/* Country List */}
      {view === 'countries' && (
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-2">
            {sortedCountries.map((country, index) => (
              <div
                key={country.id}
                onClick={() => onCountrySelect(country)}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#1a1f3a] cursor-pointer transition-colors mb-1"
              >
                {/* Rank */}
                <div className="w-6 text-center text-gray-400 text-sm">
                  {index + 1}
                </div>

                {/* Flag */}
                <div className="text-2xl">{country.flag}</div>

                {/* Country Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm truncate">
                    {country.name}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-xs">
                      ${country.marketCap.toLocaleString()}
                    </span>
                    <div
                      className={`flex items-center gap-1 text-xs ${
                        country.change24h >= 0
                          ? 'text-green-500'
                          : 'text-red-500'
                      }`}
                    >
                      {country.change24h >= 0 ? (
                        <TrendingUp className="h-3 w-3" />
                      ) : (
                        <TrendingDown className="h-3 w-3" />
                      )}
                      <span>{Math.abs(country.change24h).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>

                {/* President Avatar */}
                <div className="relative">
                  <img
                    src={country.president.avatar}
                    alt={country.president.name}
                    className="w-8 h-8 rounded-full border-2 border-[#F9C80E]"
                  />
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Presidents List */}
      {view === 'presidents' && (
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-2">
            {sortedCountries.map((country, index) => (
              <div
                key={country.id}
                onClick={() => onCountrySelect(country)}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#1a1f3a] cursor-pointer transition-colors mb-1"
              >
                {/* Rank */}
                <div className="w-6 text-center text-gray-400 text-sm">
                  {index + 1}
                </div>

                {/* President Avatar */}
                <img
                  src={country.president.avatar}
                  alt={country.president.name}
                  className="w-10 h-10 rounded-full border-2 border-[#F9C80E]"
                />

                {/* President Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white text-sm">
                      {country.president.name}
                    </span>
                    <span className="text-lg">{country.flag}</span>
                  </div>
                  <div className="text-xs text-gray-400 truncate">
                    {country.name} • ${country.marketCap.toLocaleString()}
                  </div>
                </div>

                {/* Nukes */}
                <div className="text-right">
                  <div className="text-[#F9C80E] text-sm">
                    {country.nukeCount}
                  </div>
                  <div className="text-xs text-gray-400">nukes</div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Holders List */}
      {view === 'holders' && (
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-2">
            {sortedHolders.map((holder, index) => (
              <div
                key={holder.id}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-[#1a1f3a] cursor-pointer transition-colors mb-1"
              >
                {/* Rank */}
                <div className="w-6 text-center text-gray-400 text-sm">
                  {index + 1}
                </div>

                {/* Holder Avatar */}
                <img
                  src={holder.avatar}
                  alt={holder.name}
                  className="w-10 h-10 rounded-full border-2 border-[#3BE2FF]"
                />

                {/* Holder Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-white text-sm">{holder.name}</span>
                    <span className="text-lg">{holder.country.flag}</span>
                  </div>
                  <div className="text-xs text-gray-400">
                    {holder.holdings.toLocaleString()} tokens
                  </div>
                </div>

                {/* Value */}
                <div className="text-right">
                  <div className="text-[#3BE2FF] text-sm">
                    ${(holder.value / 1000).toFixed(1)}K
                  </div>
                  <div className="text-xs text-gray-400">value</div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  )
}
