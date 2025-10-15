#!/bin/bash

# =====================================================
# ESPN Projections Import Script
# =====================================================
# This script imports ESPN fantasy basketball projections
# from JSON into the nba_espn_projections table
# =====================================================

echo "🏀 HoopGeek ESPN Projections Import"
echo "=================================="

# Set environment variables (same as run_supa_setup.sh)
export VITE_SUPABASE_URL="https://qbznyaimnrpibmahisue.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiem55YWltbnJwaWJtYWhpc3VlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQxNTQyOCwiZXhwIjoyMDc0OTkxNDI4fQ.MwGad8G7T9G6b-6qNzyNr3o7cVZn0E4Fg7r0ISZ-5Pw"

echo "📊 Environment variables set"
echo "🔗 Supabase URL: $VITE_SUPABASE_URL"
echo ""

# Check if JSON file exists
JSON_FILE="scripts/supabase/espn_projections.json"
if [ ! -f "$JSON_FILE" ]; then
    echo "❌ Error: ESPN projections JSON file not found at $JSON_FILE"
    echo "   Please ensure the file exists before running this script"
    exit 1
fi

echo "✅ Found ESPN projections JSON file: $JSON_FILE"
echo ""

# Run the import script
echo "🚀 Starting ESPN projections import..."
echo "   This will:"
echo "   • Load projections from JSON"
echo "   • Match players to nba_players table"
echo "   • Import into nba_espn_projections table"
echo "   • Show import statistics"
echo ""

python3 scripts/setup/import_espn_projections.py

# Check exit status
if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 ESPN projections import completed successfully!"
    echo ""
    echo "📊 What was imported:"
    echo "   • 2025 Statistics (actual stats from last season)"
    echo "   • 2026 Projections (ESPN's predictions)"
    echo "   • 2026 Outlook (ESPN's analysis text)"
    echo "   • Player matching to nba_players table"
    echo ""
    echo "💡 Next steps:"
    echo "   • Check the nba_espn_projections table in your database"
    echo "   • Review any unmatched players that need manual fixes"
    echo "   • Use projections data in your fantasy app"
else
    echo ""
    echo "❌ ESPN projections import failed!"
    echo "   Check the error messages above for details"
    exit 1
fi
