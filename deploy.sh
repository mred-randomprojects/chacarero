#!/bin/bash
# Manual deploy of the room server: the droplet pulls main and rebuilds.
# Pushing to main does the same through .github/workflows/deploy.yml.
set -e
ssh pinas-cruzadas 'cd /root/chacarero && git fetch -q origin main && git reset -q --hard origin/main && exec deploy/remote.sh'
curl -s https://pistasjug.ar/chacarero/health; echo
