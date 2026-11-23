#!/usr/bin/env python3
"""
GoShipping — Production Deployment Script for Hostinger
Builds the project and syncs dist/ and package.json to Hostinger Cloud.
"""

import os
import sys
import subprocess
import pexpect

HOST = os.environ.get("HOSTINGER_HOST", "217.21.87.101")
PORT = os.environ.get("HOSTINGER_PORT", "65002")
USER = os.environ.get("HOSTINGER_USER", "u398667964")
PASSWORD = os.environ.get("HOSTINGER_SSH_PASS", "Strong#@!1234")
REMOTE_PATH = os.environ.get("HOSTINGER_REMOTE_PATH", "domains/goshipping.com.bd/public_html/")

def deploy_to_hostinger():
    # Sync source files to Hostinger
    print(f"🚀 1. Syncing project sources to Hostinger ({USER}@{HOST}:{PORT} -> {REMOTE_PATH})...")
    rsync_cmd = (
        f'rsync -avz --inplace '
        f'--exclude="node_modules" --exclude=".git" --exclude=".env" --exclude=".*_store.json" '
        f'-e "ssh -p {PORT} -o StrictHostKeyChecking=no" '
        f'src public scripts server.js package.json astro.config.mjs tsconfig.json {USER}@{HOST}:{REMOTE_PATH}'
    )
    print(f"Running: {rsync_cmd}\n")

    child = pexpect.spawn(rsync_cmd, encoding="utf-8", timeout=180)
    child.logfile = sys.stdout

    index = child.expect(["(?i)password:", pexpect.EOF, pexpect.TIMEOUT])
    if index == 0:
        child.sendline(PASSWORD)
        child.expect(pexpect.EOF, timeout=180)
    
    child.close()
    if child.exitstatus == 0:
        print(f"\n📦 2. Building production bundle remotely with single-thread optimization...")
        remote_build_cmd = (
            f'ssh -p {PORT} -o StrictHostKeyChecking=no {USER}@{HOST} '
            f'"cd domains/goshipping.com.bd/public_html && '
            f'node scripts/clean_remote_store.cjs && '
            f'GOMAXPROCS=1 RAYON_NUM_THREADS=1 UV_THREADPOOL_SIZE=1 ./node_modules/.bin/astro build && '
            f'touch tmp/restart.txt && '
            f'npx pm2 restart goshipping 2>/dev/null || true"'
        )
        r_child = pexpect.spawn(remote_build_cmd, encoding="utf-8", timeout=300)
        r_child.logfile = sys.stdout
        r_idx = r_child.expect(["(?i)password:", pexpect.EOF, pexpect.TIMEOUT])
        if r_idx == 0:
            r_child.sendline(PASSWORD)
            r_child.expect(pexpect.EOF, timeout=300)
        r_child.close()
        print(f"\n🎉 3. Successfully built and deployed GoShipping to {USER}@{HOST}:{REMOTE_PATH}!")
    else:
        print(f"\n⚠️ Rsync exit code: {child.exitstatus}")
        print("If you received 'Permission denied' or '/sbin/nologin', please ensure SSH Access is toggled ON in Hostinger hPanel -> Advanced -> SSH Access.")

if __name__ == "__main__":
    deploy_to_hostinger()
