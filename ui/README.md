# AnyPS5 UI · PlayStation 5 Studio & Launcher

An all-in-one desktop game launcher and relinker studio for **[AnyPS5](https://github.com/ramsforge/AnyPS5)**, featuring an authentic **PlayStation 5 UI/UX aesthetic**, dynamic game hero shelf, live relinker execution, NID symbol auditing, and PRX library management.

![AnyPS5 UI Preview](https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80)

---

## ✨ Features

- **🎮 PlayStation 5 Menu Aesthetic**:
  - Horizontal dynamic game shelf with smooth card focus animations, scaling, and neon-blue halo glows.
  - Ambient fullscreen hero background wallpapers that cross-fade to the selected game's artwork (`pic1.png`).
  - Web Audio API synthesized PlayStation 5 UI sounds (cursor tick, confirm chime, cancel tone, launch stinger).
  - Full keyboard (`←` / `→` / `Enter` / `Esc`) and Gamepad API (DualSense / Xbox controller) navigation.

- **⚡ Relinker Studio**:
  - Visual configuration of all AnyPS5 flags:
    - Target OS: Windows PE (`.exe`), Linux ELF (`.elf`), macOS Mach-O (`eboot`).
    - Subsystem: Windows GUI Subsystem (`--windows-gui`) vs Console Subsystem.
    - CPU Codegen Translation: AMD Zen2 Native, Intel AVX2 translation (`--to-intel`), Apple Rosetta (`--to-rosetta`).
    - Unused Import Filtering: Level 0 (Keep All), Level 1 (Safe CFG/GOT analysis), Level 2 (Strict PLT compaction).
    - Advanced: `--trace-imports`, `--windows-diagnostics`, `--registry`, custom `$ORIGIN/libs` RPath.
  - Real-time 8-stage progress tracker and live terminal log stream.

- **🔍 NID Inspector**:
  - Deep-dive into imported 64-bit NID function hashes.
  - Resolves imported functions against known clean-room PRX exports (`libkernel.prx`, `libSceAgcDriver.prx`, `libScePad.prx`, `libSceAudioOut.prx`, etc.).
  - Instant compatibility scoring and stub detection.

- **📦 PRX System Libraries Manager**:
  - Monitor installed clean-room PRX libraries.
  - Check for latest official releases directly from GitHub.

- **🚀 Native Game Launcher**:
  - One-click play for ported executables (`app.exe` / `app.elf`).
  - Active runtime HUD showing process PID, simulated frame timing, and Vulkan SPIR-V pipeline caches.

---

## 🛠️ Quick Start

### Prerequisites
- Node.js 18+ (tested with Node 22/24)
- npm 10+

### Installation & Run

1. Navigate to the `ui` folder:
```sh
cd ui
```

2. Install dependencies:
```sh
npm install
```

3. Launch development server:
```sh
npm run dev
```

Open your browser at `http://localhost:5173` to explore the PlayStation 5 interface.

4. Build production bundle:
```sh
npm run build
```

---

## 🎯 Architecture

```
ui/
├── electron/              # Electron main and preload bridge
│   ├── main.ts            # Native process management & dialogs
│   └── preload.ts         # Type-safe window.anyps5 bridge
├── src/
│   ├── components/
│   │   ├── TopBar.tsx           # PS5 system navigation bar
│   │   ├── HomeScreen.tsx       # PS5 hero carousel & quick actions
│   │   ├── RelinkerStudio.tsx   # Conversion control center & terminal
│   │   ├── NidInspector.tsx     # NID import compatibility auditor
│   │   ├── PrxManager.tsx       # Clean-room PRX library manager
│   │   ├── TelemetryPanel.tsx   # Zen2 CPU & Vulkan diagnostic suite
│   │   ├── GameLauncherModal.tsx# Running game process HUD
│   │   ├── AddGameModal.tsx     # Game import wizard
│   │   └── SettingsPage.tsx     # In-app configuration preferences
│   ├── services/
│   │   ├── audioService.ts      # Web Audio API PS5 sound synthesizer
│   │   ├── apiBridge.ts         # Cross-environment Electron / Web API
│   │   └── sampleData.ts        # Built-in PS5 game library presets
│   ├── types/                   # TypeScript interfaces
│   ├── App.tsx                  # Main controller
│   ├── main.tsx                 # Entry mount point
│   └── index.css                # PS5 glow & design system
├── package.json
├── tailwind.config.js
└── vite.config.ts
```
