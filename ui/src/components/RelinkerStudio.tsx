import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Sparkles, 
  Terminal, 
  CheckCircle2, 
  AlertTriangle,
  XCircle,
  Loader2, 
  Sliders, 
  RotateCcw,
  Play,
  Cpu,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  FolderCheck,
  X,
  FileCode,
  HardDrive,
  Info,
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

interface HumanStage {
  id: number;
  title: string;
  description: string;
  status: 'pending' | 'active' | 'completed' | 'error';
  progress: number;
}

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
  const [isRelinking, setIsRelinking] = useState<boolean>(false);
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(selectedGame.status === 'ported');
  const [showTerminal, setShowTerminal] = useState<boolean>(mode === 'advanced');

  // System Telemetry & Detection State
  const [telemetry, setTelemetry] = useState<SystemTelemetry | null>(null);
  const [isDetecting, setIsDetecting] = useState<boolean>(false);
  const [detectionTimestamp, setDetectionTimestamp] = useState<string>('');

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
    { timestamp: new Date().toLocaleTimeString(), level: 'info', message: 'Relinker Studio ready. System environment ready for native PS5 binary transformation.' }
  ]);

  // Error State for Human-Readable Diagnoses
  const [errorMessage, setErrorMessage] = useState<{
    summary: string;
    reason: string;
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

  // Sync mode changes to localStorage
  const handleSetMode = (newMode: 'simple' | 'advanced') => {
    audioService.playNavTick();
    setMode(newMode);
    localStorage.setItem('anyps5_relinker_mode', newMode);
    if (newMode === 'advanced') {
      setShowTerminal(true);
    }
  };

  // Perform Genuine Hardware & Toolchain Detection
  const runSystemDetection = async () => {
    setIsDetecting(true);
    audioService.playNavTick();
    try {
      const data = await apiBridge.getTelemetry();
      setTelemetry(data);
      setDetectionTimestamp(new Date().toLocaleTimeString());

      // Auto-apply recommended settings based on verified host CPU and OS
      if (data.recommendedCpuTranslation) {
        setOptions(prev => ({
          ...prev,
          cpuTranslation: data.recommendedCpuTranslation || 'intel',
          target: 'windows',
          subsystem: 'gui',
          unusedFilter: 1,
        }));
      }

      setLogs(prev => [
        ...prev,
        {
          timestamp: new Date().toLocaleTimeString(),
          level: 'success',
          message: `[System Detection] Host: ${data.osName || 'Windows'}, CPU: ${data.hostCpu}, GPU: ${data.gpuName}. Toolchain: ${data.relinkerBinaryFound ? 'Ready' : 'Missing'}.`,
        }
      ]);
    } catch (err: any) {
      setLogs(prev => [
        ...prev,
        {
          timestamp: new Date().toLocaleTimeString(),
          level: 'warn',
          message: `[System Detection] Could not query full telemetry: ${err.message || String(err)}`,
        }
      ]);
    } finally {
      setIsDetecting(false);
    }
  };

  // Run detection on mount
  useEffect(() => {
    runSystemDetection();
  }, []);

  // Update selected game when initialGame prop changes
  useEffect(() => {
    setSelectedGame(initialGame);
    setIsCompleted(initialGame.status === 'ported');
  }, [initialGame]);

  // Auto-scroll terminal stream
  useEffect(() => {
    if (showTerminal) {
      terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, showTerminal]);

  // Human-Readable 6-Stage Mapping derived from technical stages
  const humanStages: HumanStage[] = useMemo(() => {
    const s1 = technicalStages.find(s => s.id === 1);
    const s2 = technicalStages.find(s => s.id === 2);
    const s3 = technicalStages.find(s => s.id === 3);
    const s4 = technicalStages.find(s => s.id === 4);
    const s5 = technicalStages.find(s => s.id === 5);
    const s6 = technicalStages.find(s => s.id === 6);
    const s7 = technicalStages.find(s => s.id === 7);
    const s8 = technicalStages.find(s => s.id === 8);

    const getAggregatedStatus = (...stages: (ConversionStage | undefined)[]): 'pending' | 'active' | 'completed' | 'error' => {
      if (stages.some(s => s?.status === 'error')) return 'error';
      if (stages.some(s => s?.status === 'active')) return 'active';
      if (stages.every(s => s?.status === 'completed')) return 'completed';
      return 'pending';
    };

    const getAggregatedProgress = (...stages: (ConversionStage | undefined)[]): number => {
      const valid = stages.filter(Boolean) as ConversionStage[];
      if (valid.length === 0) return 0;
      const sum = valid.reduce((acc, curr) => acc + (curr.progress || (curr.status === 'completed' ? 100 : 0)), 0);
      return Math.round(sum / valid.length);
    };

    return [
      {
        id: 1,
        title: 'Validating Game Files',
        description: 'Verifying decrypted ELF headers, folder structure, and eboot integrity',
        status: getAggregatedStatus(s1),
        progress: getAggregatedProgress(s1),
      },
      {
        id: 2,
        title: 'Checking System Compatibility',
        description: 'Scanning PlayStation 5 imported NIDs against clean-room PRX system libraries',
        status: getAggregatedStatus(s2),
        progress: getAggregatedProgress(s2),
      },
      {
        id: 3,
        title: 'Preparing Runtime Libraries',
        description: 'Resolving bundled sce_module dependencies and linking clean-room drivers',
        status: getAggregatedStatus(s3, s7),
        progress: getAggregatedProgress(s3, s7),
      },
      {
        id: 4,
        title: 'Translating CPU Instructions',
        description: options.cpuTranslation === 'intel'
          ? 'Rewriting AMD Zen2 instruction sequences into Intel AVX2 micro-ops'
          : options.cpuTranslation === 'rosetta'
          ? 'Translating CPU instructions for macOS Rosetta 2 JIT runtime'
          : 'AMD Zen2 native instruction lowering bypassed for raw native execution',
        status: getAggregatedStatus(s4),
        progress: getAggregatedProgress(s4),
      },
      {
        id: 5,
        title: 'Optimizing and Building Executable',
        description: 'Filtering unreferenced imports and constructing native 64-bit Windows PE binary (app.exe)',
        status: getAggregatedStatus(s5, s6),
        progress: getAggregatedProgress(s5, s6),
      },
      {
        id: 6,
        title: 'Finalizing Native Game Package',
        description: 'Finalizing in-place game folder, extracting high-res assets, and preparing Plug & Play launcher',
        status: getAggregatedStatus(s8),
        progress: getAggregatedProgress(s8),
      },
    ];
  }, [technicalStages, options.cpuTranslation]);

  // Overall Pipeline Progress (0-100%)
  const overallProgress = useMemo(() => {
    const completedCount = humanStages.filter(s => s.status === 'completed').length;
    const activeStage = humanStages.find(s => s.status === 'active');
    const activeBonus = activeStage ? (activeStage.progress || 50) / 100 : 0;
    return Math.min(100, Math.round(((completedCount + activeBonus) / humanStages.length) * 100));
  }, [humanStages]);

  // Pre-Flight Validation State Computation
  const validationResult = useMemo(() => {
    const blocking: string[] = [];
    const warnings: string[] = [];

    // Check game selection & folder
    if (!selectedGame || !selectedGame.path) {
      blocking.push('No game directory specified. Please import or select a valid game folder.');
    }

    // Check toolchain readiness
    if (telemetry && !telemetry.relinkerBinaryFound) {
      blocking.push('Relinker compiler engine (relinker.exe) was not found in the build directory. Build the relinker first.');
    }

    // Check PRX libraries
    if (telemetry && telemetry.prxVersion === 'Not installed') {
      warnings.push('Clean-room PRX system libraries are missing or incomplete. The game might encounter missing symbols.');
    }

    // Check compatibility score
    if (selectedGame?.compatibility && selectedGame.compatibility.score < 60) {
      warnings.push(`Compatibility audit score is ${selectedGame.compatibility.score}%. Some advanced PS5 functions may require stubbing.`);
    }

    // Check CPU translation compatibility
    if (telemetry && options.cpuTranslation === 'none' && !/AMD|Ryzen/i.test(telemetry.hostCpu)) {
      warnings.push('AMD Zen2 native execution selected on an Intel processor. Recommended: Intel AVX2 translation to prevent invalid instruction crashes.');
    }

    // Check subsystem
    if (options.subsystem === 'console') {
      warnings.push('Console subsystem enabled. An extra command-line terminal window will open alongside the game.');
    }

    // Determine state
    let state: 'ready' | 'warning' | 'blocking' = 'ready';
    if (blocking.length > 0) {
      state = 'blocking';
    } else if (warnings.length > 0) {
      state = 'warning';
    }

    return { state, blocking, warnings };
  }, [selectedGame, telemetry, options]);

  // Execute Relinker Pipeline
  const handleStartRelinking = async () => {
    if (isRelinking || validationResult.state === 'blocking') return;
    
    audioService.playConfirm();
    setIsRelinking(true);
    setIsCancelling(false);
    setIsCompleted(false);
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

      setIsRelinking(false);
      setIsCancelling(false);

      if (success) {
        setIsCompleted(true);
        audioService.playSuccess();
        onUpdateGameStatus(selectedGame.id, 'ported', finalGame);
      } else {
        audioService.playCancel();
        setErrorMessage({
          summary: 'The conversion process encountered an unexpected issue and halted.',
          reason: 'The relinker compiler or system PRX library loader returned a non-zero exit code.',
          remedy: '1. Verify the game is decrypted and contains eboot.bin.\n2. In Advanced Mode, try setting CPU Translation to Intel AVX2 and Unused Import Optimization to Level 0.\n3. Expand "View Technical Logs" below for compiler logs.',
        });
      }
    } catch (err: any) {
      setIsRelinking(false);
      setIsCancelling(false);
      audioService.playCancel();
      setErrorMessage({
        summary: 'Pipeline execution failed.',
        reason: err.message || String(err),
        remedy: 'Ensure no other process is locking the game directory and that relinker.exe has execution permissions.',
      });
    }
  };

  // Cancel Relinking Pipeline
  const handleCancelRelinking = async () => {
    if (!isRelinking || isCancelling) return;
    audioService.playCancel();
    setIsCancelling(true);
    setLogs(prev => [
      ...prev,
      {
        timestamp: new Date().toLocaleTimeString(),
        level: 'warn',
        message: '[AnyPS5] User requested cancellation. Terminating active relinker process...',
      }
    ]);

    await apiBridge.cancelRelinker();

    setIsRelinking(false);
    setIsCancelling(false);
    setTechnicalStages(prev => prev.map(s => s.status === 'active' ? { ...s, status: 'error' } : s));
    setErrorMessage({
      summary: 'Relinking was cancelled by the user.',
      reason: 'Active compilation was safely halted. No game files were damaged.',
      remedy: 'You can adjust settings and restart the relinking process whenever you are ready.',
    });
  };

  return (
    <div className="relative w-full h-full flex flex-col pt-20 px-8 pb-8 overflow-y-auto select-none">
      {/* Console Header with Mode Switcher & Game Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-white/5">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">
              System Software / Porting Tools
            </span>
            <span className="text-neutral-600">•</span>
            <span className="text-[11px] font-semibold text-emerald-400 tracking-wide">
              Plug & Play Relinker Engine
            </span>
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-3">
            <span>Relinker Studio</span>
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
              mode === 'simple' 
                ? 'bg-blue-500/10 text-blue-300 border-blue-500/20' 
                : 'bg-purple-500/10 text-purple-300 border-purple-500/20'
            }`}>
              {mode === 'simple' ? 'Simple Mode' : 'Advanced Mode'}
            </span>
          </h2>
        </div>

        <div className="flex items-center space-x-3">
          {/* Mode Switcher Toggle */}
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

          {/* Selected Game Picker */}
          <div className="flex items-center space-x-3 bg-white/5 px-3 py-1.5 rounded-full border border-white/10 hover:border-white/20 transition-colors">
            <img
              src={selectedGame.iconUrl}
              alt={selectedGame.title}
              className="w-6 h-6 rounded-md object-cover shadow"
            />
            <select
              value={selectedGame.id}
              onChange={(e) => {
                const found = games.find(g => g.id === e.target.value);
                if (found) {
                  audioService.playNavTick();
                  setSelectedGame(found);
                  setIsCompleted(found.status === 'ported');
                  setErrorMessage(null);
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
      </div>

      {/* Purpose Banner (Simple Mode) */}
      {mode === 'simple' && (
        <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-blue-900/20 via-neutral-900/40 to-neutral-900/20 border border-blue-500/20 flex items-start space-x-3.5">
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 mt-0.5">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-white mb-0.5">Automated PlayStation 5 Native Porting</h3>
            <p className="text-xs text-neutral-300 leading-relaxed">
              Relinker Studio transforms PlayStation 5 games into native 64-bit Windows applications that run directly on your hardware without heavyweight virtualization or emulation lag. We inspect your processor, map system imports, and prepare your title for instant Plug & Play.
            </p>
          </div>
        </div>
      )}

      {/* Hardware Telemetry & Detection Card */}
      <div className="mb-6 p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start md:items-center space-x-3">
          <div className="p-2 rounded-xl bg-white/5 border border-white/10 text-neutral-300">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-white">Host System Environment</span>
              {telemetry && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-mono border border-emerald-500/20">
                  Verified
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-400 mt-0.5">
              {telemetry ? (
                <span>
                  <strong className="text-neutral-200">{telemetry.hostCpu}</strong> • {telemetry.gpuName} • {telemetry.osName || 'Windows 11'}
                </span>
              ) : (
                'Detecting system hardware and instruction set support...'
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {telemetry && (
            <div className="hidden lg:flex items-center space-x-2 mr-2 text-[11px] text-neutral-400 font-mono">
              <span className="flex items-center space-x-1">
                <span className={`w-2 h-2 rounded-full ${telemetry.relinkerBinaryFound ? 'bg-emerald-400' : 'bg-red-400'}`} />
                <span>Compiler: {telemetry.relinkerBinaryFound ? 'Ready' : 'Not Found'}</span>
              </span>
              <span>•</span>
              <span className="flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>PRX: {telemetry.prxVersion}</span>
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={runSystemDetection}
            disabled={isDetecting}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-medium transition-colors border border-white/10"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isDetecting ? 'animate-spin' : ''}`} />
            <span>{isDetecting ? 'Detecting...' : 'Detect My System'}</span>
          </button>
        </div>
      </div>

      {/* Recommendation Banner */}
      {telemetry?.recommendationReason && (
        <div className="mb-6 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-xs text-emerald-300">
          <div className="flex items-center space-x-2">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>System Recommendation:</strong> {telemetry.recommendationReason}
            </span>
          </div>
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-200 ml-2 shrink-0">
            Auto-Configured
          </span>
        </div>
      )}

      {/* Main Grid: Configuration on Left, Progress & Terminal on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 min-h-0">
        
        {/* Left Column: Configuration & Pre-Flight Summary */}
        <div className="lg:col-span-5 flex flex-col space-y-6">

          {/* Simple Mode: Plain-Language Settings Overview */}
          {mode === 'simple' ? (
            <div className="space-y-4 bg-white/[0.02] p-5 rounded-2xl border border-white/10">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                  <ShieldCheck className="w-4 h-4 text-blue-400" />
                  <span>Configured Settings</span>
                </span>
                <span className="text-[11px] text-neutral-400">Click Advanced for manual tuning</span>
              </div>

              {/* Setting 1: Target Executable */}
              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="flex items-center justify-between text-xs font-medium text-white mb-1">
                  <span>Output Executable Format</span>
                  <span className="font-mono text-emerald-400 text-[11px]">Windows (.exe)</span>
                </div>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  Creates a native 64-bit Windows application you can launch directly from AnyPS5 Studio or your desktop.
                </p>
              </div>

              {/* Setting 2: Window Mode */}
              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="flex items-center justify-between text-xs font-medium text-white mb-1">
                  <span>Window Presentation</span>
                  <span className="font-mono text-blue-300 text-[11px]">Clean Window (GUI)</span>
                </div>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  Launches cleanly into fullscreen/windowed gaming mode without leaving an empty command prompt window open.
                </p>
              </div>

              {/* Setting 3: CPU Instruction Translation */}
              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="flex items-center justify-between text-xs font-medium text-white mb-1">
                  <span>CPU Instruction Lowering</span>
                  <span className="font-mono text-purple-300 text-[11px]">
                    {options.cpuTranslation === 'intel' ? 'Intel AVX2 Optimization' : options.cpuTranslation === 'rosetta' ? 'Rosetta 2' : 'AMD Zen2 Native'}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  {options.cpuTranslation === 'intel' 
                    ? 'Translates AMD Zen2 console instructions into standard Intel AVX2 micro-ops for smooth performance on your processor.' 
                    : options.cpuTranslation === 'rosetta'
                    ? 'Translates instructions for Apple Silicon JIT translation.'
                    : 'Native AMD Ryzen instruction execution without translation overhead.'}
                </p>
              </div>

              {/* Setting 4: Unused Import Optimization */}
              <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                <div className="flex items-center justify-between text-xs font-medium text-white mb-1">
                  <span>Library Optimization</span>
                  <span className="font-mono text-emerald-400 text-[11px]">Standard (Level 1)</span>
                </div>
                <p className="text-[11px] text-neutral-400 leading-relaxed">
                  Safely trims unneeded PlayStation operating system stubs to ensure faster startup and maximum stability.
                </p>
              </div>
            </div>
          ) : (
            /* Advanced Mode: Detailed Technical Controls & Compiler Flags */
            <div className="space-y-4 bg-white/[0.02] p-5 rounded-2xl border border-white/10">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                  <Sliders className="w-4 h-4 text-purple-400" />
                  <span>Technical Compiler Options</span>
                </span>
                <span className="text-[10px] font-mono text-neutral-400">relinker.exe flags</span>
              </div>

              {/* Target Executable Format */}
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
                <p className="text-[10px] text-neutral-400 mt-1">
                  Windows creates native 64-bit PE executable with DirectX 12 & Vulkan driver support.
                </p>
              </div>

              {/* Windows Subsystem */}
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
                <p className="text-[10px] text-neutral-400 mt-1">
                  GUI launches without extra windows. Console attaches a live command prompt for debugging stdout.
                </p>
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
                <p className="text-[10px] text-neutral-400 mt-1">
                  {options.cpuTranslation === 'intel' 
                    ? 'Intel AVX2 rewrites AMD-exclusive Zen2 micro-ops to standard Intel instructions.'
                    : options.cpuTranslation === 'rosetta'
                    ? 'Rosetta 2 adapts instructions for Apple Silicon JIT translation.'
                    : 'AMD Zen2 preserves console instruction stream without translation.'}
                </p>
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
                <p className="text-[10px] text-neutral-400 mt-1">
                  Level 1 eliminates unreferenced NIDs to minimize memory and improve launch speed.
                </p>
              </div>

              {/* Diagnostics & Call Tracing */}
              <div className="pt-3 border-t border-white/5 space-y-2.5 text-xs text-neutral-300">
                <label className="flex items-start space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.windowsDiagnostics}
                    onChange={(e) => setOptions(o => ({ ...o, windowsDiagnostics: e.target.checked }))}
                    className="mt-0.5 rounded bg-black border-white/20 text-white focus:ring-0"
                  />
                  <div>
                    <span className="font-medium text-white block">Startup Dependency Diagnostics (--windows-diagnostics)</span>
                    <span className="text-[10px] text-neutral-400 block">Pre-flight checks GPU capabilities, DirectX/Vulkan extensions, and PRX presence before WinMain.</span>
                  </div>
                </label>

                <label className="flex items-start space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={options.traceImports}
                    onChange={(e) => setOptions(o => ({ ...o, traceImports: e.target.checked }))}
                    className="mt-0.5 rounded bg-black border-white/20 text-white focus:ring-0"
                  />
                  <div>
                    <span className="font-medium text-white block">PRX Call Tracing (--trace-imports)</span>
                    <span className="text-[10px] text-neutral-400 block">Logs function calls from game to host libraries. Useful for debugging missing APIs.</span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Pre-Flight Configuration Summary Card */}
          <div className="p-5 rounded-2xl bg-neutral-900/60 border border-white/10 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center space-x-2">
                <FolderCheck className="w-4 h-4 text-emerald-400" />
                <span>Pre-Flight Summary</span>
              </span>

              {/* Validation Status Pill */}
              <div className="flex items-center space-x-1.5">
                {validationResult.state === 'ready' && (
                  <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-xs font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Ready</span>
                  </span>
                )}
                {validationResult.state === 'warning' && (
                  <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 text-xs font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    <span>Needs Attention</span>
                  </span>
                )}
                {validationResult.state === 'blocking' && (
                  <span className="flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-300 border border-red-500/30 text-xs font-semibold">
                    <XCircle className="w-3.5 h-3.5 text-red-400" />
                    <span>Cannot Proceed</span>
                  </span>
                )}
              </div>
            </div>

            {/* Target & Path Details */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center text-neutral-300">
                <span className="text-neutral-400">Target Title:</span>
                <span className="font-semibold text-white">{selectedGame.title}</span>
              </div>
              <div className="flex justify-between items-center text-neutral-300">
                <span className="text-neutral-400">Title ID / Size:</span>
                <span className="font-mono text-neutral-200">{selectedGame.titleId} • {(selectedGame.sizeBytes / (1024*1024*1024)).toFixed(1)} GB</span>
              </div>
              <div className="flex justify-between items-center text-neutral-300">
                <span className="text-neutral-400">Source Folder:</span>
                <span className="font-mono text-neutral-300 truncate max-w-[200px]" title={selectedGame.path}>
                  {selectedGame.path}
                </span>
              </div>
              <div className="flex justify-between items-center text-neutral-300">
                <span className="text-neutral-400">Output Binary:</span>
                <span className="font-mono text-emerald-300">app.exe (In-Place Native)</span>
              </div>
              <div className="flex justify-between items-center text-neutral-300">
                <span className="text-neutral-400">Configuration Preset:</span>
                <span className="text-blue-300 font-medium">
                  {options.cpuTranslation === 'intel' ? 'Intel AVX2 Optimized' : options.cpuTranslation === 'rosetta' ? 'Apple Silicon' : 'AMD Zen2 Native'}
                </span>
              </div>
            </div>

            {/* Validation Warnings / Blocking Issues Display */}
            {validationResult.warnings.length > 0 && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 space-y-1">
                <div className="flex items-center space-x-1.5 font-semibold">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Warnings (relocation can proceed):</span>
                </div>
                <ul className="list-disc pl-5 text-[11px] space-y-0.5 text-amber-200/90">
                  {validationResult.warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {validationResult.blocking.length > 0 && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-300 space-y-1">
                <div className="flex items-center space-x-1.5 font-semibold">
                  <XCircle className="w-3.5 h-3.5 text-red-400" />
                  <span>Blocking Requirements:</span>
                </div>
                <ul className="list-disc pl-5 text-[11px] space-y-0.5 text-red-200/90">
                  {validationResult.blocking.map((b, idx) => (
                    <li key={idx}>{b}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Primary Action Buttons */}
            <div className="pt-2 flex flex-col space-y-2.5">
              {!isRelinking ? (
                <button
                  type="button"
                  onClick={handleStartRelinking}
                  disabled={validationResult.state === 'blocking'}
                  className={`w-full py-3.5 rounded-full font-semibold text-sm transition-all flex items-center justify-center space-x-2 ${
                    validationResult.state === 'blocking'
                      ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-white/5'
                      : 'bg-white text-black hover:bg-neutral-200 active:scale-[0.98] shadow-lg shadow-white/10'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Start Relinking Process</span>
                </button>
              ) : (
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    disabled
                    className="flex-1 py-3.5 rounded-full bg-neutral-800 text-neutral-300 font-semibold text-sm flex items-center justify-center space-x-2 cursor-wait"
                  >
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>{isCancelling ? 'Cancelling Process...' : 'Relinking in Progress...'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelRelinking}
                    disabled={isCancelling}
                    className="px-4 py-3.5 rounded-full bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/30 font-medium text-xs transition-colors flex items-center space-x-1.5"
                  >
                    <X className="w-4 h-4" />
                    <span>Cancel</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Pipeline Stages, Status Summary & Terminal */}
        <div className="lg:col-span-7 flex flex-col space-y-6">

          {/* Success Banner (when game is ported / just finished) */}
          {isCompleted && !isRelinking && (
            <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/60 via-emerald-900/30 to-black/60 border border-emerald-500/30 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in">
              <div className="flex items-start space-x-3.5">
                <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 mt-0.5 border border-emerald-500/30">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">Relinking Completed Successfully!</h3>
                  <p className="text-xs text-emerald-200/90 mt-0.5">
                    <strong>{selectedGame.title}</strong> is now ported in-place and ready to Plug & Play on your PC.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2.5">
                {onLaunchGame && (
                  <button
                    type="button"
                    onClick={() => {
                      audioService.playLaunch();
                      onLaunchGame(selectedGame);
                    }}
                    className="px-5 py-2.5 rounded-full bg-white text-black font-bold text-xs hover:bg-neutral-200 transition-all shadow-lg flex items-center space-x-2"
                  >
                    <Play className="w-3.5 h-3.5 fill-black" />
                    <span>Play Game Now</span>
                  </button>
                )}
                {onNavigateToGames && (
                  <button
                    type="button"
                    onClick={() => {
                      audioService.playNavTick();
                      onNavigateToGames();
                    }}
                    className="px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-medium text-xs transition-colors border border-white/10"
                  >
                    Games Library
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Error Message Box (Readable Diagnosis & Actionable Steps) */}
          {errorMessage && (
            <div className="p-5 rounded-2xl bg-red-950/40 border border-red-500/30 text-white space-y-3 animate-fade-in">
              <div className="flex items-start space-x-3">
                <div className="p-2 rounded-xl bg-red-500/20 text-red-400 mt-0.5">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-red-200">{errorMessage.summary}</h4>
                  <p className="text-xs text-red-300/90 mt-1">{errorMessage.reason}</p>
                </div>
              </div>
              <div className="pt-2 border-t border-red-500/20 text-xs">
                <span className="font-semibold text-neutral-200 block mb-1">Recommended Next Steps:</span>
                <p className="text-[11px] text-neutral-300 whitespace-pre-line leading-relaxed">
                  {errorMessage.remedy}
                </p>
              </div>
            </div>
          )}

          {/* Simple Mode: 6-Stage Human-Readable Progressive Status Display */}
          {mode === 'simple' ? (
            <div className="bg-white/[0.03] rounded-2xl p-5 border border-white/10 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div>
                  <span className="text-xs font-bold text-white uppercase tracking-wider block">
                    Pipeline Progression
                  </span>
                  <span className="text-[11px] text-neutral-400">
                    {isRelinking ? 'Relinking actively executing...' : isCompleted ? 'All stages completed' : 'Ready to start'}
                  </span>
                </div>

                {/* Overall Progress Percentage */}
                <div className="flex items-center space-x-2">
                  <div className="w-32 h-2 rounded-full bg-black/50 overflow-hidden border border-white/10">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-500 via-indigo-400 to-emerald-400 transition-all duration-300"
                      style={{ width: `${overallProgress}%` }}
                    />
                  </div>
                  <span className="font-mono text-xs font-semibold text-white min-w-[36px] text-right">
                    {overallProgress}%
                  </span>
                </div>
              </div>

              {/* 6 Stage Vertical Sequence */}
              <div className="space-y-2.5">
                {humanStages.map((st) => (
                  <div
                    key={st.id}
                    className={`p-3 rounded-xl border transition-all flex items-start space-x-3.5 ${
                      st.status === 'completed'
                        ? 'bg-emerald-500/[0.06] border-emerald-500/20 text-emerald-200'
                        : st.status === 'active'
                        ? 'bg-white/10 border-white/40 text-white shadow-lg'
                        : st.status === 'error'
                        ? 'bg-red-500/10 border-red-500/30 text-red-200'
                        : 'bg-black/20 border-white/5 text-neutral-400'
                    }`}
                  >
                    {/* Stage Indicator Icon */}
                    <div className="mt-0.5">
                      {st.status === 'completed' && (
                        <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                      )}
                      {st.status === 'active' && (
                        <div className="w-5 h-5 rounded-full bg-white/20 text-white flex items-center justify-center">
                          <Loader2 className="w-4 h-4 animate-spin" />
                        </div>
                      )}
                      {st.status === 'error' && (
                        <div className="w-5 h-5 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center">
                          <XCircle className="w-4 h-4" />
                        </div>
                      )}
                      {st.status === 'pending' && (
                        <div className="w-5 h-5 rounded-full border border-neutral-600 flex items-center justify-center text-[10px] font-mono text-neutral-500">
                          0{st.id}
                        </div>
                      )}
                    </div>

                    {/* Stage Text & Description */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs font-semibold text-white tracking-tight">
                          {st.title}
                        </span>
                        <span className={`text-[10px] uppercase font-bold tracking-wider ${
                          st.status === 'completed'
                            ? 'text-emerald-400'
                            : st.status === 'active'
                            ? 'text-blue-300 animate-pulse'
                            : st.status === 'error'
                            ? 'text-red-400'
                            : 'text-neutral-500'
                        }`}>
                          {st.status === 'completed' ? 'Completed' : st.status === 'active' ? 'Working...' : st.status === 'error' ? 'Failed' : 'Waiting'}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-400 truncate">
                        {st.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Advanced Mode: 8 Technical Stages Grid */
            <div className="bg-white/5 rounded-2xl p-5 border border-white/10 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <span className="text-xs text-neutral-300 uppercase tracking-wider font-semibold">
                  Low-Level Compiler Stages (8-Step Engine)
                </span>
                <span className="font-mono text-xs text-neutral-400">
                  {technicalStages.filter(s => s.status === 'completed').length} / 8 Completed
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {technicalStages.map((st) => (
                  <div
                    key={st.id}
                    className={`p-2.5 rounded-xl text-left transition-colors border ${
                      st.status === 'completed'
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                        : st.status === 'active'
                        ? 'bg-white/10 border-white text-white shadow'
                        : st.status === 'error'
                        ? 'bg-red-500/10 border-red-500/30 text-red-300'
                        : 'bg-black/20 border-white/5 text-neutral-500'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] font-mono">0{st.id}</span>
                      {st.status === 'completed' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                      {st.status === 'active' && <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />}
                      {st.status === 'error' && <XCircle className="w-3.5 h-3.5 text-red-400" />}
                    </div>
                    <p className="text-[11px] font-semibold truncate text-white">{st.title}</p>
                    <p className="text-[9px] text-neutral-400 truncate mt-0.5">{st.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Collapsible / Optional Technical Terminal Stream */}
          <div className="bg-black/70 rounded-2xl border border-white/10 overflow-hidden shadow-2xl flex flex-col">
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between text-xs font-mono text-neutral-400 bg-white/[0.02]">
              <div className="flex items-center space-x-2">
                <Terminal className="w-3.5 h-3.5 text-neutral-300" />
                <span className="text-white font-medium">Technical Compiler Stream (stdout)</span>
                <span className="text-neutral-500 text-[10px]">({logs.length} entries)</span>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={() => setLogs([])}
                  className="hover:text-white transition-colors text-[11px]"
                >
                  Clear Logs
                </button>
                <button
                  type="button"
                  onClick={() => {
                    audioService.playNavTick();
                    setShowTerminal(prev => !prev);
                  }}
                  className="flex items-center space-x-1 hover:text-white transition-colors text-[11px] font-medium"
                >
                  <span>{showTerminal ? 'Hide Terminal' : 'View Technical Logs'}</span>
                  {showTerminal ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Terminal Body */}
            {showTerminal && (
              <div className="p-4 font-mono text-xs space-y-1.5 overflow-y-auto max-h-[320px] bg-black/90">
                {logs.length === 0 ? (
                  <p className="text-neutral-600 text-[11px] italic">No logs recorded yet.</p>
                ) : (
                  logs.map((log, idx) => (
                    <div key={idx} className="flex items-start space-x-2.5 leading-relaxed">
                      <span className="text-neutral-600 text-[10px] select-none shrink-0 font-mono">
                        [{log.timestamp}]
                      </span>
                      <span
                        className={`break-all ${
                          log.level === 'error'
                            ? 'text-red-400 font-semibold'
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
                  ))
                )}
                <div ref={terminalEndRef} />
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};
