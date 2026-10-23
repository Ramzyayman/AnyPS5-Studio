import argparse
import os
import shutil
import subprocess
import sys
import tarfile
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

UPSTREAM_VERSION = "v0.1.2"
WINDOWS_AGC_DRIVER_SIZE = 12989911

RELEASE_ASSETS = {
    "windows": {
        "relinker_url": f"https://github.com/boykopovar/AnyPS5/releases/download/{UPSTREAM_VERSION}/relinker-{UPSTREAM_VERSION}.exe",
        "relinker_bin": "relinker.exe",
        "prx_url": f"https://github.com/boykopovar/AnyPS5/releases/download/{UPSTREAM_VERSION}/prx-windows-{UPSTREAM_VERSION}.zip",
        "archive_type": "zip",
    },
    "linux": {
        "relinker_url": f"https://github.com/boykopovar/AnyPS5/releases/download/{UPSTREAM_VERSION}/relinker-{UPSTREAM_VERSION}",
        "relinker_bin": "relinker",
        "prx_url": f"https://github.com/boykopovar/AnyPS5/releases/download/{UPSTREAM_VERSION}/prx-linux-{UPSTREAM_VERSION}.tar.gz",
        "archive_type": "tar.gz",
    },
}

def download_file(url: str, dest_path: Path) -> bool:
    print(f"Downloading {url} -> {dest_path}...")
    dest_path.parent.mkdir(parents=True, exist_ok=True)

    curl_cmd = f'curl -sSL -f --retry 3 --retry-delay 2 -o "{dest_path}" "{url}"'
    res = subprocess.run(curl_cmd, shell=True, capture_output=True, text=True)
    if res.returncode == 0 and dest_path.exists() and dest_path.stat().st_size > 0:
        return True

    try:
        req = urllib.request.Request(url, headers={"User-Agent": "AnyPS5-Studio-Deploy/1.4.5"})
        with urllib.request.urlopen(req, timeout=120) as resp, open(dest_path, "wb") as out:
            shutil.copyfileobj(resp, out)
        return dest_path.exists() and dest_path.stat().st_size > 0
    except Exception as e:
        print(f"Download failed for {url}: {e}")
        return False

def deploy(target_platform: str) -> bool:
    is_linux = (target_platform == "linux")
    cfg = RELEASE_ASSETS.get(target_platform)
    if not cfg:
        print(f"Unsupported target platform: {target_platform}")
        return False

    relinker_bin_name = cfg["relinker_bin"]
    temp_dir = ROOT / f"dist-upstream-download-{target_platform}"
    if temp_dir.exists():
        shutil.rmtree(temp_dir, ignore_errors=True)
    temp_dir.mkdir(parents=True, exist_ok=True)

    print(f"Deploying official upstream core {UPSTREAM_VERSION} for {target_platform}...")

    # 1. Download official relinker binary
    temp_relinker = temp_dir / relinker_bin_name
    if not download_file(cfg["relinker_url"], temp_relinker):
        print(f"ERROR: Failed to download official relinker binary from {cfg['relinker_url']}")
        shutil.rmtree(temp_dir, ignore_errors=True)
        return False

    # 2. Download official PRX archive
    archive_ext = ".zip" if cfg["archive_type"] == "zip" else ".tar.gz"
    archive_path = temp_dir / f"prx-archive{archive_ext}"
    if not download_file(cfg["prx_url"], archive_path):
        print(f"ERROR: Failed to download official PRX archive from {cfg['prx_url']}")
        shutil.rmtree(temp_dir, ignore_errors=True)
        return False

    # 3. Extract PRX archive
    extract_dir = temp_dir / "extracted"
    extract_dir.mkdir(parents=True, exist_ok=True)
    print(f"Extracting PRX archive ({archive_path.name})...")
    try:
        if cfg["archive_type"] == "zip":
            with zipfile.ZipFile(archive_path, "r") as zf:
                zf.extractall(extract_dir)
        else:
            with tarfile.open(archive_path, "r:gz") as tf:
                tf.extractall(extract_dir)
    except Exception as extract_err:
        print(f"ERROR: Failed to extract PRX archive: {extract_err}")
        shutil.rmtree(temp_dir, ignore_errors=True)
        return False

    # 4. Discover all extracted PRX and runtime libraries
    extracted_prxs = []
    for root_path, _, files in os.walk(extract_dir):
        for f in files:
            p = Path(root_path) / f
            lower = f.lower()
            if lower.endswith(".prx") or lower.endswith(".dll") or lower.endswith(".so"):
                extracted_prxs.append(p)

    # 5. Validate libSceAgcDriver.prx size on Windows
    if not is_linux:
        agc_driver = next((p for p in extracted_prxs if p.name.lower() == "libsceagcdriver.prx"), None)
        if not agc_driver:
            print("ERROR: libSceAgcDriver.prx not found in extracted Windows PRX archive!")
            shutil.rmtree(temp_dir, ignore_errors=True)
            return False

        actual_size = agc_driver.stat().st_size
        if actual_size != WINDOWS_AGC_DRIVER_SIZE:
            print(f"ERROR: libSceAgcDriver.prx size validation failed! Expected {WINDOWS_AGC_DRIVER_SIZE} bytes, got {actual_size} bytes.")
            shutil.rmtree(temp_dir, ignore_errors=True)
            return False

        print(f"Validated libSceAgcDriver.prx ({actual_size} bytes). Matches official AnyPS5 {UPSTREAM_VERSION}.")

    # 6. Deploy relinker binary
    target_build = ROOT / "build"
    target_build.mkdir(parents=True, exist_ok=True)
    dst_relinker = target_build / relinker_bin_name
    shutil.copy2(temp_relinker, dst_relinker)
    if is_linux:
        try:
            os.chmod(dst_relinker, 0o755)
        except OSError:
            pass
    print(f"Deployed {relinker_bin_name} to {dst_relinker}")

    unpacked_build = ROOT / "ui" / "dist-installer" / ("linux-unpacked" if is_linux else "win-unpacked") / "resources" / "build"
    if unpacked_build.exists():
        unpacked_dst = unpacked_build / relinker_bin_name
        shutil.copy2(temp_relinker, unpacked_dst)
        if is_linux:
            try:
                os.chmod(unpacked_dst, 0o755)
            except OSError:
                pass
        print(f"Deployed {relinker_bin_name} to {unpacked_dst}")

    # 7. Deploy PRX libraries
    target_libs = ROOT / "libs"
    target_libs.mkdir(parents=True, exist_ok=True)
    unpacked_libs = ROOT / "ui" / "dist-installer" / ("linux-unpacked" if is_linux else "win-unpacked") / "resources" / "libs"

    prx_count = 0
    lib_count = 0
    for item in extracted_prxs:
        dst = target_libs / item.name
        shutil.copy2(item, dst)
        if is_linux:
            try:
                os.chmod(dst, 0o755)
            except OSError:
                pass

        if unpacked_libs.exists():
            unpacked_dst_lib = unpacked_libs / item.name
            shutil.copy2(item, unpacked_dst_lib)
            if is_linux:
                try:
                    os.chmod(unpacked_dst_lib, 0o755)
                except OSError:
                    pass

        if item.suffix.lower() == ".prx":
            prx_count += 1
        else:
            lib_count += 1

    # Apply any local PRX/DLL overrides from core/libs/overrides
    override_candidates = [
        ROOT / "core" / "libs" / "overrides",
        ROOT / "ui" / "core" / "libs" / "overrides",
    ]
    for cand in override_candidates:
        if cand.exists() and cand.is_dir():
            for ov in cand.iterdir():
                if ov.is_file():
                    shutil.copy2(ov, target_libs / ov.name)
                    if is_linux:
                        try:
                            os.chmod(target_libs / ov.name, 0o755)
                        except OSError:
                            pass
                    print(f"Applied override: {ov.name}")
            break

    print(f"Successfully deployed {prx_count} PRX libraries and {lib_count} runtime libraries to libs/ and unpacked resources.")
    if prx_count < 50:
        print(f"ERROR: Expected at least 50 PRX libraries, but found only {prx_count}!")
        shutil.rmtree(temp_dir, ignore_errors=True)
        return False

    shutil.rmtree(temp_dir, ignore_errors=True)
    return True

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Deploy AnyPS5 upstream core binaries")
    parser.add_argument("--platform", choices=["windows", "linux"], default="linux" if sys.platform.startswith("linux") else "windows")
    args = parser.parse_args()

    success = deploy(args.platform)
    sys.exit(0 if success else 1)
