import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Sparkles, 
  Terminal, 
  CheckCircle2, 
  AlertTriangle,
  Loader2, 
  Sliders, 
  Play,
  Cpu,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  X,
  Check
} from 'lucide-react';
import { GameItem, RelinkerOptions, ConversionStage, ConversionLog, SystemTelemetry } from '../types';
import { apiBridge } from '../services/apiBridge';
import { audioService } from '../services/audioService';

interface RelinkerStudioProps {
  games: GameItem[];
  selectedGame: GameItem;
  onUpdateGameStatus: (gameId: string, status: 'ported', updatedGame?: GameItem) => void;
  onLaunchGame?: (game: GameItem) => void;
  onNavigateToGames?: () => void;
}

type ExecutionState = 'idle' | 'running' | 'success' | 'error';

interface HumanStep {
  stepNumber: number;
  title: string;
  description: string;
}

const HUMAN_STEPS: Record<number, HumanStep> = {
  1: { stepNumber: 1, title: 'Checking game files', description: 'Verifying decrypted game files, folder layout, and eboot' },
  2: { stepNumber: 2, title: 'Checking compatibility', description: 'Matching PlayStation 5 system calls with PC runtime libraries' },
  3: { stepNumber: 3, title: 'Preparing runtime libraries', description: 'Configuring clean-room system libraries for graphics and input' },
  4: { stepNumber: 4, title: 'Translating CPU instructions', description: 'Adapting console CPU instructions for your processor' },
  5: { stepNumber: 5, title: 'Building Windows executable', description: 'Generating native 64-bit Windows application (app.exe)' },
  6: { stepNumber: 6, title: 'Finalizing native package', description: 'Extracting artwork and preparing instant Plug & Play launcher' },
};

export const RelinkerStudio: React.FC<RelinkerStudioProps> = ({
  games,
  selectedGame: initialGame,
  onUpdateGameStatus,
  onLaunchGame,
  onNavigateToGames,
}) => {
  // Mode State: 'simple' (default) vs 'advanced'
  const [mode, setMode] = useState<'simple' | 'advanced'>(() => {
    return (localStorage.getItem('anyps5_relinker_mode') as 'simple' | 'advanced') || 'simple';
  });

  const [selectedGame, setSelectedGame] = useState<GameItem>(initialGame);
  const [executionState, setExecutionState] = useState<ExecutionState>('idle');
  const [isCancelling, setIsCancelling] = useState<boolean>(false);

  // Simple Mode expandable sections
  const [showSystemDetails, setShowSystemDetails] = useState<boolean>(false);
  const [showSettingsDetails, setShowSettingsDetails] = useState<boolean>(false);
  const [showLiveLogs, setShowLiveLogs] = useState<boolean>(false);
  const [showErrorLogs, setShowErrorLogs] = useState<boolean>(false);

  // System Telemetry State
  const [telemetry, setTelemetry] = useState<SystemTelemetry | null>(null);
  const [isDetecting, setIsDetecting] = useState<boolean>(false);

  // Technical 8-Stage Pipeline (for backend and Advanced mode)
  const [technicalStages, setTechnicalStages] = useState<ConversionStage[]>([
    { id: 1, title: 'Validating Decrypted ELF', description: 'Inspecting ELF headers & PT_LOAD segments', status: 'pending' },
    { id: 2, title: 'Scanning System Imports (NIDs)', description: 'Resolving PS5 library imports against clean-room PRX exports', status: 'pending' },
    { id: 3, title: 'Scanning Bundled Modules', description: 'Parsing modules in sce_module/ for runtime dependencies', status: 'pending' },
    { id: 4, title: 'AMD to Intel Codegen Translation', description: 'Rewriting AMD-specific Zen2 instructions', status: 'pending' },
    { id: 5, title: 'Unused Import Filter & PLT', description: 'Analyzing control-flow and compacting PLT', status: 'pending' },
    { id: 6, title: 'Relinking PE Executable', description: 'Generating Windows PE headers and entry RVA', status: 'pending' },
    { id: 7, title: 'Copying Clean-room PRX Libraries', description: 'Deploying system libraries (libkernel, libSceAgcDriver)', status: 'pending' },
    { id: 8, title: 'Finalizing Native Package', description: 'Writing app.exe and registry metadata', status: 'pending' },
  ]);

  // Terminal & Progress Logs
  const [logs, setLogs] = useState<ConversionLog[]>([
    { timestamp: new Date().toLocaleTimeString(), level: 'info', message: 'Relinker Studio ready. System environment initialized.' }
  ]);

  // Error Diagnosis State
  const [errorMessage, setErrorMessage] = useState<{
    summary: string;
    remedy: string;
  } | null>(null);

  // Relinker Configuration Options
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

  // Persist mode toggle
  const handleSetMode = (newMode: 'simple' | 'advanced') => {
    audioService.playNavTick();
    setMode(newMode);
    localStorage.setItem('anyps5_relinker_mode', newMode);
  };

  // Perform Real System Detection
  const runSystemDetection = async () => {
    setIsDetecting(true);
    try {
      const data = await apiBridge.getTelemetry();
      setTelemetry(data);

      if (data.recommendedCpuTranslation) {
        setOptions(prev => ({
          ...prev,
          cpuTranslation: data.recommendedCpuTranslation || 'intel',
          target: 'windows',
          subsystem: 'gui',
          unusedFilter: 1,
        }));
      }
    } catch (err: any) {
      console.warn('System telemetry check:', err);
    } finally {
      setIsDetecting(false);
    }
  };

  useEffect(() => {
    runSystemDetection();
  }, []);

  // Update game when prop changes
  useEffect(() => {
    setSelectedGame(initialGame);
    setExecutionState('idle');
    setErrorMessage(null);
  }, [initialGame]);

  // Scroll logs when updated
  useEffect(() => {
    if (showLiveLogs || showErrorLogs || mode === 'advanced') {
      terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, showLiveLogs, showErrorLogs, mode]);

  // Active step mapping during execution
  const activeStepInfo: HumanStep = useMemo(() => {
    const s1 = technicalStages.find(s => s.id === 1);
    const s2 = technicalStages.find(s => s.id === 2);
    const s3 = technicalStages.find(s => s.id === 3);
    const s4 = technicalStages.find(s => s.id === 4);
    const s5 = technicalStages.find(s => s.id === 5);
    const s6 = technicalStages.find(s => s.id === 6);
    const s7 = technicalStages.find(s => s.id === 7);
    const s8 = technicalStages.find(s => s.id === 8);

    if (s8?.status === 'active' || s8?.status === 'completed') return HUMAN_STEPS[6];
    if (s6?.status === 'active' || s5?.status === 'active') return HUMAN_STEPS[5];
    if (s4?.status === 'active') return HUMAN_STEPS[4];
    if (s7?.status === 'active' || s3?.status === 'active') return HUMAN_STEPS[3];
    if (s2?.status === 'active') return HUMAN_STEPS[2];
    if (s1?.status === 'active') return HUMAN_STEPS[1];

    const completedCount = technicalStages.filter(s => s.status === 'completed').length;
    if (completedCount >= 7) return HUMAN_STEPS[6];
    if (completedCount >= 5) return HUMAN_STEPS[5];
    if (completedCount >= 4) return HUMAN_STEPS[4];
    if (completedCount >= 2) return HUMAN_STEPS[3];
    if (completedCount >= 1) return HUMAN_STEPS[2];

    return HUMAN_STEPS[1];
  }, [technicalStages]);

  // Overall Progress Percentage (0-100%)
  const overallProgress = useMemo(() => {
    if (executionState === 'success') return 100;
    if (executionState === 'idle') return 0;
    const completed = technicalStages.filter(s => s.status === 'completed').length;
    const active = technicalStages.find(s => s.status === 'active');
    const activeProgress = active ? 0.5 : 0;
    return Math.min(99, Math.round(((completed + activeProgress) / technicalStages.length) * 100));
  }, [technicalStages, executionState]);

  // System Readiness Check
  const readiness = useMemo(() => {
    if (!selectedGame || !selectedGame.path) {
      return { isReady: false, statusText: 'System check needed: Game folder not found' };
    }
    if (telemetry && !telemetry.relinkerBinaryFound) {
      return { isReady: false, statusText: 'System check needed: Relinker toolchain missing' };
    }
    return { isReady: true, statusText: 'Your PC is ready to relink this game' };
  }, [selectedGame, telemetry]);

  // Single-sentence Recommended Settings Summary
  const recommendationSummary = useMemo(() => {
    if (options.cpuTranslation === 'intel') {
      return 'Configured for your Intel processor (AVX2 optimized, clean game window).';
    }
    if (options.cpuTranslation === 'none') {
      return 'Configured for your AMD Ryzen processor (native Zen2, clean game window).';
    }
    if (options.cpuTranslation === 'rosetta') {
      return 'Configured for Apple Silicon (Rosetta 2 translation).';
    }
    return 'Standard configuration selected for 64-bit Windows.';
  }, [options.cpuTranslation]);

  // Start Relinking Process
  const handleStartRelinking = async () => {
    if (executionState === 'running' || !readiness.isReady) return;
    
    audioService.playConfirm();
    setExecutionState('running');
    setIsCancelling(false);
    setErrorMessage(null);

    // Reset stages
    setTechnicalStages(prev => prev.map(s => ({ ...s, status: 'pending', progress: 0 })));

    let finalGame: GameItem | undefined;

    try {
      const success = await apiBridge.executeRelinker(
        selectedGame,
        options,
        (updatedStage) => {
          setTechnicalStages(prev => prev.map(s => s.id === updatedStage.id ? { ...s, ...updatedStage } : s));
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

      setIsCancelling(false);

      if (success) {
        setExecutionState('success');
        audioService.playSuccess();
        onUpdateGameStatus(selectedGame.id, 'ported', finalGame);
      } else {
        setExecutionState('error');
        audioService.playCancel();
        setErrorMessage({
          summary: 'The conversion process was unable to complete.',
          remedy: '1. Verify the game is decrypted and contains eboot.bin.\n2. In Advanced mode, try setting CPU Translation to Intel AVX2 and Unused Import Optimization to Level 0.\n3. Make sure no other program is accessing the game folder.',
        });
      }
    } catch (err: any) {
      setIsCancelling(false);
      setExecutionState('error');
      audioService.playCancel();
      setErrorMessage({
        summary: 'Pipeline execution failed.',
        remedy: err.message || 'Ensure relinker.exe has execution permissions and game folder is accessible.',
      });
    }
  };

  // Cancel Relinking Process
  const handleCancelRelinking = async () => {
    if (executionState !== 'running' || isCancelling) return;
    audioService.playCancel();
    setIsCancelling(true);

    setLogs(prev => [
      ...prev,
      {
        timestamp: new Date().toLocaleTimeString(),
        level: 'warn',
        message: '[AnyPS5] User requested cancellation. Safely stopping compiler...',
      }
    ]);

    await apiBridge.cancelRelinker();

    setExecutionState('error');
    setIsCancelling(false);
    setErrorMessage({
      summary: 'Relinking was cancelled by the user.',
      remedy: 'Compilation stopped safely. No game files were damaged. You can start again whenever you are ready.',
    });
  };

  return (
    <div className="relative w-full h-full flex flex-col pt-20 px-8 pb-8 overflow-y-auto select-none">
      
      {/* Console Header: Title & Clean Mode Toggle */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
        <div>
          <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider block mb-1">
            System Software / Relinker Studio
          </span>
          <h2 className="text-2xl font-bold text-white tracking-tight">Relinker Studio</h2>
        </div>

        {/* Mode Toggle */}
        <div className="flex items-center bg-black/60 p-1 rounded-xl border border-white/10 shadow-inner">
          <button
            type="button"
            onClick={() => handleSetMode('simple')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              mode === 'simple'
                ? 'bg-white text-black font-semibold shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Simple</span>
          </button>
          <button
            type="button"
            onClick={() => handleSetMode('advanced')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              mode === 'advanced'
                ? 'bg-white text-black font-semibold shadow-sm'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Advanced</span>
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* SIMPLE MODE (Zero Clutter, State-Driven, Non-Technical Friendly) */}
      {/* ============================================================== */}
      {mode === 'simple' && (
        <div className="flex-1 flex flex-col justify-center items-center max-w-xl mx-auto w-full pb-12">
          
          {/* STATE 1: IDLE (Before Execution) */}
          {executionState === 'idle' && (
            <div className="w-full space-y-6 animate-fade-in">
              
              {/* 1. Selected Game Display & Dropdown */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/[0.03] border border-white/10">
                <div className="flex items-center space-x-3.5 min-w-0">
                  <img
                    src={selectedGame.iconUrl}
                    alt={selectedGame.title}
                    className="w-12 h-12 rounded-xl object-cover shadow border border-white/10 shrink-0"
                  />
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-white tracking-tight truncate">
                      {selectedGame.title}
                    </h3>
                    <p className="text-[11px] text-neutral-400 font-mono mt-0.5">
                      {selectedGame.titleId} • {(selectedGame.sizeBytes / (1024 * 1024 * 1024)).toFixed(1)} GB
                    </p>
                  </div>
                </div>

                {/* Change Game Select */}
                <select
                  value={selectedGame.id}
                  onChange={(e) => {
                    const found = games.find(g => g.id === e.target.value);
                    if (found) {
                      audioService.playNavTick();
                      setSelectedGame(found);
                      setErrorMessage(null);
                    }
                  }}
                  className="bg-white/5 hover:bg-white/10 text-neutral-200 border border-white/10 rounded-xl px-3 py-1.5 text-xs font-medium cursor-pointer focus:outline-none transition-colors ml-3 shrink-0"
                >
                  {games.map(g => (
                    <option key={g.id} value={g.id} className="bg-[#0b0e14] text-white">
                      {g.title}
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. System Readiness (One Concise Status + Expandable Details) */}
              <div className="py-2.5 px-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2.5">
                    <span className={`w-2 h-2 rounded-full ${
                      readiness.isReady 
                        ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' 
                        : 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.6)]'
                    }`} />
                    <span className="text-neutral-200 font-medium">
                      {readiness.statusText}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowSystemDetails(prev => !prev)}
                    className="text-neutral-400 hover:text-white text-[11px] transition-colors"
                  >
                    {showSystemDetails ? 'Hide details' : 'View details'}
                  </button>
                </div>

                {showSystemDetails && (
                  <div className="pt-2 border-t border-white/5 text-[11px] text-neutral-400 space-y-1 font-mono">
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Processor:</span>
                      <span className="text-neutral-300">{telemetry?.hostCpu || 'Detected'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Graphics:</span>
                      <span className="text-neutral-300">{telemetry?.gpuName || 'DirectX 12 / Vulkan'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">System OS:</span>
                      <span className="text-neutral-300">{telemetry?.osName || 'Windows'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Relinker Tool:</span>
                      <span className={telemetry?.relinkerBinaryFound ? 'text-emerald-400' : 'text-red-400'}>
                        {telemetry?.relinkerBinaryFound ? 'Ready (relinker.exe)' : 'Not Found in build/'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Recommended Settings (Compact One-Line Summary + Expandable Details) */}
              <div className="py-2.5 px-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-300">
                    {recommendationSummary}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowSettingsDetails(prev => !prev)}
                    className="text-neutral-400 hover:text-white text-[11px] transition-colors shrink-0 ml-3"
                  >
                    {showSettingsDetails ? 'Hide summary' : 'Summary'}
                  </button>
                </div>

                {showSettingsDetails && (
                  <div className="pt-2 border-t border-white/5 text-[11px] text-neutral-400 space-y-1 font-mono">
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Target Executable:</span>
                      <span className="text-neutral-300">Windows (.exe)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Subsystem:</span>
                      <span className="text-neutral-300">Clean Window (GUI)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">CPU Translation:</span>
                      <span className="text-neutral-300">
                        {options.cpuTranslation === 'intel' ? 'Intel AVX2 Optimization' : options.cpuTranslation === 'rosetta' ? 'Apple Silicon' : 'AMD Zen2 Native'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Import Optimization:</span>
                      <span className="text-neutral-300">Standard (Level 1)</span>
                    </div>
                  </div>
                )}
              </div>

              {/* 4. Primary Action: Start Relinking */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleStartRelinking}
                  disabled={!readiness.isReady}
                  className={`w-full py-4 rounded-full font-bold text-sm tracking-wide transition-all shadow-xl flex items-center justify-center space-x-2 ${
                    !readiness.isReady
                      ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                      : 'bg-white text-black hover:bg-neutral-200 active:scale-[0.99] shadow-white/10'
                  }`}
                >
                  <Sparkles className="w-4 h-4 fill-black" />
                  <span>{selectedGame.status === 'ported' ? 'Re-run Relinking' : 'Start Relinking'}</span>
                </button>
              </div>

              {/* 5. Secondary Options */}
              <div className="flex items-center justify-center space-x-4 pt-1 text-xs text-neutral-400">
                <button
                  type="button"
                  onClick={() => handleSetMode('advanced')}
                  className="hover:text-white transition-colors"
                >
                  Customize settings
                </button>
                <span className="text-neutral-700">•</span>
                <button
                  type="button"
                  onClick={() => setShowSystemDetails(prev => !prev)}
                  className="hover:text-white transition-colors"
                >
                  Technical details
                </button>
              </div>

            </div>
          )}

          {/* STATE 2: RUNNING (During Execution) */}
          {executionState === 'running' && (
            <div className="w-full flex flex-col items-center text-center space-y-6 animate-fade-in py-6">
              <img
                src={selectedGame.iconUrl}
                alt={selectedGame.title}
                className="w-16 h-16 rounded-2xl object-cover shadow-2xl border border-white/10"
              />

              <div>
                <h3 className="text-lg font-bold text-white tracking-tight mb-1">
                  Relinking {selectedGame.title}
                </h3>
                <p className="text-xs text-neutral-400">
                  {activeStepInfo.description}
                </p>
              </div>

              {/* Step indicator and progress bar */}
              <div className="w-full space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-medium text-white flex items-center space-x-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                    <span>{activeStepInfo.title}</span>
                  </span>
                  <span className="font-mono text-neutral-400 text-xs">
                    Step {activeStepInfo.stepNumber} of 6 • {overallProgress}%
                  </span>
                </div>

                <div className="w-full h-2 rounded-full bg-black/60 overflow-hidden border border-white/10">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 via-indigo-400 to-emerald-400 transition-all duration-300"
                    style={{ width: `${overallProgress}%` }}
                  />
                </div>
              </div>

              {/* Cancellation & Logs Toggle */}
              <div className="flex items-center space-x-4 pt-2">
                <button
                  type="button"
                  onClick={handleCancelRelinking}
                  disabled={isCancelling}
                  className="text-xs text-neutral-400 hover:text-red-400 transition-colors"
                >
                  {isCancelling ? 'Cancelling...' : 'Cancel process'}
                </button>
                <span className="text-neutral-700">•</span>
                <button
                  type="button"
                  onClick={() => setShowLiveLogs(prev => !prev)}
                  className="text-xs text-neutral-400 hover:text-white transition-colors"
                >
                  {showLiveLogs ? 'Hide logs' : 'View technical logs'}
                </button>
              </div>

              {/* Expandable live log output */}
              {showLiveLogs && (
                <div className="w-full text-left bg-black/80 rounded-xl p-3 border border-white/10 font-mono text-[11px] max-h-48 overflow-y-auto space-y-1">
                  {logs.map((l, i) => (
                    <div key={i} className={l.level === 'error' ? 'text-red-400' : l.level === 'warn' ? 'text-amber-400' : l.level === 'success' ? 'text-emerald-400' : 'text-neutral-400'}>
                      {l.message}
                    </div>
                  ))}
                  <div ref={terminalEndRef} />
                </div>
              )}
            </div>
          )}

          {/* STATE 3: SUCCESS (After Backend Confirms Completion) */}
          {executionState === 'success' && (
            <div className="w-full flex flex-col items-center text-center space-y-6 animate-fade-in py-6">
              <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/10">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-xl font-bold text-white tracking-tight mb-1">
                  Relinking Complete!
                </h3>
                <p className="text-xs text-neutral-300 leading-relaxed max-w-sm">
                  <strong className="text-white">{selectedGame.title}</strong> has been converted to a native Windows executable and is ready to play.
                </p>
              </div>

              {/* Output Location */}
              <div className="w-full p-3.5 rounded-xl bg-white/[0.03] border border-white/10 text-left">
                <span className="text-[10px] uppercase font-bold text-neutral-400 tracking-wider block mb-1">
                  Output Location
                </span>
                <p className="text-xs font-mono text-emerald-300 break-all select-all">
                  {selectedGame.path}\app.exe
                </p>
              </div>

              {/* Primary & Secondary Actions */}
              <div className="w-full space-y-2.5 pt-2">
                {onLaunchGame && (
                  <button
                    type="button"
                    onClick={() => {
                      audioService.playLaunch();
                      onLaunchGame(selectedGame);
                    }}
                    className="w-full py-4 rounded-full bg-white text-black font-bold text-sm hover:bg-neutral-200 active:scale-[0.99] transition-all shadow-xl flex items-center justify-center space-x-2"
                  >
                    <Play className="w-4 h-4 fill-black" />
                    <span>Play Game Now</span>
                  </button>
                )}

                <div className="flex items-center justify-center space-x-4 pt-1 text-xs text-neutral-400">
                  {onNavigateToGames && (
                    <button
                      type="button"
                      onClick={() => {
                        audioService.playNavTick();
                        onNavigateToGames();
                      }}
                      className="hover:text-white transition-colors"
                    >
                      Back to Games Library
                    </button>
                  )}
                  <span className="text-neutral-700">•</span>
                  <button
                    type="button"
                    onClick={() => {
                      audioService.playNavTick();
                      setExecutionState('idle');
                    }}
                    className="hover:text-white transition-colors"
                  >
                    Relink again
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STATE 4: ERROR (On Failure) */}
          {executionState === 'error' && (
            <div className="w-full flex flex-col items-center text-center space-y-6 animate-fade-in py-6">
              <div className="w-16 h-16 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 flex items-center justify-center shadow-lg shadow-red-500/10">
                <AlertTriangle className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-xl font-bold text-white tracking-tight mb-1">
                  Relinking Could Not Be Completed
                </h3>
                <p className="text-xs text-neutral-300 leading-relaxed max-w-sm">
                  {errorMessage?.summary || 'The relinker pipeline encountered an issue.'}
                </p>
              </div>

              {/* Actionable recovery suggestion */}
              <div className="w-full p-4 rounded-xl bg-red-950/20 border border-red-500/20 text-left space-y-1.5">
                <span className="text-[11px] font-semibold text-red-300 block">
                  Suggested Steps:
                </span>
                <p className="text-xs text-neutral-300 leading-relaxed whitespace-pre-line">
                  {errorMessage?.remedy || 'Check that game files are decrypted and not locked by another process.'}
                </p>
              </div>

              {/* Actions */}
              <div className="w-full space-y-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    audioService.playNavTick();
                    setExecutionState('idle');
                    setErrorMessage(null);
                  }}
                  className="w-full py-3.5 rounded-full bg-white text-black font-bold text-xs hover:bg-neutral-200 active:scale-[0.99] transition-all shadow-lg"
                >
                  Try Again
                </button>

                <div className="flex items-center justify-center space-x-4 pt-1 text-xs text-neutral-400">
                  <button
                    type="button"
                    onClick={() => {
                      audioService.playNavTick();
                      handleSetMode('advanced');
                    }}
                    className="hover:text-white transition-colors"
                  >
                    Open Advanced mode
                  </button>
                  <span className="text-neutral-700">•</span>
                  <button
                    type="button"
                    onClick={() => setShowErrorLogs(prev => !prev)}
                    className="hover:text-white transition-colors"
                  >
                    {showErrorLogs ? 'Hide error logs' : 'View error logs'}
                  </button>
                </div>
              </div>

              {showErrorLogs && (
                <div className="w-full text-left bg-black/80 rounded-xl p-3 border border-red-500/20 font-mono text-[11px] max-h-48 overflow-y-auto space-y-1">
                  {logs.map((l, i) => (
                    <div key={i} className={l.level === 'error' ? 'text-red-400 font-semibold' : 'text-neutral-400'}>
                      {l.message}
                    </div>
                  ))}
                  <div ref={terminalEndRef} />
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* ============================================================== */}
      {/* ADVANCED MODE (Full Technical Controls for Developers)        */}
      {/* ============================================================== */}
      {mode === 'advanced' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 min-h-0">
          
          {/* Left Column: Technical Controls */}
          <div className="lg:col-span-5 flex flex-col space-y-5">
            
            {/* Selected Game Picker */}
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between">
              <div className="flex items-center space-x-3 min-w-0">
                <img
                  src={selectedGame.iconUrl}
                  alt={selectedGame.title}
                  className="w-8 h-8 rounded-lg object-cover"
                />
                <div className="truncate">
                  <span className="text-xs font-semibold text-white block truncate">{selectedGame.title}</span>
                  <span className="text-[10px] text-neutral-400 font-mono">{selectedGame.titleId}</span>
                </div>
              </div>
              <select
                value={selectedGame.id}
                onChange={(e) => {
                  const found = games.find(g => g.id === e.target.value);
                  if (found) {
                    audioService.playNavTick();
                    setSelectedGame(found);
                  }
                }}
                className="bg-black/60 text-white text-xs rounded-lg px-2 py-1 border border-white/10"
              >
                {games.map(g => (
                  <option key={g.id} value={g.id} className="bg-[#0b0e14] text-white">
                    {g.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Technical Options Box */}
            <div className="space-y-4 bg-white/[0.02] p-4 rounded-xl border border-white/10">
              
              {/* Target OS */}
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">
                  Target Executable Format
                  <span className="text-[10px] text-neutral-500 font-mono ml-2">(--windows / --macos)</span>
                </label>
                <div className="grid grid-cols-3 gap-1.5 bg-black/40 p-1 rounded-xl border border-white/10">
                  {(['windows', 'linux', 'macos'] as const).map(target => (
                    <button
                      key={target}
                      type="button"
                      onClick={() => {
                        audioService.playNavTick();
                        setOptions(o => ({ ...o, target }));
                      }}
                      className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-colors ${
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
                <label className="block text-xs font-medium text-neutral-300 mb-1">
                  Windows Subsystem
                  <span className="text-[10px] text-neutral-500 font-mono ml-2">(--windows-gui)</span>
                </label>
                <div className="grid grid-cols-2 gap-1.5 bg-black/40 p-1 rounded-xl border border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      audioService.playNavTick();
                      setOptions(o => ({ ...o, subsystem: 'gui' }));
                    }}
                    className={`py-1.5 px-3 rounded-lg text-xs font-medium transition-colors ${
                      options.subsystem === 'gui'
                        ? 'bg-white text-black shadow font-semibold'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    Clean Window (GUI)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      audioService.playNavTick();
                      setOptions(o => ({ ...o, subsystem: 'console' }));
                    }}
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

              {/* CPU Codegen Translation */}
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">
                  CPU Codegen Instruction Lowering
                  <span className="text-[10px] text-neutral-500 font-mono ml-2">(--to-intel / --to-rosetta)</span>
                </label>
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
                      {cpu === 'none' ? 'AMD Zen2' : cpu === 'intel' ? 'Intel AVX2' : 'Rosetta 2'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Unused Import Optimization */}
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">
                  Unused Import Optimization
                  <span className="text-[10px] text-neutral-500 font-mono ml-2">(unused-filter=0|1|2)</span>
                </label>
                <div className="grid grid-cols-3 gap-1.5 bg-black/40 p-1 rounded-xl border border-white/10">
                  {[0, 1, 2].map(level => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => {
                        audioService.playNavTick();
                        setOptions(o => ({ ...o, unusedFilter: level as 0 | 1 | 2 }));
                      }}
                      className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-colors ${
                        options.unusedFilter === level
                          ? 'bg-white text-black shadow font-semibold'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      Level {level} {level === 1 ? '(Standard)' : level === 0 ? '(None)' : '(Strict)'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Diagnostics & Call Tracing */}
              <div className="pt-2 border-t border-white/5 space-y-2 text-xs text-neutral-300">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.windowsDiagnostics}
                    onChange={(e) => setOptions(o => ({ ...o, windowsDiagnostics: e.target.checked }))}
                    className="rounded bg-black border-white/20 text-white focus:ring-0"
                  />
                  <span>Startup diagnostics (--windows-diagnostics)</span>
                </label>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.traceImports}
                    onChange={(e) => setOptions(o => ({ ...o, traceImports: e.target.checked }))}
                    className="rounded bg-black border-white/20 text-white focus:ring-0"
                  />
                  <span>Call tracing (--trace-imports)</span>
                </label>
              </div>

            </div>

            {/* Run / Cancel Button in Advanced Mode */}
            <div className="pt-1">
              {executionState !== 'running' ? (
                <button
                  type="button"
                  onClick={handleStartRelinking}
                  className="w-full py-3.5 rounded-full font-bold text-xs bg-white text-black hover:bg-neutral-200 transition-all shadow-md flex items-center justify-center space-x-2"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Start Relinking Process</span>
                </button>
              ) : (
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    disabled
                    className="flex-1 py-3.5 rounded-full bg-neutral-800 text-neutral-300 font-semibold text-xs flex items-center justify-center space-x-2"
                  >
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                    <span>Executing Relinker...</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelRelinking}
                    disabled={isCancelling}
                    className="px-4 py-3.5 rounded-full bg-red-500/20 text-red-300 hover:bg-red-500/30 text-xs font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: 8-Stage Pipeline & Live Terminal */}
          <div className="lg:col-span-7 flex flex-col space-y-5">
            
            {/* 8-Stage Grid */}
            <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
              <span className="text-[10px] text-neutral-400 uppercase tracking-wider font-semibold block mb-2.5">
                Compiler Stages (8-Step Pipeline)
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {technicalStages.map((st) => (
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

            {/* Live Terminal Stream */}
            <div className="flex-1 bg-black/80 rounded-2xl p-4 border border-white/10 flex flex-col min-h-[300px]">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10 text-xs font-mono text-neutral-400">
                <div className="flex items-center space-x-2">
                  <Terminal className="w-3.5 h-3.5 text-neutral-300" />
                  <span>relinker stdout</span>
                </div>
                <button
                  type="button"
                  onClick={() => setLogs([])}
                  className="hover:text-white transition-colors"
                >
                  Clear
                </button>
              </div>

              <div className="flex-1 overflow-y-auto font-mono text-xs space-y-1.5 pr-2 max-h-[320px]">
                {logs.map((log, idx) => (
                  <div key={idx} className="flex items-start space-x-2">
                    <span className="text-neutral-600 text-[10px] select-none font-mono">[{log.timestamp}]</span>
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
      )}

    </div>
  );
};
