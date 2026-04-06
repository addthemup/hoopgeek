#!/usr/bin/env python3
"""
Diagnose why Team of the Night (TOTN) only shows certain dates in PostCreator.

The PostCreator dropdown is populated from the nba_totn table. TOTN rows are
created by backfill_nba_totn.py, which reads from nba_boxscores (one row per
game_date with min > 0). So:
  - If nba_totn only has 2026-02-08 → only that date was backfilled
  - Backfill only creates rows for dates that have boxscores in nba_boxscores
  - Boxscores are populated by import_daily_boxscores.py (typically run for
    "yesterday" by cron, or manually with --date)

Run: python3 scripts/setup/diagnose_totn.py
"""

import os
import sys

try:
    from supabase import create_client
except ImportError:
    print("pip install supabase")
    sys.exit(1)
try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = lambda: None

DEFAULT_URL = "https://qbznyaimnrpibmahisue.supabase.co"
DEFAULT_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiem55YWltbnJwaWJtYWhpc3VlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQxNTQyOCwiZXhwIjoyMDc0OTkxNDI4fQ.MwGad8G7T9G6b-6qNzyNr3o7cVZn0E4Fg7r0ISZ-5Pw"

def main():
    for p in [".env", os.path.join(os.path.dirname(__file__), "..", "..", ".env")]:
        if os.path.isfile(p):
            load_dotenv(p)
            break
    url = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL") or DEFAULT_URL
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY") or DEFAULT_KEY
    if not url or not key:
        print("Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
        sys.exit(1)
    supabase = create_client(url, key)

    # 1) Distinct game_dates in nba_boxscores (min > 0)
    dates_with_boxscores = set()
    offset = 0
    page = 1000
    while True:
        r = supabase.table("nba_boxscores").select("game_date").gt("min", 0).range(offset, offset + page - 1).execute()
        if not r.data:
            break
        for row in r.data:
            dates_with_boxscores.add(row["game_date"])
        offset += page
        if len(r.data) < page:
            break
    dates_with_boxscores = sorted(dates_with_boxscores)

    # 2) Rows in nba_totn
    r = supabase.table("nba_totn").select("game_date").order("game_date", desc=False).execute()
    totn_dates = sorted([row["game_date"] for row in (r.data or [])])

    # 3) nba_games final count (game_status=3) by game_date
    r = supabase.table("nba_games").select("game_date, game_status").eq("game_status", 3).execute()
    game_dates = (r.data or [])
    final_dates = set()
    for row in game_dates:
        gd = row.get("game_date")
        if gd:
            if isinstance(gd, str) and "T" in gd:
                gd = gd.split("T")[0]
            final_dates.add(gd)
    final_dates = sorted(final_dates)

    print("=" * 60)
    print("Team of the Night (TOTN) diagnosis")
    print("=" * 60)
    print()
    print("1) nba_boxscores (min > 0)")
    print(f"   Distinct game_dates: {len(dates_with_boxscores)}")
    if dates_with_boxscores:
        print(f"   Range: {dates_with_boxscores[0]} … {dates_with_boxscores[-1]}")
        if len(dates_with_boxscores) <= 15:
            print(f"   Dates: {', '.join(dates_with_boxscores)}")
        else:
            print(f"   First 5: {dates_with_boxscores[:5]}")
            print(f"   Last 5:  {dates_with_boxscores[-5:]}")
    else:
        print("   No boxscores found. Run import_daily_boxscores for the dates you need.")
    print()
    print("2) nba_totn (what PostCreator dropdown shows)")
    print(f"   Rows: {len(totn_dates)}")
    if totn_dates:
        print(f"   Dates: {', '.join(totn_dates)}")
    else:
        print("   No TOTN rows. Run: python3 scripts/setup/backfill_nba_totn.py")
    print()
    print("3) nba_games (game_status = 3 Final)")
    print(f"   Distinct game_dates with final games: {len(final_dates)}")
    if final_dates and len(final_dates) <= 20:
        print(f"   Dates: {', '.join(final_dates[:20])}{'…' if len(final_dates) > 20 else ''}")
    print()
    print("Conclusion:")
    if not dates_with_boxscores:
        print("   → No boxscores in DB. TOTN cannot be built.")
        print("   → Populate boxscores: run import_daily_boxscores.py for each date (or use your cron).")
    elif not totn_dates:
        print("   → You have boxscores but no nba_totn rows.")
        print("   → Run: python3 scripts/setup/backfill_nba_totn.py")
    elif len(totn_dates) < len(dates_with_boxscores):
        print("   → You have more boxscore dates than TOTN rows.")
        print("   → Run full backfill: python3 scripts/setup/backfill_nba_totn.py (no --date)")
    else:
        print("   → TOTN is populated from boxscores. PostCreator shows all dates in nba_totn.")
    print("   Note: PostCreator fetches the 30 most recent nba_totn rows (by game_date desc).")
    print("   If you only see one date there, your nba_totn table has at most one row in this project.")
    print()

if __name__ == "__main__":
    main()
