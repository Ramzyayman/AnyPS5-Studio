export type PortingStatus = 'ported' | 'ready_to_relink' | 'converting' | 'missing_prx';

export interface GameItem {
  id: string;
  title: string;
  titleId: string;
  version: string;
  category: 'game' | 'app';
  status: PortingStatus;
  path: string;
  executableName: string;
  targetPlatform: 'windows' | 'linux';
  description?: string;
  isSample?: boolean;
  iconUrl: string;
  backdropUrl: string;
  lastPlayed?: string;
  playTime?: string;
  sizeBytes: number;
  sdkVersion: string;
  minHostCpu: string;
  compatibility: {
    status: 'playable' | 'ingame' | 'intro' | 'untested';
    score: number; // percentage
    resolvedNids: number;
    totalNids: number;
    unresolvedModules: string[];
    missingNids: { nid: string; module: string; funcGuess?: string }[];
    amdInstructionsDetected: number;
  };
}

export interface RelinkerOptions {
  target: 'windows' | 'linux' | 'macos';
  subsystem: 'gui' | 'console';
  cpuTranslation: 'none' | 'intel' | 'rosetta';
  unusedFilter: 0 | 1 | 2;
  rpath: string;
  traceImports: boolean;
  windowsDiagnostics: boolean;
  fixedBaseAddress: string;
  autorun: boolean;
  sceModulePath: string;
}

export interface ConversionStage {
  id: number;
  title: string;
  description: string;
  status: 'pending' | 'active' | 'completed' | 'error';
  progress?: number;
}

export interface ConversionLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
}

export interface SystemTelemetry {
  hostCpu: string;
  hasZen2Extensions: boolean;
  missingExtensions: string[];
  gpuName: string;
  vulkanVersion: string;
  memoryUsageMb: number;
  totalMemoryMb: number;
  relinkerBinaryFound: boolean;
  relinkerPath: string;
  prxVersion: string;
  osName?: string;
  cpuArchitecture?: string;
  recommendedCpuTranslation?: 'none' | 'intel' | 'rosetta';
  recommendationReason?: string;
}

export interface AppSettings {
  relinkerPath: string;
  prxPath: string;
  defaultTarget: string;
  cpuFix: string;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  advanced: boolean;
  defaultRelinkerPath?: string;
  defaultPrxPath?: string;
}
