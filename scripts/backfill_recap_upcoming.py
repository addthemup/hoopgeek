#!/usr/bin/env python3
"""
Diagnose missing game_recap / upcoming posts by America/New_York slate date, then optionally
backfill via automate-game-recaps and automate-upcoming edge functions.

Loads VITE_SUPABASE_URL (or SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY from environment
(e.g. source .env.local before running).

Usage:
  cd hoopgeek && set -a && source .env.local && set +a && python3 -u scripts/backfill_recap_upcoming.py --days 14 --dry-run
  cd hoopgeek && set -a && source .env.local && set +a && python3 -u scripts/backfill_recap_upcoming.py --days 14 --apply
"""

from __future__ import annotations

import argparse
import json
import os
import ssl
import sys
import time
import urllib.error
import urllib.request

import certifi
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

NY = ZoneInfo("America/New_York")

_SSL = ssl.create_default_context(cafile=certifi.where())


def _env_url() -> str:
    u = (os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL") or "").rstrip("/")
    if not u:
        print("Missing SUPABASE_URL or VITE_SUPABASE_URL", file=sys.stderr)
        sys.exit(1)
    return u


def _env_key() -> str:
    k = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or ""
    if not k:
        print("Missing SUPABASE_SERVICE_ROLE_KEY", file=sys.stderr)
        sys.exit(1)
    return k


def utc_ts_to_ny_date(value: str) -> str:
    """Match edge isDateInEST: calendar date in America/New_York for this timestamptz."""
    s = value.strip()
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    dt = datetime.fromisoformat(s)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(NY).date().isoformat()


def rest_headers(key: str) -> dict[str, str]:
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


def rest_get_all(
    base: str,
    path: str,
    key: str,
    params: list[tuple[str, str]],
) -> list[dict[str, Any]]:
    """Paginate PostgREST (range 0-999, 1000-1999, ...)."""
    out: list[dict[str, Any]] = []
    offset = 0
    page = 1000
    while True:
        q = "&".join(f"{k}={v}" for k, v in params)
        sep = "&" if q else ""
        url = f"{base}/rest/v1/{path}?{q}{sep}&limit={page}&offset={offset}"
        req = urllib.request.Request(url, headers=rest_headers(key), method="GET")
        with urllib.request.urlopen(req, timeout=120, context=_SSL) as resp:
            chunk = json.loads(resp.read().decode())
        if not isinstance(chunk, list):
            raise RuntimeError(f"Unexpected response: {chunk!r}")
        out.extend(chunk)
        if len(chunk) < page:
            break
        offset += page
    return out


def invoke_edge(
    base: str,
    fn: str,
    key: str,
    body: dict[str, Any],
    *,
    timeout_sec: int = 3600,
) -> tuple[int, str]:
    url = f"{base}/functions/v1/{fn}"
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        url,
        data=data,
        headers={**rest_headers(key), "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout_sec, context=_SSL) as resp:
            return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(errors="replace")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--days", type=int, default=14, help="ET calendar days to include ending today (NY)")
    p.add_argument("--dry-run", action="store_true", help="Only print diagnosis + planned backfill dates")
    p.add_argument("--apply", action="store_true", help="POST recap + upcoming for each day that needs either")
    p.add_argument("--sleep", type=float, default=2.0, help="Seconds between edge calls when applying")
    args = p.parse_args()

    if args.days < 1 or args.days > 45:
        print("--days must be 1..45", file=sys.stderr)
        sys.exit(1)
    if args.dry_run and args.apply:
        print("Use only one of --dry-run or --apply", file=sys.stderr)
        sys.exit(1)
    if not args.dry_run and not args.apply:
        print("Specify --dry-run or --apply", file=sys.stderr)
        sys.exit(1)

    base = _env_url()
    key = _env_key()

    today_ny = datetime.now(NY).date()
    start_ny = today_ny - timedelta(days=args.days - 1)
    ny_dates = [start_ny + timedelta(days=i) for i in range(args.days)]
    ny_date_set = {d.isoformat() for d in ny_dates}

    # Pull nba_games in a wide UTC window around the NY range
    utc_start = datetime.combine(start_ny - timedelta(days=1), datetime.min.time(), tzinfo=NY).astimezone(timezone.utc)
    utc_end = datetime.combine(today_ny + timedelta(days=2), datetime.max.time(), tzinfo=NY).astimezone(timezone.utc)

    games_raw = rest_get_all(
        base,
        "nba_games",
        key,
        [
            ("select", "game_id,game_date,home_team_tricode,away_team_tricode"),
            ("game_date", f"gte.{utc_start.isoformat().replace('+00:00', 'Z')}"),
            ("game_date", f"lte.{utc_end.isoformat().replace('+00:00', 'Z')}"),
            ("order", "game_date.asc"),
        ],
    )

    slate_by_date: dict[str, list[str]] = defaultdict(list)
    for g in games_raw:
        gid = str(g.get("game_id") or "")
        gd = g.get("game_date")
        home = g.get("home_team_tricode")
        away = g.get("away_team_tricode")
        if not gid or gd is None:
            continue
        if not home or not away or home == away:
            continue
        d = utc_ts_to_ny_date(str(gd))
        if d in ny_date_set:
            slate_by_date[d].append(gid)

    for d in slate_by_date:
        slate_by_date[d] = sorted(set(slate_by_date[d]))

    # feed_posts: published recaps + upcoming for those game_ids
    all_ids = sorted({gid for ids in slate_by_date.values() for gid in ids})
    if not all_ids:
        print("No nba_games in window with valid tricodes — nothing to diagnose.")
        return

    recaps: set[str] = set()
    upcoming: set[str] = set()

    # PostgREST in() batches of 100
    for i in range(0, len(all_ids), 100):
        batch = all_ids[i : i + 100]
        in_list = "(" + ",".join(batch) + ")"
        rows = rest_get_all(
            base,
            "feed_posts",
            key,
            [
                ("select", "game_id,post_type"),
                ("status", "eq.published"),
                ("post_type", "in.(game_recap,upcoming)"),
                ("game_id", f"in.{in_list}"),
            ],
        )
        for r in rows:
            pid = str(r.get("game_id") or "")
            pt = r.get("post_type")
            if pt == "game_recap":
                recaps.add(pid)
            elif pt == "upcoming":
                upcoming.add(pid)

    need_recap_dates: list[str] = []
    need_upcoming_dates: list[str] = []

    print(f"Slate window (ET): {start_ny.isoformat()} .. {today_ny.isoformat()} ({args.days} days)\n")
    print(f"{'date_et':<12} {'slate':>5} {'recap':>5} {'upc':>5} {'miss_recap':>10} {'miss_upc':>8}")
    print("-" * 52)

    for d in sorted(ny_date_set):
        ids = slate_by_date.get(d, [])
        if not ids:
            continue
        m_r = sum(1 for g in ids if g not in recaps)
        m_u = sum(1 for g in ids if g not in upcoming)
        cr = sum(1 for g in ids if g in recaps)
        cu = sum(1 for g in ids if g in upcoming)
        print(f"{d:<12} {len(ids):>5} {cr:>5} {cu:>5} {m_r:>10} {m_u:>8}")
        if m_r > 0:
            need_recap_dates.append(d)
        if m_u > 0:
            need_upcoming_dates.append(d)

    backfill_dates = sorted(set(need_recap_dates) | set(need_upcoming_dates))
    print()
    if not backfill_dates:
        print("No slate days in range need recap or upcoming (by game_id coverage).")
        return

    print(f"Backfill candidate ET dates ({len(backfill_dates)}): {', '.join(backfill_dates)}")

    if args.dry_run:
        print("\nDry run only — no edge calls. Re-run with --apply to invoke functions.")
        return

    for d in backfill_dates:
        print(f"\n=== {d} ===")
        if d in need_recap_dates:
            print("  POST automate-game-recaps ...")
            code, body = invoke_edge(base, "automate-game-recaps", key, {"date": d})
            print(f"  recap HTTP {code} {body[:500]}{'...' if len(body) > 500 else ''}")
            time.sleep(args.sleep)
        if d in need_upcoming_dates:
            print("  POST automate-upcoming ...")
            code, body = invoke_edge(base, "automate-upcoming", key, {"date": d})
            print(f"  upcoming HTTP {code} {body[:500]}{'...' if len(body) > 500 else ''}")
            time.sleep(args.sleep)

    print("\nDone.")


if __name__ == "__main__":
    main()
