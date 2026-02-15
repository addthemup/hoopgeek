#!/usr/bin/env python3
"""
Opponent Back-to-Back Analysis
===============================
Finds which NBA teams have the most "opponent back-to-backs" —
i.e., games where they face a team playing the SECOND leg of a back-to-back.

Definitions:
  - Back-to-back: a team plays games on consecutive calendar days.
  - Opp B2B:      when Team A plays Team B, and Team B is on the
                   second leg of their own back-to-back.

Season window: 2025-10-21  –  2026-04-12 (regular season)
"""

from collections import defaultdict
from datetime import timedelta
from supabase import create_client

# ── Supabase credentials ──────────────────────────────────────────────
SUPABASE_URL = "https://qbznyaimnrpibmahisue.supabase.co"
SUPABASE_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiem55YWltbnJwaWJtYWhpc3VlIiwi"
    "cm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQxNTQyOCwiZXhwIjoyMDc0"
    "OTkxNDI4fQ.MwGad8G7T9G6b-6qNzyNr3o7cVZn0E4Fg7r0ISZ-5Pw"
)

DATE_START = "2025-10-21"
DATE_END   = "2026-04-12"

# ── Fetch games ───────────────────────────────────────────────────────
print("Connecting to Supabase and fetching nba_games …")
sb = create_client(SUPABASE_URL, SUPABASE_KEY)

# game_date is stored as a timestamptz — filter by the date portion
# Supabase PostgREST range: gte / lte on the ISO string works fine.
all_games = []
page_size = 1000
offset = 0

while True:
    resp = (
        sb.table("nba_games")
        .select("game_id, game_date, home_team_tricode, away_team_tricode")
        .gte("game_date", f"{DATE_START}T00:00:00")
        .lte("game_date", f"{DATE_END}T23:59:59")
        .order("game_date")
        .range(offset, offset + page_size - 1)
        .execute()
    )
    rows = resp.data
    if not rows:
        break
    all_games.extend(rows)
    if len(rows) < page_size:
        break
    offset += page_size

print(f"Fetched {len(all_games)} games between {DATE_START} and {DATE_END}.\n")

if not all_games:
    print("No games found — check your date range or table contents.")
    raise SystemExit(1)

# ── Build each team's set of game dates (EST calendar day) ────────────
from datetime import datetime, timezone

team_dates: dict[str, set] = defaultdict(set)

for g in all_games:
    # game_date comes back as an ISO string (UTC).  Convert to EST date.
    raw = g["game_date"]
    if isinstance(raw, str):
        # Handle various ISO formats
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    else:
        dt = raw

    # Convert UTC → EST (UTC-5) to get the "calendar day" of the game
    est_offset = timezone(timedelta(hours=-5))
    est_date = dt.astimezone(est_offset).date()

    team_dates[g["home_team_tricode"]].add(est_date)
    team_dates[g["away_team_tricode"]].add(est_date)

# ── Identify every (team, date) that is the SECOND leg of a B2B ──────
b2b_second_legs: dict[str, set] = {}

for team, dates in team_dates.items():
    second_legs = set()
    for d in sorted(dates):
        if (d - timedelta(days=1)) in dates:
            second_legs.add(d)
    b2b_second_legs[team] = second_legs

# Print B2B totals per team for context
print("=" * 55)
print(f"{'TEAM':<6} {'TOTAL B2B 2nd LEGS':>20}")
print("=" * 55)
b2b_counts = {t: len(legs) for t, legs in b2b_second_legs.items()}
for team, cnt in sorted(b2b_counts.items(), key=lambda x: -x[1]):
    print(f"{team:<6} {cnt:>20}")
print()

# ── Count opponent B2Bs for every team ────────────────────────────────
# For each game, if the HOME team is on a B2B 2nd leg, the AWAY team
# gets +1 opp-B2B.  And vice versa.
opp_b2b_count: dict[str, int] = defaultdict(int)
opp_b2b_details: dict[str, list] = defaultdict(list)

for g in all_games:
    raw = g["game_date"]
    if isinstance(raw, str):
        dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    else:
        dt = raw

    est_offset = timezone(timedelta(hours=-5))
    est_date = dt.astimezone(est_offset).date()

    home = g["home_team_tricode"]
    away = g["away_team_tricode"]

    # If the HOME team is on a B2B second leg, the AWAY team benefits
    if est_date in b2b_second_legs.get(home, set()):
        opp_b2b_count[away] += 1
        opp_b2b_details[away].append(
            f"  {est_date}  vs {home} (home, B2B 2nd leg)"
        )

    # If the AWAY team is on a B2B second leg, the HOME team benefits
    if est_date in b2b_second_legs.get(away, set()):
        opp_b2b_count[home] += 1
        opp_b2b_details[home].append(
            f"  {est_date}  vs {away} (away, B2B 2nd leg)"
        )

# ── Print the leaderboard ────────────────────────────────────────────
print("=" * 55)
print(f"{'RANK':<6} {'TEAM':<6} {'OPP B2Bs':>10}")
print("=" * 55)

ranked = sorted(opp_b2b_count.items(), key=lambda x: -x[1])
for rank, (team, count) in enumerate(ranked, start=1):
    print(f"{rank:<6} {team:<6} {count:>10}")

print()

# ── Show detailed breakdown for ALL teams ─────────────────────────────
print("DETAILED BREAKDOWN (All Teams):")
print("-" * 55)
for team, _ in ranked:
    print(f"\n{team} — {opp_b2b_count[team]} opp B2Bs:")
    for detail in sorted(opp_b2b_details[team]):
        print(detail)
