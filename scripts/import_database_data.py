#!/usr/bin/env python3
"""
Database Import Script
Imports data from JSON files back into the database for quick restoration.
"""

import os
import json
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime
import argparse

def get_db_connection():
    """Get database connection using environment variables."""
    return psycopg2.connect(
        host=os.getenv("SUPABASE_HOST", "localhost"),
        port=os.getenv("SUPABASE_PORT", "5432"),
        database=os.getenv("SUPABASE_DB", "postgres"),
        user=os.getenv("SUPABASE_USER", "postgres"),
        password=os.getenv("SUPABASE_PASSWORD", ""),
        sslmode=os.getenv("SUPABASE_SSL_MODE", "require")
    )

def import_table_data(conn, table_name, data_dir):
    """Import data from a JSON file into a table."""
    json_file = os.path.join(data_dir, f"{table_name}.json")
    
    if not os.path.exists(json_file):
        print(f"⚠️  No data file found for {table_name}, skipping")
        return 0
    
    try:
        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        if not data:
            print(f"📭 No data to import for {table_name}")
            return 0
        
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Get column names from first row
            columns = list(data[0].keys())
            columns_str = ", ".join(columns)
            placeholders = ", ".join([f"%({col})s" for col in columns])
            
            # Clear existing data
            cur.execute(f"DELETE FROM {table_name}")
            
            # Insert new data
            cur.executemany(
                f"INSERT INTO {table_name} ({columns_str}) VALUES ({placeholders})",
                data
            )
            
            conn.commit()
            print(f"✅ Imported {len(data)} rows into {table_name}")
            return len(data)
            
    except Exception as e:
        print(f"❌ Error importing {table_name}: {e}")
        conn.rollback()
        return 0

def import_database_data(data_dir="database_backup"):
    """Import all database data from JSON files."""
    if not os.path.exists(data_dir):
        print(f"❌ Data directory {data_dir} does not exist")
        return
    
    # Check for metadata file
    metadata_file = os.path.join(data_dir, "export_metadata.json")
    if os.path.exists(metadata_file):
        with open(metadata_file, 'r', encoding='utf-8') as f:
            metadata = json.load(f)
        print(f"📄 Importing data exported on: {metadata.get('export_timestamp', 'Unknown')}")
        print(f"📊 Expected rows: {metadata.get('total_rows', 'Unknown'):,}")
        print()
    
    # List of tables to import (in dependency order)
    tables = [
        "players",
        "player_game_logs", 
        "player_season_stats",
        "player_career_totals_regular_season",
        "player_career_totals_post_season", 
        "player_career_totals_all_star_season",
        "player_career_totals_college_season",
        "player_season_totals_regular_season",
        "player_season_totals_post_season",
        "player_season_totals_all_star_season", 
        "player_season_totals_college_season",
        "player_season_rankings_regular_season",
        "player_season_rankings_post_season",
        "nba_games",
        "nba_season_weeks",
        "leagues",
        "league_settings",
        "league_members",
        "divisions", 
        "fantasy_teams",
        "draft_order",
        "league_states",
        "roster_spots",
        "fantasy_team_players",
        "draft_picks",
        "league_invitations",
        "league_schedule_settings",
        "weekly_matchups",
        "draft_chat_messages",
        "draft_lobby_participants",
        "trades",
        "player_watchlist",
        "player_favorites",
        "dynasty_keepers",
        "dynasty_settings",
        "fantasy_season_weeks",
        "espn_player_projections"
    ]
    
    conn = get_db_connection()
    total_rows = 0
    
    try:
        print(f"🚀 Starting database import from {data_dir}/")
        print(f"📅 Import timestamp: {datetime.now().isoformat()}")
        print()
        
        for table in tables:
            rows_imported = import_table_data(conn, table, data_dir)
            total_rows += rows_imported
        
        print()
        print(f"🎉 Import completed!")
        print(f"📊 Total rows imported: {total_rows:,}")
        
    finally:
        conn.close()

def main():
    parser = argparse.ArgumentParser(description="Import database data from JSON files")
    parser.add_argument("--data-dir", default="database_backup", help="Directory containing exported data")
    args = parser.parse_args()
    
    import_database_data(args.data_dir)

if __name__ == "__main__":
    main()
