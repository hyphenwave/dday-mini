import { Button } from './ui/button';
import { Input } from './ui/input';
import { Rocket } from 'lucide-react';

export function Actions() {
  return (
    <div className="p-4 space-y-3">
      <div className="text-xs text-gray-400 mb-3">ACTIONS</div>
      
      <div className="space-y-2">
        <Input
          placeholder="Input the country to buy share"
          className="bg-[#0a0f1e] border-[#1a1f3a] text-white placeholder:text-gray-600"
        />
        
        <Button
          variant="outline"
          className="w-full border-[#3BE2FF] text-[#3BE2FF] hover:bg-[#3BE2FF]/10 justify-start"
        >
          <Rocket className="h-4 w-4 mr-2" />
          Distribute free market with entire countr…
        </Button>
      </div>
    </div>
  );
}
