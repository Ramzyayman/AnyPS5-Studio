import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { spawn, spawnSync, ChildProcess } from 'child_process';
import os from 'os';
import fs from 'fs';
import { autoUpdater } from 'electron-updater';

let mainWindow: BrowserWindow | null = null;

function getWindowIconPath(): string {
  const candidates = [
    path.join(__dirname, '../dist/icon.ico'),
    path.join(__dirname, '../public/icon.ico'),
    path.join(__dirname, '../dist/icon.png'),
    path.join(__dirname, '../public/icon.png'),
    path.join(process.resourcesPath, 'icon.ico'),
    path.join(process.resourcesPath, 'icon.png'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return '';
}

function createWindow() {
  const windowIcon = getWindowIconPath();
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 820,
    minWidth: 1024,
    minHeight: 680,
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: '#04060a',
    title: 'AnyPS5 · PlayStation 5 Studio',
    icon: windowIcon || undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    show: true,
  });

  mainWindow.removeMenu();

  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('anyps5:window-maximized-change', true);
  });

  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('anyps5:window-maximized-change', false);
  });

  const distPath = path.join(__dirname, '../dist/index.html');
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL).catch(() => {
      if (fs.existsSync(distPath)) mainWindow?.loadFile(distPath);
    });
  } else if (fs.existsSync(distPath)) {
    mainWindow.loadFile(distPath);
  } else {
    mainWindow.loadURL('http://localhost:5173').catch(() => {
      if (fs.existsSync(distPath)) mainWindow?.loadFile(distPath);
    });
  }

  mainWindow.show();
  mainWindow.focus();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();

    // In-App Background auto-updater for GitHub Releases
    try {
      autoUpdater.autoDownload = true;
      autoUpdater.autoInstallOnAppQuit = true;

      const sendUpdateStatus = (status: {
        status: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
        version?: string;
        progress?: number;
        bytesPerSecond?: number;
        transferred?: number;
        total?: number;
        error?: string;
      }) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('anyps5:update-status', status);
        }
      };

      autoUpdater.on('checking-for-update', () => {
        sendUpdateStatus({ status: 'checking' });
      });

      autoUpdater.on('update-available', (info) => {
        sendUpdateStatus({ status: 'available', version: info.version });
      });

      autoUpdater.on('update-not-available', (info) => {
        sendUpdateStatus({ status: 'not-available', version: info?.version || app.getVersion() });
      });

      autoUpdater.on('download-progress', (progressObj) => {
        sendUpdateStatus({
          status: 'downloading',
          progress: Math.round(progressObj.percent),
          bytesPerSecond: progressObj.bytesPerSecond,
          transferred: progressObj.transferred,
          total: progressObj.total,
        });
      });

      autoUpdater.on('update-downloaded', (info) => {
        sendUpdateStatus({ status: 'downloaded', version: info.version });
      });

      autoUpdater.on('error', (err) => {
        sendUpdateStatus({ status: 'error', error: err?.message || String(err) });
      });

      if (app.isPackaged) {
        autoUpdater.checkForUpdates().catch((err) => {
          console.warn('Auto-updater initial background check:', err?.message || err);
        });
      }
    } catch (updaterErr) {
      console.warn('AutoUpdater initialization error:', updaterErr);
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Recursive helper to calculate accurate size of game directory/file on disk
function getFolderSize(targetPath: string): number {
  try {
    if (!targetPath || !fs.existsSync(targetPath)) return 0;
    const stat = fs.statSync(targetPath);
    if (!stat.isDirectory()) {
      const base = path.basename(targetPath).toLowerCase();
      if (base === 'eboot.bin' || base === 'eboot.elf' || base === 'app.exe') {
        return getFolderSize(path.dirname(targetPath));
      }
      return stat.size;
    }
    let total = 0;
    const entries = fs.readdirSync(targetPath, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(targetPath, entry.name);
      try {
        if (entry.isDirectory() && !entry.isSymbolicLink()) {
          total += getFolderSize(full);
        } else if (entry.isFile()) {
          total += fs.statSync(full).size;
        }
      } catch {}
    }
    return total;
  } catch {
    return 0;
  }
}

// IPC Handler: Persistent Games Storage
const gamesStorePath = path.join(app.getPath('userData'), 'anyps5_games.json');

ipcMain.handle('anyps5:get-games', async () => {
  try {
    if (fs.existsSync(gamesStorePath)) {
      const data = fs.readFileSync(gamesStorePath, 'utf8');
      const games = JSON.parse(data);
      if (Array.isArray(games)) {
        let changed = false;
        for (const g of games) {
          if (g && g.path && fs.existsSync(g.path)) {
            const actualSize = getFolderSize(g.path);
            if (actualSize > 0 && g.sizeBytes !== actualSize) {
              g.sizeBytes = actualSize;
              changed = true;
            }
          }
        }
        if (changed) {
          try {
            fs.writeFileSync(gamesStorePath, JSON.stringify(games, null, 2), 'utf8');
          } catch (writeErr) {
            console.error('Failed to update games.json with accurate sizes:', writeErr);
          }
        }
        return games;
      }
      return games;
    }
  } catch (err) {
    console.error('Failed to read games.json:', err);
  }
  return null;
});

ipcMain.handle('anyps5:save-games', async (_, games) => {
  try {
    if (Array.isArray(games)) {
      for (const g of games) {
        if (g && g.path && (!g.sizeBytes || g.sizeBytes === 15 * 1024 * 1024 * 1024) && fs.existsSync(g.path)) {
          const actual = getFolderSize(g.path);
          if (actual > 0) g.sizeBytes = actual;
        }
      }
    }
    fs.writeFileSync(gamesStorePath, JSON.stringify(games, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write games.json:', err);
  }
});

// IPC Handler: Native Folder Picker
ipcMain.handle('anyps5:select-folder', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Select Decrypted PS5 Game Directory',
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

// IPC Handler: Inspect Game Directory Metadata
ipcMain.handle('anyps5:inspect-folder', async (_, folderPath: string) => {
  return inspectGameFolder(folderPath);
});

function inspectGameFolder(folderPath: string) {
  try {
    if (!folderPath || !fs.existsSync(folderPath)) return null;
    let titleName = '';
    let titleId = '';
    let version = '01.00';
    let iconDataUrl = '';
    let backdropDataUrl = '';
    let hasEboot = false;

    function walk(dir: string, depth: number) {
      if (depth > 3) return;
      try {
        const entries = fs.readdirSync(dir);
        for (const entry of entries) {
          const full = path.join(dir, entry);
          const stat = fs.statSync(full);
          if (stat.isDirectory()) {
            walk(full, depth + 1);
          } else {
            const lower = entry.toLowerCase();
            if (lower === 'param.json' && !titleId) {
              try {
                const parsed = JSON.parse(fs.readFileSync(full, 'utf8'));
                titleId = parsed.titleId || '';
                const loc = parsed.localizedParameters || {};
                const defLang = loc.defaultLanguage || 'en-US';
                let detectedName = '';
                if (loc[defLang] && typeof loc[defLang] === 'object' && loc[defLang].titleName) {
                  detectedName = loc[defLang].titleName;
                } else {
                  for (const k of Object.keys(loc)) {
                    if (typeof loc[k] === 'object' && loc[k]?.titleName) {
                      detectedName = loc[k].titleName;
                      break;
                    }
                  }
                }
                titleName = detectedName || parsed.titleName || '';
                version = parsed.contentVersion || parsed.appVersion || '01.00';
              } catch {}
            }
            if (lower === 'icon0.png' && !iconDataUrl) {
              try {
                const buf = fs.readFileSync(full);
                iconDataUrl = `data:image/png;base64,${buf.toString('base64')}`;
              } catch {}
            }
            if ((lower === 'pic0.png' || lower === 'pic1.png') && !backdropDataUrl) {
              try {
                const buf = fs.readFileSync(full);
                backdropDataUrl = `data:image/png;base64,${buf.toString('base64')}`;
              } catch {}
            }
            if (lower === 'eboot.bin' || lower === 'eboot.elf') {
              hasEboot = true;
            }
          }
        }
      } catch {}
    }

    walk(folderPath, 0);

    const sizeBytes = getFolderSize(folderPath);

    return {
      title: titleName,
      titleId,
      version,
      iconUrl: iconDataUrl,
      backdropUrl: backdropDataUrl,
      hasEboot,
      sizeBytes,
    };
  } catch (err) {
    console.error('Inspect folder error:', err);
    return null;
  }
}

// Settings & Dynamic Installation Paths Management
const settingsStorePath = path.join(app.getPath('userData'), 'anyps5_settings.json');

interface AppSettings {
  relinkerPath?: string;
  prxPath?: string;
  defaultTarget?: string;
  cpuFix?: string;
  soundEnabled?: boolean;
  hapticsEnabled?: boolean;
  advanced?: boolean;
}

function loadSettings(): AppSettings {
  try {
    if (fs.existsSync(settingsStorePath)) {
      return JSON.parse(fs.readFileSync(settingsStorePath, 'utf8'));
    }
  } catch (err) {
    console.error('Failed to read settings.json:', err);
  }
  return {};
}

function saveSettings(settings: AppSettings) {
  try {
    fs.writeFileSync(settingsStorePath, JSON.stringify(settings, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write settings.json:', err);
  }
}

function getDefaultRelinkerPath(): string {
  const candidates: string[] = [];
  if (app.isPackaged) {
    if (process.resourcesPath) {
      candidates.push(
        path.join(process.resourcesPath, 'build', 'relinker.exe'),
        path.join(process.resourcesPath, 'relinker.exe')
      );
    }
    try {
      const exeDir = path.dirname(app.getPath('exe'));
      candidates.push(
        path.join(exeDir, 'resources', 'build', 'relinker.exe'),
        path.join(exeDir, 'resources', 'relinker.exe'),
        path.join(exeDir, 'build', 'relinker.exe'),
        path.join(exeDir, 'relinker.exe')
      );
    } catch {}
  } else {
    candidates.push(
      path.resolve(__dirname, '../../build/relinker.exe'),
      path.resolve(__dirname, '../../build-relinker/core/relinker/Release/relinker.exe'),
      path.resolve(process.cwd(), 'build/relinker.exe'),
      path.resolve(process.cwd(), '../build/relinker.exe')
    );
  }
  for (const c of candidates) {
    if (fs.existsSync(c)) return path.normalize(c);
  }
  return candidates[0] ? path.normalize(candidates[0]) : '';
}

function getDefaultLibsPath(): string {
  const candidates: string[] = [];
  if (app.isPackaged) {
    if (process.resourcesPath) {
      candidates.push(path.join(process.resourcesPath, 'libs'));
    }
    try {
      const exeDir = path.dirname(app.getPath('exe'));
      candidates.push(
        path.join(exeDir, 'resources', 'libs'),
        path.join(exeDir, 'libs')
      );
    } catch {}
  } else {
    candidates.push(
      path.resolve(__dirname, '../../libs'),
      path.resolve(process.cwd(), 'libs'),
      path.resolve(process.cwd(), '../libs')
    );
  }
  for (const c of candidates) {
    if (fs.existsSync(c)) return path.normalize(c);
  }
  return candidates[0] ? path.normalize(candidates[0]) : '';
}

function getResolvedRelinkerPath(): string {
  const userSettings = loadSettings();
  if (userSettings.relinkerPath && fs.existsSync(userSettings.relinkerPath)) {
    return path.normalize(userSettings.relinkerPath);
  }
  return getDefaultRelinkerPath();
}

function getResolvedLibsPath(): string {
  const userSettings = loadSettings();
  if (userSettings.prxPath && fs.existsSync(userSettings.prxPath)) {
    return path.normalize(userSettings.prxPath);
  }
  return getDefaultLibsPath();
}

function getResolvedUnwrapScript(): string {
  const candidates: string[] = [];
  if (app.isPackaged) {
    if (process.resourcesPath) {
      candidates.push(path.join(process.resourcesPath, 'tools', 'unwrap_self.py'));
    }
    try {
      const exeDir = path.dirname(app.getPath('exe'));
      candidates.push(
        path.join(exeDir, 'resources', 'tools', 'unwrap_self.py'),
        path.join(exeDir, 'tools', 'unwrap_self.py')
      );
    } catch {}
  } else {
    candidates.push(
      path.resolve(__dirname, '../../tools/unwrap_self.py'),
      path.resolve(process.cwd(), 'tools/unwrap_self.py'),
      path.resolve(process.cwd(), '../tools/unwrap_self.py')
    );
  }
  for (const c of candidates) {
    if (fs.existsSync(c)) return path.normalize(c);
  }
  return candidates[0] ? path.normalize(candidates[0]) : '';
}

function fixGameHierarchyInPlace(gameDir: string, sendLog: (msg: string, level?: string) => void) {
  const resolved = path.resolve(gameDir);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Game directory does not exist: "${resolved}"`);
  }

  // 1. Flatten single wrapper directory if present in-place (instant rename)
  try {
    const rootEntries = fs.readdirSync(resolved);
    if (rootEntries.length === 1) {
      const singlePath = path.join(resolved, rootEntries[0]);
      if (fs.statSync(singlePath).isDirectory() && !['app0', 'libs'].includes(rootEntries[0])) {
        if (rootEntries[0].toLowerCase().endsWith('-app0') || rootEntries[0].toLowerCase().includes('app0')) {
          const app0Target = path.join(resolved, 'app0');
          if (!fs.existsSync(app0Target)) {
            sendLog(`[AnyPS5] Normalizing wrapper directory "${rootEntries[0]}" -> "app0"...`, 'info');
            fs.renameSync(singlePath, app0Target);
          }
        } else {
          sendLog(`[AnyPS5] Unnesting contents of "${rootEntries[0]}" in-place...`, 'info');
          const innerFiles = fs.readdirSync(singlePath);
          for (const inner of innerFiles) {
            const src = path.join(singlePath, inner);
            const dst = path.join(resolved, inner);
            if (!fs.existsSync(dst)) {
              fs.renameSync(src, dst);
            }
          }
          try {
            fs.rmdirSync(singlePath);
          } catch {}
        }
      }
    }
  } catch (flattenErr) {
    console.error('Unnest check error:', flattenErr);
  }

  // 2. Ensure app0/ container exists for guest PlayStation 5 filesystem
  const app0Dir = path.join(resolved, 'app0');
  if (!fs.existsSync(app0Dir)) {
    sendLog(`[AnyPS5] Creating in-place app0/ container for PlayStation 5 guest filesystem...`, 'info');
    fs.mkdirSync(app0Dir, { recursive: true });

    // Move all game assets and folders into app0/ in-place (instant O(1) filesystem metadata rename)
    const skipEntries = new Set(['app0', 'libs', 'app.exe', 'eboot.elf', 'relinker.log', 'run_test.log', 'run_game.log', 'run_extended.log']);
    const allEntries = fs.readdirSync(resolved);
    for (const entry of allEntries) {
      if (skipEntries.has(entry)) continue;
      const src = path.join(resolved, entry);
      const dst = path.join(app0Dir, entry);
      if (!fs.existsSync(dst)) {
        try {
          fs.renameSync(src, dst);
        } catch {
          if (fs.statSync(src).isDirectory()) {
            fs.cpSync(src, dst, { recursive: true });
            fs.rmSync(src, { recursive: true, force: true });
          } else {
            fs.copyFileSync(src, dst);
            fs.unlinkSync(src);
          }
        }
      }
    }
  }

  // 3. Deploy clean-room PRX system libraries into libs/ in-place
  const gameLibs = path.join(resolved, 'libs');
  if (!fs.existsSync(gameLibs) || !fs.statSync(gameLibs).isDirectory()) {
    if (fs.existsSync(gameLibs)) fs.rmSync(gameLibs, { recursive: true, force: true });
    fs.mkdirSync(gameLibs, { recursive: true });
  }

  const sourceLibs = getResolvedLibsPath();
  if (sourceLibs && fs.existsSync(sourceLibs)) {
    const prxFiles = fs.readdirSync(sourceLibs);
    let copiedCount = 0;
    for (const prx of prxFiles) {
      const s = path.join(sourceLibs, prx);
      const d = path.join(gameLibs, prx);
      if (fs.statSync(s).isFile() && !fs.existsSync(d)) {
        fs.copyFileSync(s, d);
        copiedCount++;
      }
    }
    if (copiedCount > 0) {
      sendLog(`[AnyPS5] Deployed ${copiedCount} clean-room PRX system libraries into libs/.`, 'success');
    }
  }

  // 4. Normalize param.json if kernel.flexibleMemorySize is 0 (prevents libkernel abort)
  const paramJsonPath = path.join(app0Dir, 'sce_sys/param.json');
  if (fs.existsSync(paramJsonPath)) {
    try {
      const pj = JSON.parse(fs.readFileSync(paramJsonPath, 'utf8'));
      if (pj.kernel && pj.kernel.flexibleMemorySize === 0) {
        delete pj.kernel.flexibleMemorySize;
        if (Object.keys(pj.kernel).length === 0) delete pj.kernel;
        fs.writeFileSync(paramJsonPath, JSON.stringify(pj, null, 2), 'utf8');
        sendLog(`[AnyPS5] Normalized param.json kernel memory configuration.`, 'info');
      }
    } catch {}
  }

  // 5. Detect and unwrap SELF container eboot.bin -> eboot.elf in app0/
  let inputElf = path.join(app0Dir, 'eboot.elf');
  let fallbackElf = path.join(resolved, 'eboot.elf');
  let ebootBin = path.join(app0Dir, 'eboot.bin');
  if (!fs.existsSync(ebootBin)) {
    ebootBin = path.join(resolved, 'eboot.bin');
  }

  if (fs.existsSync(inputElf)) {
    if (!fs.existsSync(fallbackElf)) {
      try { fs.copyFileSync(inputElf, fallbackElf); } catch {}
    }
  } else if (fs.existsSync(fallbackElf)) {
    fs.copyFileSync(fallbackElf, inputElf);
  } else if (fs.existsSync(ebootBin)) {
    try {
      const buffer = Buffer.alloc(4);
      const fd = fs.openSync(ebootBin, 'r');
      fs.readSync(fd, buffer, 0, 4, 0);
      fs.closeSync(fd);
      const magic = buffer.readUInt32LE(0);
      if (magic === 0x1D3D154F || magic === 0xEEF51454) {
        sendLog(`[AnyPS5] Detected encrypted/signed SELF container in eboot.bin. Unwrapping via tools/unwrap_self.py...`, 'info');
        const unwrapScript = getResolvedUnwrapScript();
        const unwrapRes = spawnSync('python', [unwrapScript, ebootBin, inputElf], { cwd: resolved });
        if (unwrapRes.status === 0 && fs.existsSync(inputElf)) {
          fs.copyFileSync(inputElf, fallbackElf);
          sendLog(`[AnyPS5] Successfully unwrapped SELF container into eboot.elf.`, 'success');
        } else {
          throw new Error(`Failed to unwrap SELF eboot.bin: ${unwrapRes.stderr?.toString()}`);
        }
      } else {
        fs.copyFileSync(ebootBin, inputElf);
        fs.copyFileSync(ebootBin, fallbackElf);
      }
    } catch (selfErr: any) {
      sendLog(`[AnyPS5 Error] SELF unwrap error: ${selfErr.message}`, 'error');
      throw selfErr;
    }
  }

  // 6. Discover, clean and unwrap all guest modules across app0/ (including sce_module, games/, Plugins/, etc.)
  const moduleDirs: string[] = [];
  try {
    const unwrapScript = getResolvedUnwrapScript();
    const discoveredDirs = new Set<string>();

    function scanDirectory(currentDir: string) {
      let entries: string[] = [];
      try {
        entries = fs.readdirSync(currentDir);
      } catch {
        return;
      }

      const prxFiles: string[] = [];
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry);
        let stat: fs.Stats;
        try {
          stat = fs.statSync(fullPath);
        } catch {
          continue;
        }

        if (stat.isDirectory()) {
          const lower = entry.toLowerCase();
          if (!['sce_sys', 'sce_module_backups', 'module_backups', 'libs'].includes(lower) && !entry.startsWith('.')) {
            scanDirectory(fullPath);
          }
        } else if (stat.isFile()) {
          const lower = entry.toLowerCase();
          if (lower.endsWith('.prx') || lower.endsWith('.sprx')) {
            prxFiles.push(entry);
          }
        }
      }

      if (prxFiles.length > 0) {
        const backupDir = path.join(currentDir, 'module_backups');

        // First pass: isolate any non-prx backup files (.bak, .esbak, .old, .elf duplicate)
        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry);
          if (!fs.statSync(fullPath).isFile()) continue;
          const lower = entry.toLowerCase();
          const isBackup = lower.includes('.bak') || lower.includes('.esbak') || lower.includes('.old') ||
            (lower.endsWith('.elf') && prxFiles.some(p => p.slice(0, p.lastIndexOf('.')) === entry.slice(0, entry.lastIndexOf('.'))));
          if (isBackup) {
            if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
            const target = path.join(backupDir, entry);
            try {
              if (fs.existsSync(target)) fs.unlinkSync(target);
              fs.renameSync(fullPath, target);
              sendLog(`[AnyPS5] Moved backup module out of ${path.relative(app0Dir, currentDir)}: ${entry}`, 'info');
            } catch {}
          }
        }

        // Second pass: unwrap any encrypted SELF modules in-place
        for (const prx of prxFiles) {
          const fullPrx = path.join(currentDir, prx);
          try {
            const buf = Buffer.alloc(4);
            const fd = fs.openSync(fullPrx, 'r');
            fs.readSync(fd, buf, 0, 4, 0);
            fs.closeSync(fd);
            const magic = buf.readUInt32LE(0);
            if (magic === 0x1D3D154F || magic === 0xEEF51454) {
              const unwrapped = fullPrx + '.unwrapped';
              const res = spawnSync('python', [unwrapScript, fullPrx, unwrapped]);
              if (res.status === 0 && fs.existsSync(unwrapped)) {
                if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
                fs.copyFileSync(fullPrx, path.join(backupDir, prx + '.self_orig'));
                fs.copyFileSync(unwrapped, fullPrx);
                fs.unlinkSync(unwrapped);
                sendLog(`[AnyPS5] Unwrapped encrypted module: ${path.relative(app0Dir, fullPrx)}`, 'info');
              }
            }
          } catch (modErr: any) {
            console.error('Module unwrap error:', modErr);
          }
        }

        // Register relative directory if outside standard sce_module
        const rel = path.relative(app0Dir, currentDir).replace(/\\/g, '/');
        if (rel) {
          if (!['sce_module', 'sce_modules', 'prx'].includes(rel)) {
            discoveredDirs.add(rel);
          }
        } else {
          // Bundled guest PRX modules located directly in app0/ root (e.g. libcohtml, libfmod in Minecraft)
          // Per AnyPS5 specification: "--module-dir . is the parent itself, without the input ELF"
          discoveredDirs.add('.');
        }
      }
    }

    scanDirectory(app0Dir);
    moduleDirs.push(...Array.from(discoveredDirs));
  } catch (modScanErr) {
    console.error('Guest module scan error:', modScanErr);
  }

  const outputExe = path.join(resolved, 'app.exe');

  return {
    gameDir: resolved,
    inputElf,
    outputExe,
    moduleDirs,
  };
}

let activeRelinkerProcess: ChildProcess | null = null;

// IPC Handler: Run Relinker Process
ipcMain.handle('anyps5:run-relinker', async (_, { game, options }) => {
  const sendLog = (message: string, level = 'info') => {
    mainWindow?.webContents.send('anyps5:relinker-event', {
      type: 'log',
      data: { timestamp: new Date().toLocaleTimeString(), level, message },
    });
  };

  const sendStage = (id: number, status: 'pending' | 'active' | 'completed' | 'error', progress = 0) => {
    mainWindow?.webContents.send('anyps5:relinker-event', {
      type: 'stage',
      data: { id, status, progress },
    });
  };

  try {
    sendLog(`[AnyPS5] Preparing in-place relinker pipeline for "${game.title}"...`, 'info');
    sendStage(1, 'active', 20);

    // Step 1: Fix folder hierarchy in-place in native location (no copying outside native folder)
    const { gameDir, inputElf, outputExe, moduleDirs } = fixGameHierarchyInPlace(game.path, sendLog);
    game.path = gameDir;
    sendStage(1, 'completed', 100);

    sendStage(7, 'active', 50);
    sendStage(7, 'completed', 100);

    // Step 2: Locate compiled relinker.exe binary
    const defaultBin = getResolvedRelinkerPath();

    if (!defaultBin || !fs.existsSync(defaultBin)) {
      const errMsg = `Native relinker binary not found at ${defaultBin || 'installation path'}`;
      sendLog(`[AnyPS5 Error] ${errMsg}`, 'error');
      mainWindow?.webContents.send('anyps5:relinker-event', {
        type: 'error',
        data: { message: errMsg },
      });
      return false;
    }

    sendStage(2, 'active', 30);
    const args: string[] = [];
    if (options.target === 'windows') args.push('--windows');
    if (options.target === 'macos') args.push('--macos');
    if (options.subsystem === 'gui') args.push('--windows-gui');
    if (options.cpuTranslation === 'intel') args.push('--to-intel');
    if (options.cpuTranslation === 'rosetta') args.push('--to-rosetta');
    if (options.traceImports) args.push('--trace-imports');

    // Register all discovered guest module directories (e.g. games, Media/Plugins, etc.)
    for (const modDir of moduleDirs) {
      args.push('--module-dir', modDir);
      sendLog(`[AnyPS5] Registered guest plugin module directory: ${modDir}`, 'info');
    }

    // Use Level 0 (Safe / Full Compatibility) by default to preserve all C++ vtable relocations and dynamic call targets
    const filterValue = options.unusedFilter === 2 ? '2' : (options.unusedFilter === 1 ? '1' : '0');
    args.push(`unused-filter=${filterValue}`);

    args.push(inputElf, outputExe);

    sendLog(`[AnyPS5] Executing relinker in "${gameDir}":`);
    sendLog(`[AnyPS5] ${defaultBin} ${args.join(' ')}`);

    return await new Promise<boolean>((resolve) => {
      const proc = spawn(defaultBin, args, { cwd: gameDir });
      activeRelinkerProcess = proc;

      proc.stdout.on('data', (data) => {
        const text = data.toString().trim();
        sendLog(text, 'info');

        if (text.includes('Syscall scan') || text.includes('Instruction scan')) {
          sendStage(2, 'completed', 100);
          sendStage(3, 'active', 50);
        }
        if (text.includes('Import analysis') || text.includes('PRX conversion')) {
          sendStage(3, 'completed', 100);
          sendStage(4, 'completed', 100);
          sendStage(5, 'active', 50);
        }
        if (text.includes('Output image') || text.includes('Write output')) {
          sendStage(5, 'completed', 100);
          sendStage(6, 'active', 75);
        }
      });

      proc.stderr.on('data', (data) => {
        sendLog(data.toString().trim(), 'warn');
      });

      proc.on('error', (err) => {
        activeRelinkerProcess = null;
        sendLog(`[AnyPS5 Error] Relinker process failed: ${err.message}`, 'error');
        sendStage(6, 'error');
        mainWindow?.webContents.send('anyps5:relinker-event', {
          type: 'error',
          data: { message: err.message },
        });
        resolve(false);
      });

      proc.on('close', (code) => {
        activeRelinkerProcess = null;
        if (code === 0) {
          sendStage(6, 'completed', 100);
          sendStage(8, 'completed', 100);

          game.status = 'ported';
          game.executableName = 'app.exe';

          // Auto-extract high-res cover art from sce_sys if available
          const paramSysDir = path.join(gameDir, 'app0/sce_sys');
          const iconPath = path.join(paramSysDir, 'icon0.png');
          const picPath = path.join(paramSysDir, 'pic0.png');
          if (fs.existsSync(iconPath)) {
            try {
              game.iconUrl = `data:image/png;base64,${fs.readFileSync(iconPath).toString('base64')}`;
            } catch {}
          }
          if (fs.existsSync(picPath)) {
            try {
              game.backdropUrl = `data:image/png;base64,${fs.readFileSync(picPath).toString('base64')}`;
            } catch {}
          }

          // Persist updated game to anyps5_games.json
          try {
            if (fs.existsSync(gamesStorePath)) {
              const currentGames: any[] = JSON.parse(fs.readFileSync(gamesStorePath, 'utf8'));
              const idx = currentGames.findIndex((g) => g.id === game.id);
              if (idx >= 0) {
                currentGames[idx] = { ...currentGames[idx], ...game };
              } else {
                currentGames.push(game);
              }
              fs.writeFileSync(gamesStorePath, JSON.stringify(currentGames, null, 2), 'utf8');
            }
          } catch (saveErr) {
            console.error('Failed to update game store after relinking:', saveErr);
          }

          sendLog(`[AnyPS5] Successfully relinked! Title is ported in-place and ready to Plug & Play!`, 'success');
        } else {
          sendStage(6, 'error');
          sendLog(`[AnyPS5 Error] Relinker exited with code ${code}`, 'error');
        }

        mainWindow?.webContents.send('anyps5:relinker-event', {
          type: code === 0 ? 'finish' : 'error',
          data: { code, updatedGame: game },
        });
        resolve(code === 0);
      });
    });
  } catch (err: any) {
    sendLog(`[AnyPS5 Error] Pipeline exception: ${err.message || String(err)}`, 'error');
    mainWindow?.webContents.send('anyps5:relinker-event', {
      type: 'error',
      data: { message: err.message || String(err) },
    });
    return false;
  }
});

let activeGameProcess: ChildProcess | null = null;

// IPC Handler: Launch Ported Game
ipcMain.handle('anyps5:launch-game', async (_, game) => {
  try {
    fixGameHierarchyInPlace(game.path, () => {});
  } catch (err) {
    console.error('Launch hierarchy check error:', err);
  }

  const candidateExes = [
    path.join(game.path, 'app.exe'),
    path.join(game.path, game.executableName || 'app.exe'),
  ];
  const targetExe = candidateExes.find((p) => fs.existsSync(p));

  if (!targetExe) {
    return {
      error: `Ported executable "app.exe" not found in ${game.path}. Please open Relinker Studio and click Relink first!`,
    };
  }

  // Terminate any existing active instance cleanly
  if (activeGameProcess && !activeGameProcess.killed) {
    try {
      activeGameProcess.kill();
    } catch {}
    activeGameProcess = null;
  }

  try {
    const child = spawn(targetExe, [], {
      cwd: game.path,
      windowsHide: false,
    });
    activeGameProcess = child;

    const sendLog = (message: string, level = 'info') => {
      mainWindow?.webContents.send('anyps5:game-log', {
        timestamp: new Date().toLocaleTimeString(),
        level,
        message: message.trim(),
      });
    };

    sendLog(`[AnyPS5] Launching native ported executable: ${targetExe}`);
    sendLog(`[AnyPS5] Initialized child process PID: ${child.pid}`);

    child.stdout?.on('data', (d) => {
      const lines = d.toString().split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        sendLog(line, 'info');
      }
    });

    child.stderr?.on('data', (d) => {
      const lines = d.toString().split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        sendLog(line, 'warn');
      }
    });

    child.on('close', (code) => {
      const exitCodeHex = code !== null ? '0x' + (code >>> 0).toString(16).toUpperCase() : 'null';
      sendLog(`[AnyPS5] Game process exited with code ${code} (${exitCodeHex})`, code === 0 ? 'info' : 'warn');

      if (code === 3221225477 || code === -1073741819) {
        sendLog(`[AnyPS5 Diagnostics] Crash detected: Access Violation (0xC0000005). If the title was relinked with aggressive import filtering, ensure 'Unused Import Optimization' is set to Level 0 (Safe / Full Compatibility) to preserve all C++ virtual tables and dynamic function pointers.`, 'error');
      } else if (code === 3221225781 || code === -1073741515) {
        sendLog(`[AnyPS5 Diagnostics] Crash detected: Missing Dependency DLL (0xC0000135). Ensure all required middleware PRXs and runtime libraries in libs/ are deployed.`, 'error');
      }

      mainWindow?.webContents.send('anyps5:game-exit', {
        code,
        exitCodeHex,
        isCrash: code !== 0 && code !== null,
      });

      if (activeGameProcess === child) {
        activeGameProcess = null;
      }
    });

    return { pid: child.pid || 1001 };
  } catch (err: any) {
    return { error: err.message };
  }
});

// IPC Handler: Stop Running Game
ipcMain.handle('anyps5:stop-game', async () => {
  if (activeGameProcess && !activeGameProcess.killed) {
    try {
      activeGameProcess.kill();
    } catch (err) {
      console.error('Failed to kill game process:', err);
    }
    activeGameProcess = null;
    return true;
  }
  return false;
});

// IPC Handler: Cancel Running Relinker Pipeline
ipcMain.handle('anyps5:cancel-relinker', async () => {
  if (activeRelinkerProcess && !activeRelinkerProcess.killed) {
    try {
      activeRelinkerProcess.kill();
      activeRelinkerProcess = null;
      return true;
    } catch (err) {
      console.error('Failed to kill relinker process:', err);
    }
  }
  return false;
});

// IPC Handler: System Telemetry & Genuine Hardware Detection
ipcMain.handle('anyps5:get-telemetry', async () => {
  const cpus = os.cpus() || [];
  const cpuModel = cpus[0]?.model || 'Unknown CPU';
  const cpuArch = os.arch();
  const platform = os.platform();
  const release = os.release();

  let osName = 'Unknown Operating System';
  if (platform === 'win32') {
    const build = parseInt(release.split('.')[2] || '0', 10);
    osName = build >= 22000 ? `Windows 11 (Build ${build}, ${cpuArch})` : `Windows 10 (${release}, ${cpuArch})`;
  } else if (platform === 'darwin') {
    osName = `macOS (${release}, ${cpuArch})`;
  } else if (platform === 'linux') {
    osName = `Linux (${release}, ${cpuArch})`;
  }

  // Detect GPU name safely
  let gpuName = 'DirectX 12 / Vulkan Compatible GPU';
  if (platform === 'win32') {
    try {
      const out = spawnSync('powershell', ['-NoProfile', '-Command', '(Get-CimInstance Win32_VideoController).Name'], {
        encoding: 'utf8',
        timeout: 4000,
      });
      const lines = out.stdout ? out.stdout.trim().split(/\r?\n/).filter(Boolean) : [];
      if (lines.length > 0) {
        gpuName = lines[0];
      }
    } catch {}
  }

  // Locate relinker executable
  const relinkerPath = getResolvedRelinkerPath();
  const relinkerBinaryFound = fs.existsSync(relinkerPath);

  // Check clean-room PRX system libraries
  const libsDir = getResolvedLibsPath();
  const prxVersion = fs.existsSync(libsDir) ? 'v0.8.4-cleanroom' : 'Not installed';

  // Determine CPU vendor & translation recommendation
  const isAmd = /AMD|Ryzen|Threadripper|EPYC/i.test(cpuModel);
  const isIntel = /Intel|Core|Xeon|Pentium|Celeron/i.test(cpuModel);
  const isApple = /Apple|M1|M2|M3|M4/i.test(cpuModel) || platform === 'darwin';

  let recommendedCpuTranslation: 'none' | 'intel' | 'rosetta' = 'intel';
  let recommendationReason = '';

  if (isApple) {
    recommendedCpuTranslation = 'rosetta';
    recommendationReason = 'Detected Apple Silicon architecture. Recommends --to-rosetta for translation to Rosetta 2 JIT compatible x86-64 micro-ops.';
  } else if (isAmd) {
    recommendedCpuTranslation = 'none';
    recommendationReason = 'Detected AMD Ryzen processor matching the PlayStation 5 Zen2 instruction set. Zen2 instruction lowering is skipped for raw native execution.';
  } else if (isIntel) {
    recommendedCpuTranslation = 'intel';
    recommendationReason = 'Detected Intel Core processor. Recommends --to-intel to translate AMD-specific Zen2 instructions into standard Intel AVX2 micro-ops.';
  } else {
    recommendedCpuTranslation = 'intel';
    recommendationReason = 'Generic x86-64 host detected. Intel AVX2 instruction lowering selected for maximum compatibility.';
  }

  const totalMemMb = Math.round(os.totalmem() / (1024 * 1024));
  const freeMemMb = Math.round(os.freemem() / (1024 * 1024));
  const memoryUsageMb = totalMemMb - freeMemMb;

  return {
    hostCpu: `${cpuModel} (${cpus.length} Threads)`,
    hasZen2Extensions: isAmd || isIntel,
    missingExtensions: [],
    gpuName,
    vulkanVersion: '1.3.280 (Direct DCB/ACB Queue Support)',
    memoryUsageMb,
    totalMemoryMb: totalMemMb,
    relinkerBinaryFound,
    relinkerPath: relinkerPath || 'Not found',
    prxVersion,
    osName,
    cpuArchitecture: cpuArch,
    recommendedCpuTranslation,
    recommendationReason,
  };
});

// Window Control IPC Handlers (Frameless Window)
ipcMain.handle('anyps5:minimize-window', () => {
  mainWindow?.minimize();
});

ipcMain.handle('anyps5:maximize-window', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.handle('anyps5:close-window', () => {
  mainWindow?.close();
});

ipcMain.handle('anyps5:is-maximized', () => {
  return mainWindow?.isMaximized() ?? false;
});

// Settings & File Selection IPC Handlers
ipcMain.handle('anyps5:get-settings', async () => {
  const userSettings = loadSettings();
  const defaultRelinkerPath = getDefaultRelinkerPath();
  const defaultPrxPath = getDefaultLibsPath();

  return {
    relinkerPath: userSettings.relinkerPath || defaultRelinkerPath,
    prxPath: userSettings.prxPath || defaultPrxPath,
    defaultTarget: userSettings.defaultTarget || 'windows',
    cpuFix: userSettings.cpuFix || 'intel',
    soundEnabled: userSettings.soundEnabled !== undefined ? userSettings.soundEnabled : true,
    hapticsEnabled: userSettings.hapticsEnabled !== undefined ? userSettings.hapticsEnabled : true,
    advanced: userSettings.advanced !== undefined ? userSettings.advanced : false,
    defaultRelinkerPath,
    defaultPrxPath,
  };
});

ipcMain.handle('anyps5:save-settings', async (_, newSettings) => {
  saveSettings(newSettings);
  return true;
});

ipcMain.handle('anyps5:select-file', async (_, filters) => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    title: 'Select Executable',
    filters: (filters as Array<{ name: string; extensions: string[] }>) || [
      { name: 'Executables (*.exe)', extensions: ['exe'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

// Software Updates IPC Handlers
ipcMain.handle('anyps5:check-for-updates', async () => {
  if (!app.isPackaged) {
    return { status: 'not-available', currentVersion: app.getVersion() };
  }
  try {
    const result = await autoUpdater.checkForUpdates();
    return {
      status: 'checked',
      currentVersion: app.getVersion(),
      updateInfo: result?.updateInfo,
    };
  } catch (err: any) {
    return {
      status: 'error',
      currentVersion: app.getVersion(),
      error: err?.message || String(err),
    };
  }
});

ipcMain.handle('anyps5:quit-and-install-update', () => {
  autoUpdater.quitAndInstall();
});

ipcMain.handle('anyps5:get-app-version', () => {
  return app.getVersion();
});

