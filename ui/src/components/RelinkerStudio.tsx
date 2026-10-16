import React, { useState, useRef, useEffect } from 'react';
import { 
  Sparkles, 
  Terminal, 
  CheckCircle2, 
  Loader2, 
  Sliders, 
  RotateCcw,
  ArrowRight
} from 'lucide-react';
import { GameItem, RelinkerOptions, ConversionStage, ConversionLog } from '../types';
import { apiBridge } from '../services/apiBridge';
import { audioService } from '../services/audioService';

interface RelinkerStudioProps {
  games: GameItem[];
  selectedGame: GameItem;
  onUpdateGameStatus: (gameId: string, status: 'ported', updatedGame?: GameItem) => void;
}

export const RelinkerStudio: React.FC<RelinkerStudioProps> = ({
  games,
  selectedGame: initialGame,
  onUpdateGameStatus,
}) => {
  const [selectedGame, setSelectedGame] = useState<GameItem>(initialGame);
  const [isRelinking, setIsRelinking] = useState<boolean>(false);
  const [stages, setStages] = useState<ConversionStage[]>([
    { id: 1, title: 'Validating Decrypted ELF', description: 'Inspecting ELF headers & PT_LOAD segments', status: 'pending' },
    { id: 2, title: 'Scanning System Imports (NIDs)', description: 'Resolving PS5 library imports against clean-room PRX exports', status: 'pending' },
    { id: 3, title: 'Scanning Bundled Modules', description: 'Parsing modules in sce_module/ for runtime dependencies', status: 'pending' },
    { id: 4, title: 'AMD to Intel Codegen Translation', description: 'Rewriting AMD-specific Zen2 instructions', status: 'pending' },
    { id: 5, title: 'Unused Import Filter & PLT', description: 'Analyzing control-flow and compacting PLT', status: 'pending' },
    { id: 6, title: 'Relinking PE Executable', description: 'Generating Windows PE headers and entry RVA', status: 'pending' },
    { id: 7, title: 'Copying Clean-room PRX Libraries', description: 'Deploying system libraries (libkernel, libSceAgcDriver)', status: 'pending' },
    { id: 8, title: 'Finalizing Native Package', description: 'Writing app.exe and registry metadata', status: 'pending' },
  ]);
  const [logs, setLogs] = useState<ConversionLog[]>([
    { timestamp: new Date().toLocaleTimeString(), level: 'info', message: 'Relinker Studio ready. Select a PS5 title and configure conversion parameters.' }
  ]);
  const [options, setOptions] = useState<RelinkerOptions>({
    target: 'windows',
    subsystem: 'gui',
    cpuTranslation: 'intel',
    unusedFilter: 1,
    rpath: '$ORIGIN/libs',
    traceImports: false,
    windowsDiagnostics: true,
    fixedBaseAddress: '',
    autorun: false,
    sceModulePath: '',
  });

  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleStartRelinking = async () => {
    if (isRelinking) return;
    audioService.playConfirm();
    setIsRelinking(true);

    // Reset stages
    setStages(prev => prev.map(s => ({ ...s, status: 'pending' })));

    let finalGame: GameItem | undefined;

    const success = await apiBridge.executeRelinker(
      selectedGame,
      options,
      (updatedStage) => {
        setStages(prev => prev.map(s => s.id === updatedStage.id ? updatedStage : s));
      },
      (newLog) => {
        setLogs(prev => [...prev, newLog]);
      },
      (updatedGame) => {
        if (updatedGame) {
          finalGame = updatedGame;
          setSelectedGame(updatedGame);
        }
      }
    );

    setIsRelinking(false);
    if (success) {
      audioService.playSuccess();
      onUpdateGameStatus(selectedGame.id, 'ported', finalGame);
    } else {
      audioService.playCancel();
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-56px)] flex flex-col p-8 overflow-y-auto select-none">
      {/* Console Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
        <div>
          <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider block mb-1">
            System Software / Porting Tools
          </span>
          <h2 className="text-2xl font-bold text-white tracking-tight">Relinker Studio</h2>
        </div>

        {/* Selected Game Picker */}
        <div className="flex items-center space-x-3 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
          <img
            src={selectedGame.iconUrl}
            alt={selectedGame.title}
            className="w-6 h-6 rounded-md object-cover"
          />
          <select
            value={selectedGame.id}
            onChange={(e) => {
              const found = games.find(g => g.id === e.target.value);
              if (found) {
                audioService.playNavTick();
                setSelectedGame(found);
              }
            }}
            className="bg-transparent text-white font-medium text-xs focus:outline-none cursor-pointer pr-2"
          >
            {games.map(g => (
              <option key={g.id} value={g.id} className="bg-[#0b0e14] text-white">
                {g.title} ({g.titleId})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Grid: Parameters on Left, Pipeline & Logs on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 min-h-0">
        {/* Left Column: Relinker Configuration */}
        <div className="lg:col-span-5 flex flex-col space-y-5">
          <div className="space-y-4">
            {/* Target OS */}
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">Target OS Executable</label>
              <div className="grid grid-cols-3 gap-1.5 bg-black/40 p-1 rounded-xl border border-white/10">
                {(['windows', 'linux', 'macos'] as const).map(target => (
                  <button
                    key={target}
                    type="button"
                    onClick={() => {
                      audioService.playNavTick();
                      setOptions(o => ({ ...o, target }));
                    }}
                    className={`py-1.5 px-3 rounded-lg text-xs font-medium transition-colors ${
                      options.target === target
                        ? 'bg-white text-black shadow font-semibold'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    {target === 'windows' ? 'Windows (.exe)' : target === 'linux' ? 'Linux (.elf)' : 'macOS'}
                  </button>
                ))}
              </div>
            </div>

            {/* Subsystem */}
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">Windows Subsystem</label>
              <div className="grid grid-cols-2 gap-1.5 bg-black/40 p-1 rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setOptions(o => ({ ...o, subsystem: 'gui' }))}
                  className={`py-1.5 px-3 rounded-lg text-xs font-medium transition-colors ${
                    options.subsystem === 'gui'
                      ? 'bg-white text-black shadow font-semibold'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  GUI Subsystem (--windows-gui)
                </button>
                <button
                  type="button"
                  onClick={() => setOptions(o => ({ ...o, subsystem: 'console' }))}
                  className={`py-1.5 px-3 rounded-lg text-xs font-medium transition-colors ${
                    options.subsystem === 'console'
                      ? 'bg-white text-black shadow font-semibold'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  Console Subsystem
                </button>
              </div>
            </div>

            {/* CPU Instruction Lowering */}
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">Host CPU Codegen Translation</label>
              <div className="grid grid-cols-3 gap-1.5 bg-black/40 p-1 rounded-xl border border-white/10">
                {(['none', 'intel', 'rosetta'] as const).map(cpu => (
                  <button
                    key={cpu}
                    type="button"
                    onClick={() => {
                      audioService.playNavTick();
                      setOptions(o => ({ ...o, cpuTranslation: cpu }));
                    }}
                    className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-colors ${
                      options.cpuTranslation === cpu
                        ? 'bg-white text-black shadow font-semibold'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    {cpu === 'none' ? 'AMD Zen2' : cpu === 'intel' ? '--to-intel' : '--to-rosetta'}
                  </button>
                ))}
              </div>
            </div>

            {/* Unused Filter Level */}
            <div>
              <label className="block text-xs font-medium text-neutral-400 mb-1.5">Unused Import Optimization</label>
              <div className="grid grid-cols-3 gap-1.5 bg-black/40 p-1 rounded-xl border border-white/10">
                {[0, 1, 2].map(level => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setOptions(o => ({ ...o, unusedFilter: level as 0 | 1 | 2 }))}
                    className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-colors ${
                      options.unusedFilter === level
                        ? 'bg-white text-black shadow font-semibold'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Level {level}
                  </button>
                ))}
              </div>
            </div>

            {/* Diagnostics toggles */}
            <div className="pt-3 border-t border-white/5 space-y-2 text-xs text-neutral-300">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.windowsDiagnostics}
                  onChange={(e) => setOptions(o => ({ ...o, windowsDiagnostics: e.target.checked }))}
                  className="rounded bg-black border-white/20 text-white focus:ring-0"
                />
                <span>Include startup dependency diagnostics (--windows-diagnostics)</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.traceImports}
                  onChange={(e) => setOptions(o => ({ ...o, traceImports: e.target.checked }))}
                  className="rounded bg-black border-white/20 text-white focus:ring-0"
                />
                <span>Pass imports through call tracer (--trace-imports)</span>
              </label>
            </div>
          </div>

          {/* Primary Action Button */}
          <div className="pt-2">
            <button
              onClick={handleStartRelinking}
              disabled={isRelinking}
              className={`w-full py-3.5 rounded-full font-semibold text-sm transition-all flex items-center justify-center space-x-2 ${
                isRelinking
                  ? 'bg-neutral-800 text-neutral-400 cursor-not-allowed'
                  : 'bg-white text-black hover:bg-neutral-200 active:scale-95 shadow-md'
              }`}
            >
              {isRelinking ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Processing Relinker Pipeline...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Start Relinking Process</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Stages & Live Terminal */}
        <div className="lg:col-span-7 flex flex-col space-y-5">
          {/* 8-stage progress tracker */}
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-semibold block mb-2.5">
              Pipeline Stages
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {stages.map((st) => (
                <div
                  key={st.id}
                  className={`p-2 rounded-xl text-left transition-colors border ${
                    st.status === 'completed'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                      : st.status === 'active'
                      ? 'bg-white/10 border-white text-white'
                      : 'bg-black/20 border-white/5 text-neutral-500'
                  }`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[9px] font-mono">0{st.id}</span>
                    {st.status === 'completed' && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                    {st.status === 'active' && <Loader2 className="w-3 h-3 animate-spin text-white" />}
                  </div>
                  <p className="text-[11px] font-medium truncate">{st.title}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Terminal stream */}
          <div className="flex-1 bg-black/60 rounded-2xl p-4 border border-white/10 flex flex-col min-h-[300px]">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10 text-xs font-mono text-neutral-400">
              <div className="flex items-center space-x-2">
                <Terminal className="w-3.5 h-3.5 text-neutral-300" />
                <span>relinker stdout</span>
              </div>
              <button
                onClick={() => setLogs([])}
                className="hover:text-white transition-colors"
              >
                Clear
              </button>
            </div>

            <div className="flex-1 overflow-y-auto font-mono text-xs space-y-1.5 pr-2 max-h-[340px]">
              {logs.map((log, idx) => (
                <div key={idx} className="flex items-start space-x-2">
                  <span className="text-neutral-600 text-[10px] select-none">[{log.timestamp}]</span>
                  <span
                    className={`${
                      log.level === 'error'
                        ? 'text-red-400'
                        : log.level === 'warn'
                        ? 'text-amber-400'
                        : log.level === 'success'
                        ? 'text-emerald-400 font-semibold'
                        : 'text-neutral-300'
                    }`}
                  >
                    {log.message}
                  </span>
                </div>
              ))}
              <div ref={terminalEndRef} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
