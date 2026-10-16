import React, { useState, useEffect } from 'react';
import { 
  Gamepad2, 
  Settings, 
  Volume2, 
  VolumeX, 
  Search,
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

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onTabChange,
  onOpenAddGame,
  onOpenSettings,
  gamepadConnected,
}) => {
  const [time, setTime] = useState<string>('');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

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

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    audioService.enabled = next;
    if (next) audioService.playConfirm();
  };

  return (
    <header className="relative z-30 h-14 flex items-center justify-between px-8 bg-transparent select-none">
      {/* Left: AnyPS5 Console Identity & Clean Navigation Tabs */}
      <div className="flex items-center space-x-10">
        {/* Subtle Brand Mark */}
        <div className="flex items-center space-x-2.5">
          <div className="w-6 h-6 rounded-md bg-white flex items-center justify-center">
            <span className="font-black text-black text-[11px] tracking-tighter">PS</span>
          </div>
          <span className="font-semibold text-sm tracking-wide text-white/90">
            AnyPS5 <span className="text-white/40 font-normal">Studio</span>
          </span>
        </div>

        {/* Console Navigation Tabs (Clean text with active indicator, no bloated pills) */}
        <nav className="flex items-center space-x-8 text-sm">
          <button
            onClick={() => handleTabClick('games')}
            className={`relative py-1 font-medium tracking-wide transition-colors ${
              activeTab === 'games'
                ? 'text-white'
                : 'text-neutral-400 hover:text-white/80'
            }`}
          >
            <span>Games</span>
            {activeTab === 'games' && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-white rounded-full" />
            )}
          </button>

          <button
            onClick={() => handleTabClick('relinker')}
            className={`relative py-1 font-medium tracking-wide transition-colors ${
              activeTab === 'relinker'
                ? 'text-white'
                : 'text-neutral-400 hover:text-white/80'
            }`}
          >
            <span>Relinker Studio</span>
            {activeTab === 'relinker' && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-white rounded-full" />
            )}
          </button>

          <button
            onClick={() => handleTabClick('nid')}
            className={`relative py-1 font-medium tracking-wide transition-colors ${
              activeTab === 'nid'
                ? 'text-white'
                : 'text-neutral-400 hover:text-white/80'
            }`}
          >
            <span>NID Inspector</span>
            {activeTab === 'nid' && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-white rounded-full" />
            )}
          </button>

          <button
            onClick={() => handleTabClick('prx')}
            className={`relative py-1 font-medium tracking-wide transition-colors ${
              activeTab === 'prx'
                ? 'text-white'
                : 'text-neutral-400 hover:text-white/80'
            }`}
          >
            <span>PRX Libraries</span>
            {activeTab === 'prx' && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-white rounded-full" />
            )}
          </button>

          <button
            onClick={() => handleTabClick('telemetry')}
            className={`relative py-1 font-medium tracking-wide transition-colors ${
              activeTab === 'telemetry'
                ? 'text-white'
                : 'text-neutral-400 hover:text-white/80'
            }`}
          >
            <span>System Status</span>
            {activeTab === 'telemetry' && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-white rounded-full" />
            )}
          </button>
        </nav>
      </div>

      {/* Right: Understated Console Controls */}
      <div className="flex items-center space-x-5 text-neutral-300">
        {/* Import Game Button */}
        <button
          onClick={() => {
            audioService.playConfirm();
            onOpenAddGame();
          }}
          className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-white/10 hover:bg-white/15 text-white text-xs font-medium transition-colors"
          title="Import Decrypted PS5 Title"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Import</span>
        </button>

        {/* Controller Status */}
        <div 
          className="flex items-center space-x-1.5 text-xs text-neutral-400"
          title={gamepadConnected ? "DualSense Wireless Controller Connected" : "Keyboard Navigation Active"}
        >
          <Gamepad2 className={`w-4 h-4 ${gamepadConnected ? 'text-blue-400' : 'text-neutral-500'}`} />
          {gamepadConnected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
        </div>

        {/* Audio Mute/Unmute */}
        <button
          onClick={toggleSound}
          className="p-1 hover:text-white transition-colors"
          title={soundEnabled ? "Mute UI Sounds" : "Unmute UI Sounds"}
        >
          {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-neutral-500" />}
        </button>

        {/* Settings */}
        <button
          onClick={() => {
            audioService.playConfirm();
            onOpenSettings();
          }}
          className="p-1 hover:text-white transition-colors"
          title="System Settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Console Clock */}
        <span className="text-xs font-medium tracking-wider text-white pl-2">
          {time}
        </span>
      </div>
    </header>
  );
};
