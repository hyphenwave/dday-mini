import { mockEvents } from '../lib/mockData';
import { ScrollArea } from './ui/scroll-area';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Rocket, Crown, TrendingUp, AlertTriangle } from 'lucide-react';

const mockMarketData = [
  { time: '00:00', value: 2400 },
  { time: '04:00', value: 2210 },
  { time: '08:00', value: 2290 },
  { time: '12:00', value: 2500 },
  { time: '16:00', value: 2780 },
  { time: '20:00', value: 2847 },
  { time: '23:59', value: 3100 },
];

export function Intel() {
  const getEventIcon = (type: string) => {
    switch (type) {
      case 'nuke':
        return <Rocket className="h-4 w-4 text-[#FF4B4B]" />;
      case 'leadership':
        return <Crown className="h-4 w-4 text-[#F9C80E]" />;
      case 'market':
        return <TrendingUp className="h-4 w-4 text-[#3BE2FF]" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getEventColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'border-l-[#FF4B4B]';
      case 'medium':
        return 'border-l-[#F9C80E]';
      case 'low':
        return 'border-l-[#3BE2FF]';
      default:
        return 'border-l-gray-600';
    }
  };

  const formatTime = (date: Date) => {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Market Chart */}
      <div className="p-4 border-b border-[#1a1f3a]">
        <div className="text-xs text-gray-400 mb-3">GLOBAL MARKET CAP (24H)</div>
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mockMarketData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1f3a" />
              <XAxis
                dataKey="time"
                stroke="#4a4a6a"
                tick={{ fill: '#8a8a9a', fontSize: 10 }}
              />
              <YAxis
                stroke="#4a4a6a"
                tick={{ fill: '#8a8a9a', fontSize: 10 }}
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
                dataKey="value"
                stroke="#3BE2FF"
                strokeWidth={2}
                dot={{ fill: '#3BE2FF', r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Announcements */}
      <div className="flex-1 overflow-hidden">
        <div className="p-4 border-b border-[#1a1f3a]">
          <div className="text-xs text-gray-400">RECENT ANNOUNCEMENTS</div>
        </div>
        <ScrollArea className="h-[calc(100%-3rem)]">
          <div className="p-4 space-y-3">
            {mockEvents.map((event) => (
              <div
                key={event.id}
                className={`p-3 bg-[#0a0f1e] border-l-4 ${getEventColor(event.severity)} rounded-r-lg`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {getEventIcon(event.type)}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm text-white mb-1">
                      {event.description}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatTime(event.timestamp)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
