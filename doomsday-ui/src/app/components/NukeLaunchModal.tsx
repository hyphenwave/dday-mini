import { Country } from '../lib/mockData';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Checkbox } from './ui/checkbox';
import { AlertTriangle, Rocket, Skull } from 'lucide-react';
import { useState } from 'react';

interface NukeLaunchModalProps {
  country: Country | null;
  open: boolean;
  onClose: () => void;
  onLaunch?: () => void;
}

export function NukeLaunchModal({ country, open, onClose, onLaunch }: NukeLaunchModalProps) {
  const [confirmed, setConfirmed] = useState(false);

  if (!country) return null;

  const handleLaunch = () => {
    if (confirmed && onLaunch) {
      onLaunch();
      setConfirmed(false);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-gradient-to-b from-[#1a0a0a] to-[#0a0f1e] border-2 border-[#FF4B4B] text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#FF4B4B]">
            <Rocket className="h-6 w-6" />
            Launch Nuclear Strike
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            You are about to launch a nuclear weapon. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {/* Warning Banner */}
        <div className="bg-[#FF4B4B]/10 border border-[#FF4B4B] rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-[#FF4B4B] flex-shrink-0 mt-0.5" />
          <div className="text-sm text-gray-300">
            Launching a nuke will destroy infrastructure and reduce the target country's market cap significantly.
            This is an irreversible action.
          </div>
        </div>

        {/* Target Country */}
        <div className="bg-[#1a1f3a] rounded-lg p-4">
          <div className="text-xs text-gray-400 mb-2">TARGET</div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{country.flag}</span>
              <div>
                <div className="text-white">{country.name}</div>
                <div className="text-sm text-gray-400">
                  Market Cap: ${country.marketCap.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Impact Stats */}
        <div className="space-y-2">
          <div className="text-xs text-gray-400 mb-2">ESTIMATED IMPACT</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#0a0f1e] border border-[#FF4B4B]/30 rounded p-3">
              <div className="text-[#FF4B4B] text-xl">-35%</div>
              <div className="text-xs text-gray-400">Market Cap</div>
            </div>
            <div className="bg-[#0a0f1e] border border-[#FF4B4B]/30 rounded p-3">
              <div className="text-[#FF4B4B] text-xl">-50M</div>
              <div className="text-xs text-gray-400">Population</div>
            </div>
            <div className="bg-[#0a0f1e] border border-[#FF4B4B]/30 rounded p-3">
              <div className="text-[#FF4B4B] text-xl">-25%</div>
              <div className="text-xs text-gray-400">Resources</div>
            </div>
            <div className="bg-[#0a0f1e] border border-[#FF4B4B]/30 rounded p-3">
              <div className="text-[#F9C80E]">+100</div>
              <div className="text-xs text-gray-400">Notoriety</div>
            </div>
          </div>
        </div>

        {/* Cost */}
        <div className="bg-[#1a1f3a] rounded-lg p-3 flex justify-between items-center">
          <span className="text-sm text-gray-400">Cost</span>
          <span className="text-white">1 Nuke + 10 SOL</span>
        </div>

        {/* Confirmation Checkbox */}
        <div className="flex items-start gap-3 p-3 bg-[#0a0f1e] rounded-lg border border-[#FF4B4B]/20">
          <Checkbox
            id="confirm-nuke"
            checked={confirmed}
            onCheckedChange={(checked) => setConfirmed(checked as boolean)}
            className="mt-0.5 border-[#FF4B4B] data-[state=checked]:bg-[#FF4B4B]"
          />
          <label htmlFor="confirm-nuke" className="text-sm text-gray-300 cursor-pointer">
            I understand this action is permanent and will destroy {country.name}'s infrastructure,
            causing massive casualties and economic damage.
          </label>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            onClick={onClose}
            variant="outline"
            className="flex-1 border-gray-600 text-gray-400 hover:bg-gray-800"
          >
            Cancel
          </Button>
          <Button
            onClick={handleLaunch}
            disabled={!confirmed}
            className="flex-1 bg-[#FF4B4B] text-white hover:bg-[#FF4B4B]/80 disabled:opacity-50"
          >
            <Skull className="h-4 w-4 mr-2" />
            Launch Nuke
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
