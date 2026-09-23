#!/bin/bash
# Runs on the droplet from /root/chacarero, a checkout of main that the caller
# has just reset to origin/main. Rebuilds only the layers that changed.
set -e
cd "$(dirname "$0")/.."
docker compose up -d --build --remove-orphans
docker image prune -f >/dev/null 2>&1 || true
docker compose ps
