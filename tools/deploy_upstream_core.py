import argparse
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

def deploy(target_platform):
    is_linux = (target_platform == "linux")
    artifact_name = "anyps5-upstream-core-linux-x64" if is_linux else "anyps5-upstream-core-windows-x64"
    relinker_bin_name = "relinker" if is_linux else "relinker.exe"

    res_in_prog = run_cmd("gh run list --workflow build-upstream-core.yml --json databaseId,status", check=False)
    if res_in_prog.returncode == 0:
        try:
            runs_data = json.loads(res_in_prog.stdout)
            for item in runs_data:
                if item.get("status") in ("in_progress", "queued"):
                    in_prog_id = item.get("databaseId")
                    if in_prog_id:
                        print(f"Waiting for in-progress core build run #{in_prog_id} to finish...")
                        run_cmd(f"gh run watch {in_prog_id} --interval 10", check=False)
                        break
        except Exception as prog_err:
            print(f"Warning: Failed to inspect in-progress runs: {prog_err}")

    print(f"Resolving latest '{artifact_name}' artifact from GitHub Actions...")
    temp_dir = ROOT / f"dist-upstream-download-{target_platform}"
    if temp_dir.exists():
        shutil.rmtree(temp_dir)
    temp_dir.mkdir(parents=True, exist_ok=True)

    downloaded = False
    candidate_run_id = None

    res_api = run_cmd("gh api repos/Ramzyayman/AnyPS5-Studio/actions/artifacts", check=False)
    if res_api.returncode == 0:
        try:
            data = json.loads(res_api.stdout)
            for art in data.get("artifacts", []):
                if art.get("name") == artifact_name:
                    candidate_run_id = art.get("workflow_run", {}).get("id")
                    print(f"Discovered {artifact_name} in workflow run #{candidate_run_id} (created at {art.get('created_at')})")
                    break
        except Exception as json_err:
            print(f"Warning: Failed to parse GitHub API artifact JSON: {json_err}")

    if not candidate_run_id:
        cmd_runs = 'gh run list --workflow build-upstream-core.yml --status success --limit 10 --json databaseId -q ".[].databaseId"'
        res_runs = run_cmd(cmd_runs, check=False)
        for r_id in res_runs.stdout.splitlines():
            r_id = r_id.strip()
            if r_id:
                candidate_run_id = r_id
                break

    if candidate_run_id:
        print(f"Downloading {artifact_name} from run #{candidate_run_id}...")
        cmd = f'gh run download {candidate_run_id} --name {artifact_name} --dir "{temp_dir}" --repo Ramzyayman/AnyPS5-Studio'
        res = run_cmd(cmd, check=False)
        if res.returncode == 0:
            downloaded = True
        else:
            print(f"Warning: Run download for #{candidate_run_id} returned {res.returncode}: {res.stderr.strip()}")

    if not downloaded:
        print(f"Attempting general artifact download for {artifact_name}...")
        cmd = f'gh run download --name {artifact_name} --dir "{temp_dir}" --repo Ramzyayman/AnyPS5-Studio'
        res = run_cmd(cmd, check=False)
        if res.returncode == 0:
            downloaded = True

    if not downloaded:
        print(f"ERROR: Could not locate or download required CI artifact '{artifact_name}'.")
        print("Please ensure that the 'Build Upstream Core Binaries' workflow has completed successfully for this platform.")
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
    if prx_count < 50:
        print(f"ERROR: Expected at least 50 PRX libraries, but found only {prx_count}!")
        shutil.rmtree(temp_dir, ignore_errors=True)
        return False

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
