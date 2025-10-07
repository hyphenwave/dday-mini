'use client'

import { useState } from 'react'

interface CountryCardProps {
  country: {
    id: number
    name: string
    marketCap: number
    president: string
    isActive: boolean
    hasNuke: boolean
    totalSupply: number
    bondingCurveCap: number
    deployedToUniswap: boolean
  }
  onBuyTokens: (countryId: number, amount: number) => void
  isSelected: boolean
  onSelect: (countryId: number) => void
  connected: boolean
}

export function CountryCard({
  country,
  onBuyTokens,
  isSelected,
  onSelect,
  connected,
}: CountryCardProps) {
  const [buyAmount, setBuyAmount] = useState('1000')
  const [isBuying, setIsBuying] = useState(false)

  const handleBuy = async () => {
    const amount = parseInt(buyAmount)
    if (!amount || amount <= 0) return

    setIsBuying(true)
    try {
      await onBuyTokens(country.id, amount)
    } finally {
      setIsBuying(false)
    }
  }

  const getCountryFlag = (countryName: string) => {
    const flags: { [key: string]: string } = {
      'United States': '🇺🇸',
      China: '🇨🇳',
      Germany: '🇩🇪',
      Japan: '🇯🇵',
      'United Kingdom': '🇬🇧',
      France: '🇫🇷',
      Italy: '🇮🇹',
      Spain: '🇪🇸',
      Canada: '🇨🇦',
      Australia: '🇦🇺',
    }
    return flags[countryName] || '🏴'
  }

  return (
    <div
      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
        isSelected
          ? 'border-yellow-400 bg-yellow-400/20'
          : 'border-white/20 hover:border-white/40'
      } ${!country.isActive ? 'opacity-50' : ''}`}
      onClick={() => onSelect(country.id)}
    >
      <div className="text-center mb-4">
        <div className="text-3xl mb-2">
          {country.hasNuke ? '💣' : getCountryFlag(country.name)}
        </div>
        <div className="font-semibold text-sm">{country.name}</div>
        <div className="text-xs text-gray-300">
          ${(country.marketCap / 1000).toFixed(0)}k market cap
        </div>
        {country.president && (
          <div className="text-xs text-yellow-400 mt-1">
            👑 {country.president.slice(0, 6)}...
          </div>
        )}
      </div>

      {isSelected && (
        <div className="space-y-3">
          <div className="text-xs space-y-1">
            <div className="flex justify-between">
              <span>Status:</span>
              <span
                className={country.isActive ? 'text-green-400' : 'text-red-400'}
              >
                {country.isActive ? 'Active' : 'Eliminated'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Supply:</span>
              <span>{country.totalSupply.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>Deployed:</span>
              <span
                className={
                  country.deployedToUniswap
                    ? 'text-green-400'
                    : 'text-yellow-400'
                }
              >
                {country.deployedToUniswap ? 'Yes' : 'No'}
              </span>
            </div>
          </div>

          {country.isActive && (
            <div className="space-y-2">
              <input
                type="number"
                value={buyAmount}
                onChange={(e) => setBuyAmount(e.target.value)}
                placeholder="Amount"
                className="w-full px-2 py-1 bg-white/10 border border-white/20 rounded text-white placeholder-gray-300 text-xs"
                onClick={(e) => e.stopPropagation()}
              />
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleBuy()
                }}
                disabled={!connected || isBuying}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-2 py-1 rounded text-xs font-semibold transition-colors"
              >
                {isBuying ? 'Buying...' : 'Buy Tokens'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
