import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { spawn, spawnSync, ChildProcess } from 'child_process';
import os from 'os';
import fs from 'fs';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 820,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: '#04060a',
    title: 'AnyPS5 · PlayStation 5 Studio',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    show: true,
  });

  // Try loading live Vite dev server first, fallback to static dist
  const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
  mainWindow.loadURL(devUrl).catch(() => {
    mainWindow?.loadFile(path.join(__dirname, '../dist/index.html'));
  });

  mainWindow.show();
  mainWindow.focus();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC Handler: Persistent Games Storage
const gamesStorePath = path.join(app.getPath('userData'), 'anyps5_games.json');

ipcMain.handle('anyps5:get-games', async () => {
  try {
    if (fs.existsSync(gamesStorePath)) {
      const data = fs.readFileSync(gamesStorePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed to read games.json:', err);
  }
  return null;
});

ipcMain.handle('anyps5:save-games', async (_, games) => {
  try {
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

    return {
      title: titleName,
      titleId,
      version,
      iconUrl: iconDataUrl,
      backdropUrl: backdropDataUrl,
      hasEboot,
    };
  } catch (err) {
    console.error('Inspect folder error:', err);
    return null;
  }
}

const appRootDir = path.resolve(__dirname, '../..');

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

  const repoLibsCandidates = [
    path.resolve(appRootDir, 'libs'),
    'C:/Users/PC/.gemini/antigravity/scratch/AnyPS5/libs',
  ];
  const sourceLibs = repoLibsCandidates.find((p) => fs.existsSync(p));
  if (sourceLibs) {
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
        const unwrapScript = path.resolve(appRootDir, 'tools/unwrap_self.py');
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

  // 6. Clean and unwrap guest modules in sce_module/ (prevent ambiguous dependency collisions)
  const sceModuleDir = path.join(app0Dir, 'sce_module');
  if (fs.existsSync(sceModuleDir)) {
    try {
      const modFiles = fs.readdirSync(sceModuleDir);
      const unwrapScript = path.resolve(appRootDir, 'tools/unwrap_self.py');
      const backupDir = path.join(app0Dir, 'sce_module_backups');

      // First pass: move any backup / non-prx files out of sce_module/
      for (const mf of modFiles) {
        const full = path.join(sceModuleDir, mf);
        if (!fs.statSync(full).isFile()) continue;

        // Any backup or non-primary extension (.bak, .esbak, .bak_*, .old, etc.) must be moved out
        const isBackup = mf.includes('.bak') || mf.includes('.esbak') || mf.includes('.old') || !mf.endsWith('.prx');
        if (isBackup) {
          if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
          const targetBackup = path.join(backupDir, mf);
          try {
            if (fs.existsSync(targetBackup)) fs.unlinkSync(targetBackup);
            fs.renameSync(full, targetBackup);
            sendLog(`[AnyPS5] Moved backup module out of sce_module/: ${mf}`, 'info');
          } catch {}
        }
      }

      // Second pass: unwrap any encrypted SELF modules in-place (no .bak_self left in sce_module)
      const remainingFiles = fs.readdirSync(sceModuleDir);
      for (const mf of remainingFiles) {
        if (mf.endsWith('.prx')) {
          const fullPrx = path.join(sceModuleDir, mf);
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
                fs.copyFileSync(fullPrx, path.join(backupDir, mf + '.self_orig'));
                fs.copyFileSync(unwrapped, fullPrx);
                fs.unlinkSync(unwrapped);
                sendLog(`[AnyPS5] Unwrapped encrypted module in-place: sce_module/${mf}`, 'info');
              }
            }
          } catch (modErr: any) {
            console.error('Module unwrap error:', modErr);
          }
        }
      }
    } catch (sceErr) {
      console.error('sce_module cleaning error:', sceErr);
    }
  }

  const outputExe = path.join(resolved, 'app.exe');

  return {
    gameDir: resolved,
    inputElf,
    outputExe,
  };
}

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
    const { gameDir, inputElf, outputExe } = fixGameHierarchyInPlace(game.path, sendLog);
    game.path = gameDir;
    sendStage(1, 'completed', 100);

    sendStage(7, 'active', 50);
    sendStage(7, 'completed', 100);

    // Step 2: Locate compiled relinker.exe binary
    const candidatePaths = [
      path.resolve(appRootDir, 'build/relinker.exe'),
      path.resolve(appRootDir, 'build-relinker/core/relinker/Release/relinker.exe'),
      'C:/Users/PC/.gemini/antigravity/scratch/AnyPS5/build/relinker.exe',
    ];
    const defaultBin = candidatePaths.find((p) => fs.existsSync(p)) || candidatePaths[0];

    if (!fs.existsSync(defaultBin)) {
      const errMsg = `Native relinker binary not found at ${defaultBin}`;
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

    const filterValue = (options.unusedFilter === 'none' || options.unusedFilter === 0) ? '0' : '1';
    args.push(`unused-filter=${filterValue}`);

    args.push(inputElf, outputExe);

    sendLog(`[AnyPS5] Executing relinker in "${gameDir}":`);
    sendLog(`[AnyPS5] ${defaultBin} ${args.join(' ')}`);

    return await new Promise<boolean>((resolve) => {
      const proc = spawn(defaultBin, args, { cwd: gameDir });

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
        sendLog(`[AnyPS5 Error] Relinker process failed: ${err.message}`, 'error');
        sendStage(6, 'error');
        mainWindow?.webContents.send('anyps5:relinker-event', {
          type: 'error',
          data: { message: err.message },
        });
        resolve(false);
      });

      proc.on('close', (code) => {
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
      sendLog(`[AnyPS5] Game process exited with code ${code}`, code === 0 ? 'info' : 'warn');
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

