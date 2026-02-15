#!/usr/bin/env python3
"""
List games for 2026-02-03 and 2026-02-04 from:
1) SportsGameOdds API (props source)
2) Supabase nba_games
3) Supabase player_props_games
So you can compare and spot discrepancies.
"""

import os
import sys
from datetime import datetime, timedelta

try:
    from dotenv import load_dotenv
    load_dotenv('.env.local')
    load_dotenv('.env')
except Exception:
    pass

API_KEY = os.getenv("VITE_SPORTS_ODDS_API_KEY") or os.getenv("SPORTS_ODDS_API_KEY")
SUPABASE_URL = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

def main():
    from supabase import create_client
    from sports_odds_api import SportsGameOdds

    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Missing Supabase env vars")
        sys.exit(1)
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    dates = ['2026-02-03', '2026-02-04']

    # --- 1) SportsGameOdds API ---
    print("=" * 70)
    print("1) SPORTS GAME ODDS API (props import source)")
    print("=" * 70)
    client = SportsGameOdds(api_key_param=API_KEY)
    page = client.events.get(league_id='NBA', odds_available=True, finalized=False, limit=50)
    events_by_date = {}
    for event in page.data or []:
        if not getattr(event, 'status', None):
            continue
        starts_at = getattr(event.status, 'starts_at', None)
        if not starts_at:
            continue
        try:
            dt = datetime.fromisoformat(str(starts_at).replace('Z', '+00:00'))
            d = dt.strftime('%Y-%m-%d')
            if d not in events_by_date:
                events_by_date[d] = []
            events_by_date[d].append(event)
        except Exception:
            pass

    for d in dates:
        evs = events_by_date.get(d, [])
        print(f"\n  {d} ({len(evs)} events)")
        for e in evs:
            eid = getattr(e, 'eventID', '?')
            home = away = '?'
            if getattr(e, 'teams', None):
                if getattr(e.teams, 'home', None) and getattr(e.teams.home, 'names', None):
                    home = e.teams.home.names.long or e.teams.home.names.medium or '?'
                if getattr(e.teams, 'away', None) and getattr(e.teams.away, 'names', None):
                    away = e.teams.away.names.long or e.teams.away.names.medium or '?'
            starts = getattr(getattr(e, 'status', None), 'starts_at', None)
            start_str = starts.isoformat() if hasattr(starts, 'isoformat') else str(starts) if starts else ''
            print(f"    event_id={eid}  {away} @ {home}  starts_at={start_str}")

    # --- 2) nba_games ---
    print("\n" + "=" * 70)
    print("2) SUPABASE nba_games")
    print("=" * 70)
    for d in dates:
        # nba_games.game_date can be timestamp; use range for the day (through start of next day)
        next_d = (datetime.strptime(d, '%Y-%m-%d') + timedelta(days=1)).strftime('%Y-%m-%d')
        r = supabase.table('nba_games').select('game_id, game_date, home_team_tricode, away_team_tricode, home_team_name, away_team_name').gte('game_date', d).lt('game_date', next_d).order('game_date').execute()
        rows = r.data or []
        print(f"\n  {d} ({len(rows)} games)")
        for row in rows:
            gd = row.get('game_date', '')
            print(f"    game_id={row.get('game_id')}  {row.get('away_team_tricode')} @ {row.get('home_team_tricode')}  game_date={gd}  ({row.get('away_team_name')} @ {row.get('home_team_name')})")

    # --- 3) player_props_games ---
    print("\n" + "=" * 70)
    print("3) SUPABASE player_props_games")
    print("=" * 70)
    for d in dates:
        r = supabase.table('player_props_games').select('id, event_id, game_date, home_team_tricode, away_team_tricode, home_team, away_team, nba_game_id').eq('game_date', d).execute()
        rows = r.data or []
        print(f"\n  {d} ({len(rows)} games)")
        for row in rows:
            print(f"    id={row.get('id')}  event_id={row.get('event_id')}  {row.get('away_team_tricode')} @ {row.get('home_team_tricode')}  nba_game_id={row.get('nba_game_id')}  ({row.get('away_team')} @ {row.get('home_team')})")

    print("\n" + "=" * 70)

if __name__ == '__main__':
    main()
