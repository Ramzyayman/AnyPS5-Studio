import fs from 'fs';
import path from 'path';
import { RuntimeProfile, RuntimesManifest, ResolvedRuntime } from '../src/types';

export class RuntimeManager {
  private userDataDir: string;
  private runtimesBaseDir: string;
  private manifestPath: string;
  private bundledDir: string;
  private commitsDir: string;
  private customDir: string;
  private defaultRelinkerGetter: () => string;
  private defaultLibsGetter: () => string;

  constructor(
    userDataDir: string,
    defaultRelinkerGetter: () => string,
    defaultLibsGetter: () => string,
    currentSettings?: { relinkerPath?: string; prxPath?: string }
  ) {
    this.userDataDir = userDataDir;
    this.runtimesBaseDir = path.join(userDataDir, 'runtimes');
    this.manifestPath = path.join(this.runtimesBaseDir, 'runtimes_manifest.json');
    this.bundledDir = path.join(this.runtimesBaseDir, 'bundled');
    this.commitsDir = path.join(this.runtimesBaseDir, 'commits');
    this.customDir = path.join(this.runtimesBaseDir, 'custom');
    this.defaultRelinkerGetter = defaultRelinkerGetter;
    this.defaultLibsGetter = defaultLibsGetter;

    this.init(currentSettings);
  }

  private getRelinkerBinName(): string {
    return process.platform === 'win32' ? 'relinker.exe' : 'relinker';
  }

  private detectLocalCommitHash(): string {
    try {
      const repoRoot = path.resolve(__dirname, '../../');
      if (fs.existsSync(path.join(repoRoot, '.git'))) {
        const { spawnSync } = require('child_process');
        const logOut = spawnSync('git', ['log', '-1', '--pretty=format:%P', 'HEAD'], {
          cwd: repoRoot,
          encoding: 'utf8',
          timeout: 2000,
        });
        if (logOut.stdout) {
          const parts = logOut.stdout.trim().split(/\s+/);
          if (parts.length > 1 && parts[1]) {
            return parts[1].substring(0, 7);
          }
        }
        const headOut = spawnSync('git', ['rev-parse', '--short', 'HEAD'], {
          cwd: repoRoot,
          encoding: 'utf8',
          timeout: 2000,
        });
        if (headOut.stdout && headOut.stdout.trim()) {
          return headOut.stdout.trim();
        }
      }
    } catch {}
    return '0d1c299';
  }

  private init(currentSettings?: { relinkerPath?: string; prxPath?: string }) {
    try {
      if (!fs.existsSync(this.runtimesBaseDir)) {
        fs.mkdirSync(this.runtimesBaseDir, { recursive: true });
      }
      if (!fs.existsSync(this.bundledDir)) {
        fs.mkdirSync(this.bundledDir, { recursive: true });
      }
      if (!fs.existsSync(this.commitsDir)) {
        fs.mkdirSync(this.commitsDir, { recursive: true });
      }
      if (!fs.existsSync(this.customDir)) {
        fs.mkdirSync(this.customDir, { recursive: true });
      }

      this.seedBundledRuntime();

      let manifest: RuntimesManifest;
      const isNewManifest = !fs.existsSync(this.manifestPath);

      if (isNewManifest) {
        manifest = {
          activeGlobalRuntimeId: 'bundled',
          runtimes: [
            {
              id: 'bundled',
              name: 'Bundled Stable (v0.1.2)',
              type: 'bundled',
              commitHash: 'v0.1.2',
              date: '2026-10-14T08:56:52Z',
              path: 'bundled',
              isRemovable: false,
            },
          ],
        };

        // If local workspace build exists, register as Local Build profile
        const defaultRelinker = this.defaultRelinkerGetter();
        const defaultLibs = this.defaultLibsGetter();
        if (defaultRelinker && fs.existsSync(defaultRelinker) && defaultLibs && fs.existsSync(defaultLibs)) {
          const localSha = this.detectLocalCommitHash();
          manifest.runtimes.push({
            id: 'local-build',
            name: `Local Build (${localSha})`,
            type: 'custom',
            commitHash: localSha,
            date: new Date().toISOString(),
            path: path.dirname(defaultRelinker),
            relinkerPath: defaultRelinker,
            libsPath: defaultLibs,
            isRemovable: true,
          });
        }

        // If user already has custom paths configured in settings, auto-register as Custom (Imported)
        if (currentSettings) {
          const hasCustomRelinker =
            currentSettings.relinkerPath &&
            fs.existsSync(currentSettings.relinkerPath) &&
            path.normalize(currentSettings.relinkerPath) !== path.normalize(this.defaultRelinkerGetter());
          const hasCustomLibs =
            currentSettings.prxPath &&
            fs.existsSync(currentSettings.prxPath) &&
            path.normalize(currentSettings.prxPath) !== path.normalize(this.defaultLibsGetter());

          if (hasCustomRelinker || hasCustomLibs) {
            const relinkerP = currentSettings.relinkerPath || this.defaultRelinkerGetter();
            const libsP = currentSettings.prxPath || this.defaultLibsGetter();
            const customProfile: RuntimeProfile = {
              id: 'custom-imported',
              name: 'Custom (Imported)',
              type: 'custom',
              date: new Date().toISOString(),
              path: path.dirname(relinkerP),
              relinkerPath: relinkerP,
              libsPath: libsP,
              isRemovable: true,
            };
            manifest.runtimes.push(customProfile);
            manifest.activeGlobalRuntimeId = 'custom-imported';
          }
        }

        this.saveManifest(manifest);
      } else {
        manifest = this.getManifest();
        let changed = false;

        // Ensure bundled runtime is present and set to v0.1.2 baseline
        const bundled = manifest.runtimes.find((r) => r.id === 'bundled');
        if (!bundled) {
          manifest.runtimes.unshift({
            id: 'bundled',
            name: 'Bundled Stable (v0.1.2)',
            type: 'bundled',
            commitHash: 'v0.1.2',
            date: '2026-10-14T08:56:52Z',
            path: 'bundled',
            isRemovable: false,
          });
          changed = true;
        } else if (bundled.commitHash !== 'v0.1.2') {
          bundled.commitHash = 'v0.1.2';
          bundled.name = 'Bundled Stable (v0.1.2)';
          changed = true;
        }

        // Ensure local build is registered if local workspace build exists
        const defaultRelinker = this.defaultRelinkerGetter();
        const defaultLibs = this.defaultLibsGetter();
        if (defaultRelinker && fs.existsSync(defaultRelinker) && defaultLibs && fs.existsSync(defaultLibs)) {
          const hasLocal = manifest.runtimes.some((r) => r.id === 'local-build');
          if (!hasLocal) {
            const localSha = this.detectLocalCommitHash();
            manifest.runtimes.push({
              id: 'local-build',
              name: `Local Build (${localSha})`,
              type: 'custom',
              commitHash: localSha,
              date: new Date().toISOString(),
              path: path.dirname(defaultRelinker),
              relinkerPath: defaultRelinker,
              libsPath: defaultLibs,
              isRemovable: true,
            });
            changed = true;
          }
        }

        if (changed) {
          this.saveManifest(manifest);
        }
      }
    } catch (err) {
      console.error('Failed to initialize RuntimeManager:', err);
    }
  }

  private seedBundledRuntime() {
    try {
      const defaultRelinker = this.defaultRelinkerGetter();
      const defaultLibs = this.defaultLibsGetter();
      const binName = this.getRelinkerBinName();

      const targetRelinker = path.join(this.bundledDir, binName);
      if (defaultRelinker && fs.existsSync(defaultRelinker) && !fs.existsSync(targetRelinker)) {
        try {
          fs.copyFileSync(defaultRelinker, targetRelinker);
          if (process.platform !== 'win32') {
            fs.chmodSync(targetRelinker, 0o755);
          }
        } catch (copyErr) {
          console.warn('Failed to seed bundled relinker:', copyErr);
        }
      }

      const targetLibs = path.join(this.bundledDir, 'libs');
      if (!fs.existsSync(targetLibs)) {
        fs.mkdirSync(targetLibs, { recursive: true });
      }

      const currentLibsCount = fs.existsSync(targetLibs) ? fs.readdirSync(targetLibs).length : 0;
      if (defaultLibs && fs.existsSync(defaultLibs) && currentLibsCount === 0) {
        try {
          const files = fs.readdirSync(defaultLibs);
          for (const file of files) {
            const src = path.join(defaultLibs, file);
            const dst = path.join(targetLibs, file);
            if (fs.statSync(src).isFile()) {
              fs.copyFileSync(src, dst);
              if (process.platform !== 'win32') {
                try {
                  fs.chmodSync(dst, 0o755);
                } catch {}
              }
            }
          }
        } catch (copyLibsErr) {
          console.warn('Failed to seed bundled libs:', copyLibsErr);
        }
      }
    } catch (err) {
      console.warn('Seed bundled runtime warning:', err);
    }
  }

  public getManifest(): RuntimesManifest {
    try {
      if (fs.existsSync(this.manifestPath)) {
        const raw = fs.readFileSync(this.manifestPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.runtimes)) {
          return parsed;
        }
      }
    } catch (err) {
      console.error('Failed to read runtimes_manifest.json:', err);
    }

    return {
      activeGlobalRuntimeId: 'bundled',
      runtimes: [
        {
          id: 'bundled',
          name: 'Bundled Stable (v0.1.2)',
          type: 'bundled',
          commitHash: 'v0.1.2',
          date: '2026-10-14T08:56:52Z',
          path: 'bundled',
          isRemovable: false,
        },
      ],
    };
  }

  public saveManifest(manifest: RuntimesManifest): void {
    try {
      fs.writeFileSync(this.manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
    } catch (err) {
      console.error('Failed to write runtimes_manifest.json:', err);
    }
  }

  public listRuntimes(): ResolvedRuntime[] {
    const manifest = this.getManifest();
    const binName = this.getRelinkerBinName();
    const results: ResolvedRuntime[] = [];

    for (const profile of manifest.runtimes) {
      let relinkerPath = '';
      let libsPath = '';

      if (profile.type === 'bundled') {
        const localRelinker = path.join(this.bundledDir, binName);
        const localLibs = path.join(this.bundledDir, 'libs');
        if (fs.existsSync(localRelinker) && fs.existsSync(localLibs)) {
          relinkerPath = localRelinker;
          libsPath = localLibs;
        } else {
          relinkerPath = this.defaultRelinkerGetter();
          libsPath = this.defaultLibsGetter();
        }
      } else if (profile.type === 'custom') {
        if (profile.relinkerPath && fs.existsSync(profile.relinkerPath)) {
          relinkerPath = path.normalize(profile.relinkerPath);
        } else {
          const cand = path.isAbsolute(profile.path)
            ? path.join(profile.path, binName)
            : path.join(this.runtimesBaseDir, profile.path, binName);
          if (fs.existsSync(cand)) relinkerPath = cand;
        }

        if (profile.libsPath && fs.existsSync(profile.libsPath)) {
          libsPath = path.normalize(profile.libsPath);
        } else {
          const candDir = path.isAbsolute(profile.path)
            ? profile.path
            : path.join(this.runtimesBaseDir, profile.path);
          const candLibs = path.join(candDir, 'libs');
          if (fs.existsSync(candLibs)) {
            libsPath = candLibs;
          } else if (fs.existsSync(candDir)) {
            libsPath = candDir;
          }
        }
      } else {
        // ci-artifact
        const baseFolder = path.isAbsolute(profile.path)
          ? profile.path
          : path.join(this.runtimesBaseDir, profile.path);
        relinkerPath = profile.relinkerPath || path.join(baseFolder, binName);
        libsPath = profile.libsPath || path.join(baseFolder, 'libs');
      }

      const isValid =
        Boolean(relinkerPath && fs.existsSync(relinkerPath)) &&
        Boolean(libsPath && fs.existsSync(libsPath));

      results.push({
        id: profile.id,
        name: profile.name,
        type: profile.type,
        commitHash: profile.commitHash,
        commitMessage: profile.commitMessage,
        date: profile.date,
        relinkerPath: path.normalize(relinkerPath),
        libsPath: path.normalize(libsPath),
        isRemovable: profile.isRemovable,
        isValid,
      });
    }

    return results;
  }

  public resolveRuntime(runtimeId?: string): ResolvedRuntime {
    const list = this.listRuntimes();
    const manifest = this.getManifest();
    const targetId = runtimeId || manifest.activeGlobalRuntimeId || 'bundled';

    const match = list.find((r) => r.id === targetId);
    if (match && match.isValid) {
      return match;
    }

    // Failsafe fallback: return bundled runtime
    const bundled = list.find((r) => r.id === 'bundled');
    if (bundled && bundled.isValid) {
      return bundled;
    }

    // Ultimate fallback to baseline getters
    return {
      id: 'bundled',
      name: 'Bundled Stable (v0.1.2) [Fallback]',
      type: 'bundled',
      commitHash: 'v0.1.2',
      date: new Date().toISOString(),
      relinkerPath: this.defaultRelinkerGetter(),
      libsPath: this.defaultLibsGetter(),
      isRemovable: false,
      isValid: true,
    };
  }

  public setActiveGlobalRuntime(runtimeId: string): boolean {
    const manifest = this.getManifest();
    const exists = manifest.runtimes.some((r) => r.id === runtimeId);
    if (!exists) return false;

    manifest.activeGlobalRuntimeId = runtimeId;
    this.saveManifest(manifest);
    return true;
  }

  public registerCustomRuntime(
    name: string,
    customPath: string,
    relinkerOverride?: string,
    libsOverride?: string
  ): RuntimeProfile {
    const resolvedPath = path.resolve(customPath);
    const binName = this.getRelinkerBinName();

    const relinkerPath =
      relinkerOverride && fs.existsSync(relinkerOverride)
        ? path.normalize(relinkerOverride)
        : path.join(resolvedPath, binName);

    const libsPath =
      libsOverride && fs.existsSync(libsOverride)
        ? path.normalize(libsOverride)
        : fs.existsSync(path.join(resolvedPath, 'libs'))
        ? path.join(resolvedPath, 'libs')
        : resolvedPath;

    if (!fs.existsSync(relinkerPath)) {
      throw new Error(`Relinker binary not found at "${relinkerPath}"`);
    }

    if (!fs.existsSync(libsPath)) {
      throw new Error(`Libs directory not found at "${libsPath}"`);
    }

    const id = `custom-${Date.now()}`;
    const profile: RuntimeProfile = {
      id,
      name: name.trim() || `Custom Core (${path.basename(resolvedPath)})`,
      type: 'custom',
      date: new Date().toISOString(),
      path: resolvedPath,
      relinkerPath,
      libsPath,
      isRemovable: true,
    };

    const manifest = this.getManifest();
    manifest.runtimes.push(profile);
    this.saveManifest(manifest);

    return profile;
  }

  public removeRuntime(runtimeId: string): boolean {
    if (runtimeId === 'bundled') {
      return false; // Bundled stable cannot be deleted
    }

    const manifest = this.getManifest();
    const profile = manifest.runtimes.find((r) => r.id === runtimeId);
    if (!profile || !profile.isRemovable) {
      return false;
    }

    // If it's a managed directory under commits/, remove files
    try {
      const fullTarget = path.isAbsolute(profile.path)
        ? profile.path
        : path.join(this.runtimesBaseDir, profile.path);

      if (
        fullTarget.startsWith(this.commitsDir) ||
        fullTarget.startsWith(this.customDir)
      ) {
        if (fs.existsSync(fullTarget)) {
          fs.rmSync(fullTarget, { recursive: true, force: true });
        }
      }
    } catch (delErr) {
      console.warn('Failed to remove runtime folder:', delErr);
    }

    manifest.runtimes = manifest.runtimes.filter((r) => r.id !== runtimeId);
    if (manifest.activeGlobalRuntimeId === runtimeId) {
      manifest.activeGlobalRuntimeId = 'bundled';
    }

    this.saveManifest(manifest);
    return true;
  }
}
