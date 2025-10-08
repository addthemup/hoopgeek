#!/usr/bin/env python3
"""
Database Export Script
Exports all data from the database to JSON files for quick restoration.
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

def export_table_data(conn, table_name, output_dir):
    """Export all data from a table to a JSON file."""
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(f"SELECT * FROM {table_name} ORDER BY created_at, id")
            rows = cur.fetchall()
            
            # Convert to list of dicts
            data = [dict(row) for row in rows]
            
            # Write to JSON file
            output_file = os.path.join(output_dir, f"{table_name}.json")
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, default=str)
            
            print(f"✅ Exported {len(data)} rows from {table_name}")
            return len(data)
            
    except Exception as e:
        print(f"❌ Error exporting {table_name}: {e}")
        return 0

def export_database_data(output_dir="database_backup"):
    """Export all database data to JSON files."""
    # Create output directory
    os.makedirs(output_dir, exist_ok=True)
    
    # List of tables to export (in dependency order)
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
        print(f"🚀 Starting database export to {output_dir}/")
        print(f"📅 Export timestamp: {datetime.now().isoformat()}")
        print()
        
        for table in tables:
            rows_exported = export_table_data(conn, table, output_dir)
            total_rows += rows_exported
        
        # Create metadata file
        metadata = {
            "export_timestamp": datetime.now().isoformat(),
            "total_tables": len(tables),
            "total_rows": total_rows,
            "tables_exported": tables
        }
        
        metadata_file = os.path.join(output_dir, "export_metadata.json")
        with open(metadata_file, 'w', encoding='utf-8') as f:
            json.dump(metadata, f, indent=2)
        
        print()
        print(f"🎉 Export completed!")
        print(f"📊 Total rows exported: {total_rows:,}")
        print(f"📁 Output directory: {output_dir}/")
        print(f"📄 Metadata file: {metadata_file}")
        
    finally:
        conn.close()

def main():
    parser = argparse.ArgumentParser(description="Export database data to JSON files")
    parser.add_argument("--output", default="database_backup", help="Output directory for exported data")
    args = parser.parse_args()
    
    export_database_data(args.output)

if __name__ == "__main__":
    main()
