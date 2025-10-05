#!/bin/bash

# Script to run the league system migration
echo "🏀 Running league system migration..."

# Check if supabase CLI is available
if ! npx supabase --version &> /dev/null; then
    echo "❌ Supabase CLI is not available. Please install it first:"
    echo "   npm install supabase --save-dev"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "supabase/config.toml" ]; then
    echo "❌ Please run this script from the project root directory"
    exit 1
fi

# Run the RLS policy fix migration
echo "📝 Applying RLS policy fix..."
npx supabase db push

if [ $? -eq 0 ]; then
    echo "✅ Migration completed successfully!"
    echo ""
    echo "🎉 Your league system is now ready!"
    echo ""
    echo "Next steps:"
    echo "1. Start your development server: npm run dev"
    echo "2. Go to your dashboard and click 'Create League'"
    echo "3. Fill out the league creation form"
    echo "4. Check the standings page to see your teams"
    echo ""
    echo "The system will automatically:"
    echo "- Create the league with your settings"
    echo "- Generate teams (Team 1, Team 2, etc.)"
    echo "- Set up draft order"
    echo "- Initialize league state"
    echo "- Send invitations (if provided)"
else
    echo "❌ Migration failed. Please check the error messages above."
    exit 1
fi
