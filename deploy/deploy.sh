#!/bin/bash
set -euo pipefail

# ============================================================
#  EnergyDispenX – Ubuntu Production Deployment Script
#  Target: /root/dispenx
# ============================================================

DEPLOY_DIR="${DEPLOY_DIR:-/root/energy}"
DOMAIN="${DOMAIN:-your-domain.com}"      # override: DOMAIN=api.example.com ./deploy.sh
DB_NAME="energy_db"
DB_USER="dispenx"
DB_PASS="${DB_PASS:-$(openssl rand -base64 24)}"
JWT_SECRET="${JWT_SECRET:-$(openssl rand -base64 32)}"
POS_HMAC_SECRET="${POS_HMAC_SECRET:-$(openssl rand -base64 32)}"
NODE_VERSION="20"

BLUE='\033[0;34m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${BLUE}[DEPLOY]${NC} $1"; }
ok()   { echo -e "${GREEN}[  OK  ]${NC} $1"; }
fail() { echo -e "${RED}[FAIL ]${NC} $1"; exit 1; }

# ── 1. System packages ────────────────────────────────────
log "Updating system packages..."
apt-get update -qq && apt-get upgrade -y -qq
apt-get install -y -qq curl wget git nginx certbot python3-certbot-nginx ufw build-essential
ok "System packages installed"

# ── 2. Node.js via NodeSource ──────────────────────────────
if ! command -v node &>/dev/null || [[ "$(node -v)" != v${NODE_VERSION}* ]]; then
  log "Installing Node.js ${NODE_VERSION}..."
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
  apt-get install -y -qq nodejs
fi
ok "Node.js $(node -v)  npm $(npm -v)"

# ── 3. PostgreSQL ──────────────────────────────────────────
if ! command -v psql &>/dev/null; then
  log "Installing PostgreSQL..."
  apt-get install -y -qq postgresql postgresql-contrib
fi
systemctl enable --now postgresql
ok "PostgreSQL running"

# Create DB user and database
log "Configuring database..."
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"
ok "Database '${DB_NAME}' ready"

# ── 4. Create project directory ────────────────────────────
log "Setting up ${DEPLOY_DIR}..."
mkdir -p "${DEPLOY_DIR}"

# ── 5. Copy project files ─────────────────────────────────
# If running from the repo, copy server + admin source
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

log "Copying server files..."
rsync -a --delete \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='.env' \
  "${REPO_ROOT}/server/" "${DEPLOY_DIR}/server/"

log "Copying admin files..."
rsync -a --delete \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='.env' \
  "${REPO_ROOT}/admin/" "${DEPLOY_DIR}/admin/"

ok "Source files copied"

# ── 6. Server .env ─────────────────────────────────────────
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}?schema=public"

cat > "${DEPLOY_DIR}/server/.env" <<ENVEOF
NODE_ENV=production
PORT=4601
DATABASE_URL="${DATABASE_URL}"
JWT_SECRET="${JWT_SECRET}"
JWT_EXPIRES_IN=8h
POS_HMAC_SECRET="${POS_HMAC_SECRET}"
DEFAULT_PUMP_PRICE=650
CORS_ORIGIN=https://${DOMAIN}
ENVEOF
chmod 600 "${DEPLOY_DIR}/server/.env"
ok "Server .env created"

# ── 7. Build server ───────────────────────────────────────
log "Installing server dependencies..."
cd "${DEPLOY_DIR}/server"
npm ci --omit=dev --ignore-scripts
npm i -D typescript @types/node @types/express @types/bcrypt @types/cors @types/jsonwebtoken @types/morgan @types/node-cron @types/pdfkit @types/uuid prisma tsx
npx prisma generate
npm run build
ok "Server built to dist/"

# ── 8. Run Prisma migrations ──────────────────────────────
log "Running database migrations..."
npx prisma migrate deploy
ok "Migrations applied"

# ── 9. Seed database ──────────────────────────────────────
log "Seeding database..."
npx tsx src/seed.ts || log "Seed skipped (may already be seeded)"
ok "Database seeded"

# ── 10. Build admin portal ─────────────────────────────────
log "Building admin portal..."
cd "${DEPLOY_DIR}/admin"
npm ci
npm run build
ok "Admin portal built to dist/"

# ── 11. systemd: API server ───────────────────────────────
log "Creating systemd service..."
cat > /etc/systemd/system/energydispenx-api.service <<SVCEOF
[Unit]
Description=EnergyDispenX API Server
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=${DEPLOY_DIR}/server
EnvironmentFile=${DEPLOY_DIR}/server/.env
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=energydispenx-api

NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=${DEPLOY_DIR}/server
PrivateTmp=true

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable --now energydispenx-api
ok "energydispenx-api service started"

# ── 12. Nginx ──────────────────────────────────────────────
log "Configuring Nginx..."
cat > /etc/nginx/sites-available/dispenx <<NGXEOF
# EnergyDispenX – Nginx reverse proxy
server {
    listen 80;
    server_name ${DOMAIN};

    # Admin portal (static)
    root ${DEPLOY_DIR}/admin/dist;
    index index.html;

    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:4601;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 30s;
        proxy_send_timeout 30s;
    }

    # SPA fallback
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
    gzip_min_length 256;
}
NGXEOF

ln -sf /etc/nginx/sites-available/dispenx /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
ok "Nginx configured"

# ── 13. Firewall ───────────────────────────────────────────
log "Configuring firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 'Nginx Full'
ufw --force enable
ok "Firewall active (SSH + HTTP/HTTPS)"

# ── 14. SSL with Let's Encrypt ─────────────────────────────
if [[ "${DOMAIN}" != "your-domain.com" ]]; then
  log "Obtaining SSL certificate for ${DOMAIN}..."
  certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos --email "admin@${DOMAIN}" --redirect || \
    log "Certbot failed – you can run it manually later"
else
  log "Skipping SSL – set DOMAIN=yourdomain.com to enable"
fi

# ── 15. Summary ────────────────────────────────────────────
echo ""
echo "=========================================="
echo "  EnergyDispenX Deployment Complete"
echo "=========================================="
echo ""
echo "  Deploy dir:  ${DEPLOY_DIR}"
echo "  API:         http://${DOMAIN}/api/health"
echo "  Admin:       http://${DOMAIN}"
echo "  DB:          ${DB_NAME} (user: ${DB_USER})"
echo ""
echo "  DB Password: ${DB_PASS}"
echo "  JWT Secret:  ${JWT_SECRET}"
echo ""
echo "  ── Services ──"
echo "  systemctl status energydispenx-api"
echo "  journalctl -u energydispenx-api -f"
echo ""
echo "  ── SSL (if domain is pointed) ──"
echo "  DOMAIN=${DOMAIN} certbot --nginx -d ${DOMAIN}"
echo ""
echo "  ── Mobile App ──"
echo "  Set EXPO_PUBLIC_API_BASE=https://${DOMAIN}/api"
echo "=========================================="
