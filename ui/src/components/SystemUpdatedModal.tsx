import React from 'react';
import { Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';
import { audioService } from '../services/audioService';

interface SystemUpdatedModalProps {
  isOpen: boolean;
  currentVersion: string;
  onContinue: () => void;
}

export const SystemUpdatedModal: React.FC<SystemUpdatedModalProps> = ({
  isOpen,
  currentVersion,
  onContinue,
}) => {
  if (!isOpen) return null;

  const handleContinue = () => {
    audioService.playConfirm();
    onContinue();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div className="w-full max-w-lg bg-[#0c111c] border border-white/15 rounded-2xl shadow-2xl p-6 text-slate-100 space-y-6 animate-scale-up">
        {/* Header */}
        <div className="flex items-start space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-[#0070d1]/20 border border-[#0070d1]/40 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Sparkles className="w-5 h-5 text-[#0070d1]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white tracking-wide">System Software Updated</h3>
            <p className="text-xs text-white/50 font-mono mt-0.5">Version {currentVersion}</p>
          </div>
        </div>

        {/* Feature Summary */}
        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-2.5">
          <h4 className="text-[11px] font-mono uppercase tracking-wider text-white/40 mb-2">
            Release Highlights
          </h4>
          <div className="flex items-start space-x-2.5 text-xs text-white/80">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <span>
              <strong>Runtime Engine Manager:</strong> Switch execution cores between bundled, upstream commits, and local custom builds.
            </span>
          </div>
          <div className="flex items-start space-x-2.5 text-xs text-white/80">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <span>
              <strong>Local PR Builder:</strong> Native CMake & Ninja compilation of community pull requests and multi-PR hybrid merges.
            </span>
          </div>
          <div className="flex items-start space-x-2.5 text-xs text-white/80">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <span>
              <strong>Git Worktree Resilience:</strong> Automated self-healing, stale lock removal, and conflict recovery.
            </span>
          </div>
          <div className="flex items-start space-x-2.5 text-xs text-white/80">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <span>
              <strong>Keep-Alive Tab State:</strong> Compilation and relink operations persist continuously across tab switches.
            </span>
          </div>
          <div className="flex items-start space-x-2.5 text-xs text-white/80">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <span>
              <strong>Dual-Platform Parity:</strong> Full support for Windows (app.exe) and Linux (app.elf) runtime targets.
            </span>
          </div>
        </div>

        {/* Single Continue Action */}
        <div className="flex items-center justify-end pt-2">
          <button
            onClick={handleContinue}
            className="px-6 py-2.5 rounded-xl bg-[#0070d1] hover:bg-[#0060b8] text-white text-xs font-semibold tracking-wide transition-all shadow-lg shadow-[#0070d1]/20 flex items-center space-x-2"
          >
            <span>Continue</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
