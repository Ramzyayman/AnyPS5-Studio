import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

def run_cmd(cmd, check=True):
    res = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=str(ROOT))
    if check and res.returncode != 0:
        print(f"Command failed: {cmd}\nStderr: {res.stderr}")
        sys.exit(res.returncode)
    return res

def deploy():
    print("Checking for latest anyps5-upstream-core-windows-x64 artifact from GitHub Actions...")
    temp_dir = ROOT / "dist-upstream-download"
    if temp_dir.exists():
        shutil.rmtree(temp_dir)
    temp_dir.mkdir(parents=True, exist_ok=True)

    # Query latest successful run ID
    cmd_run = 'gh run list --branch feature/upstream-sync --workflow build-upstream-core.yml --status success --limit 1 --json databaseId -q ".[0].databaseId"'
    res_run = run_cmd(cmd_run, check=False)
    latest_run_id = res_run.stdout.strip()
    if latest_run_id:
        print(f"Downloading from latest successful build run #{latest_run_id}...")
        cmd = f'gh run download {latest_run_id} --name anyps5-upstream-core-windows-x64 --dir "{temp_dir}" --repo Ramzyayman/AnyPS5-Studio'
    else:
        cmd = f'gh run download --name anyps5-upstream-core-windows-x64 --dir "{temp_dir}" --repo Ramzyayman/AnyPS5-Studio'
    res = run_cmd(cmd, check=False)
    if res.returncode != 0:
        print(f"Could not download artifact directly: {res.stderr.strip()}")
        print("The build job may still be compiling. Check status with: gh run list")
        return False

    downloaded_libs = temp_dir / "libs"
    downloaded_build = temp_dir / "build"

    if not downloaded_libs.exists() and (temp_dir / "anyps5-upstream-core-windows-x64").exists():
        sub = temp_dir / "anyps5-upstream-core-windows-x64"
        if (sub / "libs").exists():
            downloaded_libs = sub / "libs"
            downloaded_build = sub / "build"

    if not downloaded_libs.exists():
        print(f"Error: downloaded artifact structure unexpected in {temp_dir}")
        return False

    # Deploy relinker.exe
    src_relinker = downloaded_build / "relinker.exe"
    if src_relinker.exists():
        target_build = ROOT / "build"
        target_build.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src_relinker, target_build / "relinker.exe")
        print(f"Deployed {src_relinker.name} to {target_build / 'relinker.exe'}")

        unpacked_build = ROOT / "ui" / "dist-installer" / "win-unpacked" / "resources" / "build"
        if unpacked_build.exists():
            shutil.copy2(src_relinker, unpacked_build / "relinker.exe")
            print(f"Deployed {src_relinker.name} to {unpacked_build / 'relinker.exe'}")

    # Deploy PRXs and runtime DLLs
    target_libs = ROOT / "libs"
    target_libs.mkdir(parents=True, exist_ok=True)
    unpacked_libs = ROOT / "ui" / "dist-installer" / "win-unpacked" / "resources" / "libs"

    prx_count = 0
    dll_count = 0
    for item in downloaded_libs.iterdir():
        if item.is_file():
            shutil.copy2(item, target_libs / item.name)
            if unpacked_libs.exists():
                shutil.copy2(item, unpacked_libs / item.name)
            if item.suffix.lower() == '.prx':
                prx_count += 1
            elif item.suffix.lower() == '.dll':
                dll_count += 1

    if (target_libs / "libc.prx").exists():
        overrides_dir = ROOT / "core" / "libs" / "overrides"
        overrides_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(target_libs / "libc.prx", overrides_dir / "libc.prx")

    print(f"Successfully deployed {prx_count} PRX libraries and {dll_count} runtime DLLs to libs/ and unpacked resources.")
    
    # Cleanup temp download
    try:
        shutil.rmtree(temp_dir)
    except Exception:
        pass

    return True

if __name__ == "__main__":
    success = deploy()
    sys.exit(0 if success else 1)
