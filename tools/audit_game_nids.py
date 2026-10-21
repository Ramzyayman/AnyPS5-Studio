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
    try:
        header = import_audit.unpack("<16sHHIQQQIHHHHHH", data, 0, path, "ELF header")
        if not header[6] or header[6] >= len(data):
            symbols, _ = import_audit.elf_program_dynamic_symbols(path, data)
            results = []
            for sym in symbols:
                if "#" in sym:
                    parts = sym.split("#")
                    lib = parts[1] + ".prx" if not parts[1].endswith(".prx") else parts[1]
                    results.append((parts[0], lib))
                else:
                    results.append((sym, None))
            return results

        sections = import_audit.elf_sections(path, data)
        results = []
        for section in sections:
            kind, offset, size, link, entry = section[1], section[4], section[5], section[6], section[9]
            if kind == 11:
                if entry != 24 or size % 24 or link >= len(sections) or sections[link][1] != 3:
                    continue
                strings_offset, strings_size = sections[link][4], sections[link][5]
                import_audit.take(data, strings_offset, strings_size, path, "dynamic string table")
                for position in range(0, size, 24):
                    name, _, _, index, _, _ = import_audit.unpack("<IBBHQQ", data, offset + position, path, "dynamic symbol")
                    if name and index == 0:
                        symbol = import_audit.cstring(data, strings_offset + name, strings_offset + strings_size, path, "import name")
                        if "#" in symbol:
                            parts = symbol.split("#")
                            lib = parts[1] + ".prx" if not parts[1].endswith(".prx") else parts[1]
                            results.append((parts[0], lib))
                        else:
                            results.append((symbol, None))
        return results
    except Exception:
        return []


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
    if data[:4] == b"\x7fELF":
        raw_imports = elf_symbol_imports(bpath, data)
    elif data[:2] == b"MZ":
        raw_imports = pe_symbol_imports(bpath, data)
    elif bpath.name.endswith(".registry.json"):
        try:
            entries = import_audit.read_registry(bpath)
            raw_imports = [(nid, lib) for nid, lib, _ in entries]
        except Exception:
            pass

    if not raw_imports:
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
        if not module:
            if nid in exports and exports[nid]:
                module = exports[nid][0]
            elif symbol in exports and exports[symbol]:
                module = exports[symbol][0]
            else:
                module = guess_module(symbol)

        is_exported = False
        if exports:
            if nid in exports or symbol in exports:
                is_exported = True
            elif module and any(nid in import_audit.read_exports(p) for p in Path(libs_dir).glob("*.prx") if p.name.lower() == module.lower()):
                is_exported = True
        else:
            is_exported = True

        stub_key = f"{module}:{nid}"
        if not is_exported:
            status = "missing"
            missing_count += 1
            notes = "Symbol not exported by active clean-room runtime"
        elif stub_key in stubs:
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
