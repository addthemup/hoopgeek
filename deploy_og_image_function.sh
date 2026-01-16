#!/bin/bash

# Deploy OG Image Generation Edge Function to Supabase

echo "🎨 Deploying OG Image Generation Edge Function..."
echo ""

# Check if we're in the right directory
if [ ! -d "supabase/functions/generate-og-image" ]; then
  echo "❌ Error: supabase/functions/generate-og-image not found"
  echo "   Are you in the project root directory?"
  exit 1
fi

# Check if supabase CLI is available
if ! command -v supabase &> /dev/null && ! command -v npx &> /dev/null; then
  echo "❌ Error: Supabase CLI not found"
  echo "   Install with: npm install -g supabase"
  exit 1
fi

# Check if logged in
if ! supabase projects list &> /dev/null 2>&1 && ! npx supabase projects list &> /dev/null 2>&1; then
  echo "⚠️  Not logged in to Supabase. Please run:"
  echo "   npx supabase login"
  exit 1
fi

echo "📦 Deploying generate-og-image function..."
if command -v supabase &> /dev/null; then
  supabase functions deploy generate-og-image
else
  npx supabase functions deploy generate-og-image
fi

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Edge function deployed successfully!"
  echo ""
  echo "📋 Next steps:"
  echo "1. Ensure 'og-images' storage bucket exists in Supabase"
  echo "2. Test by creating a new feed post"
  echo "3. Check logs in Supabase Dashboard → Edge Functions"
  echo ""
  echo "🧪 Test the function manually:"
  echo 'curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/generate-og-image" \'
  echo '  -H "Authorization: Bearer YOUR_ANON_KEY" \'
  echo '  -H "Content-Type: application/json" \'
  echo '  -d '"'"'{"post_id":"test-id","team_tricodes":["LAL","BOS"]}'"'"''
  echo ""
else
  echo "❌ Deployment failed. Check the error above."
  exit 1
fi

