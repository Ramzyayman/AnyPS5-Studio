import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('anyps5', {
  selectFolder: () => ipcRenderer.invoke('anyps5:select-folder'),
  inspectFolder: (folderPath: string) => ipcRenderer.invoke('anyps5:inspect-folder', folderPath),
  getGames: () => ipcRenderer.invoke('anyps5:get-games'),
  saveGames: (games: unknown) => ipcRenderer.invoke('anyps5:save-games', games),
  runRelinker: (game: unknown, options: unknown, callbackId: string) => 
    ipcRenderer.invoke('anyps5:run-relinker', { game, options, callbackId }),
  cancelRelinker: () => ipcRenderer.invoke('anyps5:cancel-relinker'),
  launchGame: (game: unknown) => ipcRenderer.invoke('anyps5:launch-game', game),
  stopGame: (pid?: number) => ipcRenderer.invoke('anyps5:stop-game', pid),
  getSystemTelemetry: () => ipcRenderer.invoke('anyps5:get-telemetry'),
  getSettings: () => ipcRenderer.invoke('anyps5:get-settings'),
  saveSettings: (settings: unknown) => ipcRenderer.invoke('anyps5:save-settings', settings),
  getAvailableGpus: () => ipcRenderer.invoke('anyps5:get-available-gpus'),
  selectFile: (filters?: unknown) => ipcRenderer.invoke('anyps5:select-file', filters),
  checkForUpdates: () => ipcRenderer.invoke('anyps5:check-for-updates'),
  quitAndInstallUpdate: () => ipcRenderer.invoke('anyps5:quit-and-install-update'),
  getAppVersion: () => ipcRenderer.invoke('anyps5:get-app-version'),
  openExternal: (url: string) => ipcRenderer.invoke('anyps5:open-external', url),
  onUpdateStatus: (callback: (status: unknown) => void) => {
    const handler = (_: unknown, status: unknown) => callback(status);
    ipcRenderer.on('anyps5:update-status', handler);
    return () => {
      ipcRenderer.removeListener('anyps5:update-status', handler);
    };
  },
  getCommunityPRs: (repo?: string, forceRefresh?: boolean) => ipcRenderer.invoke('anyps5:get-community-prs', repo, forceRefresh),
  downloadPRBuild: (args: { prNumber: number; artifactUrl?: string }) => 
    ipcRenderer.invoke('anyps5:download-pr-build', args),
  setActivePRBuild: (prNumber: number) => ipcRenderer.invoke('anyps5:set-active-pr-build', prNumber),
  revertToDefaultBuild: () => ipcRenderer.invoke('anyps5:revert-to-default-build'),
  deletePRBuild: (prNumber: number) => ipcRenderer.invoke('anyps5:delete-pr-build', prNumber),
  mergeAndBuildPRs: (prNumbers: number[]) => ipcRenderer.invoke('anyps5:merge-and-build-prs', prNumbers),
  getMergedBuilds: () => ipcRenderer.invoke('anyps5:get-merged-builds'),
  setActiveMergedBuild: (buildId: string) => ipcRenderer.invoke('anyps5:set-active-merged-build', buildId),
  deleteMergedBuild: (buildId: string) => ipcRenderer.invoke('anyps5:delete-merged-build', buildId),
  onPRDownloadProgress: (callback: (progress: unknown) => void) => {
    const handler = (_: unknown, progress: unknown) => callback(progress);
    ipcRenderer.on('anyps5:pr-download-progress', handler);
    return () => {
      ipcRenderer.removeListener('anyps5:pr-download-progress', handler);
    };
  },
  onRelinkerEvent: (callback: (event: { type: string; data: unknown }) => void) => {
    const handler = (_: unknown, event: { type: string; data: unknown }) => callback(event);
    ipcRenderer.on('anyps5:relinker-event', handler);
    return () => {
      ipcRenderer.removeListener('anyps5:relinker-event', handler);
    };
  },
  onGameLog: (callback: (data: { level: string; message: string; timestamp?: string }) => void) => {
    const handler = (_: unknown, data: { level: string; message: string; timestamp?: string }) => callback(data);
    ipcRenderer.on('anyps5:game-log', handler);
    return () => {
      ipcRenderer.removeListener('anyps5:game-log', handler);
    };
  },
  onGameExit: (callback: (data: { code: number | null; signal?: string | null; exitCodeHex: string; isCrash: boolean }) => void) => {
    const handler = (_: unknown, data: { code: number | null; signal?: string | null; exitCodeHex: string; isCrash: boolean }) => callback(data);
    ipcRenderer.on('anyps5:game-exit', handler);
    return () => {
      ipcRenderer.removeListener('anyps5:game-exit', handler);
    };
  },
  minimizeWindow: () => ipcRenderer.invoke('anyps5:minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('anyps5:maximize-window'),
  closeWindow: () => ipcRenderer.invoke('anyps5:close-window'),
  isWindowMaximized: () => ipcRenderer.invoke('anyps5:is-maximized'),
  onWindowMaximizedChange: (callback: (isMaximized: boolean) => void) => {
    const handler = (_: unknown, isMax: boolean) => callback(isMax);
    ipcRenderer.on('anyps5:window-maximized-change', handler);
    return () => {
      ipcRenderer.removeListener('anyps5:window-maximized-change', handler);
    };
  },
});

