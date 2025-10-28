#!/bin/bash

# HoopGeek Meta Tag Injector - Deployment Script
# This script deploys the Cloudflare Worker for dynamic Open Graph meta tags

set -e  # Exit on error

echo "🏀 HoopGeek Meta Tag Injector - Deployment"
echo "=========================================="
echo ""

# Check if wrangler is installed
if ! command -v npx &> /dev/null; then
    echo "❌ Error: npm/npx not found. Please install Node.js first."
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "meta-injector.js" ]; then
    echo "❌ Error: meta-injector.js not found. Are you in the correct directory?"
    exit 1
fi

echo "📦 Installing dependencies..."
npm install

echo ""
echo "🔑 Checking environment variables..."
echo "Make sure you've set these secrets:"
echo "  - SUPABASE_URL"
echo "  - SUPABASE_ANON_KEY"
echo ""
echo "If not, run these commands:"
echo "  npx wrangler secret put SUPABASE_URL"
echo "  npx wrangler secret put SUPABASE_ANON_KEY"
echo ""

read -p "Have you set the secrets? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Please set the secrets first, then run this script again."
    exit 1
fi

echo ""
echo "🚀 Deploying to Cloudflare Workers..."
npm run deploy

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📝 Next steps:"
echo "  1. Test with: curl -A 'facebookexternalhit/1.0' https://your-domain.com/dfs/join/YOUR_POOL_ID"
echo "  2. Share a DFS pool link in iMessage to see the rich preview"
echo "  3. Monitor logs with: npm run tail"
echo ""
echo "🎉 Your DFS links will now show rich previews when shared!"

