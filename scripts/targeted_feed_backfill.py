#!/usr/bin/env python3
"""
Targeted feed backfill in dependency order per ET slate date so link-sync can attach:
  prop_prediction + injury_report → upcoming (post_link + metadata)
  prop_results → game_recap (post_link + metadata)

For each calendar date D (America/New_York), in order:
  1. automate-prop-predictions   POST {"date": D}
  2. automate-injury-reports     POST {"date": D}
  3. automate-prop-results       POST {"date": D}
  4. automate-upcoming           POST {"date": D}   # duplicate → link sync (deployed fn)
  5. automate-game-recaps        POST {"date": D}   # duplicate → prop_results link sync

Requires deployed edge functions with link-sync behavior. Recaps still need {game_id}.json in Storage.

Env: VITE_SUPABASE_URL or SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (e.g. source .env.local)

Usage:
  python3 -u scripts/targeted_feed_backfill.py --days 14 --dry-run
  python3 -u scripts/targeted_feed_backfill.py --start-date 2026-03-14 --end-date 2026-03-27 --apply
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
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import certifi

NY = ZoneInfo("America/New_York")
_SSL = ssl.create_default_context(cafile=certifi.where())

STEPS_FULL: list[tuple[str, dict[str, str]]] = [
    ("automate-prop-predictions", {"label": "prop_predictions"}),
    ("automate-injury-reports", {"label": "injury_reports"}),
    ("automate-prop-results", {"label": "prop_results"}),
    ("automate-upcoming", {"label": "upcoming (create + link sync)"}),
    ("automate-game-recaps", {"label": "game_recaps (create + prop_results link sync)"}),
]

STEPS_LINKS_ONLY: list[tuple[str, dict[str, str]]] = [
    ("automate-upcoming", {"label": "upcoming (create + link sync)"}),
    ("automate-game-recaps", {"label": "game_recaps (create + prop_results link sync)"}),
]


def _base_key() -> tuple[str, str]:
    base = (os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL") or "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or ""
    if not base or not key:
        print("Missing SUPABASE_URL/VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY", file=sys.stderr)
        sys.exit(1)
    return base, key


def _headers(key: str) -> dict[str, str]:
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


def invoke_edge(
    base: str,
    fn: str,
    key: str,
    body: dict[str, object],
    *,
    timeout_sec: int = 3600,
) -> tuple[int, str]:
    url = f"{base}/functions/v1/{fn}"
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        url,
        data=data,
        headers={**_headers(key), "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout_sec, context=_SSL) as resp:
            return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(errors="replace")


def _parse_ymd(s: str) -> date:
    y, m, d = (int(x) for x in s.split("-"))
    return date(y, m, d)


def main() -> None:
    p = argparse.ArgumentParser(description="Targeted feed backfill with link-sync ordering")
    g = p.add_mutually_exclusive_group()
    g.add_argument("--days", type=int, help="Number of ET calendar days ending today (NY), inclusive")
    p.add_argument("--start-date", type=str, help="YYYY-MM-DD (ET slate)")
    p.add_argument("--end-date", type=str, help="YYYY-MM-DD (ET slate)")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--apply", action="store_true")
    p.add_argument("--sleep", type=float, default=4.0, help="Seconds between edge calls")
    p.add_argument("--timeout", type=int, default=3600, help="Per-request timeout seconds")
    p.add_argument(
        "--only-links",
        action="store_true",
        help="Only upcoming + game_recaps (re-run after deploying link-sync functions)",
    )
    args = p.parse_args()

    if args.dry_run == args.apply:
        print("Specify exactly one of --dry-run or --apply", file=sys.stderr)
        sys.exit(1)

    today_ny = datetime.now(NY).date()
    if args.days is not None:
        if args.days < 1 or args.days > 120:
            print("--days must be 1..120", file=sys.stderr)
            sys.exit(1)
        end_d = today_ny
        start_d = today_ny - timedelta(days=args.days - 1)
    elif args.start_date and args.end_date:
        start_d = _parse_ymd(args.start_date)
        end_d = _parse_ymd(args.end_date)
        if start_d > end_d:
            print("start-date must be <= end-date", file=sys.stderr)
            sys.exit(1)
    else:
        end_d = today_ny
        start_d = today_ny - timedelta(days=13)

    dates: list[date] = []
    cur = start_d
    while cur <= end_d:
        dates.append(cur)
        cur += timedelta(days=1)

    steps = STEPS_LINKS_ONLY if args.only_links else STEPS_FULL

    print(f"ET slate range: {start_d.isoformat()} .. {end_d.isoformat()} ({len(dates)} day(s))")
    print("Per day:", " → ".join(s[0] for s in steps))
    if not args.only_links:
        print(
            "\nNote: duplicate upcoming/recap rows get prop/injury/prop_results links only if\n"
            "  automate-upcoming + automate-game-recaps with link-sync are deployed.\n"
            "  If responses show skipped duplicate_source_ref without synced_links, deploy then:\n"
            "  python3 -u scripts/targeted_feed_backfill.py ... --only-links --apply\n"
        )
    if args.dry_run:
        print("\nDry run — no HTTP calls.")
        for d in dates:
            print(f"  {d.isoformat()}")
        return

    base, key = _base_key()

    for d in dates:
        ds = d.isoformat()
        print(f"\n{'='*60}\nDATE {ds}\n{'='*60}")
        for fn, meta in steps:
            label = meta["label"]
            print(f"  → {fn} ({label}) ...", flush=True)
            code, body = invoke_edge(
                base,
                fn,
                key,
                {"date": ds, "trigger": "targeted_backfill"},
                timeout_sec=args.timeout,
            )
            head = body[:800] + ("..." if len(body) > 800 else "")
            print(f"     HTTP {code} {head}", flush=True)
            if code >= 400:
                print(f"     !! non-success for {fn} on {ds}", file=sys.stderr)
            time.sleep(args.sleep)

    print("\nDone.")


if __name__ == "__main__":
    main()
