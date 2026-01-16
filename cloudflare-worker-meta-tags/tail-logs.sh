#!/bin/bash

# Script to tail Cloudflare Worker logs for debugging OG image injection
# Usage: ./tail-logs.sh

echo "🔍 Tailing Cloudflare Worker: hoopgeek-meta-injector-production"
echo "📝 This will show real-time logs from the worker"
echo "💡 Press Ctrl+C to stop"
echo ""
echo "To filter for specific requests, you can use:"
echo "  - Player pages: Look for 'PLAYER PAGE REQUEST'"
echo "  - Feed posts: Look for 'FEED POST REQUEST'"
echo "  - OG images: Look for 'OG Image' or 'og-image'"
echo ""
echo "Starting tail..."
echo ""

# Tail with pretty formatting
npx wrangler tail hoopgeek-meta-injector-production --format pretty

