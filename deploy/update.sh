#!/bin/bash
set -euo pipefail

# ============================================================
#  EnergyDispenX – Quick Update Script
#  Run after pushing new code to update production
# ============================================================

DEPLOY_DIR="/root/dispenx"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=== Updating EnergyDispenX ==="

# 1. Copy latest source
echo "[1/6] Syncing server source..."
rsync -a --delete \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='.env' \
  "${REPO_ROOT}/server/" "${DEPLOY_DIR}/server/"

echo "[2/6] Syncing admin source..."
rsync -a --delete \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='.env' \
  "${REPO_ROOT}/admin/" "${DEPLOY_DIR}/admin/"

# 2. Rebuild server
echo "[3/6] Building server..."
cd "${DEPLOY_DIR}/server"
npm ci --omit=dev --ignore-scripts
npm i -D typescript @types/node @types/express @types/bcrypt @types/cors @types/jsonwebtoken @types/morgan @types/node-cron @types/pdfkit @types/uuid prisma tsx
npx prisma generate
npx prisma migrate deploy
npm run build

# 3. Rebuild admin
echo "[4/6] Building admin portal..."
cd "${DEPLOY_DIR}/admin"
npm ci
npm run build

# 4. Restart API
echo "[5/6] Restarting API server..."
systemctl restart dispenx-api

# 5. Reload nginx (in case config changed)
echo "[6/6] Reloading Nginx..."
nginx -t && systemctl reload nginx

echo "=== Update complete ==="
systemctl status dispenx-api --no-pager -l
