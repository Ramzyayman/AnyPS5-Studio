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
});

