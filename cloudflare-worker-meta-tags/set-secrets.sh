#!/bin/bash

# Set Cloudflare Worker Secrets for Meta Tag Injector
# This script sets the Supabase credentials as secrets for the production environment

echo "🔐 Setting Cloudflare Worker Secrets"
echo "====================================="
echo ""

# Supabase values from your codebase
SUPABASE_URL="https://qbznyaimnrpibmahisue.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiem55YWltbnJwaWJtYWhpc3VlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MTU0MjgsImV4cCI6MjA3NDk5MTQyOH0.bV4FULUCT0tJg6Scu2-B86Pui8nIeMsxDb-x5iVEHuU"

echo "Setting SUPABASE_URL..."
echo "$SUPABASE_URL" | npx wrangler secret put SUPABASE_URL --env production

echo ""
echo "Setting SUPABASE_ANON_KEY..."
echo "$SUPABASE_ANON_KEY" | npx wrangler secret put SUPABASE_ANON_KEY --env production

echo ""
echo "✅ Secrets set successfully!"
echo ""
echo "🧪 Test the worker:"
echo '  curl -A "AppleBot" "https://hoop-geek.com/bf80d119-746f-4b64-90d5-344081fb56be" | grep "og:title"'
echo ""
echo "📊 Watch logs:"
echo "  npm run tail"

