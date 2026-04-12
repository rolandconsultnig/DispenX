#!/usr/bin/env bash
# Run on the production host. Confirms the API listens on 4601 (required for nginx on 4602/4603/4604).
set -euo pipefail

echo "=== EnergyDispenX stack check ==="
echo ""

if curl -sfS "http://127.0.0.1:4601/api/health" >/dev/null; then
  echo "[OK] API responds on http://127.0.0.1:4601/api/health"
else
  echo "[FAIL] Nothing healthy on port 4601."
  echo "       Admin/staff nginx will return 502 for /api/* until the API runs."
  echo "       Fix: cd /root/energy/server && npm run build && sudo systemctl start energydispenx-api"
  echo "       (adjust path if your clone is not /root/energy)"
  exit 1
fi

if command -v systemctl >/dev/null 2>&1; then
  if systemctl is-active --quiet energydispenx-api 2>/dev/null; then
    echo "[OK] systemd: energydispenx-api is active"
  elif systemctl is-active --quiet dispenx-api 2>/dev/null; then
    echo "[OK] systemd: dispenx-api is active"
  else
    echo "[WARN] No active energydispenx-api (or dispenx-api) unit — API may stop after SSH logout."
  fi
fi

echo ""
echo "=== Done ==="
