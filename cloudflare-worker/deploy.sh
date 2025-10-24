#!/bin/bash

# ============================================================================
# Cloudflare Worker Deployment Script
# ============================================================================
# This script helps you deploy the live stats worker to Cloudflare
# ============================================================================

set -e  # Exit on any error

echo "🚀 Cloudflare Worker Deployment"
echo "================================"
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found!"
    echo ""
    echo "Installing wrangler globally..."
    npm install -g wrangler
    echo "✅ Wrangler installed!"
    echo ""
fi

# Check if user is logged in
echo "🔐 Checking Cloudflare authentication..."
if ! wrangler whoami &> /dev/null; then
    echo "❌ Not logged in to Cloudflare"
    echo ""
    echo "Opening browser to log in..."
    wrangler login
    echo "✅ Logged in!"
    echo ""
else
    echo "✅ Already logged in to Cloudflare"
    echo ""
fi

# Navigate to worker directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

echo "📁 Working directory: $SCRIPT_DIR"
echo ""

# Check if secrets are set
echo "🔑 Checking environment variables..."
echo ""
echo "We need to set your Supabase credentials as secrets."
echo ""

read -p "Set SUPABASE_URL? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    wrangler secret put SUPABASE_URL
    echo "✅ SUPABASE_URL set!"
fi

echo ""
read -p "Set SUPABASE_SERVICE_ROLE_KEY? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    wrangler secret put SUPABASE_SERVICE_ROLE_KEY
    echo "✅ SUPABASE_SERVICE_ROLE_KEY set!"
fi

echo ""
echo "🚢 Deploying worker to Cloudflare..."
echo ""

wrangler deploy

echo ""
echo "🎉 Deployment complete!"
echo ""
echo "📊 Your worker is now:"
echo "   ✅ Running on Cloudflare's edge network"
echo "   ✅ Scheduled to run every minute during game hours (6 PM ET - 5 AM ET)"
echo "   ✅ Automatically fetching live NBA stats"
echo "   ✅ Storing raw stats in Supabase"
echo ""
echo "🔍 Next steps:"
echo "   1. View logs: wrangler tail"
echo "   2. Test manually: Visit your worker URL"
echo "   3. Monitor in dashboard: https://dash.cloudflare.com"
echo ""
echo "📖 For more info, see: CLOUDFLARE_WORKER_DEPLOYMENT.md"
echo ""

