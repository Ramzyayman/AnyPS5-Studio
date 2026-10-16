import React, { useState, useEffect } from 'react';
import { 
  Gamepad2, 
  Settings, 
  Plus
} from 'lucide-react';
import { audioService } from '../services/audioService';

interface TopBarProps {
  activeTab: 'games' | 'relinker' | 'nid' | 'prx' | 'telemetry';
  onTabChange: (tab: 'games' | 'relinker' | 'nid' | 'prx' | 'telemetry') => void;
  onOpenAddGame: () => void;
  onOpenSettings: () => void;
  gamepadConnected: boolean;
}

const NAV_ITEMS: { key: 'games' | 'relinker' | 'nid' | 'prx' | 'telemetry'; label: string }[] = [
  { key: 'games', label: 'Games' },
  { key: 'relinker', label: 'Relinker Studio' },
  { key: 'nid', label: 'NID Inspector' },
  { key: 'prx', label: 'PRX Libraries' },
  { key: 'telemetry', label: 'System Status' },
];

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onTabChange,
  onOpenAddGame,
  onOpenSettings,
  gamepadConnected,
}) => {
  const [time, setTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleTabClick = (tab: 'games' | 'relinker' | 'nid' | 'prx' | 'telemetry') => {
    if (tab !== activeTab) {
      audioService.playNavTick();
      onTabChange(tab);
    }
  };

  return (
    <header className="relative z-30 h-14 flex items-center justify-between px-10 bg-gradient-to-b from-[#04060a]/60 via-[#04060a]/20 to-transparent select-none">
      {/* Left: Compact AnyPS5 Console Identity & PS5 Typography Navigation */}
      <div className="flex items-center space-x-10">
        {/* Compact Console Brand Mark */}
        <div className="flex items-center space-x-2">
          <div className="w-5 h-5 rounded-[4px] bg-white flex items-center justify-center">
            <span className="font-black text-black text-[10px] tracking-tighter">PS</span>
          </div>
          <span className="font-semibold text-xs tracking-wider text-white/90 uppercase">
            AnyPS5 <span className="text-white/40 font-normal">Studio</span>
          </span>
        </div>

        {/* PS5 Typography-Driven Navigation (no underlines, no boxes, purely typography-differentiated) */}
        <nav className="flex items-baseline space-x-8" role="tablist">
          {NAV_ITEMS.map((item) => {
            const isSelected = activeTab === item.key;
            return (
              <button
                key={item.key}
                role="tab"
                aria-selected={isSelected}
                onClick={() => handleTabClick(item.key)}
                className={`relative py-1 tracking-wide focus:outline-none focus-visible:ring-1 focus-visible:ring-white/60 focus-visible:rounded transition-all duration-200 ease-out motion-reduce:transition-none ${
                  isSelected
                    ? 'text-white text-[16px] font-semibold opacity-100'
                    : 'text-white/40 text-[14px] font-medium opacity-80 hover:text-white/70 hover:opacity-100'
                }`}
              >
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Right: Small, Understated Console Controls */}
      <div className="flex items-center space-x-5 text-neutral-300">
        {/* Import Game Button */}
        <button
          onClick={() => {
            audioService.playConfirm();
            onOpenAddGame();
          }}
          className="flex items-center space-x-1 px-2.5 py-1 rounded-full text-white/60 hover:text-white hover:bg-white/10 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white/50"
          title="Import Decrypted PS5 Title"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Import</span>
        </button>

        {/* Controller Status */}
        <div 
          className="flex items-center space-x-1.5 text-xs text-white/40"
          title={gamepadConnected ? "DualSense Wireless Controller Connected" : "Keyboard Navigation Active"}
        >
          <Gamepad2 className={`w-4 h-4 ${gamepadConnected ? 'text-blue-400' : 'text-white/40'}`} />
          {gamepadConnected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
        </div>

        {/* Settings */}
        <button
          onClick={() => {
            audioService.playConfirm();
            onOpenSettings();
          }}
          className="p-1 text-white/50 hover:text-white transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white/50 focus-visible:rounded"
          title="System Settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Console Clock */}
        <span className="text-xs font-medium tracking-wider text-white/70 pl-1">
          {time}
        </span>
      </div>
    </header>
  );
};
