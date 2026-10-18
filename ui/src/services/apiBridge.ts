import { 
  GameItem, 
  RelinkerOptions, 
  SystemTelemetry, 
  ConversionStage, 
  ConversionLog, 
  AppSettings, 
  DetectedGpu,
  UpdateStatus,
  CommunityPR,
  PRBuildDownloadProgress,
  MultiPRBuildResult,
  MergedBuildInfo
} from '../types';
import { INITIAL_GAMES } from './sampleData';

declare global {
  interface Window {
    anyps5?: {
      selectFolder: () => Promise<string | null>;
      selectFile?: (filters?: Array<{ name: string; extensions: string[] }>) => Promise<string | null>;
      inspectFolder: (folderPath: string) => Promise<{
        title?: string;
        titleId?: string;
        version?: string;
        iconUrl?: string;
        backdropUrl?: string;
        hasEboot?: boolean;
        sizeBytes?: number;
      } | null>;
      getGames: () => Promise<GameItem[]>;
      saveGames: (games: GameItem[]) => Promise<void>;
      getSettings?: () => Promise<AppSettings>;
      saveSettings?: (settings: Partial<AppSettings>) => Promise<boolean>;
      getAvailableGpus?: () => Promise<DetectedGpu[]>;
      checkForUpdates?: () => Promise<{ status: string; currentVersion: string; error?: string; updateInfo?: any }>;
      quitAndInstallUpdate?: () => void;
      getAppVersion?: () => Promise<string>;
      openExternal?: (url: string) => Promise<boolean>;
      onUpdateStatus?: (callback: (status: UpdateStatus) => void) => () => void;
      getCommunityPRs?: (repo?: string, forceRefresh?: boolean) => Promise<CommunityPR[]>;
      downloadPRBuild?: (args: { prNumber: number; artifactUrl?: string }) => Promise<{ success: boolean; path?: string; error?: string }>;
      setActivePRBuild?: (prNumber: number) => Promise<boolean>;
      revertToDefaultBuild?: () => Promise<boolean>;
      deletePRBuild?: (prNumber: number) => Promise<boolean>;
      mergeAndBuildPRs?: (prNumbers: number[]) => Promise<MultiPRBuildResult>;
      getMergedBuilds?: () => Promise<MergedBuildInfo[]>;
      setActiveMergedBuild?: (buildId: string) => Promise<boolean>;
      deleteMergedBuild?: (buildId: string) => Promise<boolean>;
      onPRDownloadProgress?: (callback: (progress: PRBuildDownloadProgress) => void) => () => void;
      runRelinker: (
        game: GameItem,
        options: RelinkerOptions,
        callbackId: string
      ) => Promise<boolean>;
      cancelRelinker: () => Promise<boolean>;
      launchGame: (game: GameItem) => Promise<{ pid?: number; error?: string }>;
      stopGame: (pid?: number) => Promise<boolean>;
      getSystemTelemetry: () => Promise<SystemTelemetry>;
      onRelinkerEvent: (
        callback: (event: { type: 'stage' | 'log' | 'finish' | 'error'; data: any }) => void
      ) => () => void;
      onGameLog: (
        callback: (data: { level: string; message: string; timestamp?: string }) => void
      ) => () => void;
      onGameExit?: (
        callback: (data: { code: number | null; signal?: string | null; exitCodeHex: string; isCrash: boolean }) => void
      ) => () => void;
      minimizeWindow?: () => Promise<void>;
      maximizeWindow?: () => Promise<void>;
      closeWindow?: () => Promise<void>;
      isWindowMaximized?: () => Promise<boolean>;
      onWindowMaximizedChange?: (callback: (isMax: boolean) => void) => () => void;
    };
  }
}

class ApiBridge {
  private games: GameItem[] = [...INITIAL_GAMES];

  public async getGames(): Promise<GameItem[]> {
    if (window.anyps5) {
      const electronGames = await window.anyps5.getGames();
      if (electronGames && Array.isArray(electronGames)) {
        return electronGames;
      }
    }
    const stored = localStorage.getItem('anyps5_games');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        // Fallback
      }
    }
    return this.games;
  }

  public async saveGames(games: GameItem[]): Promise<void> {
    this.games = games;
    if (window.anyps5) {
      await window.anyps5.saveGames(games);
    } else {
      localStorage.setItem('anyps5_games', JSON.stringify(games));
    }
  }

  public async selectGameFolder(): Promise<string | null> {
    if (window.anyps5) {
      return await window.anyps5.selectFolder();
    }
    // Browser simulated file/folder dialog
    const simulatedPath = prompt("Enter the path to your decrypted PS5 game folder or ELF:\n(e.g., C:/Games/PS5/MyGame)", "C:/Games/PS5/NewTitle");
    return simulatedPath;
  }

  public async inspectGameFolder(folderPath: string): Promise<{
    title?: string;
    titleId?: string;
    version?: string;
    iconUrl?: string;
    backdropUrl?: string;
    hasEboot?: boolean;
    sizeBytes?: number;
  } | null> {
    if (window.anyps5?.inspectFolder) {
      return await window.anyps5.inspectFolder(folderPath);
    }
    return null;
  }

  public async selectFile(filters?: Array<{ name: string; extensions: string[] }>): Promise<string | null> {
    if (window.anyps5?.selectFile) {
      return await window.anyps5.selectFile(filters);
    }
    return null;
  }

  public async getSettings(): Promise<AppSettings> {
    if (window.anyps5?.getSettings) {
      return await window.anyps5.getSettings();
    }
    const local = localStorage.getItem('anyps5_settings');
    if (local) {
      try {
        return JSON.parse(local);
      } catch {}
    }
    return {
      relinkerPath: '',
      prxPath: '',
      defaultTarget: (typeof navigator !== 'undefined' && navigator.userAgent.includes('Linux')) ? 'linux' : 'windows',
      cpuFix: 'intel',
      soundEnabled: true,
      hapticsEnabled: true,
      advanced: false,
      preferredGpu: 'auto',
    };
  }

  public async getAvailableGpus(): Promise<DetectedGpu[]> {
    if (window.anyps5?.getAvailableGpus) {
      return await window.anyps5.getAvailableGpus();
    }
    return [
      {
        name: 'NVIDIA GeForce RTX 4060',
        vendor: 'nvidia',
        isDiscrete: true,
        isVirtual: false,
        adapterRamMb: 8192,
      },
    ];
  }

  public async saveSettings(settings: Partial<AppSettings>): Promise<void> {
    if (window.anyps5?.saveSettings) {
      await window.anyps5.saveSettings(settings);
    }
    try {
      const existing = localStorage.getItem('anyps5_settings');
      const current = existing ? JSON.parse(existing) : {};
      localStorage.setItem('anyps5_settings', JSON.stringify({ ...current, ...settings }));
    } catch {}
  }

  public async getTelemetry(): Promise<SystemTelemetry> {
    if (window.anyps5) {
      return await window.anyps5.getSystemTelemetry();
    }
    return {
      hostCpu: 'Intel(R) Core(TM) i5-14400F (16 Threads)',
      hasZen2Extensions: true,
      missingExtensions: [],
      gpuName: 'NVIDIA GeForce RTX 4060',
      vulkanVersion: '1.3.280 (Direct DCB/ACB Queue Support)',
      memoryUsageMb: 3410,
      totalMemoryMb: 32768,
      relinkerBinaryFound: true,
      relinkerPath: 'build/relinker.exe',
      prxVersion: 'v0.8.4-cleanroom',
      osName: 'Windows 11 (Build 26200, x64)',
      cpuArchitecture: 'x64',
      recommendedCpuTranslation: 'intel',
      recommendationReason: 'Detected Intel Core processor. Recommends --to-intel to translate AMD-specific Zen2 instructions into standard Intel AVX2 micro-ops.',
    };
  }

  public async cancelRelinker(): Promise<boolean> {
    if (window.anyps5?.cancelRelinker) {
      return await window.anyps5.cancelRelinker();
    }
    return true;
  }

  public async launchGame(game: GameItem): Promise<{ pid?: number; error?: string }> {
    if (window.anyps5) {
      return await window.anyps5.launchGame(game);
    }
    return { pid: 12345 };
  }

  public async stopGame(pid?: number): Promise<boolean> {
    if (window.anyps5) {
      return await window.anyps5.stopGame(pid);
    }
    return true;
  }

  public onGameLog(callback: (data: { level: string; message: string; timestamp?: string }) => void): () => void {
    if (window.anyps5) {
      return window.anyps5.onGameLog(callback);
    }
    return () => {};
  }

  public onGameExit(callback: (data: { code: number | null; signal?: string | null; exitCodeHex: string; isCrash: boolean }) => void): () => void {
    if (window.anyps5?.onGameExit) {
      return window.anyps5.onGameExit(callback);
    }
    return () => {};
  }

  public async minimizeWindow(): Promise<void> {
    if (window.anyps5?.minimizeWindow) {
      await window.anyps5.minimizeWindow();
    }
  }

  public async maximizeWindow(): Promise<void> {
    if (window.anyps5?.maximizeWindow) {
      await window.anyps5.maximizeWindow();
    }
  }

  public async closeWindow(): Promise<void> {
    if (window.anyps5?.closeWindow) {
      await window.anyps5.closeWindow();
    }
  }

  public async isWindowMaximized(): Promise<boolean> {
    if (window.anyps5?.isWindowMaximized) {
      return await window.anyps5.isWindowMaximized();
    }
    return false;
  }

  public onWindowMaximizedChange(callback: (isMax: boolean) => void): () => void {
    if (window.anyps5?.onWindowMaximizedChange) {
      return window.anyps5.onWindowMaximizedChange(callback);
    }
    return () => {};
  }

  public async checkForUpdates(): Promise<{ status: string; currentVersion: string; error?: string; updateInfo?: any }> {
    if (window.anyps5?.checkForUpdates) {
      return await window.anyps5.checkForUpdates();
    }
    return { status: 'not-available', currentVersion: '1.0.0' };
  }

  public quitAndInstallUpdate(): void {
    if (window.anyps5?.quitAndInstallUpdate) {
      window.anyps5.quitAndInstallUpdate();
    }
  }

  public async getAppVersion(): Promise<string> {
    if (window.anyps5?.getAppVersion) {
      return await window.anyps5.getAppVersion();
    }
    return '1.1.2-preview.2';
  }

  public async openExternal(url: string): Promise<boolean> {
    if (window.anyps5?.openExternal) {
      return await window.anyps5.openExternal(url);
    }
    window.open(url, '_blank');
    return true;
  }

  public onUpdateStatus(callback: (status: UpdateStatus) => void): () => void {
    if (window.anyps5?.onUpdateStatus) {
      return window.anyps5.onUpdateStatus(callback);
    }
    return () => {};
  }

  private getSimulatedInstalledPRs(): Set<number> {
    try {
      const stored = localStorage.getItem('anyps5_sim_installed_prs');
      return new Set(stored ? JSON.parse(stored) : [7057]);
    } catch {
      return new Set([7057]);
    }
  }

  private saveSimulatedInstalledPRs(set: Set<number>): void {
    try {
      localStorage.setItem('anyps5_sim_installed_prs', JSON.stringify(Array.from(set)));
    } catch {}
  }

  public async getCommunityPRs(repo?: string, forceRefresh?: boolean): Promise<CommunityPR[]> {
    if (window.anyps5?.getCommunityPRs) {
      return await window.anyps5.getCommunityPRs(repo, forceRefresh);
    }
    const targetRepo = repo || 'boykopovar/AnyPS5';
    try {
      const res = await fetch(`https://api.github.com/repos/${targetRepo}/pulls?state=open&per_page=30&sort=updated&direction=desc`);
      if (res.ok) {
        const liveData = await res.json();
        const installedSet = this.getSimulatedInstalledPRs();
        const activePRNum = parseInt(localStorage.getItem('anyps5_sim_active_pr') || '0', 10);
        return liveData.map((item: any) => ({
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
          isInstalled: installedSet.has(item.number),
          isActive: activePRNum === item.number,
        }));
      }
    } catch {}
    return [];
  }

  public async downloadPRBuild(prNumber: number, artifactUrl?: string): Promise<{ success: boolean; path?: string; error?: string }> {
    if (window.anyps5?.downloadPRBuild) {
      return await window.anyps5.downloadPRBuild({ prNumber, artifactUrl });
    }
    const set = this.getSimulatedInstalledPRs();
    set.add(prNumber);
    this.saveSimulatedInstalledPRs(set);
    return { success: true, path: `relinker-pr-${prNumber}.exe` };
  }

  public async setActivePRBuild(prNumber: number): Promise<boolean> {
    if (window.anyps5?.setActivePRBuild) {
      return await window.anyps5.setActivePRBuild(prNumber);
    }
    localStorage.setItem('anyps5_sim_active_pr', String(prNumber));
    return true;
  }

  public async revertToDefaultBuild(): Promise<boolean> {
    if (window.anyps5?.revertToDefaultBuild) {
      return await window.anyps5.revertToDefaultBuild();
    }
    localStorage.removeItem('anyps5_sim_active_pr');
    return true;
  }

  public async deletePRBuild(prNumber: number): Promise<boolean> {
    if (window.anyps5?.deletePRBuild) {
      return await window.anyps5.deletePRBuild(prNumber);
    }
    const set = this.getSimulatedInstalledPRs();
    set.delete(prNumber);
    this.saveSimulatedInstalledPRs(set);
    const active = parseInt(localStorage.getItem('anyps5_sim_active_pr') || '0', 10);
    if (active === prNumber) {
      localStorage.removeItem('anyps5_sim_active_pr');
    }
    return true;
  }

  public async mergeAndBuildPRs(prNumbers: number[]): Promise<MultiPRBuildResult> {
    if (window.anyps5?.mergeAndBuildPRs) {
      return await window.anyps5.mergeAndBuildPRs(prNumbers);
    }
    const buildId = `merged-${prNumbers.sort().join('-')}`;
    return {
      success: true,
      buildId,
      relinkerPath: `experimental-builds/${buildId}/relinker.exe`,
      mergedPRs: prNumbers
    };
  }

  public async getMergedBuilds(): Promise<MergedBuildInfo[]> {
    if (window.anyps5?.getMergedBuilds) {
      return await window.anyps5.getMergedBuilds();
    }
    return [
      {
        id: 'merged-7049-7053',
        name: 'Combined Build: PR #7049 + #7053',
        prNumbers: [7049, 7053],
        installedAt: '2026-10-17T08:30:00Z',
        relinkerPath: 'userData/experimental-builds/merged-7049-7053/relinker.exe',
        isActive: false
      }
    ];
  }

  public async setActiveMergedBuild(buildId: string): Promise<boolean> {
    if (window.anyps5?.setActiveMergedBuild) {
      return await window.anyps5.setActiveMergedBuild(buildId);
    }
    return true;
  }

  public async deleteMergedBuild(buildId: string): Promise<boolean> {
    if (window.anyps5?.deleteMergedBuild) {
      return await window.anyps5.deleteMergedBuild(buildId);
    }
    return true;
  }

  public onPRDownloadProgress(callback: (progress: PRBuildDownloadProgress) => void): () => void {
    if (window.anyps5?.onPRDownloadProgress) {
      return window.anyps5.onPRDownloadProgress(callback);
    }
    return () => {};
  }


  /**
   * Run the AnyPS5 Relinker pipeline with live step updates and realistic log streaming
   */
  public async executeRelinker(
    game: GameItem,
    options: RelinkerOptions,
    onStageUpdate: (stage: ConversionStage) => void,
    onLog: (log: ConversionLog) => void,
    onFinish?: (updatedGame?: GameItem) => void
  ): Promise<boolean> {
    if (window.anyps5) {
      // In Electron native mode: subscribe to IPC events and invoke
      return new Promise((resolve) => {
        const cleanup = window.anyps5!.onRelinkerEvent((event: any) => {
          if (event.type === 'stage') onStageUpdate(event.data);
          if (event.type === 'log') onLog(event.data);
          if (event.type === 'finish') {
            cleanup();
            if (onFinish && event.data?.updatedGame) {
              onFinish(event.data.updatedGame);
            }
            resolve(true);
          }
          if (event.type === 'error') {
            cleanup();
            resolve(false);
          }
        });
        window.anyps5!.runRelinker(game, options, 'conv-' + Date.now());
      });
    }

    // Web simulation / Interactive demonstration mode
    const stages = [
      { id: 1, title: 'Validating Decrypted ELF', description: 'Inspecting ELF headers, PT_LOAD segments & SELF boundaries' },
      { id: 2, title: 'Scanning System Imports (NIDs)', description: 'Resolving PS5 library imports against clean-room PRX exports' },
      { id: 3, title: 'Scanning Bundled Modules', description: 'Parsing modules in sce_module/ for runtime PRX dependencies' },
      { id: 4, title: 'AMD to Intel Codegen Translation', description: options.cpuTranslation === 'intel' ? 'Rewriting AMD-specific Zen2 instructions' : 'Instruction lowering skipped (AMD Native)' },
      { id: 5, title: 'Unused Import Filter & PLT Optimization', description: `Analyzing call graph with unused-filter=${options.unusedFilter}` },
      { id: 6, title: options.target === 'linux' ? 'Relinking Native ELF Executable' : 'Relinking PE Executable', description: options.target === 'linux' ? 'Generating Linux ELF headers, dynamic tags, and entry RVA' : 'Generating Windows PE headers, import tables, and entry RVA' },
      { id: 7, title: 'Copying Clean-room PRX Libraries', description: 'Deploying libkernel.prx, libSceAgcDriver.prx, libScePad.prx' },
      { id: 8, title: 'Finalizing Native Package', description: options.target === 'linux' ? 'Writing app.elf and runtime configuration' : 'Writing app.exe and registry metadata' },
    ];

    onLog({
      timestamp: new Date().toLocaleTimeString(),
      level: 'info',
      message: `[AnyPS5] Initializing relinker for ${game.title} (${game.titleId})`,
    });
    onLog({
      timestamp: new Date().toLocaleTimeString(),
      level: 'info',
      message: `[AnyPS5] Options: target=${options.target}, subsystem=${options.subsystem}, cpu=${options.cpuTranslation}, unused-filter=${options.unusedFilter}`,
    });

    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i];
      onStageUpdate({
        ...stage,
        status: 'active',
        progress: 0,
      });

      // Realistic log events for each stage
      await new Promise((r) => setTimeout(r, 600));
      onLog({
        timestamp: new Date().toLocaleTimeString(),
        level: 'info',
        message: `Stage ${i + 1}/${stages.length}: ${stage.title} - ${stage.description}`,
      });

      if (i === 1) {
        onLog({
          timestamp: new Date().toLocaleTimeString(),
          level: 'success',
          message: `[NID-Patcher] Resolved ${game.compatibility.resolvedNids}/${game.compatibility.totalNids} imported functions (${game.compatibility.score}%)`,
        });
      }

      if (i === 3 && options.cpuTranslation === 'intel') {
        onLog({
          timestamp: new Date().toLocaleTimeString(),
          level: 'info',
          message: `[Codegen] Replaced ${game.compatibility.amdInstructionsDetected} AMD Zen2 instructions with Intel AVX2 equivalents`,
        });
      }

      await new Promise((r) => setTimeout(r, 450));
      onStageUpdate({
        ...stage,
        status: 'completed',
        progress: 100,
      });
    }

    onLog({
      timestamp: new Date().toLocaleTimeString(),
      level: 'success',
      message: `[AnyPS5] Conversion completed successfully! Output: ${game.path}/app.exe ready to run natively.`,
    });

    return true;
  }
}

export const apiBridge = new ApiBridge();
