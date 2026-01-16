#!/bin/bash

# ============================================================================
# Trigger One-Time NBA Team Roster Import
# ============================================================================
# This script calls the import-team-rosters Edge Function to do a one-time import
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🏀 Triggering NBA Team Roster Import..."
echo ""

# Get Supabase URL and Service Role Key from environment or use defaults
SUPABASE_URL="${SUPABASE_URL:-${VITE_SUPABASE_URL:-https://qbznyaimnrpibmahisue.supabase.co}}"
SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY}"

# Check if service role key is set
if [ -z "$SERVICE_ROLE_KEY" ]; then
    echo -e "${YELLOW}⚠️  SUPABASE_SERVICE_ROLE_KEY not found in environment${NC}"
    echo ""
    echo "Please set it:"
    echo "  export SUPABASE_SERVICE_ROLE_KEY='your-service-role-key'"
    echo ""
    echo "Or run with:"
    echo "  SUPABASE_SERVICE_ROLE_KEY='your-key' ./trigger_team_roster_import.sh"
    echo ""
    exit 1
fi

# Extract project reference from URL
PROJECT_REF=$(echo $SUPABASE_URL | sed -E 's|https?://([^.]+)\.supabase\.co.*|\1|')

echo "📡 Calling Edge Function: import-team-rosters"
echo "🌐 Project: $PROJECT_REF"
echo ""

# Call the Edge Function
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  "${SUPABASE_URL}/functions/v1/import-team-rosters" \
  -H "Authorization: Bearer ${SERVICE_ROLE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"trigger": "manual_import"}')

# Split response and HTTP code
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "📊 Response:"
echo ""

if [ "$HTTP_CODE" -eq 200 ]; then
    echo -e "${GREEN}✅ Import triggered successfully!${NC}"
    echo ""
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    echo ""
    echo "📋 Check Supabase Dashboard → Edge Functions → Logs to see progress"
else
    echo -e "${RED}❌ Error: HTTP $HTTP_CODE${NC}"
    echo ""
    echo "$BODY"
    echo ""
    echo "💡 Troubleshooting:"
    echo "  1. Make sure the Edge Function is deployed"
    echo "  2. Check that SUPABASE_SERVICE_ROLE_KEY is correct"
    echo "  3. Verify the table nba_team_roster exists"
    exit 1
fi

