#!/bin/bash

# =====================================================
# DEPLOY CREATE-LEAGUE FUNCTION FIX
# =====================================================
# This deploys the updated create-league function with
# randomized draft order (no more commissioner first!)
# =====================================================

echo "🚀 Deploying updated create-league function..."
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI is not installed"
    echo "   Install it with: brew install supabase/tap/supabase"
    exit 1
fi

# Deploy the function
echo "📦 Deploying create-league function..."
supabase functions deploy create-league --no-verify-jwt

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Successfully deployed create-league function!"
    echo ""
    echo "🎲 What changed:"
    echo "   - Removed commissioner-first ordering"
    echo "   - Added Fisher-Yates shuffle for fair randomization"
    echo "   - Draft order is now completely random"
    echo ""
    echo "📝 Next steps:"
    echo "   1. Create a new league to test the random draft order"
    echo "   2. Check the function logs to see the randomized positions"
    echo ""
    echo "🔍 View logs with:"
    echo "   supabase functions logs create-league"
else
    echo ""
    echo "❌ Failed to deploy function"
    echo "   Check your Supabase project settings and try again"
    exit 1
fi

