#!/usr/bin/env python3
"""
Scrape all four draft ranking sources and upsert into draft_rankings + draft_prospects.
Prospect = amalgamation of name matching across sources; we create prospect on first
scrape and link draft_rankings.draft_prospect_id.

Usage:
  python3 scripts/setup/draft-agg/scrape_draft_rankings.py --dry-run
  python3 scripts/setup/draft-agg/scrape_draft_rankings.py --source nbadraft_net --dry-run
  python3 scripts/setup/draft-agg/scrape_draft_rankings.py --source all

Supabase URL and service role key are hardcoded below; override with
VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY if needed.

Requires: requests, beautifulsoup4, supabase
"""

import os
import re
import sys
import unicodedata
import argparse
from datetime import datetime, date, timezone
from typing import List, Dict, Any, Optional

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

USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
DRAFT_YEAR = 2026

DEFAULT_SUPABASE_URL = "https://qbznyaimnrpibmahisue.supabase.co"
DEFAULT_SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiem55YWltbnJwaWJtYWhpc3VlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQxNTQyOCwiZXhwIjoyMDc0OTkxNDI4fQ.MwGad8G7T9G6b-6qNzyNr3o7cVZn0E4Fg7r0ISZ-5Pw"

SOURCES = {
    "tankathon": "https://tankathon.com/big_board",
    "nbadraft_net": "https://www.nbadraft.net/nba-mock-drafts/?year-mock=2026",
    "espn": "https://www.espn.com/nba/story/_/id/46886245/2026-nba-draft-big-board-rankings-top-100-prospects-players",
    "the_athletic": "https://www.nba.com/news/the-athletic-2026-nba-draft-top-100-prospects",
}

CLASS_MAP = {
    "fr.": "Freshman", "so.": "Sophomore", "jr.": "Junior", "sr.": "Senior",
    "intl.": "International", "freshman": "Freshman", "sophomore": "Sophomore",
    "junior": "Junior", "senior": "Senior", "international": "International",
}


def log(debug: bool, msg: str, *args: Any) -> None:
    if debug:
        print(msg.format(*args) if args else msg)


def normalize_name_to_slug(name: str) -> str:
    """Canonical slug for cross-source matching: lowercase, hyphenate, strip Jr./II/III."""
    if not name or not isinstance(name, str):
        return ""
    s = name.strip()
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"\s*(?:Jr\.?|II|III|IV|Sr\.?)\s*$", "", s, flags=re.IGNORECASE)
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"[^a-z0-9\s-]", "", s.lower())
    return re.sub(r"[-\s]+", "-", s).strip("-")


# Slug suffixes to strip so "mikel-brown-jr" and "mikel-brown" match one prospect
PROSPECT_SLUG_SUFFIXES = re.compile(r"-(?:jr|ii|iii|iv|sr)$", re.I)
# Known source typos / alternate slugs -> canonical prospect slug
SLUG_ALIASES = {"benett-stirtz": "bennett-stirtz"}


def canonical_prospect_slug(slug: str) -> str:
    """Normalize slug for prospect lookup/insert so Jr/II/III variants map to one prospect."""
    if not slug or not isinstance(slug, str):
        return ""
    s = slug.strip().lower()
    s = SLUG_ALIASES.get(s, s)
    s = PROSPECT_SLUG_SUFFIXES.sub("", s)
    return s.strip("-") or slug.strip().lower()


# Suffix tokens in slug -> display form (for slug_to_display_name)
_SLUG_SUFFIX_DISPLAY = {"jr": "Jr.", "ii": "II", "iii": "III", "iv": "IV", "sr": "Sr."}


def slug_to_display_name(slug: str) -> str:
    """Derive a display name from a URL slug (e.g. cameron-boozer -> Cameron Boozer, chris-cenac-jr -> Chris Cenac Jr.)."""
    if not slug or not isinstance(slug, str):
        return ""
    parts = slug.strip().split("-")
    out = []
    for i, p in enumerate(parts):
        if not p:
            continue
        low = p.lower()
        if i == len(parts) - 1 and low in _SLUG_SUFFIX_DISPLAY:
            out.append(_SLUG_SUFFIX_DISPLAY[low])
        else:
            out.append(p.capitalize())
    return " ".join(out)


def snapshot_week_monday() -> date:
    """Monday of the current week (ISO)."""
    today = date.today()
    return today - __import__("datetime").timedelta(days=today.weekday())


def setup_supabase(debug: bool = False) -> Client:
    if create_client is None:
        print("❌ supabase required. pip install supabase")
        sys.exit(1)
    if load_dotenv:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        repo_root = os.path.abspath(os.path.join(script_dir, "..", ".."))
        for p in [os.path.join(repo_root, ".env"), ".env"]:
            if os.path.isfile(p):
                load_dotenv(p)
                break
    url = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL") or DEFAULT_SUPABASE_URL
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_KEY") or DEFAULT_SUPABASE_SERVICE_ROLE_KEY
    if not url or not key:
        print("❌ Missing Supabase URL or key (check defaults in script)")
        sys.exit(1)
    log(debug, "Supabase URL: {}", url[:50] + "...")
    return create_client(url, key)


def get_or_create_prospect(
    supabase: Client,
    draft_year: int,
    row: Dict[str, Any],
    debug: bool = False,
) -> str:
    """
    Find existing draft_prospect by (draft_year, canonical slug) or create.
    row must have player_name_full, player_slug (or we derive), school_team, and optional bio.
    Returns draft_prospects.id (UUID string).
    """
    name = (row.get("player_name_full") or "").strip()
    if not name:
        raise ValueError("player_name_full required")
    raw_slug = (row.get("player_slug") or "").strip() or normalize_name_to_slug(name)
    slug = canonical_prospect_slug(raw_slug)
    school = (row.get("school_team") or "").strip() or None

    existing = (
        supabase.table("draft_prospects")
        .select("id, player_name_full, player_slug")
        .eq("draft_year", draft_year)
        .eq("player_slug", slug)
        .execute()
    )
    if existing.data and len(existing.data) > 0:
        pid = existing.data[0]["id"]
        log(debug, "    [prospect] FOUND existing prospect id={} slug={}", pid[:8], slug)
        return pid

    payload = {
        "draft_year": draft_year,
        "player_name_full": name,
        "player_slug": slug,
        "school_team": school,
        "position_primary": (row.get("position_primary") or "").strip() or None,
        "position_secondary": (row.get("position_secondary") or "").strip() or None,
        "height_ft_in": (row.get("height_ft_in") or "").strip() or None,
        "height_inches": row.get("height_inches"),
        "weight_lbs": row.get("weight_lbs"),
    }
    r = supabase.table("draft_prospects").insert(payload).execute()
    if not r.data or len(r.data) == 0:
        raise RuntimeError("draft_prospects insert returned no id")
    pid = r.data[0]["id"]
    log(debug, "    [prospect] CREATED prospect id={} slug={} name={}", pid[:8], slug, name)
    return pid


def upsert_rankings(
    supabase: Client,
    source: str,
    draft_year: int,
    snapshot_week: date,
    rows: List[Dict[str, Any]],
    dry_run: bool,
    debug: bool,
) -> int:
    """Upsert draft_rankings rows (each row must include draft_prospect_id and all required fields)."""
    if dry_run:
        log(True, "[DRY RUN] Would upsert {} rows for source={}", len(rows), source)
        for i, r in enumerate(rows[:5]):
            log(True, "  [{}] rank={} name={} prospect_id={}", i + 1, r.get("rank"), r.get("player_name_full"), (r.get("draft_prospect_id") or "")[:8])
        if len(rows) > 5:
            log(True, "  ... and {} more", len(rows) - 5)
        return len(rows)

    inserted = 0
    for r in rows:
        try:
            supabase.table("draft_rankings").upsert(
                r,
                on_conflict="source,draft_year,player_slug,snapshot_week",
            ).execute()
            inserted += 1
            if debug and inserted <= 3:
                log(True, "  upserted rank={} slug={}", r.get("rank"), r.get("player_slug"))
        except Exception as e:
            print("  ❌ upsert error:", e, "row rank=", r.get("rank"), r.get("player_name_full"))
    return inserted


def build_ranking_row(
    source: str,
    draft_year: int,
    snapshot_week: date,
    draft_prospect_id: str,
    rank: int,
    raw: Dict[str, Any],
) -> Dict[str, Any]:
    """Build one draft_rankings row for upsert (source slug = raw player_slug for uniqueness)."""
    return {
        "source": source,
        "draft_year": draft_year,
        "snapshot_week": snapshot_week.isoformat(),
        "scraped_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "rank": rank,
        "tier": raw.get("tier"),
        "player_name_full": raw.get("player_name_full") or "",
        "player_name_first": raw.get("player_name_first"),
        "player_name_last": raw.get("player_name_last"),
        "player_slug": raw.get("player_slug") or "",
        "source_player_url": raw.get("source_player_url"),
        "position_primary": raw.get("position_primary"),
        "position_secondary": raw.get("position_secondary"),
        "school_team": raw.get("school_team"),
        "height_ft_in": raw.get("height_ft_in"),
        "height_inches": raw.get("height_inches"),
        "weight_lbs": raw.get("weight_lbs"),
        "class_year": raw.get("class_year"),
        "age_years": raw.get("age_years"),
        "per36_pts": raw.get("per36_pts"),
        "per36_reb": raw.get("per36_reb"),
        "per36_ast": raw.get("per36_ast"),
        "per36_blk": raw.get("per36_blk"),
        "per36_stl": raw.get("per36_stl"),
        "per_game_pts": raw.get("per_game_pts"),
        "per_game_reb": raw.get("per_game_reb"),
        "per_game_ast": raw.get("per_game_ast"),
        "per_game_blk": raw.get("per_game_blk"),
        "per_game_stl": raw.get("per_game_stl"),
        "ts_pct": raw.get("ts_pct"),
        "usg_pct": raw.get("usg_pct"),
        "obpm": raw.get("obpm"),
        "dbpm": raw.get("dbpm"),
        "bpm": raw.get("bpm"),
        "draft_prospect_id": draft_prospect_id,
    }


# ---------- Tankathon ----------
def scrape_tankathon(debug: bool) -> List[Dict[str, Any]]:
    url = SOURCES["tankathon"]
    log(debug, "[TANKATHON] GET {}", url)
    resp = requests.get(url, timeout=30, headers={"User-Agent": USER_AGENT})
    log(debug, "[TANKATHON] status={} len={}", resp.status_code, len(resp.content))
    resp.raise_for_status()
    soup = BeautifulSoup(resp.content, "html.parser")

    SKIP_SLUGS = {"compare"}
    rows = []
    seen_slugs = set()
    # Tankathon may be React; try multiple strategies. Dedupe by slug (nav/By School/By Position repeat links).
    for a in soup.find_all("a", href=re.compile(r"/players/[a-z0-9-]+")):
        href = a.get("href", "")
        slug = href.split("/players/")[-1].strip("/").split("?")[0]
        if not slug or slug in SKIP_SLUGS or slug in seen_slugs:
            continue
        text = a.get_text(strip=True)
        if not text or len(text) < 4:
            continue
        # Try to parse "NamePos | School" or "Name"
        parts = text.split("|")
        name_part = parts[0].strip()
        school = parts[1].strip() if len(parts) > 1 else None
        pos_match = re.search(r"(PG|SG|SF|PF|C)(?:\s*/\s*(PG|SG|SF|PF|C))?", name_part, re.I)
        if pos_match:
            pos_primary = (pos_match.group(1) or "").upper()
            pos_secondary = (pos_match.group(2) or "").upper() if pos_match.lastindex and pos_match.group(2) else None
            name = re.sub(r"(PG|SG|SF|PF|C)(?:\s*/\s*(PG|SG|SF|PF|C))?", "", name_part).strip()
        else:
            name = name_part
            pos_primary = pos_secondary = None
        if not name:
            continue
        # Drop nav/junk: require "First Last" style (space) and minimal length; skip truncated text like "ompareProspects"
        if " " not in name or len(name) < 6:
            continue
        seen_slugs.add(slug)
        # Tankathon HTML often splits the first letter (e.g. rank "2" + "C" in one node, "ameron" in link). Use slug for display name.
        name = slug_to_display_name(slug)
        full_url = href if href.startswith("http") else ("https://tankathon.com" + (href if href.startswith("/") else "/" + href))
        rank = len(rows) + 1
        tier = "TIER 1" if rank <= 3 else "THE REST"  # heuristic
        rows.append({
            "rank": rank,
            "tier": tier,
            "player_name_full": name,
            "player_slug": slug,
            "source_player_url": full_url,
            "position_primary": pos_primary,
            "position_secondary": pos_secondary,
            "school_team": school,
        })
        if debug and rank <= 3:
            log(True, "  [{}] {} | {} | {}", rank, name, slug, school)

    if not rows and debug:
        log(True, "[TANKATHON] No rows from links; first 1500 chars of body:")
        body = soup.find("body") or soup
        log(True, "{}", (body.get_text() or str(body))[:1500])
    log(debug, "[TANKATHON] parsed {} rows", len(rows))
    return rows


# ---------- NBADraft.net ----------
def scrape_nbadraft_net(debug: bool) -> List[Dict[str, Any]]:
    url = SOURCES["nbadraft_net"]
    log(debug, "[NBADRAFT.NET] GET {}", url)
    resp = requests.get(url, timeout=30, headers={"User-Agent": USER_AGENT})
    log(debug, "[NBADRAFT.NET] status={} len={}", resp.status_code, len(resp.content))
    resp.raise_for_status()
    soup = BeautifulSoup(resp.content, "html.parser")

    rows = []
    tables = soup.find_all("table")
    log(debug, "[NBADRAFT.NET] found {} table(s)", len(tables))

    for t in tables:
        trs = t.find_all("tr")
        for tr in trs:
            tds = tr.find_all("td")
            if len(tds) < 6:
                continue
            try:
                rank_cell = tds[0].get_text(strip=True)
                rank = int(rank_cell) if rank_cell.isdigit() else None
                if rank is None:
                    continue
            except (ValueError, IndexError):
                continue
            # Expect: #, Team, Player, H, W, P, School, C
            team_cell = tds[1].get_text(strip=True)
            player_cell = tds[2]
            a = player_cell.find("a")
            if not a:
                continue
            name = a.get_text(strip=True)
            href = a.get("href", "")
            slug = href.rstrip("/").split("/")[-1] if href else normalize_name_to_slug(name)
            full_url = href if href.startswith("http") else f"https://www.nbadraft.net{href}" if href.startswith("/") else None
            h = tds[3].get_text(strip=True) if len(tds) > 3 else None
            w_text = tds[4].get_text(strip=True) if len(tds) > 4 else None
            w = int(w_text) if w_text and w_text.isdigit() else None
            p = tds[5].get_text(strip=True) if len(tds) > 5 else None
            school = tds[6].get_text(strip=True) if len(tds) > 6 else None
            c = tds[7].get_text(strip=True) if len(tds) > 7 else None
            class_year = CLASS_MAP.get((c or "").lower().strip(), c) if c else None
            pos_primary = pos_secondary = None
            if p:
                parts = re.split(r"\s*/\s*", p)
                pos_primary = (parts[0] or "").strip()
                pos_secondary = (parts[1] or "").strip() if len(parts) > 1 else None
            height_ft_in = h.replace("-", "'") + '"' if h and "-" in h else h

            rows.append({
                "rank": rank,
                "player_name_full": name,
                "player_slug": slug,
                "source_player_url": full_url,
                "height_ft_in": height_ft_in,
                "weight_lbs": w,
                "position_primary": pos_primary,
                "position_secondary": pos_secondary,
                "school_team": school,
                "class_year": class_year,
            })
            if debug and rank <= 3:
                log(True, "  [{}] {} | {} | {} | {}", rank, name, slug, school, class_year)

    # Dedupe by rank (page may have two tables: picks 1-30 and 31-60; avoid double 1-30)
    seen_rank = set()
    deduped = []
    for r in sorted(rows, key=lambda x: x["rank"]):
        if r["rank"] not in seen_rank:
            seen_rank.add(r["rank"])
            deduped.append(r)
    rows = deduped
    log(debug, "[NBADRAFT.NET] parsed {} rows (after dedupe)", len(rows))
    return rows


# ---------- ESPN ----------
def scrape_espn(debug: bool) -> List[Dict[str, Any]]:
    url = SOURCES["espn"]
    log(debug, "[ESPN] GET {}", url)
    resp = requests.get(url, timeout=30, headers={"User-Agent": USER_AGENT})
    log(debug, "[ESPN] status={} len={}", resp.status_code, len(resp.content))
    resp.raise_for_status()
    soup = BeautifulSoup(resp.content, "html.parser")

    rows = []
    # Top 25: h2 like "1. Darryn Peterson, PG/SG, Kansas" then subline "Freshman | Height: 6-foot-6 | Age: 19.1"
    for h2 in soup.find_all(["h2", "h3"]):
        text = h2.get_text(strip=True)
        mo = re.match(r"^(\d{1,3})\.\s+(.+)$", text)
        if not mo:
            continue
        rank = int(mo.group(1))
        rest = mo.group(2)
        if rank > 100:
            continue
        parts = [p.strip() for p in rest.split(",")]
        name = parts[0] if parts else ""
        pos_primary = pos_secondary = None
        if len(parts) > 1:
            pos_part = parts[1]
            pos_split = re.split(r"\s*/\s*", pos_part)
            pos_primary = (pos_split[0] or "").strip()
            pos_secondary = (pos_split[1] or "").strip() if len(pos_split) > 1 else None
        school = parts[2] if len(parts) > 2 else None

        a = h2.find("a")
        slug = None
        full_url = None
        if a and a.get("href"):
            full_url = a.get("href")
            if full_url and "/player/" in full_url:
                slug = full_url.rstrip("/").split("/")[-1]

        next_el = h2.find_next_sibling()
        class_year = height_ft_in = age_years = None
        if next_el:
            sub = next_el.get_text(strip=True)
            if "Height:" in sub:
                hm = re.search(r"Height:\s*([^|]+)", sub, re.I)
                if hm:
                    height_ft_in = hm.group(1).strip()
            if "Age:" in sub:
                am = re.search(r"Age:\s*([\d.]+)", sub)
                if am:
                    try:
                        age_years = float(am.group(1))
                    except ValueError:
                        pass
            if re.search(r"Freshman|Sophomore|Junior|Senior", sub, re.I):
                for k, v in CLASS_MAP.items():
                    if k in sub.lower():
                        class_year = v
                        break

        if not slug:
            slug = normalize_name_to_slug(name)
        rows.append({
            "rank": rank,
            "player_name_full": name,
            "player_slug": slug,
            "source_player_url": full_url,
            "position_primary": pos_primary,
            "position_secondary": pos_secondary,
            "school_team": school,
            "class_year": class_year,
            "height_ft_in": height_ft_in,
            "age_years": age_years,
        })
        if debug and rank <= 3:
            log(True, "  [{}] {} | {} | {}", rank, name, school, class_year)

    # 26-100: often in a block like "26. Amari Allen, SF/PF, Alabama | Age: 20.0"
    if len(rows) < 26:
        for p in soup.find_all("p"):
            text = p.get_text(strip=True)
            mo = re.match(r"^(\d{1,3})\.\s+(.+)$", text)
            if not mo:
                continue
            rank = int(mo.group(1))
            if rank <= 25 or rank > 100:
                continue
            rest = mo.group(2)
            if "|" in rest:
                left, right = rest.split("|", 1)
                rest = left
                am = re.search(r"Age:\s*([\d.]+)", right)
                age_years = float(am.group(1)) if am else None
            else:
                age_years = None
            parts = [x.strip() for x in rest.split(",")]
            name = parts[0] if parts else ""
            pos_primary = pos_secondary = None
            if len(parts) > 1:
                pos_split = re.split(r"\s*/\s*", parts[1])
                pos_primary = (pos_split[0] or "").strip()
                pos_secondary = (pos_split[1] or "").strip() if len(pos_split) > 1 else None
            school = parts[2] if len(parts) > 2 else None
            a = p.find("a", href=re.compile(r"/player/"))
            slug = full_url = None
            if a and a.get("href"):
                full_url = a.get("href")
                slug = full_url.rstrip("/").split("/")[-1]
            if not slug:
                slug = normalize_name_to_slug(name)
            rows.append({
                "rank": rank,
                "player_name_full": name,
                "player_slug": slug,
                "source_player_url": full_url,
                "position_primary": pos_primary,
                "position_secondary": pos_secondary,
                "school_team": school,
                "age_years": age_years,
            })

    rows.sort(key=lambda r: r["rank"])
    log(debug, "[ESPN] parsed {} rows", len(rows))
    return rows


# ---------- The Athletic (NBA.com syndication) ----------
def scrape_the_athletic(debug: bool) -> List[Dict[str, Any]]:
    url = SOURCES["the_athletic"]
    log(debug, "[THE ATHLETIC] GET {}", url)
    resp = requests.get(url, timeout=30, headers={"User-Agent": USER_AGENT})
    log(debug, "[THE ATHLETIC] status={} len={}", resp.status_code, len(resp.content))
    resp.raise_for_status()
    soup = BeautifulSoup(resp.content, "html.parser")

    rows = []
    tables = soup.find_all("table")
    log(debug, "[THE ATHLETIC] found {} table(s)", len(tables))

    for t in tables:
        headers = []
        thead = t.find("thead")
        if thead:
            headers = [th.get_text(strip=True).upper() for th in thead.find_all("th")]
        trs = t.find_all("tr")
        for tr in trs:
            tds = tr.find_all("td")
            if len(tds) < 3:
                continue
            try:
                rank = int(tds[0].get_text(strip=True))
            except (ValueError, IndexError):
                continue
            name = tds[1].get_text(strip=True) if len(tds) > 1 else ""
            if not name:
                continue
            slug = normalize_name_to_slug(name)
            position = tds[2].get_text(strip=True) if len(tds) > 2 else None
            school = tds[3].get_text(strip=True) if len(tds) > 3 else None
            age_text = tds[4].get_text(strip=True) if len(tds) > 4 else None
            age_years = float(age_text) if age_text and age_text.replace(".", "").isdigit() else None
            ht = tds[5].get_text(strip=True) if len(tds) > 5 else None
            pos_primary = pos_secondary = None
            if position:
                parts = re.split(r"\s*/\s*", position)
                pos_primary = (parts[0] or "").strip()
                pos_secondary = (parts[1] or "").strip() if len(parts) > 1 else None
            height_ft_in = ht.replace("-", "'") + '"' if ht and "-" in ht else ht

            rows.append({
                "rank": rank,
                "player_name_full": name,
                "player_slug": slug,
                "position_primary": pos_primary,
                "position_secondary": pos_secondary,
                "school_team": school,
                "age_years": age_years,
                "height_ft_in": height_ft_in,
            })
            if debug and rank <= 3:
                log(True, "  [{}] {} | {} | {}", rank, name, school, age_years)

    log(debug, "[THE ATHLETIC] parsed {} rows", len(rows))
    return rows


def run_source(
    supabase: Client,
    source_name: str,
    draft_year: int,
    snapshot_week: date,
    dry_run: bool,
    debug: bool,
) -> int:
    scrapers = {
        "tankathon": scrape_tankathon,
        "nbadraft_net": scrape_nbadraft_net,
        "espn": scrape_espn,
        "the_athletic": scrape_the_athletic,
    }
    fn = scrapers.get(source_name)
    if not fn:
        print("Unknown source:", source_name)
        return 0
    print("\n" + "=" * 60)
    print(f"SOURCE: {source_name}  draft_year={draft_year}  snapshot_week={snapshot_week}")
    print(f"  URL: {SOURCES.get(source_name, '')}")
    print("=" * 60)
    raw_rows = fn(debug)
    print(f"  Parsed {len(raw_rows)} rows from {source_name}")
    if debug and raw_rows:
        print("  First 3 raw rows: rank | name | slug | school")
        for r in raw_rows[:3]:
            print(f"    {r.get('rank')} | {r.get('player_name_full')} | {r.get('player_slug')} | {r.get('school_team')}")
    if not raw_rows:
        print(f"  ⚠️ No rows for {source_name}; check parser or page structure.")
        return 0

    rows_with_prospects = []
    for i, raw in enumerate(raw_rows):
        try:
            prospect_id = get_or_create_prospect(supabase, draft_year, raw, debug)
            row = build_ranking_row(
                source_name, draft_year, snapshot_week, prospect_id,
                raw["rank"], raw,
            )
            rows_with_prospects.append(row)
        except Exception as e:
            print(f"  ❌ row rank={raw.get('rank')} name={raw.get('player_name_full')}: {e}")
            if debug:
                import traceback
                traceback.print_exc()

    n = upsert_rankings(supabase, source_name, draft_year, snapshot_week, rows_with_prospects, dry_run, debug)
    print(f"  Upserted {n} draft_rankings rows for {source_name}")
    return n


def main() -> None:
    ap = argparse.ArgumentParser(description="Scrape draft rankings from all four sources")
    ap.add_argument("--source", default="all", help="tankathon | nbadraft_net | espn | the_athletic | all")
    ap.add_argument("--dry-run", action="store_true", help="Parse only; do not insert/upsert")
    ap.add_argument("--verbose", "-v", action="store_true", help="Full debug logging")
    args = ap.parse_args()

    debug = args.verbose
    snapshot_week = snapshot_week_monday()
    print("Draft rankings scraper")
    print("  draft_year =", DRAFT_YEAR)
    print("  snapshot_week =", snapshot_week)
    print("  dry_run =", args.dry_run)
    print("  verbose =", debug)

    supabase = setup_supabase(debug)
    sources_to_run = ["tankathon", "nbadraft_net", "espn", "the_athletic"] if args.source == "all" else [args.source]
    total = 0
    for src in sources_to_run:
        total += run_source(supabase, src, DRAFT_YEAR, snapshot_week, args.dry_run, debug)
    print("\n" + "=" * 60)
    print(f"TOTAL rows upserted: {total}")
    print("=" * 60)


if __name__ == "__main__":
    main()
