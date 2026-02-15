#!/usr/bin/env bash
# Deploy fetch-injuries and invoke it once for testing.
# Requires .env in repo root with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY).

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$ROOT"

# Prefer .env.local (Vite), fallback to .env, or use already-exported env vars
if [ -f .env.local ]; then
  # shellcheck disable=SC1091
  source .env.local
elif [ -f .env ]; then
  # shellcheck disable=SC1091
  source .env
fi
# (If neither file exists, we rely on VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY already being exported)

URL="${VITE_SUPABASE_URL:-$SUPABASE_URL}"
KEY="${SUPABASE_SERVICE_ROLE_KEY:-$VITE_SUPABASE_ANON_KEY}"

if [ -z "$URL" ] || [ -z "$KEY" ]; then
  echo "Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY) in .env / .env.local or export them before running."
  exit 1
fi

PROJECT_REF=$(echo "$URL" | sed 's|https://||; s|\.supabase\.co.*||')
if [ -z "$PROJECT_REF" ] || [ "$PROJECT_REF" = "your-project-id" ]; then
  echo "Invalid or placeholder VITE_SUPABASE_URL in .env"
  exit 1
fi

echo "Project ref: $PROJECT_REF"
echo "Deploying fetch-injuries..."
npx supabase functions deploy fetch-injuries --no-verify-jwt --project-ref "$PROJECT_REF"

echo ""
echo "Invoking fetch-injuries..."
FUNC_URL="${URL}/functions/v1/fetch-injuries"
RESP=$(curl -s -w "\n%{http_code}" -X POST "$FUNC_URL" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json")
HTTP_CODE=$(echo "$RESP" | tail -n1)
BODY=$(echo "$RESP" | sed '$d')
echo "HTTP $HTTP_CODE"
echo "$BODY" | jq . 2>/dev/null || echo "$BODY"
