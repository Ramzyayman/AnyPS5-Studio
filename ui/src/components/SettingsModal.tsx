import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  FolderSearch, 
  Cpu, 
  Gamepad2, 
  Volume2, 
  Check, 
  X,
  FileCode2,
  HardDrive,
  RefreshCw,
  DownloadCloud,
  CheckCircle2
} from 'lucide-react';
import { audioService } from '../services/audioService';
import { apiBridge } from '../services/apiBridge';
import { UpdateStatus } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  showAdvancedNav: boolean;
  onToggleAdvancedNav: (enabled: boolean) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
  isOpen, 
  onClose,
  showAdvancedNav,
  onToggleAdvancedNav
}) => {
  const [relinkerPath, setRelinkerPath] = useState<string>('');
  const [prxPath, setPrxPath] = useState<string>('');
  const [defaultRelinkerPath, setDefaultRelinkerPath] = useState<string>('');
  const [defaultPrxPath, setDefaultPrxPath] = useState<string>('');
  const [defaultTarget, setDefaultTarget] = useState<string>('windows');
  const [cpuFix, setCpuFix] = useState<string>('intel');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(audioService.enabled);
  const [hapticsEnabled, setHapticsEnabled] = useState<boolean>(true);
  const [advanced, setAdvanced] = useState<boolean>(showAdvancedNav);
  const [appVersion, setAppVersion] = useState<string>('1.0.0');
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({ status: 'idle' });

  useEffect(() => {
    apiBridge.getAppVersion().then(setAppVersion).catch(() => {});
    const unsub = apiBridge.onUpdateStatus((status) => {
      setUpdateStatus(status);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (isOpen) {
      setAdvanced(showAdvancedNav);
      apiBridge.getSettings().then((settings) => {
        if (settings) {
          if (settings.relinkerPath) setRelinkerPath(settings.relinkerPath);
          if (settings.prxPath) setPrxPath(settings.prxPath);
          if (settings.defaultRelinkerPath) setDefaultRelinkerPath(settings.defaultRelinkerPath);
          if (settings.defaultPrxPath) setDefaultPrxPath(settings.defaultPrxPath);
          if (settings.defaultTarget) setDefaultTarget(settings.defaultTarget);
          if (settings.cpuFix) setCpuFix(settings.cpuFix);
          if (settings.soundEnabled !== undefined) {
            setSoundEnabled(settings.soundEnabled);
            audioService.enabled = settings.soundEnabled;
          }
          if (settings.hapticsEnabled !== undefined) setHapticsEnabled(settings.hapticsEnabled);
          if (settings.advanced !== undefined) {
            setAdvanced(settings.advanced);
          }
        }
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClose = () => {
    onToggleAdvancedNav(showAdvancedNav);
    onClose();
  };

  const handleAdvancedChange = (checked: boolean) => {
    audioService.playNavTick();
    setAdvanced(checked);
    onToggleAdvancedNav(checked);
  };

  const handleBrowseRelinker = async () => {
    const selected = await apiBridge.selectFile([
      { name: 'Executable (*.exe)', extensions: ['exe'] },
      { name: 'All Files (*.*)', extensions: ['*'] }
    ]);
    if (selected) {
      setRelinkerPath(selected);
    }
  };

  const handleBrowsePrx = async () => {
    const selected = await apiBridge.selectGameFolder();
    if (selected) {
      setPrxPath(selected);
    }
  };

  const handleResetDefaults = () => {
    if (defaultRelinkerPath) setRelinkerPath(defaultRelinkerPath);
    if (defaultPrxPath) setPrxPath(defaultPrxPath);
  };

  const handleCheckForUpdates = async () => {
    audioService.playNavTick();
    setUpdateStatus({ status: 'checking' });
    try {
      const res = await apiBridge.checkForUpdates();
      if (res.status === 'not-available' || res.status === 'dev-mode') {
        setUpdateStatus({ status: 'not-available', version: res.currentVersion });
      }
    } catch (err: any) {
      setUpdateStatus({ status: 'error', error: err?.message || 'Update check failed.' });
    }
  };

  const handleSave = async () => {
    audioService.playConfirm();
    await apiBridge.saveSettings({
      relinkerPath,
      prxPath,
      defaultTarget,
      cpuFix,
      soundEnabled,
      hapticsEnabled,
      advanced,
    });
    onToggleAdvancedNav(advanced);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-[#0b0e14]/95 rounded-2xl border border-white/10 overflow-hidden shadow-2xl p-6">
        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
          <div className="flex items-center space-x-2.5">
            <Settings className="w-4 h-4 text-white/70" />
            <h3 className="font-medium text-base text-white tracking-wide">Settings · AnyPS5 Studio</h3>
          </div>
          <button
            onClick={handleClose}
            className="p-1 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-white/70 mb-1">Native Relinker Executable</label>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={relinkerPath}
                onChange={(e) => setRelinkerPath(e.target.value)}
                placeholder="Loading installation path..."
                className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all"
              />
              <button
                type="button"
                onClick={handleBrowseRelinker}
                className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white/80 hover:text-white text-xs font-medium border border-white/10 transition-colors flex-shrink-0"
              >
                Browse...
              </button>
            </div>
            <p className="text-[11px] text-white/40 mt-1">Compiled relinker binary bundled with AnyPS5 Studio</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-white/70 mb-1">System PRX Libraries Directory</label>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={prxPath}
                onChange={(e) => setPrxPath(e.target.value)}
                placeholder="Loading installation path..."
                className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all"
              />
              <button
                type="button"
                onClick={handleBrowsePrx}
                className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white/80 hover:text-white text-xs font-medium border border-white/10 transition-colors flex-shrink-0"
              >
                Browse...
              </button>
            </div>
            <p className="text-[11px] text-white/40 mt-1">Directory containing clean-room libkernel.prx, libSceAgcDriver.prx</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-white/70 mb-1">Target Platform</label>
              <select
                value={defaultTarget}
                onChange={(e) => setDefaultTarget(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#141923] border border-white/10 text-white text-xs focus:outline-none focus:border-white/30 transition-all"
              >
                <option value="windows">Windows (.exe)</option>
                <option value="linux">Linux (.elf)</option>
                <option value="macos">macOS (Mach-O)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-white/70 mb-1">Host CPU Instruction Set</label>
              <select
                value={cpuFix}
                onChange={(e) => setCpuFix(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-[#141923] border border-white/10 text-white text-xs focus:outline-none focus:border-white/30 transition-all"
              >
                <option value="intel">Intel x86-64 (AVX2 Lowering)</option>
                <option value="amd">AMD Zen 2 / Zen 3 / Zen 4 Native</option>
                <option value="rosetta">Apple Silicon (Rosetta JIT)</option>
              </select>
            </div>
          </div>

          <div className="pt-2 border-t border-white/10 space-y-2.5">
            <label className="flex items-center space-x-2.5 text-xs text-white/80 cursor-pointer">
              <input
                type="checkbox"
                checked={soundEnabled}
                onChange={(e) => {
                  setSoundEnabled(e.target.checked);
                  audioService.enabled = e.target.checked;
                }}
                className="rounded bg-white/10 border-white/20 text-[#0070d1] focus:ring-0"
              />
              <span>Synthesized PlayStation 5 acoustic UI audio</span>
            </label>

            <label className="flex items-center space-x-2.5 text-xs text-white/80 cursor-pointer">
              <input
                type="checkbox"
                checked={hapticsEnabled}
                onChange={(e) => setHapticsEnabled(e.target.checked)}
                className="rounded bg-white/10 border-white/20 text-[#0070d1] focus:ring-0"
              />
              <span>DualSense controller adaptive trigger & vibration emulation</span>
            </label>

            <div className="pt-1.5 border-t border-white/5">
              <label className="flex items-start space-x-2.5 text-xs text-white/90 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={advanced}
                  onChange={(e) => handleAdvancedChange(e.target.checked)}
                  className="rounded bg-white/10 border-white/20 text-[#0070d1] focus:ring-0 mt-0.5"
                />
                <div className="flex flex-col">
                  <span className="font-medium text-white group-hover:text-white transition-colors">Advanced</span>
                  <span className="text-[11px] text-white/50 leading-normal mt-0.5">Show Community PR Builds and advanced developer tools in the navigation.</span>
                </div>
              </label>
            </div>
          </div>

          {/* Software Updates */}
          <div className="pt-3 border-t border-white/10">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <RefreshCw className="w-3.5 h-3.5 text-white/70" />
                <span className="text-xs font-medium text-white/90">Software Updates</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-white/10 text-[10px] font-mono text-white/70">
                v{appVersion}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 flex flex-col space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2">
                  {updateStatus.status === 'checking' && (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 text-white/70 animate-spin" />
                      <span className="text-white/70">Checking for updates...</span>
                    </>
                  )}
                  {updateStatus.status === 'downloading' && (
                    <>
                      <DownloadCloud className="w-3.5 h-3.5 text-[#0070d1] animate-bounce" />
                      <span className="text-white/90">
                        Downloading update v{updateStatus.version || ''}... {updateStatus.progress ? `(${updateStatus.progress}%)` : ''}
                      </span>
                    </>
                  )}
                  {updateStatus.status === 'downloaded' && (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400 font-medium">
                        Update v{updateStatus.version} ready to install.
                      </span>
                    </>
                  )}
                  {updateStatus.status === 'not-available' && (
                    <>
                      <Check className="w-3.5 h-3.5 text-white/60" />
                      <span className="text-white/60">AnyPS5 Studio is up to date.</span>
                    </>
                  )}
                  {updateStatus.status === 'error' && (
                    <span className="text-rose-400 text-[11px] truncate max-w-[280px]">
                      {updateStatus.error || 'Update check failed.'}
                    </span>
                  )}
                  {updateStatus.status === 'idle' && (
                    <span className="text-white/60">Check for latest release updates.</span>
                  )}
                  {updateStatus.status === 'available' && (
                    <span className="text-white/80">Found update v{updateStatus.version}. Starting download...</span>
                  )}
                </div>

                {updateStatus.status === 'downloaded' ? (
                  <button
                    type="button"
                    onClick={() => {
                      audioService.playConfirm();
                      apiBridge.quitAndInstallUpdate();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-semibold transition-colors flex-shrink-0"
                  >
                    Restart & Install
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={updateStatus.status === 'checking' || updateStatus.status === 'downloading'}
                    onClick={handleCheckForUpdates}
                    className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 disabled:opacity-50 text-white/80 hover:text-white text-xs font-medium border border-white/10 transition-colors flex-shrink-0"
                  >
                    {updateStatus.status === 'checking' ? 'Checking...' : 'Check for Updates'}
                  </button>
                )}
              </div>

              {updateStatus.status === 'downloading' && (
                <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-[#0070d1] h-full transition-all duration-300 rounded-full"
                    style={{ width: `${updateStatus.progress || 0}%` }}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 flex items-center justify-between border-t border-white/10">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="text-xs text-white/40 hover:text-white/70 transition-colors"
            >
              Reset to Defaults
            </button>
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 rounded-full text-xs font-medium text-white/60 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-6 py-2 rounded-full bg-white text-black hover:bg-white/90 text-xs font-semibold transition-all"
              >
                Save Preferences
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
