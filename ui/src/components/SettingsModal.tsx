import React, { useState } from 'react';
import { 
  Settings, 
  FolderSearch, 
  Cpu, 
  Gamepad2, 
  Volume2, 
  Check, 
  X,
  FileCode2,
  HardDrive
} from 'lucide-react';
import { audioService } from '../services/audioService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [relinkerPath, setRelinkerPath] = useState<string>('C:/Users/PC/.gemini/antigravity/scratch/AnyPS5/build/relinker.exe');
  const [prxPath, setPrxPath] = useState<string>('C:/Users/PC/.gemini/antigravity/scratch/AnyPS5/libs');
  const [defaultTarget, setDefaultTarget] = useState<string>('windows');
  const [cpuFix, setCpuFix] = useState<string>('intel');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(audioService.enabled);
  const [hapticsEnabled, setHapticsEnabled] = useState<boolean>(true);

  if (!isOpen) return null;

  const handleSave = () => {
    audioService.playConfirm();
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
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-white/70 mb-1">Native Relinker Executable</label>
            <input
              type="text"
              value={relinkerPath}
              onChange={(e) => setRelinkerPath(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all"
            />
            <p className="text-[11px] text-white/40 mt-1">Compiled relinker binary built with CMake / LLVM 18</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-white/70 mb-1">System PRX Libraries Directory</label>
            <input
              type="text"
              value={prxPath}
              onChange={(e) => setPrxPath(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all"
            />
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
          </div>

          <div className="pt-4 flex items-center justify-end space-x-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
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
  );
};
