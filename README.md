# AnyPS5 Studio

AnyPS5 Studio is an all-in-one desktop launcher, management interface, and static binary relinker for running decrypted PlayStation 5 executables natively on Windows x64.

Unlike traditional virtual-machine emulators, AnyPS5 uses static binary relinking. The PlayStation 5 executable (ELF) is analyzed, translated at the machine instruction level, and converted directly into a native Windows PE executable (`.exe`). The game executes directly on your host CPU and GPU through clean-room high-level emulation (HLE) system libraries and DirectX 12 / Vulkan display pipelines.

[Latest Releases](https://github.com/Ramzyayman/AnyPS5-Studio/releases) | [Architecture Documentation](docs/dev/ARCHITECTURE.md) | [Build Instructions](docs/dev/BUILD.md)

---

## Key Features

### PlayStation 5 Styled Interface
- Console-grade user experience featuring dark aesthetic, fluid navigation, cover artwork presentation, and audio feedback.
- Modern frameless desktop window design with native window dragging, double-click to maximize, and integrated window controls.
- Real-time gamepad integration with DualSense wireless controller status and input mapping.

### Dual-Mode Relinker Studio
- **Simple Mode**: A streamlined workflow designed for non-technical users. Displays cover art, verifies system readiness, automatically configures optimal instruction lowering, and starts relinking with a single click.
- **Advanced Mode**: Full technical controls for developers and power users, including target OS, subsystem flags (GUI vs. Console), CPU codegen lowering (AMD Zen2 native, Intel AVX2, Rosetta 2), and import dead-code pruning.
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
1. Download the latest installer (`AnyPS5-Studio-Setup-x.x.x.exe`) from the [Releases](https://github.com/Ramzyayman/AnyPS5-Studio/releases) page.
2. Run the installer to set up AnyPS5 Studio on your PC. The installer bundles the relinker engine, clean-room system libraries (`libs/`), and runtime DLLs out of the box.

### Usage
1. Launch **AnyPS5 Studio**.
2. Click **Import** and select the folder of your decrypted PlayStation 5 title (containing `eboot.elf` or `app0/`).
3. Select your game and click **Relink** (or navigate to **Relinker Studio**).
4. Review the automatically selected configuration and click **Start Relinking**.
5. Once conversion completes, click **Play Game** to launch the ported executable natively on your system.

---

## Technical Architecture

AnyPS5 operates across three primary layers:

1. **Relinker Core**: Parses decrypted PlayStation 5 ELF binaries, reconstructs program headers and sections, lowers AMD Zen2 instructions into Intel AVX2 equivalents when necessary, and produces a native 64-bit Windows PE (`app.exe`).
2. **Clean-Room System Libraries (`libs/`)**: High-level reimplementations of PlayStation system modules (`libkernel.prx`, `libScePad.prx`, `libSceAudioOut.prx`, `libSceSaveData.prx`, `libSceAgc.prx`, etc.) compiled as Windows-compatible dynamic libraries.
3. **Graphics & Shaders**: PS5 AGC shader bytecode is translated to standard SPIR-V via the built-in shader recompiler, targeting modern DirectX 12 and Vulkan rendering pipelines.

---

## System Requirements

- **Operating System**: Windows 10 or Windows 11 (64-bit).
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
