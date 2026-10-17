import React, { useState, useEffect, useMemo } from 'react';
import { 
  GitPullRequest, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  ExternalLink, 
  RefreshCw, 
  Search, 
  Layers, 
  Cpu, 
  Zap, 
  ShieldCheck, 
  Check, 
  ArrowLeft,
  ArrowRight,
  Sparkles,
  GitMerge,
  Clock,
  User,
  HardDrive
} from 'lucide-react';
import { CommunityPR, PRBuildDownloadProgress } from '../types';
import { apiBridge } from '../services/apiBridge';
import { audioService } from '../services/audioService';

interface CommunityPRBuildsProps {
  onNavigateToGames?: () => void;
  onNavigateToRelinker?: () => void;
}

export const CommunityPRBuilds: React.FC<CommunityPRBuildsProps> = ({
  onNavigateToGames,
  onNavigateToRelinker
}) => {
  const [prs, setPrs] = useState<CommunityPR[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filter, setFilter] = useState<'all' | 'installed' | 'open'>('all');
  const [downloading, setDownloading] = useState<Record<number, PRBuildDownloadProgress>>({});
  const [activePRNumber, setActivePRNumber] = useState<number | null>(null);
  const [customPRNumber, setCustomPRNumber] = useState<string>('');
  const [isLookingUp, setIsLookingUp] = useState<boolean>(false);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await apiBridge.getCommunityPRs();
      setPrs(data);
      const active = data.find((p) => p.isActive);
      setActivePRNumber(active ? active.number : null);
    } catch (err) {
      console.error('Failed to load community PRs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const unsub = apiBridge.onPRDownloadProgress((prog) => {
      setDownloading((prev) => ({
        ...prev,
        [prog.prNumber]: prog
      }));

      if (prog.status === 'ready') {
        audioService.playConfirm();
        loadData();
      }
    });

    return () => unsub();
  }, []);

  const filteredPRs = useMemo(() => {
    return prs.filter((pr) => {
      const matchesSearch = 
        pr.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pr.number.toString().includes(searchQuery) ||
        pr.author.login.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pr.labels.some((l) => l.name.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      if (filter === 'installed') return pr.isInstalled;
      if (filter === 'open') return pr.state === 'open';
      return true;
    });
  }, [prs, searchQuery, filter]);

  const handleDownload = async (pr: CommunityPR) => {
    audioService.playNavTick();
    setDownloading((prev) => ({
      ...prev,
      [pr.number]: { prNumber: pr.number, status: 'downloading', progress: 10 }
    }));

    try {
      const res = await apiBridge.downloadPRBuild(pr.number, pr.artifactUrl);
      if (res.success) {
        setDownloading((prev) => {
          const next = { ...prev };
          delete next[pr.number];
          return next;
        });
        await loadData();
      } else {
        setDownloading((prev) => ({
          ...prev,
          [pr.number]: { prNumber: pr.number, status: 'error', progress: 0, error: res.error }
        }));
      }
    } catch (err: any) {
      setDownloading((prev) => ({
        ...prev,
        [pr.number]: { prNumber: pr.number, status: 'error', progress: 0, error: err?.message || 'Download failed' }
      }));
    }
  };

  const handleActivate = async (prNumber: number) => {
    audioService.playConfirm();
    const success = await apiBridge.setActivePRBuild(prNumber);
    if (success) {
      setActivePRNumber(prNumber);
      await loadData();
    }
  };

  const handleRevert = async () => {
    audioService.playConfirm();
    const success = await apiBridge.revertToDefaultBuild();
    if (success) {
      setActivePRNumber(null);
      await loadData();
    }
  };

  const handleDelete = async (prNumber: number) => {
    audioService.playNavTick();
    const success = await apiBridge.deletePRBuild(prNumber);
    if (success) {
      if (activePRNumber === prNumber) {
        setActivePRNumber(null);
      }
      await loadData();
    }
  };

  const handleLookupCustomPR = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(customPRNumber.replace(/[^0-9]/g, ''), 10);
    if (!num) return;

    audioService.playNavTick();
    setIsLookingUp(true);
    setLookupMessage(null);

    try {
      const res = await fetch(`https://api.github.com/repos/Ramzyayman/AnyPS5-Studio/pulls/${num}`, {
        headers: { 'Accept': 'application/vnd.github.v3+json' }
      });

      if (res.ok) {
        const item = await res.json();
        const customPR: CommunityPR = {
          id: item.id,
          number: item.number,
          title: item.title,
          author: {
            login: item.user?.login || 'contributor',
            avatar_url: item.user?.avatar_url || '',
            html_url: item.user?.html_url || ''
          },
          html_url: item.html_url,
          state: item.state,
          created_at: item.created_at,
          updated_at: item.updated_at,
          body: item.body || '',
          headSha: item.head?.sha?.substring(0, 7) || 'HEAD',
          headBranch: item.head?.ref || 'main',
          labels: (item.labels || []).map((l: any) => ({ name: l.name, color: l.color })),
          artifactAvailable: true,
          artifactSizeMb: 15.0,
          isInstalled: false,
          isActive: false
        };

        setPrs((prev) => {
          if (prev.some((p) => p.number === customPR.number)) return prev;
          return [customPR, ...prev];
        });
        setLookupMessage(`Found Pull Request #${num}: ${customPR.title}`);
        setCustomPRNumber('');
      } else {
        setLookupMessage(`Pull Request #${num} not found on repository.`);
      }
    } catch {
      setLookupMessage(`Could not reach GitHub API for PR #${num}.`);
    } finally {
      setIsLookingUp(false);
    }
  };

  const activePR = useMemo(() => {
    return prs.find((p) => p.number === activePRNumber);
  }, [prs, activePRNumber]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#07090e] text-white select-none animate-fade-in pt-16">
      {/* Top Header Banner & Stats */}
      <div className="px-8 md:px-12 py-6 border-b border-white/10 bg-[#0d111a]/80 backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3 mb-1">
              <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[#00a2ff]">
                <GitPullRequest className="w-5 h-5" />
              </div>
              <h1 className="text-xl md:text-2xl font-semibold tracking-wide">Community PR Builds</h1>
              <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-400 text-[11px] font-mono font-medium">
                Cloud CI
              </span>
            </div>
            <p className="text-xs text-white/50 max-w-2xl leading-relaxed">
              Test experimental PlayStation 5 relinker branches and game compatibility patches built automatically by GitHub Actions CI without installing local compilers.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                audioService.playNavTick();
                loadData();
              }}
              disabled={loading}
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 hover:text-white text-xs font-medium transition-colors flex items-center space-x-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh PRs</span>
            </button>

            {onNavigateToRelinker && (
              <button
                onClick={() => {
                  audioService.playConfirm();
                  onNavigateToRelinker();
                }}
                className="px-4 py-2 rounded-xl bg-white text-black hover:bg-white/90 text-xs font-semibold transition-all flex items-center space-x-1.5"
              >
                <span>Open Relinker</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Active Binary Indicator Card */}
        <div className="mt-5 p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${activePR ? 'bg-emerald-400 animate-pulse' : 'bg-blue-400'}`} />
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-medium text-white/90">
                  {activePR ? `Active Runtime: PR #${activePR.number} · ${activePR.title}` : 'Active Runtime: Official Bundled Stable Binary'}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                  activePR ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                }`}>
                  {activePR ? `Branch: ${activePR.headBranch}` : 'Stable v1.0.0'}
                </span>
              </div>
              <p className="text-[11px] text-white/40 mt-0.5">
                {activePR 
                  ? 'All conversions in Relinker Studio and Game Launcher sessions are currently utilizing this experimental PR build.'
                  : 'Currently running the official pre-compiled release binary validated for general stability.'}
              </p>
            </div>
          </div>

          {activePR && (
            <button
              onClick={handleRevert}
              className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white/90 hover:text-white text-xs font-medium border border-white/10 transition-colors flex-shrink-0"
            >
              Revert to Stable Default
            </button>
          )}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="px-8 md:px-12 py-3 bg-[#0a0d14] border-b border-white/5 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search & Lookup Form */}
        <div className="flex items-center space-x-3 w-full md:w-auto">
          <div className="relative w-full md:w-80">
            <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, PR #, author, or tag..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-white text-xs focus:outline-none focus:border-white/30 transition-all placeholder:text-white/30"
            />
          </div>

          <form onSubmit={handleLookupCustomPR} className="flex items-center space-x-2">
            <input
              type="text"
              value={customPRNumber}
              onChange={(e) => setCustomPRNumber(e.target.value)}
              placeholder="PR # (e.g. 42)"
              className="w-24 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/10 text-white text-xs focus:outline-none focus:border-white/30 transition-all placeholder:text-white/30 font-mono"
            />
            <button
              type="submit"
              disabled={isLookingUp || !customPRNumber.trim()}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 disabled:opacity-40 text-white/80 hover:text-white text-xs font-medium border border-white/10 transition-colors"
            >
              {isLookingUp ? '...' : 'Lookup'}
            </button>
          </form>
        </div>

        {/* Status Filters */}
        <div className="flex items-center space-x-1.5 bg-white/[0.03] p-1 rounded-xl border border-white/10">
          {(['all', 'open', 'installed'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                audioService.playNavTick();
                setFilter(tab);
              }}
              className={`px-3 py-1 rounded-lg text-xs font-medium capitalize transition-colors ${
                filter === tab 
                  ? 'bg-white/15 text-white shadow-sm' 
                  : 'text-white/50 hover:text-white/80'
              }`}
            >
              {tab === 'installed' ? `Installed (${prs.filter((p) => p.isInstalled).length})` : tab}
            </button>
          ))}
        </div>
      </div>

      {lookupMessage && (
        <div className="px-8 md:px-12 py-2 bg-blue-500/10 border-b border-blue-500/20 text-xs text-blue-300 flex items-center justify-between">
          <span>{lookupMessage}</span>
          <button onClick={() => setLookupMessage(null)} className="text-white/40 hover:text-white text-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* PR Cards Grid */}
      <div className="flex-1 overflow-y-auto px-8 md:px-12 py-6 space-y-4">
        {loading && prs.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-6 h-6 text-white/40 animate-spin" />
            <p className="text-xs text-white/40">Querying GitHub Actions CI & pull requests...</p>
          </div>
        ) : filteredPRs.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center space-y-2 text-center">
            <GitPullRequest className="w-8 h-8 text-white/20 mb-2" />
            <p className="text-sm font-medium text-white/70">No matching pull requests found</p>
            <p className="text-xs text-white/40 max-w-sm">
              Try adjusting your search query, or enter a specific PR number above to fetch directly from GitHub.
            </p>
          </div>
        ) : (
          filteredPRs.map((pr) => {
            const isInstalled = pr.isInstalled;
            const isActive = pr.isActive;
            const progressObj = downloading[pr.number];
            const isDownloading = progressObj && progressObj.status === 'downloading';

            return (
              <div
                key={pr.number}
                className={`p-5 rounded-2xl border transition-all duration-200 ${
                  isActive 
                    ? 'bg-[#10192b]/90 border-emerald-500/40 shadow-lg shadow-emerald-500/5' 
                    : isInstalled 
                    ? 'bg-[#10141f]/70 border-white/15 hover:border-white/30' 
                    : 'bg-[#0d1017]/60 border-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  {/* Left Column: PR Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2.5 mb-2">
                      <span className="px-2.5 py-0.5 rounded-full bg-white/10 text-white/90 text-xs font-mono font-semibold">
                        #{pr.number}
                      </span>
                      <h3 className="text-sm md:text-base font-semibold text-white tracking-wide truncate">
                        {pr.title}
                      </h3>
                      {isActive && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[10px] font-medium uppercase tracking-wider flex items-center space-x-1">
                          <Check className="w-3 h-3" />
                          <span>Active</span>
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-white/60 mb-3 line-clamp-2 leading-relaxed">
                      {pr.body}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-white/40">
                      <div className="flex items-center space-x-1.5">
                        <img
                          src={pr.author.avatar_url || 'https://github.com/ghost.png'}
                          alt={pr.author.login}
                          className="w-4 h-4 rounded-full border border-white/20"
                        />
                        <span className="text-white/70 font-medium">{pr.author.login}</span>
                      </div>

                      <span>·</span>

                      <div className="flex items-center space-x-1 font-mono">
                        <GitMerge className="w-3.5 h-3.5 text-white/40" />
                        <span>{pr.headBranch}</span>
                        <span className="text-white/30">({pr.headSha})</span>
                      </div>

                      <span>·</span>

                      <div className="flex items-center space-x-1">
                        <HardDrive className="w-3.5 h-3.5 text-white/40" />
                        <span>CI Artifact: ~{pr.artifactSizeMb || 15} MB</span>
                      </div>

                      {/* Labels */}
                      <div className="flex items-center space-x-1.5 ml-1">
                        {pr.labels.map((lbl) => (
                          <span
                            key={lbl.name}
                            className="px-2 py-0.5 rounded text-[10px] font-medium"
                            style={{ backgroundColor: `#${lbl.color}25`, color: `#${lbl.color}` }}
                          >
                            {lbl.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Actions */}
                  <div className="flex items-center space-x-3 flex-shrink-0 self-end md:self-center">
                    <a
                      href={pr.html_url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-xs border border-white/10 transition-colors"
                      title="View Pull Request on GitHub"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>

                    {isInstalled ? (
                      <div className="flex items-center space-x-2">
                        {isActive ? (
                          <button
                            onClick={handleRevert}
                            className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white/80 hover:text-white text-xs font-medium border border-white/10 transition-colors"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            onClick={() => handleActivate(pr.number)}
                            className="px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-semibold transition-colors flex items-center space-x-1.5 shadow-lg shadow-emerald-500/20"
                          >
                            <Zap className="w-3.5 h-3.5" />
                            <span>Activate</span>
                          </button>
                        )}

                        <button
                          onClick={() => handleDelete(pr.number)}
                          className="p-2 rounded-xl bg-white/5 hover:bg-rose-500/20 hover:text-rose-400 text-white/40 text-xs border border-white/10 transition-colors"
                          title="Delete downloaded build"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleDownload(pr)}
                        disabled={isDownloading}
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold transition-all flex items-center space-x-2 shadow-lg shadow-blue-600/20"
                      >
                        {isDownloading ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Downloading ({progressObj?.progress || 0}%)...</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-3.5 h-3.5" />
                            <span>Download CI Build</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Download Progress Bar */}
                {isDownloading && (
                  <div className="mt-4 pt-3 border-t border-white/10">
                    <div className="flex items-center justify-between text-[11px] text-white/60 mb-1.5">
                      <span>Downloading pre-built binary from GitHub Actions CI...</span>
                      <span className="font-mono">{progressObj.progress}%</span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-[#00a2ff] h-full transition-all duration-300 rounded-full"
                        style={{ width: `${progressObj.progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
