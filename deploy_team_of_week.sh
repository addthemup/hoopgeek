#!/bin/bash

# Deploy Team of the Week function to Supabase
# This script deploys the get_dfs_team_of_week function

echo "🏀 Deploying Team of the Week Function..."
echo "=========================================="

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
elif [ -f .env.local ]; then
    export $(cat .env.local | grep -v '^#' | xargs)
else
    echo "❌ Error: .env or .env.local file not found"
    exit 1
fi

# Check if SUPABASE_DB_URL is set
if [ -z "$SUPABASE_DB_URL" ]; then
    echo "❌ Error: SUPABASE_DB_URL not set in .env"
    exit 1
fi

echo ""
echo "📦 Deploying get_dfs_team_of_week function..."
psql "$SUPABASE_DB_URL" -f supabase/functions/get_dfs_team_of_week.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Team of the Week function deployed successfully!"
    echo ""
    echo "📋 Function Details:"
    echo "  - Name: get_dfs_team_of_week()"
    echo "  - Returns: Top 5 players (2G, 2F, 1C)"
    echo "  - Scoring: FanDuel fantasy points"
    echo "  - Period: Previous week's games"
    echo ""
    echo "🧪 Test the function with:"
    echo "  SELECT * FROM get_dfs_team_of_week();"
    echo ""
else
    echo ""
    echo "❌ Deployment failed. Please check the error messages above."
    exit 1
fi

