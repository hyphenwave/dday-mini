import { Country } from '../lib/mockData';
import { Button } from './ui/button';
import { MessageSquare, TrendingUp, Rocket, X } from 'lucide-react';

interface CountryInfoCardProps {
  country: Country;
  onBuySell: () => void;
  onNuke: () => void;
  onViewChat: () => void;
  onClose: () => void;
}

export function CountryInfoCard({ country, onBuySell, onNuke, onViewChat, onClose }: CountryInfoCardProps) {
  const price = 1.25; // Mock price

  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-96 bg-[#0a0f1e] border-2 border-[#3BE2FF] rounded-xl shadow-2xl overflow-hidden z-10"
         style={{ boxShadow: '0 0 40px rgba(59, 226, 255, 0.4)' }}>
      {/* Header */}
      <div className="bg-gradient-to-r from-[#1a1f3a] to-[#0a0f1e] p-4 border-b border-[#3BE2FF]/30">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{country.flag}</span>
            <div>
              <h3 className="text-white">{country.name}</h3>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-gray-400 hover:text-white hover:bg-[#1a1f3a] h-8 w-8"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* President */}
        <div className="flex items-center gap-3 bg-[#050914] p-2 rounded-lg">
          <img
            src={country.president.avatar}
            alt={country.president.name}
            className="w-10 h-10 rounded-full border-2 border-[#F9C80E]"
          />
          <div className="flex-1">
            <div className="text-xs text-gray-400">President</div>
            <div className="text-white text-sm">{country.president.name}</div>
          </div>
          <div className="flex items-center gap-1 text-[#F9C80E]">
            <Rocket className="h-4 w-4" />
            <span className="text-sm">{country.nukeCount}</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#050914] rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">Price</div>
            <div className="text-[#3BE2FF]">${price.toFixed(2)}</div>
          </div>
          <div className="bg-[#050914] rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">Market Cap</div>
            <div className="text-white">${(country.marketCap / 1000).toFixed(1)}K</div>
          </div>
          <div className="bg-[#050914] rounded-lg p-3">
            <div className="text-xs text-gray-400 mb-1">Holders</div>
            <div className="text-white">{(country.population / 1000000).toFixed(1)}M</div>
          </div>
        </div>
        
        <div className="flex items-center justify-between bg-[#050914] rounded-lg p-3">
          <span className="text-xs text-gray-400">24h Change</span>
          <div className={`flex items-center gap-1 ${
            country.change24h >= 0 ? 'text-green-500' : 'text-red-500'
          }`}>
            <TrendingUp className="h-3 w-3" />
            <span className="text-sm">{country.change24h >= 0 ? '+' : ''}{country.change24h.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 bg-[#050914] border-t border-[#1a1f3a] flex gap-2">
        <Button
          onClick={onBuySell}
          className="flex-1 bg-[#3BE2FF] text-black hover:bg-[#3BE2FF]/80"
        >
          Buy / Sell
        </Button>
        <Button
          onClick={onViewChat}
          variant="outline"
          className="border-[#3BE2FF] text-[#3BE2FF] hover:bg-[#3BE2FF]/10"
        >
          <MessageSquare className="h-4 w-4" />
        </Button>
        <Button
          onClick={onNuke}
          variant="outline"
          className="border-[#FF4B4B] text-[#FF4B4B] hover:bg-[#FF4B4B]/10"
        >
          <Rocket className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
