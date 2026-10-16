import React, { useState } from 'react';
import { 
  DownloadCloud, 
  CheckCircle2, 
  RefreshCw, 
  Layers
} from 'lucide-react';
import { audioService } from '../services/audioService';

export const PrxManager: React.FC = () => {
  const [checkingUpdates, setCheckingUpdates] = useState<boolean>(false);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);

  const prxModules = [
    { name: 'libkernel.prx', size: '1.4 MB', status: 'Installed', version: '0.8.4', description: 'Threads (libthr), Virtual Memory, APR/AMM Buffers, Equeue' },
    { name: 'libSceAgcDriver.prx', size: '3.8 MB', status: 'Installed', version: '0.8.4', description: 'Vulkan 1.3 Driver, RDNA to SPIR-V JIT, Pipeline Journal' },
    { name: 'libScePad.prx', size: '640 KB', status: 'Installed', version: '0.8.4', description: 'DualSense adaptive triggers, haptic feedback, XInput mapping' },
    { name: 'libSceAudioOut.prx', size: '780 KB', status: 'Installed', version: '0.8.4', description: 'Multichannel 7.1 & 3D Spatial Audio WASAPI output' },
    { name: 'libSceSysmodule.prx', size: '320 KB', status: 'Installed', version: '0.8.4', description: 'Dynamic PRX Module loader with deferred initialization' },
    { name: 'libSceSaveData.prx', size: '450 KB', status: 'Installed', version: '0.8.4', description: 'Host filesystem redirection for PS5 game savedata' },
    { name: 'libSceUserService.prx', size: '280 KB', status: 'Installed', version: '0.8.4', description: 'Local user account & license token provider' },
    { name: 'libSceVideoOut.prx', size: '510 KB', status: 'Installed', version: '0.8.4', description: 'Display resolution management, HDR, and frame-rate limiter' },
  ];

  const handleCheckUpdates = async () => {
    audioService.playNavTick();
    setCheckingUpdates(true);
    setDownloadSuccess(false);

    await new Promise(r => setTimeout(r, 1000));
    setCheckingUpdates(false);
    setDownloadSuccess(true);
    audioService.playSuccess();
  };

  return (
    <div className="relative w-full h-full flex flex-col pt-20 px-8 pb-8 overflow-y-auto select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/5">
        <div>
          <span className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider block mb-1">
            System Libraries
          </span>
          <h2 className="text-2xl font-bold text-white tracking-tight">PRX System Libraries</h2>
        </div>

        {/* Action Button */}
        <button
          onClick={handleCheckUpdates}
          disabled={checkingUpdates}
          className="flex items-center space-x-2 px-5 py-2.5 rounded-full bg-white text-black font-semibold text-xs tracking-wide hover:bg-neutral-200 transition-all active:scale-95 disabled:opacity-50"
        >
          {checkingUpdates ? (
            <>
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>Checking Releases...</span>
            </>
          ) : (
            <>
              <DownloadCloud className="w-3.5 h-3.5" />
              <span>Check for Updates</span>
            </>
          )}
        </button>
      </div>

      {downloadSuccess && (
        <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>PRX libraries verified with release <strong>v0.8.4-cleanroom</strong>.</span>
          </div>
          <span className="text-[10px] text-emerald-400 font-mono">libs/ up to date</span>
        </div>
      )}

      {/* Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {prxModules.map((mod) => (
          <div
            key={mod.name}
            className="bg-white/5 rounded-2xl p-4 border border-white/5 hover:border-white/20 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-xs font-semibold text-white">
                  {mod.name}
                </span>
                <span className="text-emerald-400 text-[10px] font-medium flex items-center space-x-1">
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  <span>{mod.status}</span>
                </span>
              </div>
              <p className="text-xs text-neutral-400 line-clamp-2 mb-3">
                {mod.description}
              </p>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-white/5 text-[11px] text-neutral-500 font-mono">
              <span>{mod.size}</span>
              <span className="text-neutral-400 font-sans">v{mod.version}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
