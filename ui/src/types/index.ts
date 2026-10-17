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

export interface UpdateStatus {
  status: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
  version?: string;
  progress?: number;
  bytesPerSecond?: number;
  transferred?: number;
  total?: number;
  error?: string;
}

export interface CommunityPR {
  id: number;
  number: number;
  title: string;
  author: {
    login: string;
    avatar_url: string;
    html_url: string;
  };
  html_url: string;
  state: 'open' | 'closed' | 'merged';
  created_at: string;
  updated_at: string;
  body: string;
  headSha: string;
  headBranch: string;
  labels: { name: string; color: string }[];
  artifactAvailable: boolean;
  artifactSizeMb?: number;
  artifactUrl?: string;
  isInstalled?: boolean;
  isActive?: boolean;
}

export interface PRBuildDownloadProgress {
  prNumber: number;
  status: 'idle' | 'downloading' | 'extracting' | 'ready' | 'error';
  progress: number;
  error?: string;
}

export interface MultiPRBuildResult {
  success: boolean;
  buildId?: string;
  relinkerPath?: string;
  mergedPRs?: number[];
  conflict?: string;
  error?: string;
}

export interface MergedBuildInfo {
  id: string;
  name: string;
  prNumbers: number[];
  installedAt: string;
  relinkerPath: string;
  isActive: boolean;
}
