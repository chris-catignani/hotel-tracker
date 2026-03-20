#!/usr/bin/env bash
# Trigger the exchange rate refresh cron endpoint against the local dev server.
# Reads CRON_SECRET from .env in the project root.
#
# Usage:
#   ./scripts/refresh-exchange-rates.sh
#
# Requires the dev server to be running (npm run dev).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: .env file not found at $ENV_FILE" >&2
  exit 1
fi

CRON_SECRET=$(grep '^CRON_SECRET=' "$ENV_FILE" | head -1 | cut -d '=' -f2- | tr -d '"\r')

if [[ -z "$CRON_SECRET" ]]; then
  echo "Error: CRON_SECRET not found in .env" >&2
  exit 1
fi

PORT="${PORT:-3000}"
URL="http://localhost:$PORT/api/cron/refresh-exchange-rates"

echo "Calling $URL ..."
RESPONSE=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer $CRON_SECRET" "$URL")
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)

if [[ "$HTTP_CODE" -lt 200 || "$HTTP_CODE" -ge 300 ]]; then
  echo "Error: HTTP $HTTP_CODE" >&2
  echo "$BODY" >&2
  exit 1
fi

if command -v jq &>/dev/null; then
  echo "$BODY" | jq .
else
  echo "$BODY"
fi
