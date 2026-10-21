import React, { useState, useEffect, useRef } from 'react';
import { 
  Gamepad2, 
  Settings, 
  Plus,
  Minus,
  Square,
  Copy,
  X,
  ChevronDown,
  Wrench,
  GitPullRequest,
  Code2,
  Activity
} from 'lucide-react';
import { audioService } from '../services/audioService';
import { apiBridge } from '../services/apiBridge';

interface TopBarProps {
  activeTab: 'games' | 'relinker' | 'runtimes' | 'community' | 'nid' | 'telemetry' | 'settings';
  onTabChange: (tab: 'games' | 'relinker' | 'runtimes' | 'community' | 'nid' | 'telemetry' | 'settings') => void;
  onOpenAddGame: () => void;
  onOpenSettings: () => void;
  gamepadConnected: boolean;
  showAdvancedNav?: boolean;
}

const PRIMARY_NAV_ITEMS: { key: 'games' | 'relinker' | 'runtimes'; label: string }[] = [
  { key: 'games', label: 'Games' },
  { key: 'relinker', label: 'Relinker Studio' },
  { key: 'runtimes', label: 'Runtime Manager' },
];

const DIAGNOSTIC_ITEMS: {
  key: 'community' | 'nid' | 'telemetry';
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: 'community', label: 'Community PR Builds', desc: 'Pull request testing & multi-PR merging', icon: GitPullRequest },
  { key: 'nid', label: 'NID Inspector', desc: 'Audit unresolved PS5 system calls', icon: Code2 },
  { key: 'telemetry', label: 'System Status', desc: 'Hardware & translation telemetry', icon: Activity },
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
  const [isDiagOpen, setIsDiagOpen] = useState<boolean>(false);
  const diagDropdownRef = useRef<HTMLDivElement>(null);

  const isDiagnosticActive = DIAGNOSTIC_ITEMS.some((item) => item.key === activeTab);
  const activeDiagItem = DIAGNOSTIC_ITEMS.find((item) => item.key === activeTab);

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

  // Close dropdown on outside click or escape
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (diagDropdownRef.current && !diagDropdownRef.current.contains(e.target as Node)) {
        setIsDiagOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDiagOpen) {
        setIsDiagOpen(false);
      }
    };

    if (isDiagOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDiagOpen]);

  const handleTabClick = (tab: 'games' | 'relinker' | 'runtimes' | 'community' | 'nid' | 'telemetry') => {
    if (tab !== activeTab) {
      audioService.playNavTick();
      onTabChange(tab);
    }
  };

  const primaryNavItems = showAdvancedNav
    ? [
        { key: 'games' as const, label: 'Games' },
        { key: 'relinker' as const, label: 'Relinker Studio' },
        { key: 'runtimes' as const, label: 'Runtime Manager' },
      ]
    : [
        { key: 'games' as const, label: 'Games' },
        { key: 'relinker' as const, label: 'Relinker Studio' },
      ];

  return (
    <header 
      onDoubleClick={() => apiBridge.maximizeWindow()}
      className="relative z-50 h-16 flex items-center justify-between px-3 sm:px-4 md:px-6 xl:px-10 bg-transparent select-none cursor-default w-full"
      style={{ WebkitAppRegion: 'drag' } as any}
    >
      {/* Left: Console Brand & Clean Navigation + Diagnostics Menu */}
      <div className="flex items-center space-x-3 sm:space-x-4 md:space-x-6 lg:space-x-8 shrink-0 min-w-0" style={{ WebkitAppRegion: 'no-drag' } as any}>
        {/* Compact Console Brand Mark */}
        <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
          <div className="w-5 h-5 rounded-[4px] bg-white flex items-center justify-center">
            <span className="font-black text-black text-[10px] tracking-tighter">PS</span>
          </div>
          <span className="font-semibold text-xs tracking-wider text-white/90 uppercase whitespace-nowrap">
            AnyPS5 <span className="text-white/40 font-normal">Studio</span>
          </span>
        </div>

        {/* Primary High-Level Navigation */}
        <nav className="flex items-baseline space-x-2 sm:space-x-3 md:space-x-5 xl:space-x-7 shrink-0" role="tablist">
          {primaryNavItems.map((item) => {
            const isSelected = activeTab === item.key;
            return (
              <button
                key={item.key}
                role="tab"
                aria-selected={isSelected}
                onClick={() => handleTabClick(item.key)}
                className={`relative py-1 whitespace-nowrap shrink-0 tracking-wide focus:outline-none focus-visible:ring-1 focus-visible:ring-white/60 focus-visible:rounded transition-all duration-200 ease-out motion-reduce:transition-none ${
                  isSelected
                    ? 'text-white text-xs sm:text-sm xl:text-[15px] font-semibold opacity-100'
                    : 'text-white/65 text-xs sm:text-sm xl:text-[14px] font-normal hover:text-white/90'
                }`}
              >
                <span>{item.label}</span>
              </button>
            );
          })}

          {/* Diagnostics / Tools Dropdown (Option 1) - Only shown if advanced settings is enabled */}
          {showAdvancedNav && (
            <div ref={diagDropdownRef} className="relative inline-block text-left shrink-0">
              <button
                type="button"
                onClick={() => {
                  audioService.playNavTick();
                  setIsDiagOpen((prev) => !prev);
                }}
                className={`flex items-center space-x-1.5 py-1 px-2.5 rounded-lg text-xs sm:text-sm xl:text-[14px] transition-all focus:outline-none ${
                  isDiagnosticActive
                    ? 'text-blue-300 font-semibold bg-blue-500/15 border border-blue-500/30 shadow-sm'
                    : 'text-white/65 font-normal hover:text-white hover:bg-white/5'
                }`}
              >
                <Wrench className="w-3.5 h-3.5 opacity-80" />
                <span>{isDiagnosticActive && activeDiagItem ? activeDiagItem.label : 'Diagnostics'}</span>
                <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isDiagOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Floating Dropdown Menu */}
              {isDiagOpen && (
                <div 
                  className="absolute left-0 mt-2 w-64 rounded-2xl bg-[#080b11]/98 border border-white/15 shadow-2xl backdrop-blur-xl p-1.5 z-50 animate-fade-in space-y-1 ring-1 ring-black/50"
                  style={{ WebkitAppRegion: 'no-drag' } as any}
                >
                  <div className="px-3 py-1.5 text-[10px] font-semibold text-neutral-400 uppercase tracking-wider border-b border-white/5">
                    Developer & Inspection Tools
                  </div>

                  {DIAGNOSTIC_ITEMS.map((item) => {
                    const isSelected = activeTab === item.key;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.key}
                        onClick={() => {
                          handleTabClick(item.key);
                          setIsDiagOpen(false);
                        }}
                        className={`w-full flex items-start space-x-2.5 p-2 rounded-xl text-left transition-colors ${
                          isSelected
                            ? 'bg-blue-600/20 text-white border border-blue-500/30'
                            : 'text-neutral-300 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <div className={`mt-0.5 p-1 rounded-lg ${isSelected ? 'bg-blue-500 text-white' : 'bg-white/5 text-neutral-400'}`}>
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold">{item.label}</div>
                          <div className="text-[10px] text-neutral-400 leading-tight truncate">{item.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </nav>
      </div>

      {/* Right: Small, Understated Console Controls & Window Controls (Strictly Pinned) */}
      <div 
        className="flex items-center space-x-1.5 sm:space-x-2.5 md:space-x-3 lg:space-x-4 text-neutral-300 shrink-0 ml-auto z-40" 
        style={{ WebkitAppRegion: 'no-drag' } as any}
      >
        {/* Import Game Button */}
        <button
          onClick={() => {
            audioService.playConfirm();
            onOpenAddGame();
          }}
          className="flex items-center space-x-1 px-2.5 py-1 rounded-full text-white/60 hover:text-white hover:bg-white/10 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white/50 whitespace-nowrap shrink-0"
          title="Import Decrypted PS5 Title"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden 2xl:inline">Import</span>
        </button>

        {/* Controller Status */}
        <div 
          className="flex items-center space-x-1.5 text-xs text-white/40 shrink-0"
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
          className={`p-1.5 rounded-full transition-all focus:outline-none focus-visible:ring-1 focus-visible:ring-white/50 shrink-0 ${
            activeTab === 'settings'
              ? 'text-white bg-white/20 ring-1 ring-white/30'
              : 'text-white/50 hover:text-white hover:bg-white/10'
          }`}
          title="System Settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        {/* Console Clock */}
        <span className="text-xs font-medium tracking-wider text-white/70 pl-1 whitespace-nowrap shrink-0 hidden xl:inline">
          {time}
        </span>

        {/* Minimal Frameless Window Controls */}
        <div className="flex items-center space-x-0.5 pl-1.5 sm:pl-2 border-l border-white/10 shrink-0">
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
