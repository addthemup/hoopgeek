#!/bin/bash

# NBA Games Import Script
# This script imports NBA games data using both import scripts

echo "🏀 NBA Games Import Script"
echo "=========================="

# Check if we're in the right directory
if [ ! -f "scripts/setup/import_2025_26_season.py" ] || [ ! -f "scripts/setup/nba_games_import_fixed.py" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    echo "   Current directory: $(pwd)"
    echo "   Expected to find: scripts/setup/import_2025_26_season.py and scripts/setup/nba_games_import_fixed.py"
    exit 1
fi

# Set environment variables (you may need to update these)
export VITE_SUPABASE_URL="https://qbznyaimnrpibmahisue.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiem55YWltbnJwaWJtYWhpc3VlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQxNTQyOCwiZXhwIjoyMDc0OTkxNDI4fQ.MwGad8G7T9G6b-6qNzyNr3o7cVZn0E4Fg7r0ISZ-5Pw"

# Also set the variables that some scripts expect
export SUPABASE_URL="https://qbznyaimnrpibmahisue.supabase.co"
export SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiem55YWltbnJwaWJtYWhpc3VlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQxNTQyOCwiZXhwIjoyMDc0OTkxNDI4fQ.MwGad8G7T9G6b-6qNzyNr3o7cVZn0E4Fg7r0ISZ-5Pw"

echo "🔧 Environment variables set"
echo "📊 Starting NBA games import..."

# Run the 2025-26 season import script (creates mock future season)
echo ""
echo "🚀 Step 1: Importing 2025-26 Season (Mock Data)"
echo "=============================================="
python3 scripts/setup/import_2025_26_season.py

if [ $? -eq 0 ]; then
    echo "✅ 2025-26 season import completed successfully"
else
    echo "❌ 2025-26 season import failed"
    exit 1
fi

echo ""
echo "🚀 Step 2: Importing Current Season Games (Real NBA API Data)"
echo "============================================================"
python3 scripts/setup/nba_games_import_fixed.py

if [ $? -eq 0 ]; then
    echo "✅ Current season games import completed successfully"
else
    echo "❌ Current season games import failed"
    exit 1
fi

echo ""
echo "🏁 NBA Games Import Script Completed!"
echo "====================================="
echo "📊 Both import scripts have been executed"
echo "🏀 Your NBA games database is now populated with:"
echo "   • 2025-26 season mock schedule"
echo "   • Current season real NBA games data"
echo ""
echo "🎯 Next steps:"
echo "   • Check your Supabase dashboard to verify the data"
echo "   • Test your fantasy league schedule generation"
echo "   • Run your fantasy league creation to test the system"
