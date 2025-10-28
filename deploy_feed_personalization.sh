#!/bin/bash

# Deploy Feed Personalization System
# This script deploys the personalized feed with mark-as-read functionality

echo "🚀 Deploying Feed Personalization System..."
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Please install it first:"
    echo "   npm install -g supabase"
    exit 1
fi

echo "📋 This will create:"
echo "  - user_viewed_posts table"
echo "  - mark_post_as_viewed() function"
echo "  - get_personalized_feed() function"
echo ""

read -p "Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 0
fi

echo ""
echo "📡 Connecting to Supabase..."

# Run the migration
supabase db push --include-all

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration successful!"
    echo ""
    echo "🧪 Testing functions..."
    
    # Test the functions exist
    echo "SELECT routine_name FROM information_schema.routines WHERE routine_name IN ('mark_post_as_viewed', 'get_personalized_feed');" | supabase db query
    
    echo ""
    echo "✅ Deployment complete!"
    echo ""
    echo "📚 Next steps:"
    echo "  1. Visit your app at http://localhost:5173 (or your deployed URL)"
    echo "  2. Go to User Settings → Favorite Players"
    echo "  3. Add some favorite players"
    echo "  4. Go to Home page to see your personalized feed!"
    echo ""
    echo "📊 To create feed content:"
    echo "  1. Sign in as admin"
    echo "  2. Go to User Settings → Feed Content Manager"
    echo "  3. Create posts with player IDs tagged"
    echo ""
else
    echo ""
    echo "❌ Migration failed!"
    echo ""
    echo "Try running manually:"
    echo "  1. Open Supabase Dashboard"
    echo "  2. Go to SQL Editor"
    echo "  3. Copy contents of: supabase/migrations/create_user_viewed_posts.sql"
    echo "  4. Run the query"
    echo ""
    exit 1
fi

