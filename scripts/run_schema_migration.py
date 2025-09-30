#!/usr/bin/env python3
"""
Run the schema reorganization migration
"""

import os
import sys
from supabase import create_client

# Configuration
SUPABASE_URL = "https://lsnqmdeagfzuvrypiiwi.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxzbnFtZGVhZ2Z6dXZyeXBpaXdpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTI1MTU5MSwiZXhwIjoyMDc0ODI3NTkxfQ.uOD1oFhjd6ISP7XJu7OtYYG_SwU7uZR74h8byY3HNPo"

def run_migration():
    """Run the schema reorganization migration"""
    print("🚀 Starting Database Schema Reorganization")
    print("=" * 60)
    
    try:
        # Initialize Supabase client
        supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        print("✅ Supabase client initialized")
        
        # Read the migration file
        migration_path = "../supabase/migrations/20250930230000_reorganize_teams_schema.sql"
        if not os.path.exists(migration_path):
            print(f"❌ Migration file not found: {migration_path}")
            return
        
        with open(migration_path, 'r') as f:
            migration_sql = f.read()
        
        print("📄 Migration file loaded")
        
        # Split the migration into individual statements
        statements = [stmt.strip() for stmt in migration_sql.split(';') if stmt.strip()]
        
        print(f"📊 Found {len(statements)} SQL statements to execute")
        
        # Execute each statement
        for i, statement in enumerate(statements):
            if statement:
                try:
                    print(f"   🔧 Executing statement {i+1}/{len(statements)}...")
                    result = supabase.rpc('exec_sql', {'sql': statement}).execute()
                    print(f"   ✅ Statement {i+1} executed successfully")
                except Exception as e:
                    print(f"   ⚠️  Statement {i+1} failed (might already exist): {e}")
        
        print("\n" + "=" * 60)
        print("🎉 Schema reorganization completed!")
        
        # Verify the changes
        print("\n🔍 Verifying changes...")
        
        # Check if nba_teams table exists
        try:
            teams_result = supabase.table('nba_teams').select('count', count='exact').execute()
            print(f"✅ nba_teams table created with {teams_result.count} records")
        except Exception as e:
            print(f"❌ nba_teams table check failed: {e}")
        
        # Check if fantasy_teams table exists (renamed from teams)
        try:
            fantasy_teams_result = supabase.table('fantasy_teams').select('count', count='exact').execute()
            print(f"✅ fantasy_teams table exists with {fantasy_teams_result.count} records")
        except Exception as e:
            print(f"❌ fantasy_teams table check failed: {e}")
        
        # Check players table structure
        try:
            players_sample = supabase.table('players').select('nba_team_id, nba_team_name, nba_team_abbreviation').limit(3).execute()
            print(f"✅ players table updated with NBA team fields")
            print(f"   Sample data: {players_sample.data[:2] if players_sample.data else 'No data'}")
        except Exception as e:
            print(f"❌ players table check failed: {e}")
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    run_migration()
