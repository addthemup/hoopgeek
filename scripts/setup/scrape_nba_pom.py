#!/usr/bin/env python3
"""
Scrape NBA Player of the Month (POM) for 2025-26 from Basketball Reference
and upsert into nba_pom.

Source: https://www.basketball-reference.com/awards/pom.html
- One Eastern and one Western winner per month (modern seasons).
- Handles ties (is_tie=True).

Usage:
    python3 scripts/setup/scrape_nba_pom.py --dry-run
    python3 scripts/setup/scrape_nba_pom.py

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

POM_URL = "https://www.basketball-reference.com/awards/pom.html"
USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

DEFAULT_SUPABASE_URL = "https://qbznyaimnrpibmahisue.supabase.co"
DEFAULT_SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiem55YWltbnJwaWJtYWhpc3VlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQxNTQyOCwiZXhwIjoyMDc0OTkxNDI4fQ.MwGad8G7T9G6b-6qNzyNr3o7cVZn0E4Fg7r0ISZ-5Pw"

SEASON_PATTERN = re.compile(r"^\s*(\d{4}-\d{2})\s*$")

# Full month names used on the POM page
MONTH_NAMES = {
    "October": 10, "November": 11, "December": 12,
    "January": 1, "February": 2, "March": 3,
    "April": 4, "May": 5,
}

TARGET_SEASON = "2025-26"


# ------------------------------------------------------------------
# Supabase helpers (shared pattern with scrape_nba_pow.py)
# ------------------------------------------------------------------

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


def normalize_name_for_match(name: str) -> str:
    if not name:
        return ""
    nfd = unicodedata.normalize("NFD", name)
    ascii_only = "".join(c for c in nfd if unicodedata.category(c) != "Mn")
    return " ".join(ascii_only.lower().split())


def build_player_lookup(supabase: Client) -> Dict[str, Dict]:
    lookup: Dict[str, Dict] = {}
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
    # Fallback: ilike query
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
    # Fallback: first + last name
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


# ------------------------------------------------------------------
# HTML fetch & parse
# ------------------------------------------------------------------

def fetch_pom_html() -> str:
    resp = requests.get(POM_URL, timeout=30, headers={"User-Agent": USER_AGENT})
    resp.raise_for_status()
    return resp.content.decode("utf-8", errors="replace")


def extract_all_season_blocks(html: str) -> List[Tuple[str, str]]:
    """Return list of (season, block_text) for every season on the page."""
    soup = BeautifulSoup(html, "html.parser")
    container = soup.find("div", id="content") or soup.find("body") or soup
    text = container.get_text(separator="\n")
    seasons = []
    for mo in re.finditer(r"\n\s*(\d{4}-\d{2})\s*\n", text):
        season = mo.group(1)
        start = mo.end()
        next_mo = re.search(r"\n\s*\d{4}-\d{2}\s*\n", text[start:])
        end = start + next_mo.start() if next_mo else len(text)
        block = text[start:end].strip()
        if block:
            seasons.append((season, block))
    return seasons


def parse_season_block(block: str, season: str, verbose: bool = False) -> List[Dict]:
    """
    Parse one season block into POM entries.
    Each entry: award_month, award_year, conference (E|W|None), player_name, is_tie.

    POM page layout (after BS4 get_text):
      Month names ("October", "November", ...) act as group headers.
      Under each month: "E"/"W" on own line, then player name on next line,
      or "E Name" on one line, or bare name (no conference, older seasons).
    """
    entries = []
    start_year = int(season.split("-")[0])
    end_year = start_year + 1
    lines = [ln.strip() for ln in block.splitlines() if ln.strip()]

    if verbose:
        print(f"    [parse] {season}: {len(lines)} non-empty lines")
        for idx, l in enumerate(lines[:50]):
            print(f"      line {idx:3d}: {l!r}")
        if len(lines) > 50:
            print(f"      ... ({len(lines) - 50} more lines)")

    current_month_num = None
    current_year = None
    pending_conf = None

    i = 0
    while i < len(lines):
        line = lines[i]

        # ---- Season header (skip) ----
        if SEASON_PATTERN.match(line):
            i += 1
            continue

        # ---- Month header ----
        if line in MONTH_NAMES:
            current_month_num = MONTH_NAMES[line]
            current_year = end_year if current_month_num <= 5 else start_year
            pending_conf = None
            i += 1
            continue

        if current_month_num is None:
            i += 1
            continue

        # ---- Standalone "(tie)" on its own line ----
        if line.strip("() \t").lower() == "tie":
            if entries:
                entries[-1]["is_tie"] = True
            i += 1
            continue

        # ---- Bare "E" or "W" (conference on own line) ----
        if line in ("E", "W"):
            pending_conf = line
            i += 1
            continue

        # ---- "E Name" or "W Name" on same line ----
        if line.startswith("E "):
            conf = "E"
            name_part = line[2:].strip()
        elif line.startswith("W "):
            conf = "W"
            name_part = line[2:].strip()
        elif pending_conf:
            conf = pending_conf
            name_part = line
        else:
            conf = None
            name_part = line

        pending_conf = None

        # Skip non-name tokens
        if not name_part or SEASON_PATTERN.match(name_part) or name_part in MONTH_NAMES:
            i += 1
            continue

        # Detect and strip "(tie)"
        is_tie = "(tie)" in name_part
        name_part = name_part.replace("(tie)", "").strip()

        if not name_part:
            i += 1
            continue

        entries.append({
            "award_month": current_month_num,
            "award_year": current_year,
            "conference": conf,
            "player_name": name_part,
            "is_tie": is_tie,
        })

        i += 1

    return entries


# ------------------------------------------------------------------
# Main logic
# ------------------------------------------------------------------

def run(
    dry_run: bool = False,
    verbose: bool = False,
) -> Tuple[int, List[str]]:
    """
    Fetch POM page, parse the 2025-26 season block, match players,
    and upsert into nba_pom. Returns (rows_upserted, unmatched_list).
    """
    if verbose:
        print(f"Fetching {POM_URL} ...")
    html = fetch_pom_html()
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
                unmatched.append(f"{season} {e['award_year']}-{e['award_month']:02d} {conf}: {e['player_name']}")
                if verbose:
                    print(f"    ⚠ No match: {e['player_name']}")
                continue
            row = {
                "player_id": player["id"],
                "season": season,
                "award_year": e["award_year"],
                "award_month": e["award_month"],
                "conference": e["conference"],
                "is_tie": e["is_tie"],
                "updated_at": datetime.utcnow().isoformat(),
            }
            rows_to_upsert.append(row)

    if dry_run:
        print(f"[DRY RUN] Would upsert {len(rows_to_upsert)} rows into nba_pom")
        for u in unmatched[:50]:
            print(f"  Unmatched: {u}")
        if len(unmatched) > 50:
            print(f"  ... and {len(unmatched) - 50} more")
        return len(rows_to_upsert), unmatched

    inserted = 0
    for row in rows_to_upsert:
        try:
            r = (
                supabase.table("nba_pom")
                .upsert(row, on_conflict="season,award_year,award_month,conference,player_id")
                .execute()
            )
            if r.data:
                inserted += 1
        except Exception as err:
            if verbose:
                print(f"  Error upserting {row}: {err}")
    return inserted, unmatched


def main():
    ap = argparse.ArgumentParser(description=f"Scrape NBA Player of the Month ({TARGET_SEASON}) into nba_pom")
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
