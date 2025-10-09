import { Country } from '../lib/mockData';
import { useState } from 'react';

interface WorldMapProps {
  countries: Country[];
  onCountryClick: (country: Country) => void;
  selectedCountry: Country | null;
}

export function WorldMap({ countries, onCountryClick, selectedCountry }: WorldMapProps) {
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);

  const countryPaths: Record<string, string> = {
    brazil: 'M 280 380 L 320 380 L 330 420 L 310 450 L 280 440 Z',
    usa: 'M 140 180 L 240 180 L 250 240 L 180 250 L 140 220 Z',
    china: 'M 680 220 L 750 220 L 760 280 L 720 290 L 680 260 Z',
    russia: 'M 520 120 L 780 120 L 780 200 L 520 180 Z',
    japan: 'M 780 260 L 800 260 L 800 300 L 780 300 Z',
    germany: 'M 480 200 L 510 200 L 510 230 L 480 230 Z',
    india: 'M 630 300 L 670 300 L 670 360 L 630 350 Z',
    uk: 'M 440 180 L 460 180 L 460 200 L 440 200 Z'
  };

  const getCountryColor = (country: Country) => {
    if (selectedCountry?.id === country.id) return '#3BE2FF';
    if (country.status === 'eliminated') return '#4a4a4a';
    if (country.status === 'under-attack') return '#FF4B4B';
    return '#b0b0b0';
  };

  return (
    <div className="relative w-full h-full bg-black">
      <svg
        viewBox="0 0 1000 600"
        className="w-full h-full"
        style={{ filter: 'drop-shadow(0 0 20px rgba(59, 226, 255, 0.3))' }}
      >
        {/* Simplified world map background */}
        <g opacity="0.3">
          {/* Continents - simplified shapes */}
          <path
            d="M 100 150 L 280 150 L 280 280 L 100 280 Z"
            fill="#4a4a4a"
            stroke="#2a2a3a"
            strokeWidth="1"
          />
          <path
            d="M 250 300 L 350 300 L 350 480 L 250 480 Z"
            fill="#4a4a4a"
            stroke="#2a2a3a"
            strokeWidth="1"
          />
          <path
            d="M 380 280 L 550 280 L 550 450 L 380 450 Z"
            fill="#4a4a4a"
            stroke="#2a2a3a"
            strokeWidth="1"
          />
          <path
            d="M 440 140 L 560 140 L 560 270 L 440 270 Z"
            fill="#4a4a4a"
            stroke="#2a2a3a"
            strokeWidth="1"
          />
          <path
            d="M 580 100 L 850 100 L 850 380 L 580 380 Z"
            fill="#4a4a4a"
            stroke="#2a2a3a"
            strokeWidth="1"
          />
          <path
            d="M 870 300 L 950 300 L 950 450 L 870 450 Z"
            fill="#4a4a4a"
            stroke="#2a2a3a"
            strokeWidth="1"
          />
        </g>

        {/* Interactive country regions */}
        {countries.map((country) => {
          const path = countryPaths[country.id];
          if (!path) return null;

          return (
            <g key={country.id}>
              <path
                d={path}
                fill={getCountryColor(country)}
                stroke={hoveredCountry === country.id ? '#3BE2FF' : '#1a1f3a'}
                strokeWidth={hoveredCountry === country.id ? 3 : 2}
                className="cursor-pointer transition-all duration-200"
                style={{
                  filter: hoveredCountry === country.id ? 'drop-shadow(0 0 10px rgba(59, 226, 255, 0.8))' : 'none',
                  opacity: hoveredCountry === country.id ? 1 : 0.8
                }}
                onMouseEnter={() => setHoveredCountry(country.id)}
                onMouseLeave={() => setHoveredCountry(null)}
                onClick={() => onCountryClick(country)}
              />
            </g>
          );
        })}

        {/* Grid lines */}
        <g opacity="0.1" stroke="#3BE2FF" strokeWidth="0.5">
          {[...Array(10)].map((_, i) => (
            <line
              key={`h-${i}`}
              x1="0"
              y1={i * 60}
              x2="1000"
              y2={i * 60}
            />
          ))}
          {[...Array(16)].map((_, i) => (
            <line
              key={`v-${i}`}
              x1={i * 62.5}
              y1="0"
              x2={i * 62.5}
              y2="600"
            />
          ))}
        </g>
      </svg>

      {/* Hover Tooltip */}
      {hoveredCountry && (
        <div className="absolute top-4 left-4 bg-[#0a0f1e] border border-[#3BE2FF] rounded-lg p-4 pointer-events-none">
          {(() => {
            const country = countries.find(c => c.id === hoveredCountry);
            if (!country) return null;
            return (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{country.flag}</span>
                  <span className="text-white">{country.name}</span>
                </div>
                <div className="text-sm text-gray-400">
                  Market Cap: ${country.marketCap.toLocaleString()}
                </div>
                <div className="text-sm text-gray-400">
                  Nukes: {country.nukeCount}
                </div>
                <div className="text-sm text-gray-400">
                  President: {country.president.name}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
