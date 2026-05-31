#!/usr/bin/env bash
# Create a clean backend venv (fixes pip/python mismatch + LaCie ._ file corruption)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/backend"

echo "Removing old backend/.venv (if corrupted on external drives) ..."
rm -rf .venv

echo "Creating fresh backend/.venv ..."
python3 -m venv .venv

# macOS LaCie drives sometimes add AppleDouble metadata files that break pip
find .venv -name '._*' -delete 2>/dev/null || true

echo "Installing dependencies into venv ..."
.venv/bin/python -m pip install --upgrade pip setuptools wheel
.venv/bin/python -m pip install -r requirements.txt

find .venv -name '._*' -delete 2>/dev/null || true

echo ""
echo "Verify:"
.venv/bin/python -c "from dotenv import load_dotenv; from twilio.rest import Client; print('OK — dotenv + twilio in venv')"

echo ""
echo "Twilio env (from backend/.env):"
.venv/bin/python -c "
from dotenv import load_dotenv
import os
load_dotenv('.env')
print('  SID:', 'set' if os.getenv('TWILIO_ACCOUNT_SID') else 'missing')
print('  From:', os.getenv('TWILIO_PHONE_NUMBER', 'missing'))
"

echo ""
echo "Start backend:"
echo "  cd $ROOT/backend"
echo "  source .venv/bin/activate"
echo "  export GOOGLE_APPLICATION_CREDENTIALS=$ROOT/backend/crisisroute-firebase-adminsdk-fbsvc-f5dab70143.json"
echo "  .venv/bin/uvicorn src.main:app --reload --port 8080 --reload-dir . --reload-dir ../agent"
