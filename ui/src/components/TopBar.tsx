import React, { useState, useEffect } from 'react';
import { 
  Gamepad2, 
  Settings, 
  Plus,
  Minus,
  Square,
  Copy,
  X
} from 'lucide-react';
import { audioService } from '../services/audioService';
import { apiBridge } from '../services/apiBridge';

interface TopBarProps {
  activeTab: 'games' | 'relinker' | 'nid' | 'prx' | 'telemetry';
  onTabChange: (tab: 'games' | 'relinker' | 'nid' | 'prx' | 'telemetry') => void;
  onOpenAddGame: () => void;
  onOpenSettings: () => void;
  gamepadConnected: boolean;
  showAdvancedNav?: boolean;
}

const ALL_NAV_ITEMS: { key: 'games' | 'relinker' | 'nid' | 'prx' | 'telemetry'; label: string; advanced?: boolean }[] = [
  { key: 'games', label: 'Games' },
  { key: 'relinker', label: 'Relinker Studio' },
  { key: 'nid', label: 'NID Inspector', advanced: true },
  { key: 'prx', label: 'PRX Libraries', advanced: true },
  { key: 'telemetry', label: 'System Status', advanced: true },
];

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onTabChange,
  onOpenAddGame,
  onOpenSettings,
  gamepadConnected,
  showAdvancedNav = false,
}) => {
  const [time, setTime] = useState<string>('');
  const [isMaximized, setIsMaximized] = useState<boolean>(false);

  const navItems = showAdvancedNav 
    ? ALL_NAV_ITEMS 
    : ALL_NAV_ITEMS.filter((item) => !item.advanced);

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

  useEffect(() => {
    apiBridge.isWindowMaximized().then(setIsMaximized).catch(() => {});
    const unsubscribe = apiBridge.onWindowMaximizedChange((maximized) => {
      setIsMaximized(maximized);
    });
    return () => unsubscribe();
  }, []);

  const handleTabClick = (tab: 'games' | 'relinker' | 'nid' | 'prx' | 'telemetry') => {
    if (tab !== activeTab) {
      audioService.playNavTick();
      onTabChange(tab);
    }
  };

  return (
    <header 
      onDoubleClick={() => apiBridge.maximizeWindow()}
      className="relative z-30 h-16 flex items-center justify-between px-8 md:px-12 bg-transparent select-none cursor-default"
      style={{ WebkitAppRegion: 'drag' } as any}
    >
      {/* Left: Compact AnyPS5 Console Identity & PS5 Typography Navigation */}
      <div className="flex items-center space-x-8 md:space-x-12" style={{ WebkitAppRegion: 'no-drag' } as any}>
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
        <nav className="flex items-baseline space-x-6 md:space-x-8" role="tablist">
          {navItems.map((item) => {
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
                    : 'text-white/65 text-[14px] font-normal hover:text-white/90'
                }`}
              >
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Right: Small, Understated Console Controls & Window Controls */}
      <div className="flex items-center space-x-5 text-neutral-300" style={{ WebkitAppRegion: 'no-drag' } as any}>
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

        {/* Minimal Frameless Window Controls */}
        <div className="flex items-center space-x-0.5 pl-2 border-l border-white/10">
          <button
            type="button"
            onClick={() => apiBridge.minimizeWindow()}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors focus:outline-none"
            title="Minimize"
            aria-label="Minimize Window"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => apiBridge.maximizeWindow()}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors focus:outline-none"
            title={isMaximized ? "Restore" : "Maximize"}
            aria-label={isMaximized ? "Restore Window" : "Maximize Window"}
          >
            {isMaximized ? (
              <Copy className="w-3 h-3 rotate-180" />
            ) : (
              <Square className="w-3 h-3" />
            )}
          </button>

          <button
            type="button"
            onClick={() => apiBridge.closeWindow()}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-red-500/80 transition-colors focus:outline-none"
            title="Close"
            aria-label="Close Window"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
