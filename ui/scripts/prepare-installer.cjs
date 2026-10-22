const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const uiDir = path.resolve(__dirname, '..');
const rootDir = path.resolve(uiDir, '..');
const distResourcesDir = path.join(uiDir, 'dist-resources');
const buildStagingDir = path.join(distResourcesDir, 'build');
const libsStagingDir = path.join(distResourcesDir, 'libs');
const toolsStagingDir = path.join(distResourcesDir, 'tools');

function findStripBinary() {
  if (process.env.STRIP_BIN && fs.existsSync(process.env.STRIP_BIN)) {
    return process.env.STRIP_BIN;
  }
  const candidates = [
    'C:\\winlibs\\mingw64\\bin\\strip.exe',
    'C:\\msys64\\mingw64\\bin\\strip.exe',
    'C:\\Program Files\\Git\\usr\\bin\\strip.exe',
  ];
  for (const cand of candidates) {
    if (fs.existsSync(cand)) {
      return cand;
    }
  }
  try {
    const whichCmd = process.platform === 'win32' ? 'where' : 'which';
    const out = execFileSync(whichCmd, ['strip'], { encoding: 'utf8' }).trim();
    const firstLine = out.split(/\r?\n/)[0].trim();
    if (firstLine && fs.existsSync(firstLine)) {
      return firstLine;
    }
  } catch {}
  return 'strip';
}

function getDirSizeBytes(dirPath) {
  let total = 0;
  if (!fs.existsSync(dirPath)) return 0;
  const entries = fs.readdirSync(dirPath);
  for (const entry of entries) {
    const full = path.join(dirPath, entry);
    const stat = fs.statSync(full);
    if (stat.isFile()) {
      total += stat.size;
    }
  }
  return total;
}

function main() {
  console.log('[AnyPS5 Installer Prep] Initializing packaging optimization pipeline...');

  if (fs.existsSync(distResourcesDir)) {
    fs.rmSync(distResourcesDir, { recursive: true, force: true });
  }
  fs.mkdirSync(buildStagingDir, { recursive: true });
  fs.mkdirSync(libsStagingDir, { recursive: true });
  fs.mkdirSync(toolsStagingDir, { recursive: true });

  const relinkerCandidates = [
    path.join(rootDir, 'build', 'relinker.exe'),
    path.join(rootDir, 'build', 'relinker'),
  ];
  let stagedRelinker = null;
  for (const cand of relinkerCandidates) {
    if (fs.existsSync(cand)) {
      const dest = path.join(buildStagingDir, path.basename(cand));
      fs.copyFileSync(cand, dest);
      stagedRelinker = dest;
      break;
    }
  }

  const srcLibsDir = path.join(rootDir, 'libs');
  if (fs.existsSync(srcLibsDir)) {
    const libFiles = fs.readdirSync(srcLibsDir);
    for (const file of libFiles) {
      const src = path.join(srcLibsDir, file);
      const stat = fs.statSync(src);
      if (stat.isFile()) {
        fs.copyFileSync(src, path.join(libsStagingDir, file));
      }
    }
  }

  const srcToolsDir = path.join(rootDir, 'tools');
  const requiredTools = [
    'audit_game_nids.py',
    'unwrap_self.py',
    'import_audit.py',
    'known_stubs.json',
    'nid_names.py',
  ];
  let stagedToolsCount = 0;
  for (const tool of requiredTools) {
    const src = path.join(srcToolsDir, tool);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(toolsStagingDir, tool));
      stagedToolsCount++;
    }
  }

  const relinkerInitialSize = stagedRelinker && fs.existsSync(stagedRelinker) ? fs.statSync(stagedRelinker).size : 0;
  const libsInitialSize = getDirSizeBytes(libsStagingDir);
  const totalInitialSize = relinkerInitialSize + libsInitialSize;

  const stripBin = findStripBinary();
  console.log(`[AnyPS5 Installer Prep] Strip utility: ${stripBin}`);

  if (stagedRelinker && fs.existsSync(stagedRelinker)) {
    try {
      execFileSync(stripBin, ['--strip-all', stagedRelinker], { stdio: 'pipe' });
    } catch (err) {
      console.warn(`[AnyPS5 Installer Prep] Warning: Failed to strip relinker: ${err.message}`);
    }
  }

  const stagedLibEntries = fs.readdirSync(libsStagingDir);
  let strippedPrxCount = 0;
  for (const file of stagedLibEntries) {
    if (file.toLowerCase().endsWith('.prx')) {
      const fullPath = path.join(libsStagingDir, file);
      try {
        execFileSync(stripBin, ['--strip-unneeded', fullPath], { stdio: 'pipe' });
        strippedPrxCount++;
      } catch (err) {
        console.warn(`[AnyPS5 Installer Prep] Warning: Failed to strip ${file}: ${err.message}`);
      }
    }
  }

  if (stagedRelinker && fs.existsSync(stagedRelinker)) {
    try {
      execFileSync(stagedRelinker, ['--help'], { stdio: 'pipe' });
      console.log('[AnyPS5 Installer Prep] Staged relinker verified successfully (--help exit code: 0)');
    } catch (err) {
      console.error(`[AnyPS5 Installer Prep] Error: Relinker verification failed: ${err.message}`);
      process.exit(1);
    }
  }

  const relinkerStrippedSize = stagedRelinker && fs.existsSync(stagedRelinker) ? fs.statSync(stagedRelinker).size : 0;
  const libsStrippedSize = getDirSizeBytes(libsStagingDir);
  const totalStrippedSize = relinkerStrippedSize + libsStrippedSize;
  const totalSavedBytes = totalInitialSize - totalStrippedSize;

  const initialMb = (totalInitialSize / (1024 * 1024)).toFixed(2);
  const strippedMb = (totalStrippedSize / (1024 * 1024)).toFixed(2);
  const savedMb = (totalSavedBytes / (1024 * 1024)).toFixed(2);
  const relinkerSavedMb = ((relinkerInitialSize - relinkerStrippedSize) / (1024 * 1024)).toFixed(2);
  const libsSavedMb = ((libsInitialSize - libsStrippedSize) / (1024 * 1024)).toFixed(2);

  console.log(`[AnyPS5 Installer Prep] Staged relinker size: ${(relinkerStrippedSize / (1024 * 1024)).toFixed(2)} MB (reduced by ${relinkerSavedMb} MB)`);
  console.log(`[AnyPS5 Installer Prep] Staged PRX libraries size: ${(libsStrippedSize / (1024 * 1024)).toFixed(2)} MB (reduced by ${libsSavedMb} MB, ${strippedPrxCount} PRXs stripped)`);
  console.log(`[AnyPS5 Installer Prep] Staged runtime tools: ${stagedToolsCount} scripts copied`);
  console.log(`[AnyPS5 Installer Prep] Total staged payload: ${initialMb} MB -> ${strippedMb} MB (${savedMb} MB saved)`);
}

main();
