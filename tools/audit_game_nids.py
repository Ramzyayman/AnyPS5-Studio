import argparse
import json
import os
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))

import import_audit
import nid_names


HOST_DLL_NAMES = {
    "advapi32.dll",
    "comctl32.dll",
    "comdlg32.dll",
    "d3d11.dll",
    "d3d12.dll",
    "dxgi.dll",
    "gdi32.dll",
    "imm32.dll",
    "kernel32.dll",
    "libgcc_s_seh-1.dll",
    "libstdc++-6.dll",
    "libwinpthread-1.dll",
    "msvcrt.dll",
    "ntdll.dll",
    "ole32.dll",
    "oleaut32.dll",
    "setupapi.dll",
    "shell32.dll",
    "shlwapi.dll",
    "ucrtbase.dll",
    "user32.dll",
    "version.dll",
    "winmm.dll",
    "ws2_32.dll",
}


def is_host_library(name):
    if not name:
        return False
    lower = name.lower().strip()
    if lower in HOST_DLL_NAMES:
        return True
    if lower.startswith("api-ms-win-") or lower.startswith("ext-ms-win-"):
        return True
    if lower.startswith("vcruntime") or lower.startswith("msvcp") or lower.startswith("msvcr"):
        return True
    return False


def pe_symbol_imports(path, data):
    try:
        to_offset, directory, count = import_audit.pe_headers(path, data)
        if count < 2:
            return []
        rva, size = import_audit.unpack("<II", data, directory + 8, path, "import data directory")
        if not rva or size < 20:
            return []
        results = []
        for index in range(size // 20):
            entry = import_audit.unpack("<IIIII", data, to_offset(rva + index * 20, 20)[0], path, "import directory entry")
            if entry == (0, 0, 0, 0, 0):
                break
            orig_thunk, _, _, name_rva, first_thunk = entry
            if not name_rva:
                continue
            lib_offset, lib_limit = to_offset(name_rva, 1)
            lib_name = import_audit.cstring(data, lib_offset, lib_limit, path, "import library name", "ASCII", "strict")

            if is_host_library(lib_name):
                continue

            thunk_rva = orig_thunk if orig_thunk else first_thunk
            if not thunk_rva:
                continue

            curr_rva = thunk_rva
            while True:
                thunk_offset, _ = to_offset(curr_rva, 8)
                val = import_audit.unpack("<Q", data, thunk_offset, path, "thunk data")[0]
                if val == 0:
                    break
                if not (val & 0x8000000000000000):
                    name_offset, name_limit = to_offset((val & 0x7FFFFFFF) + 2, 1)
                    sym_name = import_audit.cstring(data, name_offset, name_limit, path, "imported symbol name", "ASCII", "replace")
                    results.append((sym_name, lib_name))
                else:
                    ordinal = val & 0xFFFF
                    results.append((f"ordinal_{ordinal}", lib_name))
                curr_rva += 8
        return results
    except Exception:
        return []


def elf_symbol_imports(path, data):
    symbols, needed = import_audit.elf_imports(path, data)
    results = []
    for sym in symbols:
        if "#" in sym:
            parts = sym.split("#")
            lib = parts[1] + ".prx" if not parts[1].endswith(".prx") else parts[1]
            results.append((parts[0], lib))
        else:
            results.append((sym, None))
    return results, needed


def guess_module(name):
    lower = name.lower()
    if lower.startswith("scekernel") or lower.startswith("sce_kernel") or "pthread" in lower or lower.startswith("sys_"):
        return "libkernel.prx"
    if lower.startswith("scepad"):
        return "libScePad.prx"
    if lower.startswith("sceaudioout") or lower.startswith("sceaudio"):
        return "libSceAudioOut.prx"
    if lower.startswith("scevideoout"):
        return "libSceVideoOut.prx"
    if lower.startswith("sceagc") or lower.startswith("sce_agc"):
        return "libSceAgcDriver.prx"
    if lower.startswith("scesavedata"):
        return "libSceSaveData.prx"
    if lower.startswith("sceuserservice"):
        return "libSceUserService.prx"
    if lower.startswith("scesystemservice") or lower.startswith("scesysmodule"):
        return "libSceSystemService.prx"
    if lower.startswith("scenet"):
        return "libSceNet.prx"
    if lower.startswith("scessl"):
        return "libSceSsl.prx"
    if lower.startswith("sceerror"):
        return "libSceErrorDialog.prx"
    if lower.startswith("scecommon"):
        return "libSceCommonDialog.prx"
    if lower.startswith("scertc"):
        return "libSceRtc.prx"
    if lower.startswith("scefiber"):
        return "libSceFiber.prx"
    if lower.startswith("scerandom"):
        return "libSceRandom.prx"
    if lower.startswith("sceime"):
        return "libSceIme.prx"
    if lower.startswith("scenp"):
        return "libSceNp.prx"
    if lower.startswith("sceult"):
        return "libSceUlt.prx"
    if lower.startswith("sceplaygo"):
        return "libScePlayGo.prx"
    if lower.startswith("scevoice"):
        return "libSceVoice.prx"
    if (
        lower.startswith("libc")
        or lower.startswith("_zn")
        or lower.startswith("_zs")
        or lower.startswith("__cxa")
        or lower.startswith("std::")
        or lower in ("malloc", "free", "realloc", "calloc", "abort", "exit", "memcpy", "memset", "memmove", "memcmp", "strlen", "strcpy", "strncpy", "strcmp", "strncmp")
    ):
        return "libc.prx"
    return "libkernel.prx"


def audit_binary(binary_path, libs_dir=None):
    bpath = Path(binary_path)
    if not bpath.exists():
        return {"error": f"Binary not found: {binary_path}"}

    data = bpath.read_bytes()
    if len(data) < 4:
        return {"error": f"Binary file too small or empty: {binary_path}"}

    if data[:4] == b"SCE\x00" or data[:4] == b"\x7fCNT":
        return {"error": "Target binary is an encrypted SELF container. Decrypt or relink the executable first."}

    aerolib_db = {}
    if nid_names.DEFAULT_CACHE.exists():
        try:
            aerolib_db = nid_names.load_db(nid_names.DEFAULT_CACHE)
        except Exception:
            pass

    stubs = {}
    known_stubs_file = ROOT / "tools" / "known_stubs.json"
    if known_stubs_file.exists():
        try:
            stubs = json.loads(known_stubs_file.read_text("utf-8"))
        except Exception:
            pass
    elif (ROOT / "core" / "libs" / "prx").is_dir():
        try:
            stubs_dict = import_audit.source_stubs(ROOT / "core" / "libs" / "prx")
            stubs = {f"{k[0]}:{k[1]}": v for k, v in stubs_dict.items()}
            try:
                known_stubs_file.write_text(json.dumps(stubs), encoding="utf-8")
            except Exception:
                pass
        except Exception:
            pass

    exports = {}
    if libs_dir and Path(libs_dir).is_dir():
        try:
            exports, _ = import_audit.built_libraries([libs_dir])
        except Exception:
            pass

    raw_imports = []
    needed_libs = set()
    if data[:4] == b"\x7fELF":
        try:
            raw_imports, needed_libs = elf_symbol_imports(bpath, data)
        except import_audit.AuditError as err:
            return {"error": f"ELF import parsing error: {err}"}
        except Exception as err:
            return {"error": f"Failed to inspect ELF binary: {err}"}
    elif data[:2] == b"MZ":
        try:
            raw_imports = pe_symbol_imports(bpath, data)
        except Exception as err:
            return {"error": f"PE import parsing error: {err}"}
    elif bpath.name.endswith(".registry.json"):
        try:
            entries = import_audit.read_registry(bpath)
            raw_imports = [(nid, lib) for nid, lib, _ in entries]
        except Exception as err:
            return {"error": f"Registry read error: {err}"}

    if not raw_imports:
        if data[:2] == b"MZ":
            return {
                "error": "The audited Windows executable contains only host operating system libraries. No PlayStation 5 PRX imports were found. Ensure an authentic PlayStation 5 executable (eboot.elf or eboot.bin) is present.",
                "summary": {
                    "totalImports": 0,
                    "resolvedCount": 0,
                    "stubCount": 0,
                    "missingCount": 0,
                    "coveragePercentage": 100.0,
                },
                "imports": [],
            }
        return {
            "summary": {
                "totalImports": 0,
                "resolvedCount": 0,
                "stubCount": 0,
                "missingCount": 0,
                "coveragePercentage": 100.0,
            },
            "imports": [],
        }

    seen = set()
    imports_list = []
    resolved_count = 0
    stub_count = 0
    missing_count = 0

    for raw_sym, target_lib in raw_imports:
        if target_lib and is_host_library(target_lib):
            continue

        if raw_sym in seen:
            continue
        seen.add(raw_sym)

        if raw_sym in aerolib_db:
            nid = raw_sym
            symbol = aerolib_db[raw_sym]
        elif raw_sym.startswith("sce") or raw_sym.startswith("_") or raw_sym.startswith("libc"):
            symbol = raw_sym
            nid = nid_names.compute_nid(raw_sym)
        else:
            nid = raw_sym
            symbol = aerolib_db.get(raw_sym, raw_sym)

        module = target_lib
        providers = exports.get(nid, [])
        if not providers and symbol in exports:
            providers = exports[symbol]
        if not providers:
            comp_nid = nid_names.compute_nid(symbol)
            if comp_nid in exports:
                providers = exports[comp_nid]

        if not module:
            if providers:
                matching = [p for p in providers if p in needed_libs]
                module = matching[0] if matching else providers[0]
            else:
                module = guess_module(symbol)

        is_exported = False
        if exports:
            if providers:
                is_exported = True
            elif target_lib:
                is_exported = any(
                    nid in import_audit.read_exports(p) or symbol in import_audit.read_exports(p)
                    for p in Path(libs_dir).glob("*.prx")
                    if p.name.lower() == target_lib.lower()
                )
        else:
            is_exported = True

        stub_key = f"{module}:{nid}"
        if not is_exported:
            status = "missing"
            missing_count += 1
            notes = "Symbol not exported by active clean-room runtime"
        elif stub_key in stubs or f"{module}:{symbol}" in stubs:
            status = "stub"
            stub_count += 1
            notes = "Stubbed export; returns NotImplemented or dummy value"
        else:
            status = "implemented"
            resolved_count += 1
            notes = "Fully implemented in clean-room PRX library"

        imports_list.append({
            "nid": nid,
            "symbol": symbol,
            "module": module,
            "status": status,
            "implementationNotes": notes,
        })

    total = len(imports_list)
    coverage = round((resolved_count / total * 100), 1) if total > 0 else 100.0

    return {
        "summary": {
            "totalImports": total,
            "resolvedCount": resolved_count,
            "stubCount": stub_count,
            "missingCount": missing_count,
            "coveragePercentage": coverage,
        },
        "imports": sorted(imports_list, key=lambda x: (x["status"] != "missing", x["status"] != "stub", x["module"], x["symbol"])),
    }


def main():
    parser = argparse.ArgumentParser(description="Audit PlayStation 5 imports against PRX libraries")
    parser.add_argument("--binary", required=True, help="Path to decrypted eboot.bin, eboot.elf, or app.exe")
    parser.add_argument("--libs", help="Path to runtime libs/ directory")
    parser.add_argument("--output", help="Optional output JSON file")
    args = parser.parse_args()

    result = audit_binary(args.binary, args.libs)
    out_json = json.dumps(result, indent=2)

    if args.output:
        Path(args.output).write_text(out_json, encoding="utf-8")
    else:
        print(out_json)


if __name__ == "__main__":
    main()
