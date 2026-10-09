#!/usr/bin/env bash
# Pull the latest code, build it and restart the site. Run as the gtasixhub user:
#   sudo -u gtasixhub /srv/gtasixhub/deploy/deploy.sh
# The database and uploads live in $DATA_DIR and are never touched.
set -euo pipefail
cd /srv/gtasixhub

set -a
# shellcheck disable=SC1091
source /etc/gtasixhub.env
set +a

git pull --ff-only
# Build tools are devDependencies; NODE_ENV=production (from the env file) would skip them.
npm ci --include=dev --no-audit --no-fund
# A failed build can leave a cached error behind; retry once from a clean cache.
npm run build || { echo "Build failed; retrying with a clean cache…"; rm -rf .next; npm run build; }
sudo systemctl restart gtasixhub
echo "Deployed $(git rev-parse --short HEAD)."
