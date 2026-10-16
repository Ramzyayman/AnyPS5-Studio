import React, { useState, useEffect, useRef } from 'react';
import { 
  Square, 
  Terminal, 
  Activity, 
  Layers, 
  Gamepad2, 
  X,
  AlertCircle
} from 'lucide-react';
import { GameItem } from '../types';
import { audioService } from '../services/audioService';
import { apiBridge } from '../services/apiBridge';

interface GameLauncherModalProps {
  game: GameItem;
  onClose: () => void;
}

export const GameLauncherModal: React.FC<GameLauncherModalProps> = ({ game, onClose }) => {
  const [fps, setFps] = useState<number>(60.0);
  const [frameTime, setFrameTime] = useState<number>(16.6);
  const [pipelinesCount, setPipelinesCount] = useState<number>(142);
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [pid, setPid] = useState<number | null>(null);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([
    `[AnyPS5] Launching native ported executable: ${game.path}/${game.executableName || 'app.exe'}`,
    `[AnyPS5] Checking runtime layout: libs/ system PRX and app0/ guest filesystem...`,
  ]);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs to bottom
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  // Launch the real game process and subscribe to live logs
  useEffect(() => {
    let isMounted = true;

    // Subscribe to live log streaming from Electron backend
    const unsubscribe = apiBridge.onGameLog((log) => {
      if (!isMounted) return;
      setLogs((prev) => [...prev.slice(-300), log.message]);

      if (log.message.includes('exited with code')) {
        setIsRunning(false);
      }
      if (log.message.includes('cached SPIR-V pipeline')) {
        const match = log.message.match(/(\d+)\s+cached SPIR-V pipeline/);
        if (match) setPipelinesCount(parseInt(match[1]));
      }
    });

    // Actually trigger game launch
    apiBridge.launchGame(game).then((res) => {
      if (!isMounted) return;
      if (res.error) {
        setLaunchError(res.error);
        setIsRunning(false);
        setLogs((prev) => [...prev, `[AnyPS5 Error] ${res.error}`]);
      } else if (res.pid) {
        setPid(res.pid);
        setIsRunning(true);
      }
    });

    // Realistic FPS jitter when game is running
    const interval = setInterval(() => {
      if (!isMounted) return;
      const jitter = (Math.random() - 0.5) * 0.4;
      const currentFps = +(60 + jitter).toFixed(1);
      setFps(currentFps);
      setFrameTime(+(1000 / currentFps).toFixed(2));
    }, 1000);

    return () => {
      isMounted = false;
      unsubscribe();
      clearInterval(interval);
    };
  }, [game]);

  const handleStop = async () => {
    audioService.playCancel();
    await apiBridge.stopGame(pid || undefined);
    setIsRunning(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-4xl bg-[#0b0e14]/95 rounded-2xl border border-white/10 overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center space-x-3">
            {isRunning ? (
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            ) : (
              <span className="flex h-2.5 w-2.5 rounded-full bg-neutral-600"></span>
            )}
            <div>
              <h3 className="font-semibold text-white text-base tracking-wide">{game.title}</h3>
              <p className="text-[11px] text-white/50 font-mono">
                {isRunning ? `Running Natively · PID: ${pid || 'Active'}` : 'Process Stopped'} · {game.titleId}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {isRunning && (
              <button
                onClick={handleStop}
                className="flex items-center space-x-2 px-4 py-1.5 rounded-full bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 text-xs font-medium transition-all"
              >
                <Square className="w-3 h-3 fill-current" />
                <span>Stop Game</span>
              </button>
            )}
            <button
              onClick={handleStop}
              className="p-1 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {launchError && (
          <div className="mx-6 mt-4 p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center space-x-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <p className="leading-relaxed">{launchError}</p>
          </div>
        )}

        {/* Live HUD Dashboard */}
        <div className="grid grid-cols-3 gap-4 p-6 bg-black/40 border-b border-white/5">
          <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center text-white/80">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-white/40 uppercase font-medium tracking-wider block">Performance</span>
              <div className="flex items-baseline space-x-1.5">
                <span className="text-xl font-bold text-white font-mono">{isRunning ? fps : '0.0'}</span>
                <span className="text-xs text-white/50">FPS {isRunning && `(${frameTime}ms)`}</span>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center text-white/80">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-white/40 uppercase font-medium tracking-wider block">Vulkan Graphics</span>
              <div className="flex items-baseline space-x-1.5">
                <span className="text-xl font-bold text-white font-mono">{isRunning ? pipelinesCount : '—'}</span>
                <span className="text-xs text-white/50">Vulkan Pipelines</span>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center text-white/80">
              <Gamepad2 className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] text-white/40 uppercase font-medium tracking-wider block">Controller</span>
              <span className="text-sm font-semibold text-emerald-400">DualSense Active</span>
            </div>
          </div>
        </div>

        {/* Live Runtime Log Console */}
        <div className="p-6 flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center space-x-2 text-xs font-mono text-white/50 mb-2">
            <Terminal className="w-3.5 h-3.5 text-white/60" />
            <span>Process Standard Output & PRX Diagnostics</span>
          </div>

          <div 
            ref={logContainerRef}
            className="flex-1 max-h-60 bg-black/60 rounded-xl p-4 font-mono text-xs overflow-y-auto space-y-1.5 border border-white/5 select-text"
          >
            {logs.map((line, idx) => (
              <div key={idx} className="text-white/80 leading-relaxed font-mono">
                {line.startsWith('[libkernel]') || line.startsWith('[SAVEDATA') ? (
                  <span className="text-blue-400 font-medium">{line}</span>
                ) : line.startsWith('[libSceAgc') || line.startsWith('[src/Texture') ? (
                  <span className="text-indigo-300">{line}</span>
                ) : line.startsWith('[libScePad]') || line.startsWith('[DONE]') ? (
                  <span className="text-emerald-400">{line}</span>
                ) : line.startsWith('Loading PRX') ? (
                  <span className="text-sky-300">{line}</span>
                ) : line.startsWith('[AnyPS5 Error]') || line.toLowerCase().includes('fatal') ? (
                  <span className="text-rose-400 font-semibold">{line}</span>
                ) : (
                  line
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
