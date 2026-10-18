import argparse
import json
import os
import shutil
import subprocess
import sys
import tarfile
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

def run_cmd(cmd, check=True):
    res = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=str(ROOT))
    if check and res.returncode != 0:
        print(f"Command failed: {cmd}\nStderr: {res.stderr}")
        sys.exit(res.returncode)
    return res

def deploy(target_platform):
    is_linux = (target_platform == "linux")
    artifact_name = "anyps5-upstream-core-linux-x64" if is_linux else "anyps5-upstream-core-windows-x64"
    relinker_bin_name = "relinker" if is_linux else "relinker.exe"

    print(f"Checking for latest {artifact_name} artifact from GitHub Actions...")
    temp_dir = ROOT / f"dist-upstream-download-{target_platform}"
    if temp_dir.exists():
        shutil.rmtree(temp_dir)
    temp_dir.mkdir(parents=True, exist_ok=True)

    downloaded = False

    cmd_run = 'gh run list --workflow build-upstream-core.yml --status success --limit 1 --json databaseId -q ".[0].databaseId"'
    res_run = run_cmd(cmd_run, check=False)
    latest_run_id = res_run.stdout.strip()
    if latest_run_id:
        print(f"Downloading from latest successful build run #{latest_run_id}...")
        cmd = f'gh run download {latest_run_id} --name {artifact_name} --dir "{temp_dir}" --repo Ramzyayman/AnyPS5-Studio'
    else:
        cmd = f'gh run download --name {artifact_name} --dir "{temp_dir}" --repo Ramzyayman/AnyPS5-Studio'
    
    res = run_cmd(cmd, check=False)
    if res.returncode == 0:
        downloaded = True
    else:
        print(f"Could not download GitHub Actions artifact: {res.stderr.strip()}")
        print("Attempting upstream GitHub release fallback...")

    if not downloaded:
        try:
            target_build = ROOT / "build"
            target_build.mkdir(parents=True, exist_ok=True)
            target_libs = ROOT / "libs"
            target_libs.mkdir(parents=True, exist_ok=True)

            if is_linux:
                relinker_url = "https://github.com/boykopovar/AnyPS5/releases/download/v0.1.2/relinker-v0.1.2"
                prx_url = "https://github.com/boykopovar/AnyPS5/releases/download/v0.1.2/prx-linux-v0.1.2.tar.gz"
                print(f"Downloading relinker from {relinker_url}...")
                relinker_dst = target_build / "relinker"
                urllib.request.urlretrieve(relinker_url, relinker_dst)
                try:
                    os.chmod(relinker_dst, 0o755)
                except OSError:
                    pass

                print(f"Downloading PRX bundle from {prx_url}...")
                tar_dst = temp_dir / "prx-linux.tar.gz"
                urllib.request.urlretrieve(prx_url, tar_dst)
                with tarfile.open(tar_dst, "r:gz") as tar:
                    tar.extractall(path=temp_dir)
            else:
                relinker_url = "https://github.com/boykopovar/AnyPS5/releases/download/v0.1.2/relinker-v0.1.2.exe"
                prx_url = "https://github.com/boykopovar/AnyPS5/releases/download/v0.1.2/prx-windows-v0.1.2.zip"
                print(f"Downloading relinker from {relinker_url}...")
                relinker_dst = target_build / "relinker.exe"
                urllib.request.urlretrieve(relinker_url, relinker_dst)

                print(f"Downloading PRX bundle from {prx_url}...")
                zip_dst = temp_dir / "prx-windows.zip"
                urllib.request.urlretrieve(prx_url, zip_dst)
                with zipfile.ZipFile(zip_dst, "r") as zf:
                    zf.extractall(path=temp_dir)

            extracted_libs = temp_dir / "libs"
            if not extracted_libs.exists() and (temp_dir / "prx").exists():
                extracted_libs = temp_dir / "prx"
            if not extracted_libs.exists():
                extracted_libs = temp_dir

            for item in extracted_libs.glob("**/*"):
                if item.is_file() and (item.suffix.lower() in [".prx", ".dll"]):
                    shutil.copy2(item, target_libs / item.name)
                    if is_linux:
                        try:
                            os.chmod(target_libs / item.name, 0o755)
                        except OSError:
                            pass

            print("Successfully deployed core assets via release fallback.")
            shutil.rmtree(temp_dir, ignore_errors=True)
            return True
        except Exception as e:
            print(f"Fallback download failed: {e}")
            shutil.rmtree(temp_dir, ignore_errors=True)
            return False

    downloaded_libs = temp_dir / "libs"
    downloaded_build = temp_dir / "build"

    if not downloaded_libs.exists() and (temp_dir / artifact_name).exists():
        sub = temp_dir / artifact_name
        if (sub / "libs").exists():
            downloaded_libs = sub / "libs"
            downloaded_build = sub / "build"

    if not downloaded_libs.exists():
        print(f"Error: downloaded artifact structure unexpected in {temp_dir}")
        shutil.rmtree(temp_dir, ignore_errors=True)
        return False

    src_relinker = downloaded_build / relinker_bin_name
    target_build = ROOT / "build"
    target_build.mkdir(parents=True, exist_ok=True)
    if src_relinker.exists():
        dst_bin = target_build / relinker_bin_name
        shutil.copy2(src_relinker, dst_bin)
        if is_linux:
            try:
                os.chmod(dst_bin, 0o755)
            except OSError:
                pass
        print(f"Deployed {src_relinker.name} to {dst_bin}")

        unpacked_build = ROOT / "ui" / "dist-installer" / ("linux-unpacked" if is_linux else "win-unpacked") / "resources" / "build"
        if unpacked_build.exists():
            shutil.copy2(src_relinker, unpacked_build / relinker_bin_name)
            if is_linux:
                try:
                    os.chmod(unpacked_build / relinker_bin_name, 0o755)
                except OSError:
                    pass
            print(f"Deployed {src_relinker.name} to {unpacked_build / relinker_bin_name}")

    target_libs = ROOT / "libs"
    target_libs.mkdir(parents=True, exist_ok=True)
    unpacked_libs = ROOT / "ui" / "dist-installer" / ("linux-unpacked" if is_linux else "win-unpacked") / "resources" / "libs"

    prx_count = 0
    lib_count = 0
    for item in downloaded_libs.iterdir():
        if item.is_file():
            dst = target_libs / item.name
            shutil.copy2(item, dst)
            if is_linux:
                try:
                    os.chmod(dst, 0o755)
                except OSError:
                    pass
            if unpacked_libs.exists():
                shutil.copy2(item, unpacked_libs / item.name)
                if is_linux:
                    try:
                        os.chmod(unpacked_libs / item.name, 0o755)
                    except OSError:
                        pass
            if item.suffix.lower() == '.prx':
                prx_count += 1
            elif item.suffix.lower() in ['.dll', '.so']:
                lib_count += 1

    print(f"Successfully deployed {prx_count} PRX libraries and {lib_count} runtime libraries to libs/ and unpacked resources.")

    try:
        shutil.rmtree(temp_dir, ignore_errors=True)
    except Exception:
        pass

    return True

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Deploy AnyPS5 upstream core binaries")
    parser.add_argument("--platform", choices=["windows", "linux"], default="linux" if sys.platform.startswith("linux") else "windows")
    args = parser.parse_args()

    success = deploy(args.platform)
    sys.exit(0 if success else 1)
