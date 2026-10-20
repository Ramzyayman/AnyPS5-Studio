import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Terminal,
  Hammer,
  Play,
  Square,
  RefreshCw,
  Download,
  GitBranch,
  FolderOpen,
  CheckCircle2,
  AlertCircle,
  Plus,
  Loader2,
  Trash2,
  Copy,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  Check,
} from 'lucide-react';
import {
  ToolchainStatus,
  ToolchainInspectionResult,
  ToolchainInstallProgress,
  SourceSyncStatus,
  BuilderLogMessage,
  BuildProgressStatus,
  RuntimeProfile,
} from '../types';
import { apiBridge } from '../services/apiBridge';
import { audioService } from '../services/audioService';

interface LocalBuilderProps {
  onRuntimeRegistered?: () => void;
  onNotification?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const sanitizeBuildError = (rawError?: string): string => {
  if (!rawError) return 'Build failed: Compilation halted';
  const str = String(rawError);

  if (/cmake.*-S.*-B.*exited with code/i.test(str) || /cmake.*configure/i.test(str) || /The source directory.*does not contain a CMakeLists/i.test(str)) {
    return 'Build failed during CMake configuration';
  }
  if (/cmake.*--build.*--target.*relinker.*exited/i.test(str)) {
    return 'Build failed during relinker compilation';
  }
  if (/cmake.*--build.*--target.*libs.*exited/i.test(str)) {
    return 'Build failed during PRX libraries compilation';
  }
  if (/ninja.*exited with code/i.test(str)) {
    return 'Build failed during Ninja compilation phase';
  }
  if (/git.*submodule/i.test(str)) {
    return 'Submodule initialization failed';
  }
  if (/git.*checkout/i.test(str) || /git.*fetch/i.test(str) || /git.*pull/i.test(str)) {
    return 'Source synchronization failed';
  }
  if (str.length > 80 && str.includes('exited with code')) {
    return 'Build process exited with an error. Inspect terminal logs below.';
  }
  if (str.length > 90) {
    return str.slice(0, 87) + '...';
  }
  return str;
};

export const LocalBuilder: React.FC<LocalBuilderProps> = ({
  onRuntimeRegistered,
  onNotification,
}) => {
  // Toolchain state
  const [toolchain, setToolchain] = useState<ToolchainStatus[]>([]);
  const [allToolsReady, setAllToolsReady] = useState<boolean>(false);
  const [inspectingTools, setInspectingTools] = useState<boolean>(true);
  const [installingToolchain, setInstallingToolchain] = useState<boolean>(false);
  const [toolchainProgress, setToolchainProgress] = useState<ToolchainInstallProgress | null>(null);

  // Source repository state
  const [sourceStatus, setSourceStatus] = useState<SourceSyncStatus | null>(null);
  const [syncingSource, setSyncingSource] = useState<boolean>(false);

  // Build state
  const [isBuilding, setIsBuilding] = useState<boolean>(false);
  const [buildStatus, setBuildStatus] = useState<BuildProgressStatus>({
    status: 'idle',
    progress: 0,
  });

  // Terminal logs state
  const [logs, setLogs] = useState<BuilderLogMessage[]>([]);
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const terminalBottomRef = useRef<HTMLDivElement>(null);

  // Manual folder registration state
  const [showManualRegister, setShowManualRegister] = useState<boolean>(false);
  const [customName, setCustomName] = useState<string>('');
  const [customPath, setCustomPath] = useState<string>('');
  const [customError, setCustomError] = useState<string | null>(null);
  const [customSuccess, setCustomSuccess] = useState<string | null>(null);

  // Load toolchain inspection
  const loadToolchain = useCallback(async () => {
    setInspectingTools(true);
    try {
      const res = await apiBridge.inspectToolchain();
      setToolchain(res.tools);
      setAllToolsReady(res.allRequiredAvailable);
    } catch (err) {
      console.error('Failed to inspect toolchain:', err);
    } finally {
      setInspectingTools(false);
    }
  }, []);

  // Load source repository status
  const loadSourceStatus = useCallback(async () => {
    try {
      const res = await apiBridge.getSourceStatus();
      setSourceStatus(res);
    } catch (err) {
      console.error('Failed to get source status:', err);
    }
  }, []);

  useEffect(() => {
    loadToolchain();
    loadSourceStatus();
  }, [loadToolchain, loadSourceStatus]);

  // Subscribe to real-time build logs
  useEffect(() => {
    const unsubLog = apiBridge.onBuilderLog((logMsg) => {
      setLogs((prev) => [...prev, logMsg]);
    });

    const unsubStatus = apiBridge.onBuildStatus((status) => {
      setBuildStatus(status);
      if (status.status === 'completed') {
        setIsBuilding(false);
        audioService.playConfirm();
        onNotification?.('Local compilation finished. Runtime profile registered.', 'success');
        onRuntimeRegistered?.();
        loadSourceStatus();
      } else if (status.status === 'error') {
        setIsBuilding(false);
        const concise = status.message || sanitizeBuildError(status.error);
        onNotification?.(concise, 'error');
      }
    });

    const unsubToolchainProgress = apiBridge.onToolchainInstallProgress((prog) => {
      setToolchainProgress(prog);
      if (prog.status === 'ready') {
        setInstallingToolchain(false);
        audioService.playConfirm();
        loadToolchain();
        onNotification?.('Managed toolchain installed successfully.', 'success');
      } else if (prog.status === 'error') {
        setInstallingToolchain(false);
        onNotification?.(`Toolchain install failed: ${prog.error}`, 'error');
      }
    });

    return () => {
      unsubLog();
      unsubStatus();
      unsubToolchainProgress();
    };
  }, [loadToolchain, loadSourceStatus, onNotification, onRuntimeRegistered]);

  // Auto-scroll terminal
  useEffect(() => {
    if (autoScroll && terminalBottomRef.current) {
      terminalBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  // Install Managed Toolchain
  const handleInstallToolchain = async () => {
    audioService.playLaunch();
    setInstallingToolchain(true);
    setToolchainProgress({
      status: 'downloading',
      progress: 0,
      message: 'Initializing toolchain provisioning...',
    });

    try {
      const res = await apiBridge.installManagedToolchain();
      if (!res.success) {
        setInstallingToolchain(false);
        onNotification?.(`Installation failed: ${res.error}`, 'error');
      }
    } catch (err: any) {
      setInstallingToolchain(false);
      onNotification?.(`Toolchain error: ${err?.message || String(err)}`, 'error');
    }
  };

  // Synchronize Upstream Source
  const handleSyncSource = async () => {
    audioService.playLaunch();
    setSyncingSource(true);
    setLogs((prev) => [
      ...prev,
      {
        text: '--- Beginning Upstream Source Synchronization ---',
        type: 'info',
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);

    try {
      const res = await apiBridge.syncSource();
      if (res.success) {
        audioService.playConfirm();
        onNotification?.(`Source synchronized to commit ${res.commit?.substring(0, 7) || 'HEAD'}.`, 'success');
        await loadSourceStatus();
      } else {
        onNotification?.(`Source sync failed: ${res.error}`, 'error');
      }
    } catch (err: any) {
      onNotification?.(`Sync error: ${err?.message || String(err)}`, 'error');
    } finally {
      setSyncingSource(false);
    }
  };

  // Start C++ Build
  const handleStartBuild = async () => {
    audioService.playLaunch();
    setIsBuilding(true);
    setBuildStatus({
      status: 'configuring',
      progress: 5,
      message: 'Starting build orchestrator...',
    });
    setLogs((prev) => [
      ...prev,
      {
        text: '=== Launching AnyPS5 Native Build Pipeline ===',
        type: 'info',
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);

    try {
      const res = await apiBridge.startBuild();
      if (!res.success) {
        setIsBuilding(false);
        const concise = sanitizeBuildError(res.error);
        onNotification?.(concise, 'error');
      }
    } catch (err: any) {
      setIsBuilding(false);
      const concise = sanitizeBuildError(err?.message || String(err));
      onNotification?.(concise, 'error');
    }
  };

  // Cancel Build
  const handleCancelBuild = async () => {
    audioService.playNavTick();
    try {
      await apiBridge.cancelBuild();
      setIsBuilding(false);
      setSyncingSource(false);
      setBuildStatus({
        status: 'idle',
        progress: 0,
        message: 'Build cancelled by user.',
      });
      setLogs((prev) => [
        ...prev,
        {
          text: '[Build Aborted] Active child compilation processes terminated.',
          type: 'error',
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } catch (err) {
      console.error('Failed to cancel build:', err);
    }
  };

  // Clear Logs
  const handleClearLogs = () => {
    audioService.playNavTick();
    setLogs([]);
  };

  // Manual folder browser
  const handleBrowseFolder = async () => {
    audioService.playNavTick();
    try {
      const selected = await apiBridge.selectFolder();
      if (selected) {
        setCustomPath(selected);
      }
    } catch (err) {
      console.error('Failed to select folder:', err);
    }
  };

  // Register pre-built custom runtime
  const handleRegisterCustom = async () => {
    setCustomError(null);
    setCustomSuccess(null);

    if (!customPath.trim()) {
      setCustomError('Please provide a build directory path.');
      return;
    }

    try {
      audioService.playLaunch();
      const profile = await apiBridge.registerCustomRuntime({
        name: customName.trim() || `Dev Core (${customPath.split(/[/\\]/).filter(Boolean).pop()})`,
        customPath: customPath.trim(),
      });

      audioService.playConfirm();
      setCustomSuccess(`Runtime "${profile.name}" registered successfully.`);
      setCustomName('');
      setCustomPath('');
      onRuntimeRegistered?.();
    } catch (err: any) {
      setCustomError(err?.message || 'Failed to register runtime profile.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Grid: Toolchain Status + Upstream Source Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Panel 1: Build Toolchain Inspection */}
        <div className="p-5 rounded-xl bg-white/[0.02] border border-white/5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-white/5">
            <div className="flex items-center space-x-2">
              <span className={`w-2 h-2 rounded-full shrink-0 ${allToolsReady ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Build Toolchain</h3>
              <span className="text-[11px] font-mono text-neutral-400">
                {allToolsReady ? 'Ready' : 'Missing Tools'}
              </span>
            </div>

            <button
              onClick={() => {
                audioService.playNavTick();
                loadToolchain();
                loadSourceStatus();
              }}
              disabled={inspectingTools || isBuilding}
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-neutral-300 hover:text-white font-medium text-xs border border-white/10 transition-colors disabled:opacity-50"
              title="Refresh toolchain and source status"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${inspectingTools ? 'animate-spin' : ''}`} />
              <span>Refresh Status</span>
            </button>
          </div>

          {/* Tools List */}
          <div className="divide-y divide-white/5">
            {toolchain.map((tool) => (
              <div
                key={tool.name}
                className="flex items-center justify-between py-2.5 px-1 hover:bg-white/[0.02] transition-colors gap-2"
              >
                {/* Left: Tool name and command locked without wrapping */}
                <div className="flex items-center space-x-2 shrink-0 whitespace-nowrap">
                  <span className="text-xs font-medium text-white">{tool.name}</span>
                  <span className="text-[10px] font-mono text-neutral-500">({tool.command})</span>
                </div>

                {/* Middle: Version string occupying remaining space, cleanly truncated with tooltip */}
                <div
                  className="min-w-0 flex-1 text-right truncate text-xs font-mono text-neutral-400"
                  title={tool.isAvailable ? tool.version || 'Detected' : 'Not installed'}
                >
                  {tool.isAvailable ? tool.version || 'Detected' : 'Not installed'}
                </div>

                {/* Right: Status badge anchored and aligned */}
                <div className="shrink-0 flex items-center justify-end space-x-1 min-w-[68px]">
                  {tool.isAvailable ? (
                    <div className="flex items-center space-x-1 text-emerald-400 font-mono text-[11px]">
                      <Check className="w-3.5 h-3.5" />
                      <span className="text-neutral-400">{tool.isManaged ? 'managed' : 'system'}</span>
                    </div>
                  ) : (
                    <span className="font-mono text-[11px] text-rose-400">missing</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Action: Install Managed Toolchain */}
          {!allToolsReady && (
            <div className="pt-2">
              <button
                onClick={handleInstallToolchain}
                disabled={installingToolchain || isBuilding}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-400 text-white font-medium text-xs transition-all shadow-sm active:scale-95 disabled:opacity-50"
              >
                {installingToolchain ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Provisioning Managed Toolchain...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>Install Managed Portable Toolchain</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Toolchain Provisioning Progress Bar */}
          {installingToolchain && toolchainProgress && (
            <div className="p-3 rounded-lg bg-blue-950/20 border border-blue-500/20 space-y-2">
              <div className="flex justify-between text-[11px] text-neutral-300 font-mono">
                <span className="truncate pr-2">{toolchainProgress.message || 'Downloading...'}</span>
                <span className="font-semibold text-blue-300 shrink-0">{toolchainProgress.progress}%</span>
              </div>
              <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${toolchainProgress.progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Panel 2: Source Code Status */}
        <div className="p-5 rounded-xl bg-white/[0.02] border border-white/5 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <div className="flex items-center space-x-2">
                <span className={`w-2 h-2 rounded-full shrink-0 ${sourceStatus?.exists ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <h3 className="text-xs font-semibold text-white uppercase tracking-wider">AnyPS5 Repository</h3>
              </div>

              <div>
                {sourceStatus?.exists ? (
                  <span className="text-[11px] font-mono text-emerald-400 inline-flex items-center space-x-1">
                    <Check className="w-3 h-3" />
                    <span>Synchronized</span>
                  </span>
                ) : (
                  <span className="text-[11px] font-mono text-amber-400">Clone Needed</span>
                )}
              </div>
            </div>

            {/* Key-Value Metadata: Clean tabular grid with subtle divider lines */}
            <div className="divide-y divide-white/5 text-xs font-mono">
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-neutral-400">Remote:</span>
                <a
                  href="https://github.com/boykopovar/AnyPS5"
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-400 hover:text-blue-300 inline-flex items-center space-x-1 transition-colors"
                >
                  <span>boykopovar/AnyPS5</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-neutral-400">Local Branch:</span>
                <span className="text-neutral-200">{sourceStatus?.branch || 'main'}</span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-neutral-400">Current Commit:</span>
                <span className="text-white font-medium">
                  {sourceStatus?.shortCommit ? (
                    <span className="bg-white/5 border border-white/10 px-1.5 py-0.5 rounded text-blue-300">
                      {sourceStatus.shortCommit}
                    </span>
                  ) : (
                    'None'
                  )}
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-neutral-400">Submodules:</span>
                <span>
                  {sourceStatus?.submodulesReady ? (
                    <span className="text-emerald-400 inline-flex items-center space-x-1">
                      <Check className="w-3 h-3" />
                      <span>17/17 initialized</span>
                    </span>
                  ) : (
                    <span className="text-amber-400">Incomplete</span>
                  )}
                </span>
              </div>
              {sourceStatus?.commitMessage && (
                <div className="pt-2.5">
                  <div className="p-2.5 rounded-lg bg-black/30 border border-white/5 text-[11px] text-neutral-300 leading-relaxed font-mono truncate" title={sourceStatus.commitMessage}>
                    {sourceStatus.commitMessage}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={handleSyncSource}
              disabled={syncingSource || isBuilding}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white font-medium text-xs border border-white/10 transition-colors disabled:opacity-50"
            >
              {syncingSource ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Synchronizing Repository & Submodules...</span>
                </>
              ) : (
                <>
                  <GitBranch className="w-3.5 h-3.5" />
                  <span>{sourceStatus?.exists ? 'Synchronize Repository (git pull)' : 'Clone Upstream Repository'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Panel 3: Live Build Terminal & Orchestrator */}
      <div className="p-5 rounded-xl bg-white/[0.02] border border-white/5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-white/5">
          <div className="flex items-center space-x-2">
            <Terminal className="w-4 h-4 text-neutral-400" />
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Live Build Terminal</h3>
          </div>

          <div className="flex items-center space-x-2">
            {isBuilding ? (
              <button
                onClick={handleCancelBuild}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-medium transition-colors"
              >
                <Square className="w-3 h-3 fill-rose-300" />
                <span>Cancel Build</span>
              </button>
            ) : (
              <button
                onClick={handleStartBuild}
                disabled={!allToolsReady || !sourceStatus?.exists || isBuilding || syncingSource}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-400 text-white font-medium text-xs transition-all shadow-sm active:scale-95 disabled:opacity-50"
              >
                <Play className="w-3 h-3 fill-white" />
                <span>Compile Relinker & PRX Libraries</span>
              </button>
            )}

            <button
              onClick={handleClearLogs}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Clear terminal logs"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Build Status Bar if active or finished */}
        {buildStatus.status !== 'idle' && (
          <div
            className={`p-3 rounded-lg border space-y-2 ${
              buildStatus.status === 'completed'
                ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
                : buildStatus.status === 'error'
                ? 'bg-rose-950/20 border-rose-500/30 text-rose-200'
                : 'bg-blue-950/20 border-blue-500/30 text-blue-200'
            }`}
          >
            <div className="flex justify-between text-xs font-mono">
              <span className="font-medium">
                {buildStatus.status === 'error'
                  ? buildStatus.message || 'Build Failed'
                  : buildStatus.message || 'Processing...'}
              </span>
              <span>
                {buildStatus.status === 'error' ? 'Halted' : `${buildStatus.progress}%`}
              </span>
            </div>
            <div className="w-full h-1 bg-black/40 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  buildStatus.status === 'completed'
                    ? 'bg-emerald-500'
                    : buildStatus.status === 'error'
                    ? 'bg-rose-500'
                    : 'bg-blue-500'
                }`}
                style={{ width: buildStatus.status === 'error' ? '100%' : `${buildStatus.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* In-flow Error Banner above Terminal */}
        {buildStatus.status === 'error' && (
          <div className="p-3.5 rounded-lg bg-rose-950/30 border border-rose-500/30 text-xs text-rose-200 flex items-start space-x-3">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1 min-w-0 flex-1">
              <div className="font-semibold text-rose-100">
                {buildStatus.message || 'Build Failed'}
              </div>
              <div className="text-[11px] text-rose-300/80 leading-relaxed">
                Review the compiler and linker error logs in the terminal below for the exact failure trace.
              </div>
            </div>
          </div>
        )}

        {/* Terminal Screen */}
        <div className="bg-[#06080e] font-mono text-xs border border-white/10 rounded-xl p-4 h-72 overflow-y-auto space-y-1 select-text scrollbar-thin">
          {logs.length === 0 ? (
            <div className="h-full flex items-center justify-center text-neutral-600 font-mono text-xs">
              Waiting for compilation or synchronization process...
            </div>
          ) : (
            logs.map((log, idx) => {
              let colorClass = 'text-neutral-300';
              if (log.type === 'stderr') colorClass = 'text-amber-300';
              if (log.type === 'error') colorClass = 'text-rose-400 font-semibold';
              if (log.type === 'info') colorClass = 'text-blue-300';

              return (
                <div key={idx} className="leading-relaxed flex items-start space-x-2">
                  <span className="text-neutral-600 select-none text-[10px] shrink-0 pt-0.5">
                    {log.timestamp}
                  </span>
                  <span className={`${colorClass} break-all`}>{log.text}</span>
                </div>
              );
            })
          )}
          <div ref={terminalBottomRef} />
        </div>
      </div>

      {/* Collapsible Panel 4: Manual Directory Registration (Advanced) */}
      <div className="rounded-xl bg-white/[0.02] border border-white/5 overflow-hidden">
        <button
          onClick={() => {
            audioService.playNavTick();
            setShowManualRegister(!showManualRegister);
          }}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center space-x-2.5">
            <FolderOpen className="w-4 h-4 text-neutral-400" />
            <span className="text-xs font-medium text-neutral-200">
              Advanced: Link External Pre-compiled Build Directory
            </span>
          </div>
          {showManualRegister ? (
            <ChevronDown className="w-4 h-4 text-neutral-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-neutral-400" />
          )}
        </button>

        {showManualRegister && (
          <div className="p-5 border-t border-white/5 space-y-4">
            <p className="text-xs text-neutral-400">
              If you have already built AnyPS5 manually in another directory or with Visual Studio, specify the build path below to register it as an active runtime profile.
            </p>

            {customError && (
              <div className="p-3 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs">
                {customError}
              </div>
            )}

            {customSuccess && (
              <div className="p-3 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs">
                {customSuccess}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                  Profile Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Local MSVC Release Build"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full px-3.5 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-white/30"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1.5">
                  Build Folder Path
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    placeholder="e.g. C:/Projects/AnyPS5/build"
                    value={customPath}
                    onChange={(e) => setCustomPath(e.target.value)}
                    className="flex-1 px-3.5 py-2 bg-black/40 border border-white/10 rounded-lg text-xs text-white placeholder-neutral-500 font-mono focus:outline-none focus:border-white/30"
                  />
                  <button
                    onClick={handleBrowseFolder}
                    className="flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white font-medium text-xs border border-white/10 transition-colors shrink-0"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>Browse...</span>
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleRegisterCustom}
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-white text-black font-semibold text-xs hover:bg-neutral-200 transition-all shadow-sm active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>Register Runtime Profile</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
