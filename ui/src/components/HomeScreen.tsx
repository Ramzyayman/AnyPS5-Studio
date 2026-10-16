import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Sparkles, 
  Code2, 
  CheckCircle2, 
  Info, 
  X,
  HardDrive, 
  Cpu, 
  ShieldCheck, 
  Clock, 
  Layers, 
  Activity,
  FileCode2,
  FolderSearch,
  Plus,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { GameItem } from '../types';
import { audioService } from '../services/audioService';

interface HomeScreenProps {
  games: GameItem[];
  selectedGameIndex: number;
  onSelectGame: (index: number) => void;
  onLaunchGame: (game: GameItem) => void;
  onStartRelinking: (game: GameItem) => void;
  onOpenNidAudit: (game: GameItem) => void;
  onOpenAddGame: () => void;
  onDeleteGame?: (id: string) => void;
  onClearDemoGames?: () => void;
  onResetDemoGames?: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  games,
  selectedGameIndex,
  onSelectGame,
  onLaunchGame,
  onStartRelinking,
  onOpenNidAudit,
  onOpenAddGame,
  onDeleteGame,
  onClearDemoGames,
  onResetDemoGames,
}) => {
  const [showTechnicalDrawer, setShowTechnicalDrawer] = useState<boolean>(false);
  const [sampleNoticeGame, setSampleNoticeGame] = useState<GameItem | null>(null);
  const selectedGame = games[selectedGameIndex] || games[0];
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Smoothly center the active game tile when selection changes
  useEffect(() => {
    if (itemRefs.current[selectedGameIndex]) {
      itemRefs.current[selectedGameIndex]?.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }
  }, [selectedGameIndex]);

  const handleTileClick = (index: number) => {
    if (index !== selectedGameIndex) {
      audioService.playNavTick();
      onSelectGame(index);
    }
  };

  const handlePlayAction = (game: GameItem) => {
    if (game.isSample) {
      audioService.playNavTick();
      setSampleNoticeGame(game);
    } else {
      audioService.playLaunch();
      onLaunchGame(game);
    }
  };

  const handleRelinkAction = (game: GameItem) => {
    if (game.isSample) {
      audioService.playNavTick();
      setSampleNoticeGame(game);
    } else {
      audioService.playConfirm();
      onStartRelinking(game);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  };

  const hasSampleTitles = games.some((g) => g.isSample);

  // PlayStation 5 Empty Library State
  if (games.length === 0) {
    return (
      <div className="relative w-full h-[calc(100vh-56px)] flex flex-col items-center justify-center p-8 text-center select-none animate-fade-in">
        <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-5 text-neutral-400">
          <FolderSearch className="w-7 h-7" />
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight mb-2">No Titles Installed</h2>
        <p className="text-sm text-neutral-400 max-w-md mb-8 leading-relaxed">
          AnyPS5 relinks real PlayStation 5 binaries into native Windows executables. Import your decrypted <span className="text-white font-mono text-xs">eboot.bin</span> or game folder to begin.
        </p>

        <div className="flex items-center space-x-3.5">
          <button
            onClick={() => {
              audioService.playConfirm();
              onOpenAddGame();
            }}
            className="flex items-center space-x-2 px-6 py-2.5 rounded-full bg-white text-black font-semibold text-xs hover:bg-neutral-200 transition-all shadow-lg active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Import PS5 Title</span>
          </button>

          {onResetDemoGames && (
            <button
              onClick={onResetDemoGames}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/15 text-white font-medium text-xs border border-white/10 transition-all"
            >
              <span>Load UI Demo Presets</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[calc(100vh-56px)] flex flex-col justify-between overflow-hidden select-none">
      {/* Full-viewport Dynamic Background Hero Artwork */}
      <div className="absolute inset-0 z-0 pointer-events-none transition-all duration-500 ease-out">
        {selectedGame?.backdropUrl && (
          <img
            key={selectedGame.id}
            src={selectedGame.backdropUrl}
            alt={selectedGame.title}
            className="w-full h-full object-cover object-top opacity-50 scale-100 transition-opacity duration-700 ease-in-out"
          />
        )}
        {/* Layered cinematic masks for legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#04060a] via-[#04060a]/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#04060a] via-[#04060a]/75 to-transparent w-full md:w-3/4" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#04060a]/80 via-transparent to-transparent h-32" />
      </div>

      {/* Top Section: Game Carousel Shelf */}
      <div className="relative z-10 pt-3 px-10">
        <div className="flex items-center justify-between text-[11px] font-medium text-neutral-400 tracking-wider uppercase mb-2.5">
          <div className="flex items-center space-x-2">
            <span>Installed Library</span>
            <span>•</span>
            <span className="text-white/80">{games.length} Titles</span>
            {hasSampleTitles && (
              <span className="text-[10px] text-amber-400/90 font-mono lowercase tracking-normal">
                (includes demo presets)
              </span>
            )}
          </div>

          {hasSampleTitles && onClearDemoGames && (
            <button
              onClick={onClearDemoGames}
              className="text-[11px] text-neutral-400 hover:text-white transition-colors lowercase"
              title="Remove sample demonstration games from library"
            >
              Clear demo presets
            </button>
          )}
        </div>

        {/* Shelf scroll container */}
        <div className="flex items-center space-x-4 overflow-x-auto pb-4 pt-1 px-1 scrollbar-none scroll-smooth">
          {games.map((game, idx) => {
            const isSelected = idx === selectedGameIndex;
            return (
              <button
                key={game.id}
                ref={(el) => {
                  itemRefs.current[idx] = el;
                }}
                onClick={() => handleTileClick(idx)}
                className={`relative flex-shrink-0 w-28 h-36 rounded-xl overflow-hidden transition-all duration-200 focus:outline-none ${
                  isSelected
                    ? 'scale-105 ring-2 ring-white ring-offset-2 ring-offset-[#04060a] z-20 shadow-2xl opacity-100'
                    : 'opacity-65 hover:opacity-90 hover:scale-[1.02]'
                }`}
              >
                <img
                  src={game.iconUrl}
                  alt={game.title}
                  className="w-full h-full object-cover"
                />

                {/* Status Dot */}
                <div className="absolute top-2 right-2">
                  {game.status === 'ported' ? (
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 block shadow-sm" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-blue-400 block" />
                  )}
                </div>

                {/* Subtle gradient on tile */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 text-left">
                  <p className="text-[11px] font-semibold text-white truncate leading-tight">
                    {game.title}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Center-Lower Section: Selected Game Hero & Primary Actions */}
      {selectedGame && (
        <div className="relative z-10 px-10 pb-12 max-w-4xl">
          {/* Metadata Row */}
          <div className="flex items-center space-x-3 mb-2 text-xs flex-wrap gap-y-1">
            <span className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-[11px] font-semibold tracking-wider">
              PS5
            </span>
            <span className="text-neutral-400 font-mono text-xs">
              {selectedGame.titleId}
            </span>
            <span className="text-neutral-600">•</span>
            {selectedGame.isSample && (
              <>
                <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 font-mono text-[10px] font-semibold border border-amber-500/30">
                  Demo Preset · Files Not On Disk
                </span>
                <span className="text-neutral-600">•</span>
              </>
            )}
            {selectedGame.status === 'ported' ? (
              <span className="flex items-center space-x-1.5 text-emerald-400 text-xs font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Ported · Windows Native PE</span>
              </span>
            ) : (
              <span className="flex items-center space-x-1.5 text-blue-400 text-xs font-medium">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Decrypted · Ready to Relink</span>
              </span>
            )}
            <span className="text-neutral-600">•</span>
            <span className="text-neutral-400 text-xs">
              {formatSize(selectedGame.sizeBytes)}
            </span>
          </div>

          {/* Large Game Title */}
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-3 drop-shadow-md">
            {selectedGame.title}
          </h1>

          {/* Concise Description */}
          <p className="text-sm text-neutral-300 max-w-xl leading-relaxed mb-8 drop-shadow">
            {selectedGame.isSample
              ? 'Preloaded UI demonstration preset. Real binary execution requires importing your own decrypted PlayStation 5 eboot.bin.'
              : 'Native executable port for 64-bit Windows. Uses clean-room PRX system libraries with Vulkan/SPIR-V graphics pipeline translation.'}
          </p>

          {/* Action Buttons Zone (PlayStation Hierarchy: Bold Primary + Translucent Secondaries) */}
          <div className="flex flex-wrap items-center gap-3">
            {selectedGame.status === 'ported' ? (
              <button
                onClick={() => handlePlayAction(selectedGame)}
                className="flex items-center space-x-2.5 px-8 py-3 rounded-full bg-white text-black font-semibold text-sm hover:bg-neutral-200 transition-all active:scale-95 shadow-lg"
              >
                <Play className="w-4 h-4 fill-current ml-0.5" />
                <span>Play Game</span>
              </button>
            ) : (
              <button
                onClick={() => handleRelinkAction(selectedGame)}
                className="flex items-center space-x-2.5 px-8 py-3 rounded-full bg-white text-black font-semibold text-sm hover:bg-neutral-200 transition-all active:scale-95 shadow-lg"
              >
                <Sparkles className="w-4 h-4" />
                <span>Relink Game</span>
              </button>
            )}

            {/* Secondary Action: Relinker Studio */}
            <button
              onClick={() => {
                audioService.playConfirm();
                onStartRelinking(selectedGame);
              }}
              className="flex items-center space-x-2 px-5 py-3 rounded-full bg-white/10 hover:bg-white/15 text-white font-medium text-xs tracking-wide border border-white/10 transition-all"
            >
              <span>Relinker Studio</span>
            </button>

            {/* Tertiary Action: NID Compatibility */}
            <button
              onClick={() => {
                audioService.playConfirm();
                onOpenNidAudit(selectedGame);
              }}
              className="flex items-center space-x-2 px-5 py-3 rounded-full bg-white/10 hover:bg-white/15 text-white font-medium text-xs tracking-wide border border-white/10 transition-all"
            >
              <Code2 className="w-3.5 h-3.5 text-neutral-300" />
              <span>NID Compatibility ({selectedGame.compatibility.score}%)</span>
            </button>

            {/* Technical Specs Drawer Toggle */}
            <button
              onClick={() => {
                audioService.playNavTick();
                setShowTechnicalDrawer(!showTechnicalDrawer);
              }}
              className="flex items-center space-x-1.5 px-4 py-3 rounded-full bg-white/5 hover:bg-white/10 text-neutral-300 font-medium text-xs border border-white/5 transition-all"
              title="View Contextual Technical Specs"
            >
              <Info className="w-3.5 h-3.5" />
              <span>Details</span>
            </button>
          </div>
        </div>
      )}

      {/* Contextual Technical Specs Drawer (Sliding Console Panel) */}
      {showTechnicalDrawer && selectedGame && (
        <div className="absolute right-0 top-0 bottom-0 w-96 ps-panel z-40 p-6 flex flex-col justify-between border-l border-white/10 animate-fade-in shadow-2xl">
          <div className="space-y-6 overflow-y-auto pr-1">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center space-x-2 text-white font-semibold text-sm">
                <Info className="w-4 h-4 text-neutral-400" />
                <span>Technical Specifications</span>
              </div>
              <button
                onClick={() => setShowTechnicalDrawer(false)}
                className="p-1 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {selectedGame.isSample && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200/90 text-xs leading-relaxed">
                <p className="font-semibold text-amber-300 mb-0.5">Demo Title Preset</p>
                This entry is bundled for UI layout demonstration. No files exist on disk at <code className="text-white font-mono text-[11px] block mt-1">{selectedGame.path}</code>
              </div>
            )}

            {/* Spec items */}
            <div className="space-y-4 text-xs">
              <div>
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold block mb-0.5">Title & Path</span>
                <p className="text-white font-medium">{selectedGame.title}</p>
                <p className="text-neutral-400 font-mono text-[11px] truncate">{selectedGame.path}</p>
              </div>

              <div>
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold block mb-0.5">Executable Binary</span>
                <p className="text-white font-mono">{selectedGame.executableName}</p>
              </div>

              <div>
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold block mb-0.5">PS5 SDK Target</span>
                <p className="text-white font-mono">{selectedGame.sdkVersion}</p>
              </div>

              <div>
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold block mb-0.5">Host CPU Requirements</span>
                <p className="text-white">{selectedGame.minHostCpu}</p>
                <p className="text-[10px] text-neutral-400 mt-0.5">Requires Zen2 AVX2, FMA, F16C, BMI1, BMI2, LZCNT, MOVBE.</p>
              </div>

              <div>
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold block mb-0.5">NID Import Coverage</span>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-white font-mono font-bold">{selectedGame.compatibility.score}%</span>
                  <span className="text-neutral-400 font-mono text-[11px]">
                    {selectedGame.compatibility.resolvedNids} / {selectedGame.compatibility.totalNids} functions
                  </span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                  <div 
                    className="bg-emerald-400 h-full rounded-full"
                    style={{ width: `${selectedGame.compatibility.score}%` }}
                  />
                </div>
              </div>

              <div>
                <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold block mb-0.5">Play Statistics</span>
                <p className="text-white">{selectedGame.playTime || '0 hrs'} total playtime</p>
                <p className="text-neutral-400 text-[11px]">Last session: {selectedGame.lastPlayed || 'Never'}</p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-white/10 space-y-2">
            <button
              onClick={() => {
                setShowTechnicalDrawer(false);
                onOpenNidAudit(selectedGame);
              }}
              className="w-full py-2.5 rounded-full bg-white/10 hover:bg-white/15 text-white font-semibold text-xs tracking-wide transition-colors"
            >
              Open Full NID Audit
            </button>

            {onDeleteGame && (
              <button
                onClick={() => {
                  setShowTechnicalDrawer(false);
                  onDeleteGame(selectedGame.id);
                }}
                className="w-full py-2 rounded-full bg-red-500/10 hover:bg-red-500/20 text-red-400 font-semibold text-xs tracking-wide border border-red-500/20 transition-colors flex items-center justify-center space-x-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove From Library</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Demo / Sample Preset Notice Dialog */}
      {sampleNoticeGame && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-md bg-[#0b0e14]/95 rounded-2xl border border-white/10 overflow-hidden shadow-2xl p-6">
            <div className="flex items-center space-x-2.5 text-amber-400 mb-3">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="font-semibold text-base text-white">Demo Preset Title</h3>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed mb-4">
              <strong className="text-white">{sampleNoticeGame.title}</strong> is a preloaded demonstration preset to showcase the PlayStation 5 UI and metadata.
            </p>

            <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 font-mono text-[11px] text-neutral-400 mb-5 break-all">
              Path not found: {sampleNoticeGame.path}/{sampleNoticeGame.executableName}
            </div>

            <p className="text-xs text-neutral-400 mb-6 leading-relaxed">
              To port and run games natively on your PC, import your own decrypted PlayStation 5 <code className="text-white font-mono">eboot.bin</code>.
            </p>

            <div className="flex flex-col space-y-2">
              <button
                onClick={() => {
                  setSampleNoticeGame(null);
                  audioService.playConfirm();
                  onOpenAddGame();
                }}
                className="w-full py-2.5 rounded-full bg-white text-black font-semibold text-xs hover:bg-neutral-200 transition-colors"
              >
                Import Real PS5 Game
              </button>

              <button
                onClick={() => {
                  const game = sampleNoticeGame;
                  setSampleNoticeGame(null);
                  audioService.playLaunch();
                  onLaunchGame(game);
                }}
                className="w-full py-2.5 rounded-full bg-white/10 hover:bg-white/15 text-white font-medium text-xs transition-colors"
              >
                Preview Simulated Runtime HUD
              </button>

              <button
                onClick={() => {
                  audioService.playCancel();
                  setSampleNoticeGame(null);
                }}
                className="w-full py-2 rounded-full text-xs text-neutral-400 hover:text-white transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
