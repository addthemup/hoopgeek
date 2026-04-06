#!/usr/bin/env python3
"""
Prompt for a calendar date (YYYY-MM-DD), then list all NBA games that day via LeagueGameFinder.

Usage:
  python3 query_games_by_date.py              # type date at prompt
  python3 query_games_by_date.py -d 2026-03-18
  python3 query_games_by_date.py --gui        # calendar widget (tkcalendar if installed)
  python3 query_games_by_date.py --json       # print JSON instead of a table
"""

import nba_timeout_patch  # noqa: F401, E402

import argparse
import json
import re
import sys
import time
from datetime import datetime
from typing import Optional

import pandas as pd
from nba_api.stats.endpoints.leaguegamefinder import LeagueGameFinder
from nba_api.stats.library.parameters import PlayerOrTeamAbbreviation, SeasonTypeNullable

from discover_games_date_range import filter_nba_games, get_unique_games
from feed_error_utils import is_retryable_request_error, log_http_error
from nba_direct_fallback import fetch_leaguegamefinder_direct

try:
    from dotenv import load_dotenv
    from pathlib import Path

    _root = Path(__file__).resolve().parent.parent.parent
    load_dotenv(_root / ".env.local")
    load_dotenv(_root / ".env")
except ImportError:
    pass
except Exception:
    pass


def nba_season_string(game_date: str) -> str:
    """e.g. 2026-03-18 -> 2025-26 (season starts October)."""
    d = datetime.strptime(game_date, "%Y-%m-%d")
    y, m = d.year, d.month
    start_y = y if m >= 10 else y - 1
    return f"{start_y}-{(start_y + 1) % 100:02d}"


def validate_date_str(s: str) -> str:
    s = s.strip()
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", s):
        raise ValueError("Date must be YYYY-MM-DD (e.g. 2026-03-18)")
    datetime.strptime(s, "%Y-%m-%d")
    return s


def prompt_date_cli() -> str:
    while True:
        raw = input("Enter game date (YYYY-MM-DD, e.g. 2026-03-18): ").strip()
        try:
            return validate_date_str(raw)
        except ValueError as e:
            print(f"  {e}")


def prompt_date_gui() -> Optional[str]:
    try:
        import tkinter as tk
    except ImportError:
        print("tkinter not available; use --date or type the date at the prompt.")
        return None

    result: dict[str, Optional[str]] = {"date": None}

    try:
        from tkcalendar import Calendar  # type: ignore

        root = tk.Tk()
        root.title("Select game date")
        cal = Calendar(root, selectmode="day", date_pattern="yyyy-mm-dd")
        cal.pack(padx=10, pady=10)

        def ok_cal() -> None:
            d = cal.selection_get()
            result["date"] = d.strftime("%Y-%m-%d")
            root.destroy()

        tk.Button(root, text="OK", command=ok_cal).pack(pady=(0, 10))
        root.mainloop()
        return result["date"]
    except ImportError:
        pass

    # Fallback: simple entry dialog
    from tkinter import messagebox, ttk

    root = tk.Tk()
    root.title("Game date")
    var = tk.StringVar(value=datetime.now().strftime("%Y-%m-%d"))
    ttk.Label(root, text="YYYY-MM-DD").pack(padx=10, pady=(10, 0))
    entry = ttk.Entry(root, textvariable=var, width=14)
    entry.pack(padx=10, pady=5)

    def ok_entry() -> None:
        try:
            result["date"] = validate_date_str(var.get())
            root.destroy()
        except ValueError as e:
            messagebox.showerror("Invalid date", str(e))

    ttk.Button(root, text="OK", command=ok_entry).pack(pady=(0, 10))
    root.mainloop()
    return result["date"]


def fetch_games_for_date(
    game_date: str, max_attempts: int = 5, delay_seconds: int = 300
) -> Optional[pd.DataFrame]:
    season = nba_season_string(game_date)
    last_error: Optional[BaseException] = None
    for attempt in range(1, max_attempts + 1):
        try:
            if attempt > 1:
                print(
                    f"  Retry {attempt}/{max_attempts} for {game_date} ({season}, wait {delay_seconds}s)..."
                )
            else:
                print(f"Querying games for {game_date} (NBA season {season})...")
            game_finder = LeagueGameFinder(
                player_or_team_abbreviation=PlayerOrTeamAbbreviation.team,
                season_nullable=season,
                season_type_nullable=SeasonTypeNullable.regular,
                date_from_nullable=game_date,
                date_to_nullable=game_date,
                get_request=True,
            )
            df = game_finder.league_game_finder_results.get_data_frame()
            if df is None or df.empty:
                print(f"  No games returned for {game_date} (regular season / season filter).")
                return None
            df = filter_nba_games(df)
            if df.empty:
                print("  No NBA games after filtering (e.g. G League excluded).")
                return None
            return df
        except Exception as e:
            last_error = e
            log_http_error(f"games for {game_date} (LeagueGameFinder)", e)
            if attempt < max_attempts and is_retryable_request_error(e):
                time.sleep(delay_seconds)
                continue
            break

    if last_error is not None:
        print(f"  Trying direct stats.nba.com request for {game_date}...")
        try:
            df_direct = fetch_leaguegamefinder_direct(game_date, season)
            if df_direct is not None and not df_direct.empty:
                df_direct = filter_nba_games(df_direct)
                if not df_direct.empty:
                    print(
                        f"  Got {len(df_direct['GAME_ID'].unique())} game(s) via direct request"
                    )
                    return df_direct
        except Exception as fallback_err:
            log_http_error(f"direct leaguegamefinder for {game_date}", fallback_err)
        raise last_error
    return None


def main() -> None:
    parser = argparse.ArgumentParser(
        description="List NBA games for a date (LeagueGameFinder + NBA filter)"
    )
    parser.add_argument(
        "-d",
        "--date",
        dest="game_date",
        help="YYYY-MM-DD (skip prompt)",
    )
    parser.add_argument(
        "--gui",
        action="store_true",
        help="Pick date in a window (calendar if tkcalendar is installed)",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Print JSON { date, season, games: [...] }",
    )
    args = parser.parse_args()

    if args.game_date and args.gui:
        parser.error("Use either --date or --gui, not both")

    game_date: Optional[str] = None
    if args.game_date:
        try:
            game_date = validate_date_str(args.game_date)
        except ValueError as e:
            parser.error(str(e))
    elif args.gui:
        game_date = prompt_date_gui()
        if not game_date:
            sys.exit(1)
    elif sys.stdin.isatty():
        game_date = prompt_date_cli()
    else:
        line = sys.stdin.readline()
        if not line.strip():
            parser.error("Pipe YYYY-MM-DD or use --date")
        try:
            game_date = validate_date_str(line)
        except ValueError as e:
            parser.error(str(e))

    assert game_date is not None
    df = fetch_games_for_date(game_date)
    if df is None or df.empty:
        sys.exit(1)

    games = get_unique_games(df)
    season = nba_season_string(game_date)
    payload = {"date": game_date, "season": season, "games": games}

    if args.json:
        print(json.dumps(payload, indent=2))
    else:
        print(f"\n{game_date} — {len(games)} NBA game(s) (season {season}):\n")
        for g in games:
            print(f"  {g['game_id']}  {g['matchup']}")
        print()


if __name__ == "__main__":
    main()
