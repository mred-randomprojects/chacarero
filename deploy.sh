#!/bin/bash
# Builds the image locally, ships it to the droplet and (re)starts the
# container. Mirrors pinas-cruzadas/deploy.sh; uses the same SSH alias.
set -e

IMAGE="chacarero"
REMOTE="pinas-cruzadas"
REMOTE_DIR="/root/chacarero"
WS_URL="${VITE_WS_URL:-wss://pistasjug.ar/chacarero/ws}"

echo "🔨 Building ${IMAGE} for linux/amd64 (client WS: ${WS_URL})..."
docker buildx build --platform linux/amd64 --build-arg VITE_WS_URL="${WS_URL}" -t ${IMAGE}:latest --load .

echo "💾 Saving image..."
docker save ${IMAGE}:latest | gzip > ${IMAGE}.tar.gz

echo "📤 Uploading..."
ssh ${REMOTE} "mkdir -p ${REMOTE_DIR}"
scp ${IMAGE}.tar.gz docker-compose.yml ${REMOTE}:${REMOTE_DIR}/

echo "🚀 Starting on the droplet..."
ssh ${REMOTE} "
  set -e
  cd ${REMOTE_DIR}
  gunzip -c ${IMAGE}.tar.gz | docker load
  sed -i 's/^    build: \\.$//' docker-compose.yml
  docker compose up -d --remove-orphans
  rm -f ${IMAGE}.tar.gz
  docker image prune -f >/dev/null 2>&1 || true
  docker compose ps
"

rm -f ${IMAGE}.tar.gz
echo "✅ Deployed. Health: curl -s https://pistasjug.ar/chacarero/health (once Caddy routes /chacarero/*)."
