#!/bin/bash

# Deploy Supabase Edge Functions for NBA API
echo "🚀 Deploying Supabase Edge Functions..."

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Please install it first:"
    echo "npm install -g supabase"
    exit 1
fi

# Check if we're logged in
if ! supabase status &> /dev/null; then
    echo "❌ Not logged in to Supabase. Please run:"
    echo "supabase login"
    exit 1
fi

# Deploy the NBA API proxy function
echo "📦 Deploying nba-api-proxy function..."
supabase functions deploy nba-api-proxy

if [ $? -eq 0 ]; then
    echo "✅ nba-api-proxy function deployed successfully!"
else
    echo "❌ Failed to deploy nba-api-proxy function"
    exit 1
fi

# Deploy the live scoreboard function
echo "📦 Deploying live-scoreboard function..."
supabase functions deploy live-scoreboard

if [ $? -eq 0 ]; then
    echo "✅ live-scoreboard function deployed successfully!"
else
    echo "❌ Failed to deploy live-scoreboard function"
    exit 1
fi

echo ""
echo "🎉 All Edge Functions deployed successfully!"
echo ""
echo "📋 Available endpoints:"
echo "  • https://your-project.supabase.co/functions/v1/nba-api-proxy"
echo "  • https://your-project.supabase.co/functions/v1/live-scoreboard"
echo ""
echo "🔧 Usage examples:"
echo "  • GET /functions/v1/nba-api-proxy?endpoint=scoreboard"
echo "  • GET /functions/v1/nba-api-proxy?endpoint=scoreboard&gameDate=2025-10-25"
echo "  • GET /functions/v1/live-scoreboard?gameDate=2025-10-25"
echo ""
echo "🔑 Make sure to set up proper RLS policies and API keys for production!"
