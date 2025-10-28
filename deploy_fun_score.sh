#!/bin/bash

# Deploy Fun Score Post Type Migration
# This script adds the 'fun_score' post type to the database

echo "🏀 Deploying Fun Score Post Type Migration..."
echo ""

# Check if supabase CLI is available
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Please install it first:"
    echo "   npm install -g supabase"
    exit 1
fi

# Run the migration
echo "📦 Applying migration: add_fun_score_post_type.sql"
supabase db push

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration applied successfully!"
    echo ""
    echo "The 'fun_score' post type is now available in your database."
    echo ""
    echo "You can now:"
    echo "  1. Select 'Fun Score' as a post type in Feed Content Manager"
    echo "  2. View fun score data by clicking the 'View Fun Score' button"
    echo "  3. Store fun score data in post metadata"
    echo ""
else
    echo ""
    echo "❌ Migration failed. Please check the error above."
    exit 1
fi

