#!/bin/bash

# =====================================================
# User Customization System - Deployment Script
# =====================================================
# This script deploys the user customization database schema
# to your Supabase project.
#
# Usage:
#   ./scripts/deploy_user_customization.sh
#
# Prerequisites:
#   - Supabase CLI installed (or use psql)
#   - Database connection configured
# =====================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo "${BLUE}║         HoopGeek User Customization Deployment Script         ║${NC}"
echo "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if we're in the right directory
if [ ! -d "supabase/build" ]; then
    echo "${RED}❌ Error: supabase/build directory not found${NC}"
    echo "Please run this script from the project root:"
    echo "  cd /Users/adam/Desktop/hoopgeek"
    echo "  ./scripts/deploy_user_customization.sh"
    exit 1
fi

echo "${YELLOW}📋 This script will deploy the following tables:${NC}"
echo "  1. user_profiles"
echo "  2. user_favorite_players"
echo "  3. user_favorite_teams"
echo "  4. user_notification_preferences"
echo "  5. user_feed_preferences"
echo ""

# Check for Supabase CLI
if command -v supabase &> /dev/null; then
    echo "${GREEN}✅ Supabase CLI detected${NC}"
    USE_SUPABASE_CLI=true
elif command -v psql &> /dev/null; then
    echo "${YELLOW}⚠️  Supabase CLI not found, will use psql${NC}"
    USE_SUPABASE_CLI=false
else
    echo "${RED}❌ Error: Neither supabase CLI nor psql found${NC}"
    echo "Please install one of them:"
    echo "  - Supabase CLI: https://supabase.com/docs/guides/cli"
    echo "  - PostgreSQL: brew install postgresql"
    exit 1
fi

echo ""
echo "${YELLOW}🔍 Checking database connection...${NC}"

if [ "$USE_SUPABASE_CLI" = true ]; then
    # Test Supabase connection
    if supabase db ping &> /dev/null; then
        echo "${GREEN}✅ Database connection successful${NC}"
    else
        echo "${RED}❌ Cannot connect to database${NC}"
        echo "Please check your Supabase project configuration."
        exit 1
    fi
else
    # Check for DATABASE_URL environment variable
    if [ -z "$DATABASE_URL" ]; then
        echo "${RED}❌ DATABASE_URL environment variable not set${NC}"
        echo "Please set it to your Supabase connection string:"
        echo '  export DATABASE_URL="postgresql://..."'
        exit 1
    fi
    
    # Test psql connection
    if psql "$DATABASE_URL" -c "SELECT 1" &> /dev/null; then
        echo "${GREEN}✅ Database connection successful${NC}"
    else
        echo "${RED}❌ Cannot connect to database${NC}"
        echo "Please check your DATABASE_URL"
        exit 1
    fi
fi

echo ""
read -p "$(echo -e ${YELLOW}⚠️  This will modify your database. Continue? [y/N]: ${NC})" -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "${RED}Deployment cancelled${NC}"
    exit 0
fi

echo ""
echo "${BLUE}🚀 Starting deployment...${NC}"
echo ""

# Array of SQL files to execute in order
SQL_FILES=(
    "user_profiles.sql"
    "user_favorite_players.sql"
    "user_favorite_teams.sql"
    "user_notification_preferences.sql"
    "user_feed_preferences.sql"
)

# Counter for progress
TOTAL=${#SQL_FILES[@]}
CURRENT=0

# Execute each SQL file
for sql_file in "${SQL_FILES[@]}"; do
    CURRENT=$((CURRENT + 1))
    FILE_PATH="supabase/build/$sql_file"
    
    echo "${BLUE}[$CURRENT/$TOTAL]${NC} Executing ${YELLOW}$sql_file${NC}..."
    
    if [ ! -f "$FILE_PATH" ]; then
        echo "${RED}❌ File not found: $FILE_PATH${NC}"
        exit 1
    fi
    
    if [ "$USE_SUPABASE_CLI" = true ]; then
        # Use Supabase CLI
        if supabase db execute --file "$FILE_PATH" 2>&1; then
            echo "${GREEN}✅ Success${NC}"
        else
            echo "${RED}❌ Failed to execute $sql_file${NC}"
            exit 1
        fi
    else
        # Use psql
        if psql "$DATABASE_URL" -f "$FILE_PATH" > /dev/null 2>&1; then
            echo "${GREEN}✅ Success${NC}"
        else
            echo "${RED}❌ Failed to execute $sql_file${NC}"
            echo "Check the error above for details"
            exit 1
        fi
    fi
    
    echo ""
done

echo "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo "${GREEN}║                  ✅ Deployment Successful!                      ║${NC}"
echo "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "${BLUE}📊 Verifying tables...${NC}"

# Verify tables were created
if [ "$USE_SUPABASE_CLI" = true ]; then
    TABLE_COUNT=$(supabase db execute --query "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'user_%'" 2>/dev/null | tail -n 1 | tr -d ' ')
else
    TABLE_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'user_%'" 2>/dev/null | tr -d ' ')
fi

if [ "$TABLE_COUNT" = "5" ]; then
    echo "${GREEN}✅ All 5 tables created successfully${NC}"
else
    echo "${YELLOW}⚠️  Expected 5 tables, found $TABLE_COUNT${NC}"
    echo "This might be okay if tables already existed"
fi

echo ""
echo "${GREEN}🎉 User customization system is ready!${NC}"
echo ""
echo "Next steps:"
echo "  1. Start your dev server: ${BLUE}npm run dev${NC}"
echo "  2. Sign in to your app"
echo "  3. Click your email address in the top navigation"
echo "  4. Explore the settings page!"
echo ""
echo "For more information, see:"
echo "  ${BLUE}USER_CUSTOMIZATION_IMPLEMENTATION.md${NC}"
echo ""

