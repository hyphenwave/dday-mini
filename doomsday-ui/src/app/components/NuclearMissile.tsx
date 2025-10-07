'use client'

import { useState } from 'react'

interface NuclearMissileProps {
  winnerCountry: string
  onLaunch: (targetCountryId: number) => void
  availableCountries: Array<{ id: number; name: string; isActive: boolean }>
}

export function NuclearMissile({
  winnerCountry,
  onLaunch,
  availableCountries,
}: NuclearMissileProps) {
  const [selectedTarget, setSelectedTarget] = useState<number | null>(null)
  const [isLaunching, setIsLaunching] = useState(false)

  const handleLaunch = async () => {
    if (!selectedTarget) return

    setIsLaunching(true)
    try {
      await onLaunch(selectedTarget)
    } finally {
      setIsLaunching(false)
    }
  }

  return (
    <div className="bg-red-900/20 backdrop-blur-sm rounded-xl p-6 border border-red-500/30">
      <div className="flex items-center space-x-2 mb-4">
        <span className="text-2xl">💣</span>
        <h3 className="text-lg font-bold text-red-400">Nuclear Missile</h3>
      </div>

      <div className="mb-4">
        <p className="text-sm text-gray-300 mb-2">
          <span className="font-semibold text-yellow-400">{winnerCountry}</span>{' '}
          has unlocked a nuclear missile!
        </p>
        <p className="text-xs text-gray-400">
          Choose a target country to eliminate from the game. This action cannot
          be undone.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Select Target Country:
          </label>
          <select
            value={selectedTarget || ''}
            onChange={(e) => setSelectedTarget(parseInt(e.target.value))}
            className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
          >
            <option value="">Choose a target...</option>
            {availableCountries
              .filter((country) => country.isActive)
              .map((country) => (
                <option key={country.id} value={country.id}>
                  {country.name}
                </option>
              ))}
          </select>
        </div>

        <button
          onClick={handleLaunch}
          disabled={!selectedTarget || isLaunching}
          className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-2 rounded-lg font-semibold transition-colors"
        >
          {isLaunching ? 'Launching...' : '🚀 Launch Nuclear Missile'}
        </button>
      </div>

      <div className="mt-4 p-3 bg-red-900/30 rounded-lg">
        <p className="text-xs text-red-300">
          ⚠️ Warning: This will permanently eliminate the target country and rug
          their liquidity. The president of {winnerCountry} will decide the
          target.
        </p>
      </div>
    </div>
  )
}
