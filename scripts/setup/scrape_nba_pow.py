#!/usr/bin/env python3
"""
Scrape NBA Player of the Week (POW) for 2025-26 from Basketball Reference
and upsert into nba_pow.

Source: https://www.basketball-reference.com/awards/pow.html
- Award is given Monday for the previous Monday–Sunday. We store week_start_date (Monday).
- Handles ties (is_tie=True).

Usage:
    python3 scripts/setup/scrape_nba_pow.py --dry-run
    python3 scripts/setup/scrape_nba_pow.py

Requires: requests, beautifulsoup4, supabase (pip install ...)
"""

import os
import re
import sys
import unicodedata
import argparse
from datetime import datetime
from typing import List, Dict, Optional, Tuple

import requests
try:
    from bs4 import BeautifulSoup
except ImportError:
    print("❌ beautifulsoup4 required. pip install beautifulsoup4")
    sys.exit(1)

try:
    from supabase import create_client, Client
except ImportError:
    create_client = None
    Client = None
try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = lambda: None

POW_URL = "https://www.basketball-reference.com/awards/pow.html"
USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

DEFAULT_SUPABASE_URL = "https://qbznyaimnrpibmahisue.supabase.co"
DEFAULT_SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiem55YWltbnJwaWJtYWhpc3VlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQxNTQyOCwiZXhwIjoyMDc0OTkxNDI4fQ.MwGad8G7T9G6b-6qNzyNr3o7cVZn0E4Fg7r0ISZ-5Pw"

MONTH_ABBR = {
    "Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4, "May": 5, "Jun": 6,
    "Jul": 7, "Aug": 8, "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12,
}

SEASON_PATTERN = re.compile(r"^\s*(\d{4}-\d{2})\s*$")
DATE_PATTERN = re.compile(
    r"\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})\b",
    re.IGNORECASE,
)


def setup_supabase(verbose: bool = False) -> Client:
    if create_client is None:
        print("❌ supabase not installed. pip install supabase")
        sys.exit(1)
    if load_dotenv:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        repo_root = os.path.abspath(os.path.join(script_dir, "..", ".."))
        for p in [os.path.join(repo_root, ".env"), ".env", os.path.join(os.getcwd(), ".env")]:
            if os.path.isfile(p):
                load_dotenv(p)
                if verbose:
                    print(f"Loaded .env from {os.path.abspath(p)}")
                break
        else:
            if verbose:
                print("No .env found; using existing env vars")
    url = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL") or DEFAULT_SUPABASE_URL
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY") or DEFAULT_SUPABASE_SERVICE_ROLE_KEY
    if not url or not key:
        print("❌ Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
        sys.exit(1)
    return create_client(url, key)


def fetch_pow_html() -> str:
    resp = requests.get(POW_URL, timeout=30, headers={"User-Agent": USER_AGENT})
    resp.raise_for_status()
    return resp.content.decode("utf-8", errors="replace")


def extract_all_season_blocks(html: str) -> List[Tuple[str, str]]:
    """Return list of (season, block_text) for every season on the page."""
    soup = BeautifulSoup(html, "html.parser")
    # Use #content to avoid footer/nav bleed
    container = soup.find("div", id="content") or soup.find("body") or soup
    text = container.get_text(separator="\n")
    # Find all season headers (e.g. 2025-26, 2024-25, ...)
    seasons = []
    for mo in re.finditer(r"\n\s*(\d{4}-\d{2})\s*\n", text):
        season = mo.group(1)
        start = mo.end()
        # Next season or end of string
        next_mo = re.search(r"\n\s*\d{4}-\d{2}\s*\n", text[start:])
        end = start + next_mo.start() if next_mo else len(text)
        block = text[start:end].strip()
        if block:
            seasons.append((season, block))
    return seasons


SKIP_TOKENS = {
    "October", "November", "December", "January", "February",
    "March", "April", "May", "June",
}


def parse_season_block(block: str, season: str, verbose: bool = False) -> List[Dict]:
    """
    Parse one season block into entries.
    Each entry: week_start_date, conference (E|W|None), player_name, is_tie.

    Handles two layouts produced by BeautifulSoup get_text(separator="\\n"):
      Layout A (same line):   "E Giannis Antetokounmpo"
      Layout B (split lines): "E" then "Giannis Antetokounmpo" on next line

    Also handles "(tie)" appearing inline or on subsequent lines, and
    no-conference weeks (plain player name, no E/W prefix).
    """
    entries = []
    start_year = int(season.split("-")[0])
    end_year = start_year + 1
    lines = [ln.strip() for ln in block.splitlines() if ln.strip()]

    if verbose:
        print(f"    [parse] {season}: {len(lines)} non-empty lines")
        for idx, l in enumerate(lines[:40]):
            print(f"      line {idx:3d}: {l!r}")
        if len(lines) > 40:
            print(f"      ... ({len(lines) - 40} more lines)")

    week_start = None
    pending_conf = None  # set when we see a bare "E" or "W" on its own line

    i = 0
    while i < len(lines):
        line = lines[i]

        # ---- Season header (skip) ----
        if SEASON_PATTERN.match(line):
            i += 1
            continue

        # ---- Month header (skip) ----
        if line in SKIP_TOKENS:
            i += 1
            continue

        # ---- Date line (e.g. "Oct 26") ----
        mo = DATE_PATTERN.search(line)
        if mo:
            month_abbr = mo.group(1).capitalize()[:3]
            day = int(mo.group(2))
            month_num = MONTH_ABBR.get(month_abbr)
            if month_num:
                year = end_year if month_num <= 5 else start_year
                try:
                    week_start = datetime(year, month_num, day).date()
                except ValueError:
                    pass
            # A date line might also have "E Name" appended, e.g. "Oct 26 E Giannis..."
            remainder = line[mo.end():].strip()
            if remainder:
                # Feed it back through the conference/name logic below
                line = remainder
            else:
                pending_conf = None
                i += 1
                continue

        if week_start is None:
            i += 1
            continue

        # ---- Standalone "(tie)" on its own line ----
        # In the HTML, "(tie)" is outside the <a> tag so BS4 puts it on a
        # separate line.  Retroactively mark the last entry as a tie.
        if line.strip("() \t").lower() == "tie":
            if entries:
                entries[-1]["is_tie"] = True
            i += 1
            continue

        # ---- Conference or player-name line ----
        # Bare "E" or "W" on its own (Layout B: conference on separate line)
        if line in ("E", "W"):
            pending_conf = line
            i += 1
            continue

        # "E Name" or "W Name" on same line (Layout A)
        if line.startswith("E "):
            conf = "E"
            name_part = line[2:].strip()
        elif line.startswith("W "):
            conf = "W"
            name_part = line[2:].strip()
        elif pending_conf:
            # Previous line was bare "E" or "W"; this line is the name
            conf = pending_conf
            name_part = line
        else:
            # No conference prefix (pre-1999-00 or edge case)
            conf = None
            name_part = line

        pending_conf = None  # consumed

        # Skip things that aren't player names
        if not name_part or SEASON_PATTERN.match(name_part) or name_part in SKIP_TOKENS:
            i += 1
            continue

        # Skip if it looks like a date (next week header that wasn't caught)
        if DATE_PATTERN.match(name_part):
            i += 1
            continue

        # Detect and strip "(tie)" if it appears inline
        is_tie = "(tie)" in name_part
        name_part = name_part.replace("(tie)", "").strip()

        if not name_part:
            i += 1
            continue

        entries.append({
            "week_start_date": week_start,
            "conference": conf,
            "player_name": name_part,
            "is_tie": is_tie,
        })

        i += 1

    return entries


def normalize_name_for_match(name: str) -> str:
    if not name:
        return ""
    nfd = unicodedata.normalize("NFD", name)
    ascii_only = "".join(c for c in nfd if unicodedata.category(c) != "Mn")
    return " ".join(ascii_only.lower().split())


def build_player_lookup(supabase: Client) -> Dict[str, Dict]:
    lookup = {}
    page_size = 1000
    offset = 0
    while True:
        r = (
            supabase.table("nba_players")
            .select("id, nba_player_id, name")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        if not r.data:
            break
        for row in r.data:
            name = (row.get("name") or "").strip()
            if not name:
                continue
            key = normalize_name_for_match(name)
            if key and key not in lookup:
                lookup[key] = {"id": row["id"], "nba_player_id": row.get("nba_player_id"), "name": name}
            low = name.lower()
            if low not in lookup:
                lookup[low] = {"id": row["id"], "nba_player_id": row.get("nba_player_id"), "name": name}
        offset += page_size
        if len(r.data) < page_size:
            break
    return lookup


def match_player(
    player_name: str,
    lookup: Dict[str, Dict],
    supabase: Client,
    verbose: bool = False,
) -> Optional[Dict]:
    if not player_name or not player_name.strip():
        return None
    name = player_name.strip()
    if name in lookup:
        return lookup[name]
    if name.lower() in lookup:
        return lookup[name.lower()]
    key = normalize_name_for_match(name)
    if key in lookup:
        return lookup[key]
    try:
        r = (
            supabase.table("nba_players")
            .select("id, nba_player_id, name")
            .ilike("name", name)
            .limit(5)
            .execute()
        )
        if r.data:
            if len(r.data) == 1:
                return {"id": r.data[0]["id"], "nba_player_id": r.data[0].get("nba_player_id"), "name": r.data[0]["name"]}
            key_norm = normalize_name_for_match(name)
            for row in r.data:
                if normalize_name_for_match(row["name"]) == key_norm:
                    return {"id": row["id"], "nba_player_id": row.get("nba_player_id"), "name": row["name"]}
            return {"id": r.data[0]["id"], "nba_player_id": r.data[0].get("nba_player_id"), "name": r.data[0]["name"]}
    except Exception as e:
        if verbose:
            print(f"    [match] ilike error: {e}")
    parts = name.split()
    if len(parts) >= 2:
        try:
            r = (
                supabase.table("nba_players")
                .select("id, nba_player_id, name")
                .ilike("name", f"%{parts[0]}%")
                .ilike("name", f"%{parts[-1]}%")
                .limit(5)
                .execute()
            )
            if r.data:
                key_norm = normalize_name_for_match(name)
                for row in r.data:
                    if normalize_name_for_match(row["name"]) == key_norm:
                        return {"id": row["id"], "nba_player_id": row.get("nba_player_id"), "name": row["name"]}
                return {"id": r.data[0]["id"], "nba_player_id": r.data[0].get("nba_player_id"), "name": r.data[0]["name"]}
        except Exception as e:
            if verbose:
                print(f"    [match] first+last error: {e}")
    return None


TARGET_SEASON = "2025-26"


def run(
    dry_run: bool = False,
    verbose: bool = False,
) -> Tuple[int, List[str]]:
    """
    Fetch POW page, parse the 2025-26 season block, match players,
    and upsert into nba_pow. Returns (rows_upserted, unmatched_list).
    """
    if verbose:
        print(f"Fetching {POW_URL} ...")
    html = fetch_pow_html()
    all_seasons = extract_all_season_blocks(html)
    season_blocks = [(s, b) for s, b in all_seasons if s == TARGET_SEASON]
    if not season_blocks:
        print(f"❌ No block found for season {TARGET_SEASON}")
        return 0, []
    if verbose:
        print(f"Found {len(season_blocks)} block(s) for {TARGET_SEASON}")

    supabase = setup_supabase(verbose=verbose)
    lookup = build_player_lookup(supabase)
    if verbose:
        print(f"Loaded {len(lookup)} player names for matching")

    unmatched = []
    rows_to_upsert = []

    for season, block in season_blocks:
        entries = parse_season_block(block, season, verbose=verbose)
        if verbose:
            print(f"  {season}: {len(entries)} entries")
        for e in entries:
            player = match_player(e["player_name"], lookup, supabase, verbose=verbose)
            if not player:
                conf = e["conference"] or "—"
                unmatched.append(f"{season} {e['week_start_date']} {conf}: {e['player_name']}")
                if verbose:
                    print(f"    ⚠ No match: {e['player_name']}")
                continue
            row = {
                "player_id": player["id"],
                "season": season,
                "week_start_date": e["week_start_date"].isoformat(),
                "conference": e["conference"],
                "is_tie": e["is_tie"],
                "updated_at": datetime.utcnow().isoformat(),
            }
            rows_to_upsert.append(row)

    if dry_run:
        print(f"[DRY RUN] Would upsert {len(rows_to_upsert)} rows into nba_pow")
        for u in unmatched[:50]:
            print(f"  Unmatched: {u}")
        if len(unmatched) > 50:
            print(f"  ... and {len(unmatched) - 50} more")
        return len(rows_to_upsert), unmatched

    inserted = 0
    for row in rows_to_upsert:
        try:
            r = (
                supabase.table("nba_pow")
                .upsert(row, on_conflict="season,week_start_date,conference,player_id")
                .execute()
            )
            if r.data:
                inserted += 1
        except Exception as err:
            if verbose:
                print(f"  Error upserting {row}: {err}")
    return inserted, unmatched


def main():
    ap = argparse.ArgumentParser(description=f"Scrape NBA Player of the Week ({TARGET_SEASON}) into nba_pow")
    ap.add_argument("--dry-run", action="store_true", help="Parse and match only, do not write to DB")
    ap.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    args = ap.parse_args()

    inserted, unmatched = run(
        dry_run=args.dry_run,
        verbose=args.verbose,
    )

    print(f"✅ Done: {inserted} rows upserted")
    if unmatched:
        print(f"⚠ Unmatched ({len(unmatched)}):")
        for u in unmatched[:30]:
            print(f"   {u}")
        if len(unmatched) > 30:
            print(f"   ... and {len(unmatched) - 30} more")
    if args.dry_run and (inserted or unmatched):
        print("Re-run without --dry-run to write to the database.")


if __name__ == "__main__":
    main()
