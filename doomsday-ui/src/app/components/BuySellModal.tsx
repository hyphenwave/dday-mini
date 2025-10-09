import { Country, mockCountries } from '../lib/mockData'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { useEffect, useMemo, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { walletModalController } from './WalletModal'
import { ArrowDownUp, ChevronDown } from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import * as VisuallyHidden from '@radix-ui/react-visually-hidden'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'

interface BuySellModalProps {
  country: Country | null
  open: boolean
  onClose: () => void
  onCountryChange: (country: Country) => void
  baseSymbol?: string // e.g., SOL or ETH
  availableBaseBalance?: number // optional: user's base balance (SOL/ETH)
  availableTokenBalance?: number // optional: user's token balance (country token)
}

/**
 * Assumptions:
 * - `price` = baseAsset per token (e.g., 1.25 SOL per 1 token)
 * - When BUY: user inputs base (top), receives tokens (bottom = base / price)
 * - When SELL: user inputs tokens (top), receives base (bottom = tokens * price)
 *
 * We make the bottom field **derived & readOnly** to avoid circular updates.
 */

const mockPriceData = [
  { time: '00:00', price: 1.05 },
  { time: '04:00', price: 1.12 },
  { time: '08:00', price: 1.18 },
  { time: '12:00', price: 1.25 },
  { time: '16:00', price: 1.32 },
  { time: '20:00', price: 1.28 },
  { time: '23:59', price: 1.25 },
]

export function BuySellModal({
  country,
  open,
  onClose,
  onCountryChange,
  baseSymbol = 'SOL',
  availableBaseBalance = 0,
  availableTokenBalance = 0,
}: BuySellModalProps) {
  const { connected } = useWallet()
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy')
  const [topAmount, setTopAmount] = useState<string>('0')

  // ---- Price: base per token (e.g., 1.25 SOL per token)
  const price = 1.25

  // Helpers
  const parseNum = (v: string) => {
    const n = parseFloat(v)
    return Number.isFinite(n) ? n : 0
  }
  const clampNonNegative = (v: number) => (v < 0 ? 0 : v)

  // Derived bottom amount
  const bottomAmount = useMemo(() => {
    const top = clampNonNegative(parseNum(topAmount))
    if (tradeType === 'buy') {
      // base -> tokens
      return price > 0 ? (top / price).toFixed(6) : '0'
    } else {
      // tokens -> base
      return (top * price).toFixed(6)
    }
  }, [topAmount, tradeType])

  // Reset amounts when country or tradeType changes
  useEffect(() => {
    setTopAmount('0')
  }, [country?.id, tradeType])

  // Swap handler
  const handleSwap = () => {
    setTradeType((t) => (t === 'buy' ? 'sell' : 'buy'))
  }

  // Top input change (single source of truth)
  const handleTopAmountChange = (v: string) => {
    // Allow empty, digits, and single decimal point
    if (v === '' || /^\d*\.?\d*$/.test(v)) {
      setTopAmount(v)
    }
  }

  // Guard: if no country, render empty dialog
  if (!country) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="bg-[#0a0f1e] border-[#3BE2FF] text-white max-w-md p-6">
          <VisuallyHidden.Root>
            <DialogTitle>No country selected</DialogTitle>
            <DialogDescription>
              Trade modal requires a country
            </DialogDescription>
          </VisuallyHidden.Root>
          <div className="text-center text-gray-400">No country selected</div>
        </DialogContent>
      </Dialog>
    )
  }

  // Pretty symbols for the right-hand selector
  const tokenTicker = country.name.substring(0, 3).toUpperCase()

  // Stats panel numbers
  const exchangeRateText = `1 ${tokenTicker} = ${price.toFixed(
    6
  )} ${baseSymbol}`
  const estImpact = tradeType === 'buy' ? '+2.3%' : '-2.1%' // placeholder; wire to slippage calc later
  const availableBalanceText =
    tradeType === 'buy'
      ? `${availableBaseBalance.toFixed(4)} ${baseSymbol}`
      : `${availableTokenBalance.toFixed(4)} ${tokenTicker}`

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[#0a0f1e] border-[#3BE2FF] text-white max-w-[900px] p-0 h-[460px]">
        <VisuallyHidden.Root>
          <DialogTitle>Trade {country.name} Tokens</DialogTitle>
          <DialogDescription>
            Buy or sell {country.name} tokens using {baseSymbol}
          </DialogDescription>
        </VisuallyHidden.Root>

        <div className="flex h-full">
          {/* Left Side - Chart */}
          <div className="w-3/5 px-4 py-3 border-r border-[#1a1f3a] flex flex-col min-h-0">
            <div className="mb-3">
              <div className="flex items-center gap-3 mb-1">
                <span className="text-3xl">{country.flag}</span>
                <div>
                  <div className="text-xl">{country.name}</div>
                  <div className="text-sm text-gray-400">
                    {exchangeRateText}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 flex flex-col min-h-0">
              <div className="text-xs text-gray-400 mb-2">
                PRICE CHART (24H)
              </div>
              <div className="flex-1 bg-[#050914] rounded-lg p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={mockPriceData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1a1f3a" />
                    <XAxis
                      dataKey="time"
                      stroke="#4a4a6a"
                      tick={{ fill: '#8a8a9a', fontSize: 10 }}
                    />
                    <YAxis
                      stroke="#4a4a6a"
                      tick={{ fill: '#8a8a9a', fontSize: 10 }}
                      domain={['dataMin - 0.1', 'dataMax + 0.1']}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0a0f1e',
                        border: '1px solid #3BE2FF',
                        borderRadius: '8px',
                      }}
                      labelStyle={{ color: '#fff' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="price"
                      stroke="#3BE2FF"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-2">
              <div className="bg-[#050914] rounded-lg p-2">
                <div className="text-xs text-gray-400">Market Cap</div>
                <div className="text-[#3BE2FF]">
                  ${(country.marketCap / 1000).toFixed(1)}K
                </div>
              </div>
              <div className="bg-[#050914] rounded-lg p-2">
                <div className="text-xs text-gray-400">24h Change</div>
                <div
                  className={
                    country.change24h >= 0 ? 'text-green-500' : 'text-red-500'
                  }
                >
                  {country.change24h >= 0 ? '+' : ''}
                  {country.change24h.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - Trading Form */}
          <div className="w-2/5 px-4 py-3 flex flex-col min-h-0">
            <div className="relative flex-1 flex flex-col">
              {/* Top Card */}
              <div className="bg-[#0b1022] border border-[#1a1f3a] rounded-lg p-4 pb-8 mb-1">
                <div className="text-sm text-gray-400 mb-2">
                  {tradeType === 'buy' ? 'You pay' : 'You sell'}
                </div>
                <div className="flex items-center gap-4">
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={topAmount}
                    onChange={(e) => handleTopAmountChange(e.target.value)}
                    placeholder="0"
                    className="flex-1 bg-transparent border-none text-5xl h-auto p-0 text-white focus-visible:ring-0 focus-visible:ring-offset-0"
                    style={{ fontSize: '1.5rem', lineHeight: '1' }}
                  />

                  {/* Right badge shows the asset of the top input */}
                  <div className="min-w-[120px]">
                    {tradeType === 'buy' ? (
                      <Button
                        variant="outline"
                        className="bg-[#0a0f1e] border-[#3BE2FF] text-white hover:bg-[#1a1f3a] px-6 rounded-lg cursor-default w-full"
                      >
                        {baseSymbol}
                      </Button>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger className="bg-[#0a0f1e] border border-[#3BE2FF] text-white hover:bg-[#1a1f3a] px-4 py-2 rounded-lg flex items-center gap-2 transition-colors cursor-pointer w-full">
                          <span className="mr-1">{country.flag}</span>
                          <span>{tokenTicker}</span>
                          <ChevronDown className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          className="w-64 bg-[#0a0f1e] border-[#3BE2FF] text-white max-h-80 overflow-y-auto"
                          align="end"
                        >
                          {mockCountries.map((c) => (
                            <DropdownMenuItem
                              key={c.id}
                              onClick={() => onCountryChange(c)}
                              className={`cursor-pointer ${
                                c.id === country.id ? 'bg-[#1a1f3a]' : ''
                              } focus:bg-[#1a1f3a] focus:text-white`}
                            >
                              <span className="mr-2">{c.flag}</span>
                              <span className="flex-1">{c.name}</span>
                              <span className="text-xs text-gray-400">
                                ${(c.marketCap / 1000).toFixed(1)}K
                              </span>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </div>

                {/* Subline: derived conversion for the top amount */}
                <div className="text-sm text-gray-500 mt-2">
                  {tradeType === 'buy'
                    ? `≈ ${(
                        clampNonNegative(parseNum(topAmount)) / (price || 1)
                      ).toFixed(6)} ${tokenTicker}`
                    : `≈ ${(
                        clampNonNegative(parseNum(topAmount)) * price
                      ).toFixed(6)} ${baseSymbol}`}
                </div>
              </div>

              {/* Swap Button overlapping both cards */}
              <button
                onClick={handleSwap}
                aria-label="Swap"
                className={`absolute left-1/2 -translate-x-1/2 top-[calc(50%-6px)] -translate-y-1/2 z-20 h-11 w-11 rounded-xl grid place-items-center shadow-2xl border-2 transition-colors cursor-pointer ${
                  tradeType === 'buy'
                    ? 'bg-[#0d1f2a] border-[#1e3a47]'
                    : 'bg-[#2e1419] border-[#4a2029]'
                }`}
              >
                <ArrowDownUp
                  className={`h-4 w-4 ${
                    tradeType === 'buy' ? 'text-[#3BE2FF]' : 'text-[#FF4B4B]'
                  }`}
                />
              </button>

              {/* Bottom Card (derived field) */}
              <div className="bg-[#0b1022] border border-[#1a1f3a] rounded-lg p-4 pt-8 mt-1">
                <div className="text-sm text-gray-400 mb-2">You receive</div>
                <div className="flex items-center gap-4">
                  <Input
                    readOnly
                    value={bottomAmount}
                    placeholder="0"
                    className="flex-1 bg-transparent border-none text-5xl h-auto p-0 text-white"
                    style={{ fontSize: '1.5rem', lineHeight: '1' }}
                  />

                  {/* Right side shows the asset of the bottom field */}
                  <div className="min-w-[120px]">
                    {tradeType === 'buy' ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger className="bg-[#0a0f1e] border border-[#3BE2FF] text-white hover:bg-[#1a1f3a] px-4 py-2 rounded-lg flex items-center gap-2 transition-colors cursor-pointer w-full">
                          <span className="mr-1">{country.flag}</span>
                          <span>{tokenTicker}</span>
                          <ChevronDown className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          className="w-64 bg-[#0a0f1e] border-[#3BE2FF] text-white max-h-80 overflow-y-auto"
                          align="end"
                        >
                          {mockCountries.map((c) => (
                            <DropdownMenuItem
                              key={c.id}
                              onClick={() => onCountryChange(c)}
                              className={`cursor-pointer ${
                                c.id === country.id ? 'bg-[#1a1f3a]' : ''
                              } focus:bg-[#1a1f3a] focus:text-white`}
                            >
                              <span className="mr-2">{c.flag}</span>
                              <span className="flex-1">{c.name}</span>
                              <span className="text-xs text-gray-400">
                                ${(c.marketCap / 1000).toFixed(1)}K
                              </span>
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <Button
                        variant="outline"
                        className="bg-[#0a0f1e] border-[#3BE2FF] text-white hover:bg-[#1a1f3a] px-6 rounded-lg cursor-default w-full"
                      >
                        {baseSymbol}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Subline for derived */}
                <div className="text-sm text-gray-500 mt-2">
                  {tradeType === 'buy'
                    ? `Rate: 1 ${tokenTicker} = ${price.toFixed(
                        6
                      )} ${baseSymbol}`
                    : `Rate: 1 ${tokenTicker} = ${price.toFixed(
                        6
                      )} ${baseSymbol}`}
                </div>
              </div>
            </div>

            {/* Stats / Summary */}
            <div className="bg-[#050914] rounded-lg p-3 space-y-2 mt-2 mb-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Exchange rate</span>
                <span className="text-white">{exchangeRateText}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Est. market impact</span>
                <span
                  className={
                    tradeType === 'buy' ? 'text-green-500' : 'text-red-500'
                  }
                >
                  {estImpact}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Available balance</span>
                <span className="text-white">{availableBalanceText}</span>
              </div>
            </div>

            {/* Action Button */}
            {connected ? (
              <Button
                className={`w-full h-11 ${
                  tradeType === 'buy'
                    ? 'bg-[#3BE2FF] text-black hover:bg-[#3BE2FF]/80'
                    : 'bg-[#FF4B4B] text-white hover:bg-[#FF4B4B]/80'
                }`}
              >
                {tradeType === 'buy'
                  ? `Buy ${tokenTicker}`
                  : `Sell ${tokenTicker}`}
              </Button>
            ) : (
              <Button
                onClick={() => walletModalController.open()}
                className="w-full h-11 bg-[#1a1f3a] border border-[#3BE2FF] text-[#3BE2FF] hover:bg-[#3BE2FF]/10"
              >
                Connect Wallet
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
