import React, { useState } from 'react';
import { 
  Plus, 
  FolderSearch, 
  X, 
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { GameItem } from '../types';
import { apiBridge } from '../services/apiBridge';
import { audioService } from '../services/audioService';

interface AddGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddGame: (game: GameItem) => void;
}

export const AddGameModal: React.FC<AddGameModalProps> = ({ isOpen, onClose, onAddGame }) => {
  const [title, setTitle] = useState<string>('');
  const [titleId, setTitleId] = useState<string>('PPSA');
  const [folderPath, setFolderPath] = useState<string>('C:/Games/PS5/NewTitle');
  const [iconUrl, setIconUrl] = useState<string>('https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=400&q=80');
  const [backdropUrl, setBackdropUrl] = useState<string>('https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1920&q=80');
  const [sizeBytes, setSizeBytes] = useState<number>(0);
  const [detectedBadge, setDetectedBadge] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleBrowse = async () => {
    audioService.playNavTick();
    const selected = await apiBridge.selectGameFolder();
    if (selected) {
      setFolderPath(selected);

      // Auto-inspect folder for PS5 param.json and icon0.png
      const inspected = await apiBridge.inspectGameFolder(selected);
      if (inspected) {
        if (inspected.title) setTitle(inspected.title);
        if (inspected.titleId) setTitleId(inspected.titleId);
        if (inspected.iconUrl) setIconUrl(inspected.iconUrl);
        if (inspected.backdropUrl) setBackdropUrl(inspected.backdropUrl);
        if (inspected.sizeBytes) setSizeBytes(inspected.sizeBytes);
        setDetectedBadge(`PlayStation 5 Title Detected · ${inspected.title || 'App'} (${inspected.titleId || 'PPSA'})`);
      } else {
        const folderName = selected.split(/[\/\\]/).filter(Boolean).pop() || '';
        if (!title) {
          setTitle(folderName.replace(/[_-]/g, ' '));
        }
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !folderPath.trim()) return;

    audioService.playConfirm();

    const isLinuxHost = typeof navigator !== 'undefined' && navigator.userAgent.includes('Linux');
    const newGame: GameItem = {
      id: 'game-' + Date.now(),
      title: title.trim(),
      titleId: titleId.trim() || 'PPSA99999',
      version: '01.00',
      category: 'game',
      status: 'ready_to_relink',
      path: folderPath.trim(),
      executableName: isLinuxHost ? 'app.elf' : 'eboot.bin',
      targetPlatform: isLinuxHost ? 'linux' : 'windows',
      iconUrl: iconUrl || 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=400&q=80',
      backdropUrl: backdropUrl || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1920&q=80',
      sizeBytes: sizeBytes || 0,
      sdkVersion: '05.000.001',
      minHostCpu: 'AMD Zen2 / Intel AVX2',
      compatibility: {
        status: 'playable',
        score: 95,
        resolvedNids: 480,
        totalNids: 505,
        unresolvedModules: [],
        missingNids: [],
        amdInstructionsDetected: 24,
      },
    };

    onAddGame(newGame);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-[#0b0e14]/95 rounded-2xl border border-white/10 overflow-hidden shadow-2xl p-6">
        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
          <div className="flex items-center space-x-2.5">
            <Plus className="w-4 h-4 text-white/70" />
            <h3 className="font-medium text-base text-white tracking-wide">Import PlayStation 5 Title</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-white/70 mb-1">Game Directory or ELF Path</label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={folderPath}
                onChange={(e) => setFolderPath(e.target.value)}
                placeholder="C:/Games/PS5/MyGame"
                className="flex-1 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all"
                required
              />
              <button
                type="button"
                onClick={handleBrowse}
                className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium flex items-center space-x-1.5 transition-colors"
              >
                <FolderSearch className="w-3.5 h-3.5 text-white/70" />
                <span>Browse</span>
              </button>
            </div>
            <p className="text-[11px] text-white/40 mt-1">
              Select downloaded package or extracted dump folder. AnyPS5 will automatically relocate and configure it into <span className="text-white/60 font-mono">relinked-games/</span>.
            </p>
          </div>

          {detectedBadge && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center space-x-2 animate-fade-in">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span className="font-medium">{detectedBadge}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-white/70 mb-1">Game Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Dreaming Sarah"
              className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-white text-xs focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-white/70 mb-1">Title ID</label>
              <input
                type="text"
                value={titleId}
                onChange={(e) => setTitleId(e.target.value)}
                placeholder="PPSA02929"
                className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-white text-xs font-mono uppercase focus:outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/70 mb-1">Target Subsystem</label>
              <div className="w-full px-3 py-2 rounded-xl bg-white/[0.02] border border-white/5 text-white/60 text-xs font-mono">
                Windows x86_64
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-white text-black font-semibold text-xs hover:bg-neutral-200 transition-colors shadow-lg active:scale-95 flex items-center space-x-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Import to Library</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
