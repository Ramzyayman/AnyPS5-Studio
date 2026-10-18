# AnyPS5 Studio Project Rules

## Scope and Responsibilities

This workspace is strictly focused on **AnyPS5 Studio** (the launcher, UI, Electron backend, relinker orchestration, configuration, and diagnostics).

### 1. In-Scope: AnyPS5 Studio
- All code and assets under `ui/` (Electron main process, preload script, React components, Tailwind styling, Vite build configuration, package scripts).
- Launcher-level capabilities:
  - Game discovery, directory structure inspection, and `app0` flattening.
  - Relinker parameter configuration and execution flags (e.g., `--windows`, `--to-intel`, `--unused-import-opt`).
  - Runtime environment preparation (resolving `PATH`, `libs/`, `app0/`, working directories).
  - Diagnostic reporting, log capture, and user-facing recommendations.
  - Packaging, installer builds, and settings management (`anyps5_settings.json`).

### 2. Strictly Out-of-Scope: AnyPS5 Core & System Libraries
- **Never modify, patch, reverse engineer, or recompile AnyPS5 system libraries** (`core/libs/prx/`, `*.prx`, `libkernel`, `libc`, `libSce*`).
- **Never modify the relinker C++ source code** (`core/relinker/`).
- **Never binary-patch game executables** (`app.exe`, `eboot.bin`, etc.).
- Maintaining, fixing, or extending AnyPS5's underlying PS5 OS translation layer is the upstream AnyPS5 project's responsibility, not AnyPS5 Studio's.

### 3. Protocol for Game Failures and Bug Reports
When a user reports that a game crashed, failed silently, or is broken:
1. Check whether the problem is caused by the launcher layer:
   - Are working directories or paths set correctly?
   - Are required runtime PRXs deployed into the expected directory layout?
   - Is `PATH` properly configured for child process execution?
   - Are the relinker CLI arguments and options valid?
   If the fault lies in the launcher, resolve it inside `ui/`.
2. If the problem is caused by missing PS5 APIs, PRX runtime crashes, shader/GPU translation faults, or internal game engine assertions:
   - Identify and report the exact failure to the user clearly.
   - Explain that it is an upstream AnyPS5 core / system library limitation.
   - Check if any launcher settings can mitigate it (such as adjusting Unused Import Optimization level or CPU translation flags).
   - **Do not attempt to modify AnyPS5 C++ source files or patch the game binaries.**
