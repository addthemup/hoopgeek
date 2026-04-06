#!/usr/bin/env python3
"""
Backfill feed posts for Team of the Night, Team of the Week, Player of the Week,
and Player of the Month by calling the deployed Supabase Edge Functions once per
slate / week / month (same logic as daily automation).

Prerequisites:
  - nba_totn, nba_totw, nba_pow, nba_pom populated for the season (maintenance / scrape scripts).
  - Edge functions deployed: automate-team-of-night, automate-team-of-week,
    automate-player-of-week, automate-player-of-month.
  - Optional: game-data JSON in Storage improves video sections (functions still create posts).

Environment:
  SUPABASE_URL or VITE_SUPABASE_URL — project URL (https://….supabase.co)
  SUPABASE_SERVICE_ROLE_KEY — service role JWT

Usage:
  export SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=…
  python3 scripts/setup/backfill_awards_feed_posts.py
  python3 scripts/setup/backfill_awards_feed_posts.py --dry-run
  python3 scripts/setup/backfill_awards_feed_posts.py --only totn --season-end 2026-03-27
  python3 scripts/setup/backfill_awards_feed_posts.py --force --delay 2.0
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
from typing import Any, Dict, List, Optional, Set, Tuple

# Use certifi CA bundle so HTTPS to Supabase works on Python installs without system certs.
def _https_context() -> Optional[ssl.SSLContext]:
    try:
        import certifi

        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        return None


HTTPS_CONTEXT = _https_context()

try:
    from supabase import create_client
except ImportError:
    print("❌ Install supabase: pip install supabase", file=sys.stderr)
    sys.exit(1)

try:
    from dotenv import load_dotenv

    _root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    for _p in (os.path.join(_root, ".env.local"), os.path.join(_root, ".env")):
        if os.path.isfile(_p):
            load_dotenv(_p)
            break
except ImportError:
    pass

DEFAULT_SEASON_START = "2025-10-21"
DEFAULT_NBA_SEASON_SLUG = "2025-26"  # nba_pow / nba_pom.season


def get_supabase_url() -> str:
    u = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL")
    if not u:
        print("❌ Set SUPABASE_URL or VITE_SUPABASE_URL", file=sys.stderr)
        sys.exit(1)
    return u.rstrip("/")


def get_service_key() -> str:
    k = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not k:
        print("❌ Set SUPABASE_SERVICE_ROLE_KEY", file=sys.stderr)
        sys.exit(1)
    return k


def edge_url(base: str, name: str) -> str:
    return f"{base}/functions/v1/{name}"


def post_function(
    base_url: str,
    service_key: str,
    function_name: str,
    payload: Dict[str, Any],
    timeout_sec: int = 400,
) -> Tuple[int, Dict[str, Any]]:
    url = edge_url(base_url, function_name)
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
            "apikey": service_key,
        },
    )
    open_kw: Dict[str, Any] = {}
    if HTTPS_CONTEXT is not None:
        open_kw["context"] = HTTPS_CONTEXT
    try:
        with urllib.request.urlopen(req, timeout=timeout_sec, **open_kw) as resp:
            raw = resp.read().decode("utf-8")
            data = json.loads(raw) if raw else {}
            return resp.status, data
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="replace")
        try:
            data = json.loads(raw) if raw else {"error": str(e)}
        except json.JSONDecodeError:
            data = {"error": raw or str(e), "http_status": e.code}
        return e.code, data
    except Exception as e:
        return 0, {"error": str(e)}


def fetch_totn_dates(client, season_start: str, season_end: str) -> List[str]:
    dates: Set[str] = set()
    offset = 0
    page = 1000
    while True:
        r = (
            client.table("nba_totn")
            .select("game_date")
            .gte("game_date", season_start)
            .lte("game_date", season_end)
            .range(offset, offset + page - 1)
            .execute()
        )
        rows = r.data or []
        for row in rows:
            gd = row.get("game_date")
            if gd is None:
                continue
            s = str(gd)[:10]
            if len(s) == 10 and s[4] == "-" and s[7] == "-":
                dates.add(s)
        if len(rows) < page:
            break
        offset += page
    return sorted(dates)


def fetch_totw_week_starts(client, season_start: str, season_end: str) -> List[str]:
    """Week rows whose week_start falls in [season_start, season_end]."""
    starts: Set[str] = set()
    offset = 0
    page = 1000
    while True:
        r = (
            client.table("nba_totw")
            .select("week_start")
            .gte("week_start", season_start)
            .lte("week_start", season_end)
            .range(offset, offset + page - 1)
            .execute()
        )
        rows = r.data or []
        for row in rows:
            ws = row.get("week_start")
            if ws is None:
                continue
            s = str(ws)[:10]
            if len(s) == 10:
                starts.add(s)
        if len(rows) < page:
            break
        offset += page
    return sorted(starts)


def fetch_pow_weeks(client, season_slug: str, season_start: str, season_end: str) -> List[str]:
    """Distinct week_start_date in range for this NBA season slug."""
    weeks: Set[str] = set()
    offset = 0
    page = 1000
    while True:
        r = (
            client.table("nba_pow")
            .select("week_start_date")
            .eq("season", season_slug)
            .gte("week_start_date", season_start)
            .lte("week_start_date", season_end)
            .range(offset, offset + page - 1)
            .execute()
        )
        rows = r.data or []
        for row in rows:
            w = row.get("week_start_date")
            if w is None:
                continue
            s = str(w)[:10]
            if len(s) == 10:
                weeks.add(s)
        if len(rows) < page:
            break
        offset += page
    return sorted(weeks)


def fetch_pom_periods(client, season_slug: str, season_start: str, season_end: str) -> List[Tuple[int, int]]:
    """Distinct (award_year, award_month) from nba_pom for season, overlapping date window."""
    pairs: Set[Tuple[int, int]] = set()
    offset = 0
    page = 1000
    while True:
        r = (
            client.table("nba_pom")
            .select("award_year, award_month")
            .eq("season", season_slug)
            .range(offset, offset + page - 1)
            .execute()
        )
        rows = r.data or []
        for row in rows:
            try:
                y = int(row["award_year"])
                m = int(row["award_month"])
            except (KeyError, TypeError, ValueError):
                continue
            if not 1 <= m <= 12:
                continue
            month_start = f"{y}-{m:02d}-01"
            if month_start > season_end:
                continue
            last_day = 31
            if m in (4, 6, 9, 11):
                last_day = 30
            elif m == 2:
                last_day = 29 if y % 4 == 0 and (y % 100 != 0 or y % 400 == 0) else 28
            month_end = f"{y}-{m:02d}-{last_day:02d}"
            if month_end < season_start:
                continue
            pairs.add((y, m))
        if len(rows) < page:
            break
        offset += page
    return sorted(pairs)


def classify_response(data: Dict[str, Any]) -> str:
    if data.get("error"):
        return "error"
    if data.get("deferred"):
        return "deferred"
    if data.get("skipped"):
        return "skipped"
    if data.get("created") is True or data.get("post_id"):
        return "created"
    if isinstance(data.get("created"), list):
        if len(data["created"]) > 0:
            return "created"
        if data.get("errors"):
            return "error"
        return "skipped"
    return "skipped"


def main() -> None:
    ap = argparse.ArgumentParser(description="Backfill TOTN/TOTW/POW/POM feed posts via Edge Functions")
    ap.add_argument("--season-start", default=DEFAULT_SEASON_START, help="First game_date / filter start (YYYY-MM-DD)")
    ap.add_argument("--season-end", default=None, help="Last date inclusive (YYYY-MM-DD); default: today UTC date")
    ap.add_argument(
        "--nba-season",
        default=DEFAULT_NBA_SEASON_SLUG,
        metavar="SLUG",
        help="nba_pow / nba_pom season column (e.g. 2025-26)",
    )
    ap.add_argument("--only", choices=("all", "totn", "totw", "pow", "pom"), default="all")
    ap.add_argument("--dry-run", action="store_true", help="List slates only; do not call Edge Functions")
    ap.add_argument("--force", action="store_true", help="Pass force:true (bypass slate checkpoints; inserts may still skip on duplicate)")
    ap.add_argument("--delay", type=float, default=1.5, help="Seconds between Edge Function calls")
    ap.add_argument("--clip-count", type=int, default=3, metavar="N", help="clip_count for TOTN/TOTW/POW/POM")
    args = ap.parse_args()

    from datetime import date, datetime

    season_end = args.season_end
    if not season_end:
        season_end = date.today().isoformat()

    base = get_supabase_url()
    key = get_service_key()
    client = create_client(base, key)

    only = args.only
    dry = args.dry_run
    force = args.force
    delay = max(0.0, args.delay)
    clip = max(1, min(10, args.clip_count))
    nba_season = args.nba_season

    summary: Dict[str, Dict[str, int]] = {
        "totn": {"created": 0, "skipped": 0, "deferred": 0, "error": 0},
        "totw": {"created": 0, "skipped": 0, "deferred": 0, "error": 0},
        "pow": {"created": 0, "skipped": 0, "deferred": 0, "error": 0},
        "pom": {"created": 0, "skipped": 0, "deferred": 0, "error": 0},
    }

    def bump(kind: str, status: str) -> None:
        if status in summary[kind]:
            summary[kind][status] += 1

    print("=" * 60)
    print("Awards feed post backfill (Edge Functions)")
    print(f"  Season window: {args.season_start} .. {season_end}")
    print(f"  Only: {only}  nba_season={nba_season}  dry_run={dry}  force={force}  delay={delay}s  clip_count={clip}")
    print(f"  Project: {base}")
    print("=" * 60)

    if only in ("all", "totn"):
        dates = fetch_totn_dates(client, args.season_start, season_end)
        print(f"\n[TOTN] {len(dates)} dates from nba_totn")
        for d in dates:
            if dry:
                print(f"  [dry-run] would POST automate-team-of-night date={d}")
                continue
            status, data = post_function(
                base,
                key,
                "automate-team-of-night",
                {"date": d, "force": force, "clip_count": clip},
            )
            st = classify_response(data)
            if status >= 400:
                st = "error"
            bump("totn", st if st in summary["totn"] else "error")
            label = f"  {d} HTTP {status} -> {st}"
            if data.get("reason") or data.get("message"):
                label += f" {data.get('reason') or data.get('message')}"
            print(label)
            time.sleep(delay)

    if only in ("all", "totw"):
        weeks = fetch_totw_week_starts(client, args.season_start, season_end)
        print(f"\n[TOTW] {len(weeks)} weeks from nba_totw")
        for ws in weeks:
            if dry:
                print(f"  [dry-run] would POST automate-team-of-week week_start={ws}")
                continue
            status, data = post_function(
                base,
                key,
                "automate-team-of-week",
                {"week_start": ws, "force": force, "clip_count": clip},
            )
            st = classify_response(data)
            if status >= 400:
                st = "error"
            bump("totw", st if st in summary["totw"] else "error")
            print(f"  {ws} HTTP {status} -> {st}")
            time.sleep(delay)

    if only in ("all", "pow"):
        pow_weeks = fetch_pow_weeks(client, nba_season, args.season_start, season_end)
        print(f"\n[POW] {len(pow_weeks)} distinct week_start_date from nba_pow")
        for ws in pow_weeks:
            if dry:
                print(f"  [dry-run] would POST automate-player-of-week week_start_date={ws}")
                continue
            status, data = post_function(
                base,
                key,
                "automate-player-of-week",
                {"week_start_date": ws, "force": force, "clip_count": clip},
            )
            st = classify_response(data)
            if status >= 400:
                st = "error"
            # POW returns created array
            if isinstance(data.get("created"), list):
                n = len(data["created"])
                if n > 0:
                    st = "created"
                elif data.get("errors"):
                    st = "error"
                else:
                    st = "skipped"
            bump("pow", st if st in summary["pow"] else "error")
            extra = ""
            if isinstance(data.get("created"), list):
                extra = f" posts={len(data['created'])}"
            if data.get("errors"):
                extra += f" errors={len(data['errors'])}"
            print(f"  {ws} HTTP {status} -> {st}{extra}")
            time.sleep(delay)

    if only in ("all", "pom"):
        periods = fetch_pom_periods(client, nba_season, args.season_start, season_end)
        print(f"\n[POM] {len(periods)} distinct (year, month) from nba_pom")
        for y, m in periods:
            if dry:
                print(f"  [dry-run] would POST automate-player-of-month award_year={y} award_month={m}")
                continue
            status, data = post_function(
                base,
                key,
                "automate-player-of-month",
                {"award_year": y, "award_month": m, "force": force, "clip_count": clip},
            )
            st = classify_response(data)
            if status >= 400:
                st = "error"
            if isinstance(data.get("created"), list):
                n = len(data["created"])
                if n > 0:
                    st = "created"
                elif data.get("errors"):
                    st = "error"
                else:
                    st = "skipped"
            bump("pom", st if st in summary["pom"] else "error")
            print(f"  {y}-{m:02d} HTTP {status} -> {st}")
            time.sleep(delay)

    print("\n" + "=" * 60)
    print("Summary (per kind: created / skipped / deferred / error)")
    for k, v in summary.items():
        if only != "all" and k != only:
            continue
        print(f"  {k}: {v}")
    print("=" * 60)


if __name__ == "__main__":
    main()
