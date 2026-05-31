#!/usr/bin/env bash
# Start backend with reload on both backend/ and agent/ (agent lives outside backend/)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/backend"

export GOOGLE_APPLICATION_CREDENTIALS="${GOOGLE_APPLICATION_CREDENTIALS:-$ROOT/backend/crisisroute-firebase-adminsdk-fbsvc-f5dab70143.json}"

echo "CrisisRoute backend → http://127.0.0.1:8080"
echo "GOOGLE_APPLICATION_CREDENTIALS=$GOOGLE_APPLICATION_CREDENTIALS"

exec uvicorn src.main:app \
  --reload \
  --port 8080 \
  --reload-dir "$ROOT/backend" \
  --reload-dir "$ROOT/agent"
