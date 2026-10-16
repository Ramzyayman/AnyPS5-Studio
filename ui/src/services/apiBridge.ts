import { GameItem, RelinkerOptions, SystemTelemetry, ConversionStage, ConversionLog } from '../types';
import { INITIAL_GAMES } from './sampleData';

declare global {
  interface Window {
    anyps5?: {
      selectFolder: () => Promise<string | null>;
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
      runRelinker: (
        game: GameItem,
        options: RelinkerOptions,
        callbackId: string
      ) => Promise<boolean>;
      launchGame: (game: GameItem) => Promise<{ pid?: number; error?: string }>;
      stopGame: (pid?: number) => Promise<boolean>;
      getSystemTelemetry: () => Promise<SystemTelemetry>;
      onRelinkerEvent: (
        callback: (event: { type: 'stage' | 'log' | 'finish' | 'error'; data: any }) => void
      ) => () => void;
      onGameLog: (
        callback: (data: { level: string; message: string; timestamp?: string }) => void
      ) => () => void;
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

  public async getTelemetry(): Promise<SystemTelemetry> {
    if (window.anyps5) {
      return await window.anyps5.getSystemTelemetry();
    }
    return {
      hostCpu: 'AMD Ryzen 7 5800X (8 Cores, 16 Threads)',
      hasZen2Extensions: true,
      missingExtensions: [],
      gpuName: 'NVIDIA GeForce RTX 3080 (10GB VRAM) / Vulkan 1.3.280',
      vulkanVersion: '1.3.280 (Direct DCB/ACB Queue Support)',
      memoryUsageMb: 3410,
      totalMemoryMb: 32768,
      relinkerBinaryFound: true,
      relinkerPath: 'C:/AnyPS5/build/relinker.exe',
      prxVersion: 'v0.8.4-cleanroom',
    };
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
      { id: 6, title: 'Relinking PE Executable', description: 'Generating Windows PE headers, import tables, and entry RVA' },
      { id: 7, title: 'Copying Clean-room PRX Libraries', description: 'Deploying libkernel.prx, libSceAgcDriver.prx, libScePad.prx' },
      { id: 8, title: 'Finalizing Native Package', description: 'Writing app.exe and registry metadata' },
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
