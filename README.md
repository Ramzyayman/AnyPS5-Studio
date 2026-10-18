# AnyPS5 Studio

<p align="center">
  <img src="https://github.com/Ramzyayman/AnyPS5-Studio/releases/download/v1.1.2/01_HomeScreen_DreamingSarah.png" alt="AnyPS5 Studio Hero" width="950" />
</p>

<p align="center">
  <strong>Native PlayStation 5 Static Binary Relinker & Modern Desktop Gaming Studio</strong>
</p>

<p align="center">
  <a href="https://github.com/Ramzyayman/AnyPS5-Studio/releases"><img src="https://img.shields.io/github/v/release/Ramzyayman/AnyPS5-Studio?include_prereleases&color=0070d1&label=Release" alt="Release" /></a>
  <a href="https://github.com/Ramzyayman/AnyPS5-Studio/actions"><img src="https://img.shields.io/badge/Platforms-Windows%20%7C%20Linux%20x64-34d399" alt="Platforms" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-GPL--2.0-blue.svg" alt="License" /></a>
  <a href="https://github.com/Ramzyayman/AnyPS5-Studio"><img src="https://img.shields.io/badge/Architecture-Static%20Binary%20Relinking-purple" alt="Architecture" /></a>
</p>

---

AnyPS5 Studio is an all-in-one desktop launcher, management interface, and static binary relinker for running decrypted PlayStation 5 executables natively on **Windows x64** and **Linux x64**.

Unlike traditional virtual-machine emulators, AnyPS5 operates via **static binary relinking**. The PlayStation 5 executable (ELF) is analyzed, translated at the machine instruction level, and converted directly into native host executables (`.exe` on Windows, native ELF `.elf` on Linux). Games execute directly on your host CPU and GPU through clean-room high-level emulation (HLE) system libraries and native Vulkan / DirectX 12 rendering pipelines.

[Latest Releases](https://github.com/Ramzyayman/AnyPS5-Studio/releases) | [Architecture Documentation](docs/dev/ARCHITECTURE.md) | [Build Instructions](docs/dev/BUILD.md)

---

## Interface Showcase

### 1. PlayStation 5 Console Experience
Immersive console-grade interface with dynamic background hero artwork, smooth navigation, DualSense wireless controller status, and detailed compatibility breakdowns.

<p align="center">
  <img src="https://github.com/Ramzyayman/AnyPS5-Studio/releases/download/v1.1.2/02_HomeScreen_AstrosPlayroom.png" alt="Home Screen Showcase" width="470" />
  &nbsp;
  <img src="https://github.com/Ramzyayman/AnyPS5-Studio/releases/download/v1.1.2/03_Technical_Specs_Drawer.png" alt="Technical Specs Drawer" width="470" />
</p>

### 2. Dual-Mode Relinker Studio
Convert real PlayStation 5 binaries with a single click in **Simple Mode**, or fine-tune CPU instruction lowering, subsystem targets, and symbol optimization in **Advanced Mode**.

<p align="center">
  <img src="https://github.com/Ramzyayman/AnyPS5-Studio/releases/download/v1.1.2/04_RelinkerStudio_SimpleMode.png" alt="Relinker Studio Simple Mode" width="470" />
  &nbsp;
  <img src="https://github.com/Ramzyayman/AnyPS5-Studio/releases/download/v1.1.2/05_RelinkerStudio_AdvancedMode.png" alt="Relinker Studio Advanced Mode" width="470" />
</p>

### 3. State-Driven Game Launcher & Real-Time Telemetry
Monitors active game sessions with live elapsed playtime tracking, Vulkan pipeline counters, genuine CPU instruction extension checks, and high-performance discrete GPU prioritization.

<p align="center">
  <img src="https://github.com/Ramzyayman/AnyPS5-Studio/releases/download/v1.1.2/10_GameLauncher_ActiveSession.png" alt="State-Driven Game Launcher" width="470" />
  &nbsp;
  <img src="https://github.com/Ramzyayman/AnyPS5-Studio/releases/download/v1.1.2/08_SystemTelemetry.png" alt="System Hardware Telemetry" width="470" />
</p>

### 4. Compatibility Auditor & Clean-Room System PRXs
Inspect imported function NIDs, discover missing middleware stubs, and manage installed clean-room PlayStation 5 system libraries.

<p align="center">
  <img src="https://github.com/Ramzyayman/AnyPS5-Studio/releases/download/v1.1.2/06_NidInspector.png" alt="PlayStation 5 NID Inspector" width="470" />
  &nbsp;
  <img src="https://github.com/Ramzyayman/AnyPS5-Studio/releases/download/v1.1.2/07_PrxLibraries.png" alt="Clean-Room PRX Modules" width="470" />
</p>

---

## Key Features

### PlayStation 5 Styled Interface
- Console-grade user experience featuring dark aesthetic, fluid navigation, cover artwork presentation, and audio feedback.
- Modern frameless desktop window design with native window dragging, double-click to maximize, and integrated window controls.
- Real-time gamepad integration with DualSense wireless controller status and input mapping.

### Dual-Mode Relinker Studio
- **Simple Mode**: A streamlined workflow designed for non-technical users. Displays cover art, verifies system readiness, automatically configures optimal instruction lowering, and starts relinking with a single click.
- **Advanced Mode**: Full technical controls for developers and power users, including target OS (Windows vs. Linux), subsystem flags (GUI vs. Console), CPU codegen lowering (AMD Zen2 native, Intel AVX2, Rosetta 2), and import dead-code pruning.
- **Safe Relinker Defaults**: Configured to preserve all non-PLT import relocations, dynamic C++ virtual method tables, RTTI structures, and standard error categories, eliminating runtime `0xC0000005` access violation crashes.
- **Automated Middleware Discovery**: Automatically scans game directories and subdirectories to locate, unwrap, and convert guest middleware PRXs (such as `libcohtml`, `libfmod`, and `MediaDecoders`).

### State-Driven Game Launcher
- Integrated launch monitor that tracks real child process events and startup progression without exposing raw developer clutter.
- Active session playtime tracking with live telemetry.
- Intelligent process exit diagnostics that distinguish between clean exits, user stops, and crashes, providing clear remedies when an error occurs.
- Collapsible Technical Details drawer with color-coded standard output and PRX logs, accompanied by a 1-click diagnostic report exporter.

### Automatic Background Updates
- Native integration with GitHub Releases. AnyPS5 Studio automatically checks for application updates, updated relinker engines, and newly stubbed clean-room system libraries in the background.

---

## Getting Started

### Installation

#### Windows
1. Download `AnyPS5-Studio-Setup-x.x.x.exe` from the [Releases](https://github.com/Ramzyayman/AnyPS5-Studio/releases) page.
2. Run the installer to set up AnyPS5 Studio on your PC. The installer bundles the relinker engine, clean-room system libraries (`libs/`), and runtime DLLs out of the box.

#### Linux
1. Download `AnyPS5-Studio-x.x.x.AppImage` from the [Releases](https://github.com/Ramzyayman/AnyPS5-Studio/releases) page.
2. Make the file executable:
   ```bash
   chmod +x AnyPS5-Studio-*.AppImage
   ./AnyPS5-Studio-*.AppImage
   ```

### Usage
1. Launch **AnyPS5 Studio**.
2. Click **Import PS5 Title** and select the folder of your decrypted PlayStation 5 title (containing `eboot.bin`, `eboot.elf`, or `app0/`).
3. Select your game and click **Relink** (or navigate to **Relinker Studio**).
4. Review the automatically selected configuration and click **Start Relinking Process**.
5. Once conversion completes, click **Play Game** to launch the ported executable natively on your system.

---

## Technical Architecture

AnyPS5 operates across three primary layers:

1. **Relinker Core**: Parses decrypted PlayStation 5 ELF binaries, reconstructs program headers and sections, lowers AMD Zen2 instructions into Intel AVX2 equivalents when necessary, and produces a native 64-bit Windows PE (`app.exe`) or native Linux ELF (`app.elf`).
2. **Clean-Room System Libraries (`libs/`)**: High-level reimplementations of PlayStation system modules (`libkernel.prx`, `libScePad.prx`, `libSceAudioOut.prx`, `libSceSaveData.prx`, `libSceVideoOut.prx`, `libSceAgc.prx`, etc.) compiled as native dynamic libraries.
3. **Graphics & Shaders**: PS5 AGC shader bytecode is translated to standard SPIR-V via the built-in shader recompiler, targeting modern DirectX 12 and Vulkan rendering pipelines.

---

## System Requirements

- **Operating System**: Windows 10/11 (64-bit) or Linux (x86-64 glibc 2.31+, e.g. Ubuntu 22.04+, Arch Linux, CachyOS, Fedora 38+).
- **Processor**: x86-64 CPU supporting AVX2 instructions (Intel 4th Generation Core or newer, AMD Ryzen series).
- **Graphics Card**: GPU with Vulkan 1.3 or DirectX 12 driver support (NVIDIA GeForce, AMD Radeon, or Intel Arc).
- **Memory**: 16 GB RAM recommended.
- **Game Files**: Decrypted PlayStation 5 software dump obtained legally from your own hardware.

---

## Disclaimer

This project is developed solely for interoperability, research, software preservation, and compatibility purposes.

AnyPS5 Studio does not include, distribute, or require copyrighted software, console firmware, cryptographic master keys, or proprietary binary dumps. Users are strictly responsible for dumping and decrypting their own legally purchased games in accordance with applicable copyright laws.

PlayStation and PS5 are registered trademarks of Sony Interactive Entertainment Inc. This project is independent and has no affiliation with or endorsement from Sony Interactive Entertainment.

---

## License

This project is licensed under the GNU General Public License version 2 (GPL-2.0). See [LICENSE](LICENSE) for details.
