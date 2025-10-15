#!/bin/bash

# =====================================================
# HoopsHype Salaries Import Script
# =====================================================
# This script imports HoopsHype salary data
# from JSON into the nba_hoopshype_salaries table
# =====================================================

echo "🏀 HoopGeek HoopsHype Salaries Import"
echo "===================================="

# Set environment variables (same as run_supa_setup.sh)
export VITE_SUPABASE_URL="https://qbznyaimnrpibmahisue.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiem55YWltbnJwaWJtYWhpc3VlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQxNTQyOCwiZXhwIjoyMDc0OTkxNDI4fQ.MwGad8G7T9G6b-6qNzyNr3o7cVZn0E4Fg7r0ISZ-5Pw"

echo "📊 Environment variables set"
echo "🔗 Supabase URL: $VITE_SUPABASE_URL"
echo ""

# Check if JSON file exists
JSON_FILE="scripts/supabase/hoopshype_salaries.json"
if [ ! -f "$JSON_FILE" ]; then
    echo "❌ Error: HoopsHype salaries JSON file not found at $JSON_FILE"
    echo "   Please ensure the file exists before running this script"
    exit 1
fi

echo "✅ Found HoopsHype salaries JSON file: $JSON_FILE"
echo ""

# Run the import script
echo "🚀 Starting HoopsHype salaries import..."
echo "   This will:"
echo "   • Load salary data from JSON"
echo "   • Match players to nba_players table"
echo "   • Import into nba_hoopshype_salaries table"
echo "   • Show import statistics"
echo ""

python3 scripts/setup/import_hoopshype_salaries.py

# Check exit status
if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 HoopsHype salaries import completed successfully!"
    echo ""
    echo "💰 What was imported:"
    echo "   • 2025-26 season salaries"
    echo "   • 2026-27 season salaries"
    echo "   • 2027-28 season salaries"
    echo "   • 2028-29 season salaries"
    echo "   • Contract years remaining"
    echo "   • Player matching to nba_players table"
    echo ""
    echo "💡 Next steps:"
    echo "   • Check the nba_hoopshype_salaries table in your database"
    echo "   • Review any unmatched players that need manual fixes"
    echo "   • Use salary data in your fantasy app"
else
    echo ""
    echo "❌ HoopsHype salaries import failed!"
    echo "   Check the error messages above for details"
    exit 1
fi
