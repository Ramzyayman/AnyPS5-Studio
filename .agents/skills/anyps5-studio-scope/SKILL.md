---
name: anyps5-studio-scope
description: >-
  Enforces AnyPS5 Studio boundary rules and diagnostic protocols. Use whenever
  investigating game crashes, launch failures, or bugs to ensure changes are
  restricted strictly to the AnyPS5 Studio launcher layer (ui/) and never to
  core AnyPS5 system libraries, the relinker, or game binaries.
---

# AnyPS5 Studio Scope & Problem Diagnosis Runbook

Use this skill whenever a game launch failure, crash, or bug is reported in AnyPS5 Studio.

## Core Principle

We are only responsible for issues caused by **AnyPS5 Studio** or problems that can be solved via AnyPS5 Studio configurations. We do **not** modify, patch, or maintain AnyPS5 core system libraries, the relinker tool, or game binaries.

---

## Step 1: Launcher-Level Diagnostic Checklist

Always verify the following launcher responsibilities first:

1. **Runtime Layout & Pathing**:
   - Is the game path valid?
   - Is the `libs/` directory present and populated with the appropriate clean-room PRX files?
   - Is `app0/` flattened properly if an `app0/app0` nesting existed?
   - Is `PATH` set correctly on the child process to include the executable root, `libs/`, and `app0/`?

2. **Relinker Configuration**:
   - Are the selected relinker flags appropriate for the host hardware and title?
   - Is Unused Import Optimization set to Level 0 (Safe / Full Compatibility) if virtual tables or dynamic function pointers were stripped?
   - Is CPU Translation set appropriately (e.g. `--to-intel` for Intel hosts)?

3. **User Settings & Resource Synchronization**:
   - Does `anyps5_settings.json` point to valid `relinkerPath` and `prxPath` locations?
   - Were runtime PRXs properly synced to the title's execution directory?

If the failure stems from any of the above, fix it within [`ui/`](file:///c:/Users/PC/.gemini/antigravity/scratch/AnyPS5/ui).

---

## Step 2: Classifying Upstream AnyPS5 Core & Game Incompatibilities

If the launcher configuration is verified correct and the process fails during runtime:

1. **Missing / Unimplemented PS5 System Calls**:
   - Failure: `Unimplemented PlayStation 5 API`, `NotImplemented_nid_no_patch`.
   - Action: Report the missing API/NID to the user. Do not implement or stub the PRX function.

2. **System Library Faults**:
   - Failure: Access violations (`0xC0000005`), aborts (`SIGABRT`), or memory faults inside `libkernel.prx`, `libc.prx`, `libSceAgcDriver.prx`, etc.
   - Action: Explain the exact runtime failure clearly to the user as an upstream AnyPS5 compatibility limitation. Do not edit `core/libs/prx/`.

3. **Game Binary Logic & Internal Checks**:
   - Failure: Game loops exiting cleanly (`Exit Code: 0`), telemetry checks, or anti-tamper assertions.
   - Action: Report the behavior to the user. Do not disassemble and binary-patch game executables (`app.exe`).

---

## Boundaries Summary

Area | Action Allowed?
:--- | :---
`ui/**` (Electron, React, Vite, launcher scripts) | Yes (Fix and maintain)
`anyps5_settings.json` / Launcher configs | Yes (Fix and maintain)
`core/libs/prx/**` (libkernel, libc, libSce*, etc.) | No (Strictly prohibited)
`core/relinker/**` (Relinker C++ codebase) | No (Strictly prohibited)
Game executables (`app.exe`, `eboot.bin`, etc.) | No (Strictly prohibited)
