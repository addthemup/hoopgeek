#!/bin/bash
# Script to scrape games for a date and create feed posts
# This can be run from cron, GitHub Actions, or manually

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get date from argument or use yesterday
TARGET_DATE=${1:-$(date -v-1d +%Y-%m-%d 2>/dev/null || date -d "yesterday" +%Y-%m-%d)}

echo "🏀 Scraping games for ${TARGET_DATE} and creating feed posts"
echo ""

# Get Supabase credentials
SUPABASE_URL="${SUPABASE_URL:-${VITE_SUPABASE_URL:-https://qbznyaimnrpibmahisue.supabase.co}}"
SUPABASE_KEY="${SUPABASE_SERVICE_ROLE_KEY}"

if [ -z "$SUPABASE_KEY" ]; then
    echo -e "${RED}❌ Error: SUPABASE_SERVICE_ROLE_KEY not set${NC}"
    exit 1
fi

# Step 1: Run Python scraping script to upload games to storage
echo -e "${YELLOW}Step 1: Scraping games and uploading to storage...${NC}"
cd "$(dirname "$0")/../.."

python3 scripts/feed/scrape_and_upload_to_storage.py "$TARGET_DATE" || {
    echo -e "${RED}❌ Error: Scraping failed${NC}"
    exit 1
}

echo ""
echo -e "${GREEN}✅ Scraping complete${NC}"
echo ""

# Step 2: Trigger edge function to create feed posts
echo -e "${YELLOW}Step 2: Creating feed posts from scraped games...${NC}"

RESPONSE=$(curl -s -X POST \
  "${SUPABASE_URL}/functions/v1/auto-create-feed-posts" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"date\": \"${TARGET_DATE}\", \"trigger\": \"scrape_and_create\"}")

# Check if response indicates success
if echo "$RESPONSE" | grep -q '"success":true'; then
    echo -e "${GREEN}✅ Feed posts created successfully${NC}"
    echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
    exit 0
else
    echo -e "${RED}❌ Error creating feed posts${NC}"
    echo "$RESPONSE"
    exit 1
fi



