#!/usr/bin/env python3
"""
Mark nba_games as Final (game_status=3) for any game that has boxscores.
Designed to run as part of daily maintenance after importing boxscores,
so "Props vs Teams" / last 10 completed games include recently imported games.
"""

import os
import sys
from pathlib import Path

try:
    from dotenv import load_dotenv
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
        print("❌ Missing VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
        sys.exit(1)

    supabase = create_client(url, key)
    try:
        supabase.rpc("mark_games_with_boxscores_final", {}).execute()
        print("✅ Marked games with boxscores as Final")
    except Exception as e:
        print(f"❌ mark_games_with_boxscores_final failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
