#!/usr/bin/env python3
"""
Prune nba_daily_player_stats and nba_daily_team_stats tables:
delete rows older than 7 days.
Designed to run as part of daily maintenance so we only keep recent predictor data.
"""

import os
import sys
from datetime import date, timedelta

try:
    from dotenv import load_dotenv
    from pathlib import Path
    script_dir = Path(__file__).parent
    project_root = script_dir.parent.parent
    load_dotenv(project_root / '.env.local')
    load_dotenv(project_root / '.env')
    load_dotenv('.env.local')
    load_dotenv('.env')
except ImportError:
    pass

from supabase import create_client


def main():
    url = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("❌ Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
        sys.exit(1)

    cutoff = (date.today() - timedelta(days=7)).isoformat()
    supabase = create_client(url, key)

    # Prune nba_daily_player_stats
    r1 = supabase.table("nba_daily_player_stats").delete().lt("date", cutoff).execute()
    count1 = len(r1.data) if r1.data is not None else 0
    print(f"Pruned nba_daily_player_stats: deleted rows with date < {cutoff} (count={count1})")

    # Prune nba_daily_team_stats
    r2 = supabase.table("nba_daily_team_stats").delete().lt("date", cutoff).execute()
    count2 = len(r2.data) if r2.data is not None else 0
    print(f"Pruned nba_daily_team_stats: deleted rows with date < {cutoff} (count={count2})")

    print(f"✅ Total pruned: {count1 + count2} rows")
    return 0


if __name__ == "__main__":
    sys.exit(main())
