#!/usr/bin/env python3
"""
GoShipping — Production Deployment Script for Hostinger
Builds the project and syncs dist/ and package.json to Hostinger Cloud.
"""

import os
import sys
import subprocess
import pexpect

HOST = os.environ.get("HOSTINGER_HOST", "195.35.62.136")
PORT = os.environ.get("HOSTINGER_PORT", "65002")
USER = os.environ.get("HOSTINGER_USER", "u398667964")
PASSWORD = os.environ.get("HOSTINGER_SSH_PASS", "Strong#@!1234")
REMOTE_PATH = os.environ.get("HOSTINGER_REMOTE_PATH", "public_html/")

def run_local_build():
    print("\n📦 1. Building production assets with Astro...")
    result = subprocess.run(["npm", "run", "build"], check=True)
    if result.returncode != 0:
        print("❌ Build failed! Aborting deployment.")
        sys.exit(1)
    print("✅ Build completed successfully!\n")

def deploy_to_hostinger():
    run_local_build()

    print(f"🚀 2. Deploying dist/ to Hostinger ({USER}@{HOST}:{PORT} -> {REMOTE_PATH})...")
    rsync_cmd = (
        f'rsync -avz --inplace --delete '
        f'--exclude="node_modules" --exclude=".git" --exclude=".env" --exclude=".auth_store.json" '
        f'-e "ssh -p {PORT} -o StrictHostKeyChecking=no" '
        f'dist/ package.json {USER}@{HOST}:{REMOTE_PATH}'
    )
    print(f"Running: {rsync_cmd}\n")

    child = pexpect.spawn(rsync_cmd, encoding="utf-8", timeout=300)
    child.logfile = sys.stdout

    index = child.expect(["(?i)password:", pexpect.EOF, pexpect.TIMEOUT])
    if index == 0:
        child.sendline(PASSWORD)
        child.expect(pexpect.EOF, timeout=300)
    
    child.close()
    if child.exitstatus == 0:
        print(f"\n🎉 3. Successfully deployed GoShipping production build to {USER}@{HOST}:{REMOTE_PATH}!")
    else:
        print(f"\n⚠️ Rsync exit code: {child.exitstatus}")
        print("If you received 'Permission denied' or '/sbin/nologin', please ensure SSH Access is toggled ON in Hostinger hPanel -> Advanced -> SSH Access.")

if __name__ == "__main__":
    deploy_to_hostinger()
