import React, { useState, useEffect } from 'react';
import { TopBar } from './components/TopBar';
import { HomeScreen } from './components/HomeScreen';
import { RelinkerStudio } from './components/RelinkerStudio';
import { NidInspector } from './components/NidInspector';
import { PrxManager } from './components/PrxManager';
import { TelemetryPanel } from './components/TelemetryPanel';
import { GameLauncherModal } from './components/GameLauncherModal';
import { AddGameModal } from './components/AddGameModal';
import { SettingsModal } from './components/SettingsModal';
import { CommunityPRBuilds } from './components/CommunityPRBuilds';
import { GameItem } from './types';
import { apiBridge } from './services/apiBridge';
import { audioService } from './services/audioService';
import { CheckCircle2, X } from 'lucide-react';

import { INITIAL_GAMES } from './services/sampleData';

export const App: React.FC = () => {
  const [games, setGames] = useState<GameItem[]>([]);
  const [selectedGameIndex, setSelectedGameIndex] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'games' | 'relinker' | 'community' | 'nid' | 'prx' | 'telemetry'>('games');
  const [activeRunningGame, setActiveRunningGame] = useState<GameItem | null>(null);
  const [isAddGameOpen, setIsAddGameOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [gamepadConnected, setGamepadConnected] = useState<boolean>(false);
  const [downloadedUpdateVersion, setDownloadedUpdateVersion] = useState<string | null>(null);
  const [showUpdateToast, setShowUpdateToast] = useState<boolean>(false);
  const [communitySearchKeyword, setCommunitySearchKeyword] = useState<string>('');

  // Advanced navbar items setting (persisted in localStorage, default OFF)
  const [showAdvancedNav, setShowAdvancedNav] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem('anyps5_show_advanced_nav');
      return stored === 'true';
    } catch {
      return false;
    }
  });

  const handleToggleAdvancedNav = (enabled: boolean) => {
    setShowAdvancedNav(enabled);
    try {
      localStorage.setItem('anyps5_show_advanced_nav', enabled ? 'true' : 'false');
    } catch (err) {
      console.error('Failed to save advanced nav preference:', err);
    }
    // If user is currently viewing an advanced section and disables Advanced, navigate safely to Games
    if (!enabled && ['nid', 'prx', 'telemetry'].includes(activeTab)) {
      setActiveTab('games');
    }
  };

  // Load games from apiBridge
  useEffect(() => {
    apiBridge.getGames().then((loaded) => {
      setGames(loaded);
    });
  }, []);

  // Listen for background auto-updates
  useEffect(() => {
    const unsub = apiBridge.onUpdateStatus((status) => {
      if (status.status === 'downloaded' && status.version) {
        setDownloadedUpdateVersion(status.version);
        setShowUpdateToast(true);
        audioService.playConfirm();
      }
    });
    return () => unsub();
  }, []);

  const availableTabs: ('games' | 'relinker' | 'community' | 'nid' | 'prx' | 'telemetry')[] = showAdvancedNav
    ? ['games', 'relinker', 'community', 'nid', 'prx', 'telemetry']
    : ['games', 'relinker', 'community'];

  // Keyboard navigation for authentic console feel
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isAddGameOpen || isSettingsOpen || activeRunningGame) return;

      // Tab switching via Q/E or [ / ]
      if ((e.key === 'q' || e.key === 'Q' || e.key === '[') && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        setActiveTab((prev) => {
          const idx = availableTabs.indexOf(prev);
          const currentIdx = idx === -1 ? 0 : idx;
          const next = availableTabs[(currentIdx - 1 + availableTabs.length) % availableTabs.length];
          audioService.playNavTick();
          return next;
        });
        return;
      }

      if ((e.key === 'e' || e.key === 'E' || e.key === ']') && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        setActiveTab((prev) => {
          const idx = availableTabs.indexOf(prev);
          const currentIdx = idx === -1 ? 0 : idx;
          const next = availableTabs[(currentIdx + 1) % availableTabs.length];
          audioService.playNavTick();
          return next;
        });
        return;
      }

      if (games.length === 0) return;

      if (e.key === 'ArrowRight' && activeTab === 'games') {
        setSelectedGameIndex((prev) => {
          const next = (prev + 1) % games.length;
          audioService.playNavTick();
          return next;
        });
      } else if (e.key === 'ArrowLeft' && activeTab === 'games') {
        setSelectedGameIndex((prev) => {
          const next = (prev - 1 + games.length) % games.length;
          audioService.playNavTick();
          return next;
        });
      } else if (e.key === 'Enter' && activeTab === 'games') {
        const game = games[selectedGameIndex];
        if (game) {
          if (game.status === 'ported') {
            audioService.playLaunch();
            setActiveRunningGame(game);
          } else {
            audioService.playConfirm();
            setActiveTab('relinker');
          }
        }
      } else if (e.key === 'Escape') {
        if (activeTab !== 'games') {
          audioService.playCancel();
          setActiveTab('games');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [games, selectedGameIndex, activeTab, isAddGameOpen, isSettingsOpen, activeRunningGame, availableTabs]);

  // Gamepad API Polling
  useEffect(() => {
    let animationFrameId: number;
    let lastButtonState = false;
    let lastBumperState = false;

    const pollGamepads = () => {
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      const gp = gamepads[0];
      setGamepadConnected(Boolean(gp));

      if (gp && !isAddGameOpen && !isSettingsOpen && !activeRunningGame) {
        // L1 / LB (Button 4) and R1 / RB (Button 5) tab navigation
        const l1Pressed = gp.buttons[4]?.pressed;
        const r1Pressed = gp.buttons[5]?.pressed;

        if (l1Pressed && !lastBumperState) {
          lastBumperState = true;
          setActiveTab((prev) => {
            const idx = availableTabs.indexOf(prev);
            const currentIdx = idx === -1 ? 0 : idx;
            const next = availableTabs[(currentIdx - 1 + availableTabs.length) % availableTabs.length];
            audioService.playNavTick();
            return next;
          });
        } else if (r1Pressed && !lastBumperState) {
          lastBumperState = true;
          setActiveTab((prev) => {
            const idx = availableTabs.indexOf(prev);
            const currentIdx = idx === -1 ? 0 : idx;
            const next = availableTabs[(currentIdx + 1) % availableTabs.length];
            audioService.playNavTick();
            return next;
          });
        } else if (!l1Pressed && !r1Pressed) {
          lastBumperState = false;
        }

        // D-pad & Sticks when on games tab
        if (activeTab === 'games' && games.length > 0) {
          const rightPressed = gp.buttons[15]?.pressed || gp.axes[0] > 0.5;
          const leftPressed = gp.buttons[14]?.pressed || gp.axes[0] < -0.5;
          const crossPressed = gp.buttons[0]?.pressed; // Cross / A

          if (rightPressed && !lastButtonState) {
            lastButtonState = true;
            setSelectedGameIndex((prev) => {
              const next = (prev + 1) % games.length;
              audioService.playNavTick();
              return next;
            });
          } else if (leftPressed && !lastButtonState) {
            lastButtonState = true;
            setSelectedGameIndex((prev) => {
              const next = (prev - 1 + games.length) % games.length;
              audioService.playNavTick();
              return next;
            });
          } else if (crossPressed && !lastButtonState) {
            lastButtonState = true;
            const game = games[selectedGameIndex];
            if (game) {
              if (game.status === 'ported') {
                audioService.playLaunch();
                setActiveRunningGame(game);
              } else {
                audioService.playConfirm();
                setActiveTab('relinker');
              }
            }
          } else if (!rightPressed && !leftPressed && !crossPressed) {
            lastButtonState = false;
          }
        }
      }

      animationFrameId = requestAnimationFrame(pollGamepads);
    };

    animationFrameId = requestAnimationFrame(pollGamepads);
    return () => cancelAnimationFrame(animationFrameId);
  }, [games, selectedGameIndex, activeTab, isAddGameOpen, isSettingsOpen, activeRunningGame, availableTabs]);

  const handleUpdateGameStatus = (gameId: string, status: 'ported', updatedGame?: GameItem) => {
    setGames((prev) => {
      const updated = prev.map((g) => {
        if (g.id === gameId) {
          return updatedGame ? { ...g, ...updatedGame, status } : { ...g, status };
        }
        return g;
      });
      apiBridge.saveGames(updated);
      return updated;
    });
  };

  const handleAddGame = (newGame: GameItem) => {
    setGames((prev) => {
      const updated = [newGame, ...prev];
      apiBridge.saveGames(updated);
      return updated;
    });
    setSelectedGameIndex(0);
  };

  const handleDeleteGame = (gameId: string) => {
    audioService.playCancel();
    setGames((prev) => {
      const updated = prev.filter((g) => g.id !== gameId);
      apiBridge.saveGames(updated);
      return updated;
    });
    setSelectedGameIndex(0);
  };

  const handleClearDemoGames = () => {
    audioService.playCancel();
    setGames((prev) => {
      const updated = prev.filter((g) => !g.isSample);
      apiBridge.saveGames(updated);
      return updated;
    });
    setSelectedGameIndex(0);
  };

  const handleResetDemoGames = () => {
    audioService.playConfirm();
    setGames(INITIAL_GAMES);
    apiBridge.saveGames(INITIAL_GAMES);
    setSelectedGameIndex(0);
  };

  const selectedGame = games[selectedGameIndex] || games[0];

  return (
    <div className="relative w-screen h-screen bg-[#04060a] text-slate-100 overflow-hidden select-none">
      {/* Top PlayStation Header - Floats transparently over the artwork */}
      <div className="absolute top-0 left-0 right-0 z-30 pointer-events-auto bg-transparent">
        <TopBar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onOpenAddGame={() => setIsAddGameOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          gamepadConnected={gamepadConnected}
          showAdvancedNav={showAdvancedNav}
        />
      </div>

      {/* Main Tab Screen - Extends full viewport from y = 0 */}
      <main className="w-full h-full min-h-0 overflow-hidden">
        {activeTab === 'games' && (
          <HomeScreen
            games={games}
            selectedGameIndex={selectedGameIndex}
            onSelectGame={setSelectedGameIndex}
            onLaunchGame={(game) => setActiveRunningGame(game)}
            onStartRelinking={() => setActiveTab('relinker')}
            onOpenNidAudit={() => setActiveTab('nid')}
            onOpenAddGame={() => setIsAddGameOpen(true)}
            onDeleteGame={handleDeleteGame}
            onClearDemoGames={handleClearDemoGames}
            onResetDemoGames={handleResetDemoGames}
          />
        )}

        {activeTab === 'relinker' && (
          selectedGame ? (
            <RelinkerStudio
              games={games}
              selectedGame={selectedGame}
              onUpdateGameStatus={handleUpdateGameStatus}
              onLaunchGame={(game) => setActiveRunningGame(game)}
              onNavigateToGames={() => setActiveTab('games')}
            />
          ) : (
            <div className="flex-1 h-full flex flex-col items-center justify-center p-8 pt-20 text-center animate-fade-in">
              <p className="text-neutral-400 text-sm mb-4">No title selected for relinking.</p>
              <button
                onClick={() => setIsAddGameOpen(true)}
                className="px-6 py-2.5 rounded-full bg-white text-black font-semibold text-xs hover:bg-neutral-200 transition-all"
              >
                Import PS5 Title
              </button>
            </div>
          )
        )}

        {activeTab === 'community' && (
          <CommunityPRBuilds
            initialSearch={communitySearchKeyword}
            onClearInitialSearch={() => setCommunitySearchKeyword('')}
            onNavigateToGames={() => setActiveTab('games')}
            onNavigateToRelinker={() => setActiveTab('relinker')}
          />
        )}

        {activeTab === 'nid' && (
          selectedGame ? (
            <NidInspector game={selectedGame} />
          ) : (
            <div className="flex-1 h-full flex flex-col items-center justify-center p-8 pt-20 text-center animate-fade-in">
              <p className="text-neutral-400 text-sm mb-4">No title selected for NID audit.</p>
              <button
                onClick={() => setIsAddGameOpen(true)}
                className="px-6 py-2.5 rounded-full bg-white text-black font-semibold text-xs hover:bg-neutral-200 transition-all"
              >
                Import PS5 Title
              </button>
            </div>
          )
        )}

        {activeTab === 'prx' && <PrxManager />}

        {activeTab === 'telemetry' && <TelemetryPanel />}
      </main>

      {/* Game Running Modal */}
      {activeRunningGame && (
        <GameLauncherModal
          game={activeRunningGame}
          onClose={() => setActiveRunningGame(null)}
          onNavigateToRelinker={(g) => {
            setActiveRunningGame(null);
            const idx = games.findIndex((item) => item.id === g.id);
            if (idx !== -1) setSelectedGameIndex(idx);
            setActiveTab('relinker');
          }}
          onNavigateToCommunityPRs={(keyword) => {
            setActiveRunningGame(null);
            if (keyword) setCommunitySearchKeyword(keyword);
            setActiveTab('community');
          }}
        />
      )}

      {/* Import Game Modal */}
      <AddGameModal
        isOpen={isAddGameOpen}
        onClose={() => setIsAddGameOpen(false)}
        onAddGame={handleAddGame}
      />

      {/* Configuration / Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        showAdvancedNav={showAdvancedNav}
        onToggleAdvancedNav={handleToggleAdvancedNav}
      />

      {/* PS5 Notification Toast: Update Ready */}
      {showUpdateToast && downloadedUpdateVersion && (
        <div className="fixed top-14 right-6 z-50 animate-fade-in max-w-sm w-full bg-[#141923]/95 border border-white/20 rounded-2xl shadow-2xl backdrop-blur-xl p-4 flex flex-col space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-[#0070d1]/20 border border-[#0070d1]/40 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-5 h-5 text-[#0070d1]" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-white tracking-wide">Update Ready to Install</h4>
                <p className="text-[11px] text-white/60 mt-0.5">AnyPS5 Studio v{downloadedUpdateVersion} has been downloaded.</p>
              </div>
            </div>
            <button
              onClick={() => setShowUpdateToast(false)}
              className="text-white/40 hover:text-white/80 transition-colors p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex items-center justify-end space-x-2 pt-1 border-t border-white/10">
            <button
              onClick={() => setShowUpdateToast(false)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-white/60 hover:text-white transition-colors"
            >
              Later
            </button>
            <button
              onClick={() => {
                audioService.playConfirm();
                apiBridge.quitAndInstallUpdate();
              }}
              className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-semibold transition-colors shadow-lg shadow-emerald-500/20"
            >
              Restart & Install
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
