#!/bin/bash

# Deploy the waiver processing cron edge function to Supabase

echo "🚀 Deploying waiver processing cron function..."

# Make sure we're logged in
if ! supabase projects list &> /dev/null; then
  echo "❌ Not logged in to Supabase. Running 'supabase login'..."
  supabase login
fi

# Deploy the edge function
echo "📦 Deploying process-waivers-cron edge function..."
supabase functions deploy process-waivers-cron

if [ $? -eq 0 ]; then
  echo "✅ Edge function deployed successfully!"
  echo ""
  echo "📋 Next steps:"
  echo "1. Go to Supabase Dashboard → SQL Editor"
  echo "2. Run the cron setup SQL (see WAIVER_CRON_SETUP.md)"
  echo "3. Monitor logs in Edge Functions dashboard"
  echo ""
  echo "🧪 Test the function manually:"
  echo "curl -X POST 'https://qbznyaimnrpibmahisue.supabase.co/functions/v1/process-waivers-cron' \\"
  echo "  -H 'Authorization: Bearer YOUR_ANON_KEY'"
else
  echo "❌ Deployment failed. Check the error above."
  exit 1
fi

