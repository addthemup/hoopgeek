#!/usr/bin/env python3
"""
Backfill draft_prospects.image_url from ESPN headshot CDN.

Two modes:
1) From draft_rankings: use existing ESPN source_player_url (source='espn').
2) From search (--search): for prospects missing image_url, search Google or DuckDuckGo
   for "{name} {school} site:espn.com mens-college-basketball player", parse the result
   page for an ESPN player link (e.g. .../player/_/id/5142718/...) and extract the ID.

Image URL format:
  https://a.espncdn.com/combiner/i?img=/i/headshots/mens-college-basketball/players/full/{id}.png

Usage:
  python3 scripts/setup/draft-agg/backfill_prospect_images.py --dry-run
  python3 scripts/setup/draft-agg/backfill_prospect_images.py
  python3 scripts/setup/draft-agg/backfill_prospect_images.py --search   # search for ESPN ID via DDG/Google
  python3 scripts/setup/draft-agg/backfill_prospect_images.py --search --search-engine=google
  python3 scripts/setup/draft-agg/backfill_prospect_images.py --no-verify   # skip HEAD check

Override Supabase with VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
Requires: requests, supabase; selenium for --search-engine=selenium (default).
Optional: Google-Images-Search (for --search-engine=google_images; needs GOOGLE_API_KEY + GOOGLE_CSE_ID).
"""

import os
import re
import sys
import time
import argparse
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import quote_plus

import requests

try:
    from bs4 import BeautifulSoup
except ImportError:
    BeautifulSoup = None

# Selenium for browser-based search (avoids request timeouts / blocks)
try:
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.chrome.service import Service
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.common.by import By
    _SELENIUM_AVAILABLE = True
except ImportError:
    _SELENIUM_AVAILABLE = False

try:
    from supabase import create_client, Client
except ImportError:
    create_client = None
    Client = None

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = lambda: None

load_dotenv()

DEFAULT_SUPABASE_URL = os.environ.get("VITE_SUPABASE_URL", "https://qbznyaimnrpibmahisue.supabase.co")
DEFAULT_SUPABASE_SERVICE_ROLE_KEY = os.environ.get(
    "SUPABASE_SERVICE_ROLE_KEY",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiem55YWltbnJwaWJtYWhpc3VlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQxNTQyOCwiZXhwIjoyMDc0OTkxNDI4fQ.MwGad8G7T9G6b-6qNzyNr3o7cVZn0E4Fg7r0ISZ-5Pw",
)

ESPN_IMAGE_BASE = "https://a.espncdn.com/combiner/i?img=/i/headshots/mens-college-basketball/players/full"
# ESPN player page URL pattern: .../player/_/id/5142718/aj-dybantsa or .../id/5142718/...
ESPN_ID_RE = re.compile(r"/id/(\d+)(?:/|$)")

USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"


def extract_espn_id(source_player_url: Optional[str]) -> Optional[str]:
    """Extract ESPN player ID from a player page URL. Returns None if not found."""
    if not source_player_url:
        return None
    m = ESPN_ID_RE.search(source_player_url)
    return m.group(1) if m else None


def build_espn_image_url(espn_id: str) -> str:
    return f"{ESPN_IMAGE_BASE}/{espn_id}.png"


def verify_image(url: str) -> bool:
    """HEAD request to check image URL returns 200."""
    try:
        r = requests.head(url, timeout=10, headers={"User-Agent": USER_AGENT}, allow_redirects=True)
        return r.status_code == 200
    except Exception:
        return False


# Pattern to find ESPN mens-college-basketball player ID in href (avoid matching nav/other IDs like 660).
ESPN_MCB_PLAYER_HREF_RE = re.compile(
    r"mens-college-basketball/player/_/id/(\d+)(?:/|$|\?)",
    re.I,
)
# Full URL pattern for requests-based search (Google/DDG).
ESPN_PLAYER_URL_RE = re.compile(
    r"https?://(?:www\.)?espn\.com/mens-college-basketball/player/_/id/(\d+)(?:/|$)",
    re.I,
)

# Suffixes to strip when comparing names (Jr., II, etc.)
_NAME_SUFFIX_RE = re.compile(r"\s+(?:Jr\.?|II|III|IV|Sr\.?)\s*$", re.I)


def _normalize_name_for_match(s: str) -> str:
    """Lowercase, collapse spaces, strip name suffixes for matching."""
    if not s:
        return ""
    s = _NAME_SUFFIX_RE.sub("", s.strip()).strip()
    return " ".join(s.lower().split())


def _last_name_for_search(player_name_full: str) -> str:
    """Use last name only for ESPN search (e.g. 'Aj Dybantsa' -> 'dybantsa', 'Mikel Brown Jr.' -> 'brown')."""
    if not player_name_full or not player_name_full.strip():
        return ""
    s = _NAME_SUFFIX_RE.sub("", player_name_full.strip()).strip()
    parts = s.split()
    if not parts:
        return ""
    return parts[-1].lower()


def _build_chrome_driver(headless: bool = True) -> Any:
    """Build a Chrome WebDriver (reuse pattern from scrape_espn_projections)."""
    if not _SELENIUM_AVAILABLE:
        return None
    options = Options()
    if headless:
        options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--lang=en-US")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option("useAutomationExtension", False)
    chrome_binary = os.environ.get("CHROME_BINARY")
    if chrome_binary:
        options.binary_location = chrome_binary
    # Prefer Selenium Manager (avoid stale chromedriver in PATH)
    path_entries = (os.environ.get("PATH") or "").split(os.pathsep)
    filtered = [
        p for p in path_entries
        if "chromedriver" not in p.lower()
        and os.path.normpath(p.rstrip(os.pathsep).rstrip("/")) not in ("/usr/local/bin", "/usr/local")
    ]
    old_path = os.environ.get("PATH")
    try:
        os.environ["PATH"] = os.pathsep.join(filtered)
        service = Service()
        driver = webdriver.Chrome(service=service, options=options)
    finally:
        if old_path is not None:
            os.environ["PATH"] = old_path
    return driver


def _search_espn_id_selenium(
    driver: Any, last_name_query: str, player_name_full: str, timeout: int = 20
) -> Optional[str]:
    """Use Selenium to load ESPN search (by last name), then find the result card whose
    displayed name matches player_name_full and return that player's ESPN ID.
    URL: https://www.espn.com/search/_/q/{last_name}
    Parses player__Results__Item cards and matches data-track-searchresultselected or LogoTile__Title to our name.
    """
    if not last_name_query or not player_name_full:
        return None
    url = "https://www.espn.com/search/_/q/" + quote_plus(last_name_query)
    try:
        driver.get(url)
        WebDriverWait(driver, timeout).until(EC.presence_of_element_located((By.TAG_NAME, "body")))
        time.sleep(2.0)
        html = driver.page_source
    except Exception as e:
        print(f"    Selenium get failed: {e}")
        return None

    if BeautifulSoup is None:
        return None
    soup = BeautifulSoup(html, "html.parser")
    target_name = _normalize_name_for_match(player_name_full)

    # Find all <a> that point to mens-college-basketball player pages (result cards).
    for a in soup.find_all("a", href=True):
        href = a.get("href", "")
        m = ESPN_MCB_PLAYER_HREF_RE.search(href)
        if not m:
            continue
        espn_id = m.group(1)
        # Get the displayed name for this result: data-track-searchresultselected or LogoTile__Title text.
        card_name = a.get("data-track-searchresultselected") or ""
        if not card_name:
            title_el = a.select_one(".LogoTile__Title span, .LogoTile__Title")
            if title_el:
                card_name = title_el.get_text(strip=True) or ""
        if not card_name:
            continue
        if _normalize_name_for_match(card_name) == target_name:
            return espn_id
    return None


def _search_espn_id_google_images(player_name: str, school_team: Optional[str]) -> Optional[str]:
    """Use Google Custom Search (Images) API; looks for espncdn image URL and extracts player id from context. Requires GOOGLE_API_KEY + GOOGLE_CSE_ID."""
    try:
        from google_images_search import GoogleImagesSearch
    except ImportError:
        return None
    api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GCS_DEVELOPER_KEY")
    cse_id = os.environ.get("GOOGLE_CSE_ID") or os.environ.get("GCS_CX")
    if not api_key or not cse_id:
        return None
    query_parts = [player_name.strip()]
    if school_team and school_team.strip():
        query_parts.append(school_team.strip())
    query_parts.append("ESPN basketball")
    query = " ".join(query_parts)
    gis = GoogleImagesSearch(api_key, cse_id)
    try:
        gis.search(search_params={"q": query, "num": 10})
    except Exception as e:
        print(f"    Google Images Search failed: {e}")
        return None
    # Results are image URLs; we want an ESPN player page ID. Image search often returns espncdn URLs.
    # If we find an espncdn URL with /players/full/NUM.png we can use NUM.
    for result in gis.results():
        url = (result.url or "") or getattr(result, "original", "") or ""
        m = re.search(r"espncdn\.com.*?/players/full/(\d+)\.png", url, re.I)
        if m:
            return m.group(1)
    return None


def search_espn_player_id(player_name: str, school_team: Optional[str], search_engine: str = "selenium", driver: Any = None) -> Optional[str]:
    """
    Search for the player on ESPN and return their ESPN player ID if found.
    Selenium: uses https://www.espn.com/search/_/q/{name} (optionally + school).
    Others: Google/DDG with "name school site:espn.com mens-college-basketball player".
    """
    if not player_name or not player_name.strip():
        return None
    name = player_name.strip()
    school = (school_team or "").strip() or None

    if search_engine == "selenium":
        if driver is None:
            print("    Selenium driver not provided.")
            return None
        last_name = _last_name_for_search(name)
        if not last_name:
            return None
        return _search_espn_id_selenium(driver, last_name, name)

    query_parts = [name]
    if school:
        query_parts.append(school)
    query_parts.append("site:espn.com mens-college-basketball player")
    query = " ".join(query_parts)

    if search_engine == "google_images":
        return _search_espn_id_google_images(player_name.strip(), school_team)

    # requests-based: google or duckduckgo
    headers = {"User-Agent": USER_AGENT}
    if search_engine == "google":
        url = "https://www.google.com/search?q=" + quote_plus(query)
    else:
        url = "https://html.duckduckgo.com/html/?q=" + quote_plus(query)
    try:
        r = requests.get(url, timeout=15, headers=headers)
        r.raise_for_status()
    except Exception as e:
        print(f"    Search request failed: {e}")
        return None
    text = r.text
    for m in ESPN_PLAYER_URL_RE.finditer(text):
        return m.group(1)
    fallback = re.search(r"espn\.com[^\"'>\s]*?/id/(\d+)(?:/|&)", text, re.I)
    return fallback.group(1) if fallback else None


def fetch_espn_rankings_with_urls(supabase: Client, draft_year: int) -> List[Dict[str, Any]]:
    """Fetch draft_rankings rows where source=espn and source_player_url is set."""
    r = (
        supabase.table("draft_rankings")
        .select("draft_prospect_id, player_slug, draft_year, source_player_url")
        .eq("source", "espn")
        .eq("draft_year", draft_year)
        .not_.is_("source_player_url", "null")
        .execute()
    )
    return r.data or []


def get_prospect_ids_for_slugs(
    supabase: Client, draft_year: int, slug_keys: List[Tuple[Any, str]]
) -> Dict[Tuple[Any, str], str]:
    """Resolve (draft_year, player_slug) -> draft_prospect id for slugs that lack draft_prospect_id."""
    if not slug_keys:
        return {}
    keys_set = set(slug_keys)
    out: Dict[Tuple[Any, str], str] = {}
    r = (
        supabase.table("draft_prospects")
        .select("id, player_slug")
        .eq("draft_year", draft_year)
        .execute()
    )
    for row in r.data or []:
        sid = row.get("player_slug")
        if sid and (draft_year, sid) in keys_set:
            out[(draft_year, sid)] = row["id"]
    return out


def backfill(
    draft_year: int = 2026,
    dry_run: bool = False,
    verify: bool = True,
    overwrite: bool = False,
) -> None:
    if create_client is None or Client is None:
        print("❌ supabase required. pip install supabase")
        sys.exit(1)

    supabase: Client = create_client(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_SERVICE_ROLE_KEY)

    rows = fetch_espn_rankings_with_urls(supabase, draft_year)
    # Dedupe by prospect: (draft_prospect_id or (draft_year, player_slug)) -> source_player_url
    by_prospect: Dict[str, str] = {}
    missing_prospect_id: List[Tuple[str, str]] = []
    for row in rows:
        url = (row.get("source_player_url") or "").strip()
        if not url:
            continue
        pid = row.get("draft_prospect_id")
        slug = (row.get("player_slug") or "").strip()
        if pid:
            by_prospect[pid] = url
        elif slug:
            key = (row.get("draft_year", draft_year), slug)
            if key not in by_prospect:
                missing_prospect_id.append(key)
                by_prospect[f"slug:{key[0]}:{key[1]}"] = url
    # Resolve slug -> id for rows that had no draft_prospect_id
    if missing_prospect_id:
        slug_to_id = get_prospect_ids_for_slugs(supabase, draft_year, missing_prospect_id)
        for (yr, slug), prospect_id in slug_to_id.items():
            k = f"slug:{yr}:{slug}"
            if k in by_prospect:
                by_prospect[prospect_id] = by_prospect.pop(k)

    # Remove slug keys so we only have id -> url
    to_update: Dict[str, str] = {k: v for k, v in by_prospect.items() if not k.startswith("slug:")}
    if not to_update:
        print("No ESPN player URLs found in draft_rankings (source=espn). Run the ESPN scraper first.")
        return

    # Optionally filter to prospects that don't already have image_url
    if not overwrite:
        r = supabase.table("draft_prospects").select("id, image_url").in_("id", list(to_update.keys())).execute()
        existing = {row["id"]: row.get("image_url") for row in (r.data or [])}
        to_update = {pid: url for pid, url in to_update.items() if not existing.get(pid)}
        if not to_update:
            print("All prospects with ESPN data already have image_url set. Use --overwrite to replace.")
            return

    print(f"Found {len(to_update)} prospect(s) with ESPN URL to backfill.")
    updated = 0
    skipped_verify = 0
    skipped_no_id = 0
    for prospect_id, source_url in to_update.items():
        espn_id = extract_espn_id(source_url)
        if not espn_id:
            skipped_no_id += 1
            print(f"  Skip {prospect_id[:8]}...: no ESPN ID in URL {source_url[:60]}...")
            continue
        image_url = build_espn_image_url(espn_id)
        if verify and not verify_image(image_url):
            skipped_verify += 1
            print(f"  Skip {prospect_id[:8]}...: image not found {image_url}")
            continue
        if dry_run:
            print(f"  [DRY RUN] would set image_url for {prospect_id[:8]}... -> {image_url}")
            updated += 1
            continue
        try:
            supabase.table("draft_prospects").update({"image_url": image_url}).eq("id", prospect_id).execute()
            updated += 1
            print(f"  Updated {prospect_id[:8]}... -> {image_url}")
        except Exception as e:
            print(f"  ❌ {prospect_id[:8]}...: {e}")

    if skipped_no_id:
        print(f"Skipped {skipped_no_id} (no ESPN ID in URL).")
    if skipped_verify:
        print(f"Skipped {skipped_verify} (image URL returned non-200). You can set those manually or run with --no-verify.")
    print(f"Done. Updated image_url for {updated} prospect(s).")
    return updated


def fetch_prospects_missing_image(supabase: Client, draft_year: int) -> List[Dict[str, Any]]:
    """Return draft_prospects that have no image_url set."""
    r = (
        supabase.table("draft_prospects")
        .select("id, player_name_full, player_slug, school_team, image_url")
        .eq("draft_year", draft_year)
        .execute()
    )
    return [
        row for row in (r.data or [])
        if not (row.get("image_url") or "").strip()
    ]


def backfill_from_search(
    supabase: Client,
    draft_year: int,
    dry_run: bool,
    verify: bool,
    search_engine: str,
    delay_seconds: float = 2.0,
    limit: Optional[int] = None,
) -> int:
    """
    For each prospect missing image_url, search for ESPN player page and set image_url from CDN.
    """
    prospects = fetch_prospects_missing_image(supabase, draft_year)
    if limit is not None and limit > 0:
        prospects = prospects[:limit]
    if not prospects:
        print("No prospects missing image_url.")
        return 0
    if search_engine == "selenium" and not _SELENIUM_AVAILABLE:
        print("Selenium not available. Install with: pip install selenium")
        return 0
    driver = None
    if search_engine == "selenium":
        print("Starting Chrome for search (headless)...")
        driver = _build_chrome_driver(headless=True)
        if driver is None:
            print("Could not start Chrome. Install Chrome and try again, or use --search-engine=duckduckgo")
            return 0
    try:
        print(f"Searching for ESPN IDs for {len(prospects)} prospect(s) (engine={search_engine}, delay={delay_seconds}s).")
        updated = 0
        skipped_no_id = 0
        skipped_verify = 0
        for i, p in enumerate(prospects):
            pid = p.get("id")
            name = (p.get("player_name_full") or "").strip()
            school = (p.get("school_team") or "").strip() or None
            if not name:
                continue
            espn_id = search_espn_player_id(name, school, search_engine=search_engine, driver=driver)
            if not espn_id:
                skipped_no_id += 1
                print(f"  [{i+1}/{len(prospects)}] No ESPN link: {name} ({school or 'no school'})")
                time.sleep(delay_seconds)
                continue
            image_url = build_espn_image_url(espn_id)
            if verify and not verify_image(image_url):
                skipped_verify += 1
                print(f"  [{i+1}/{len(prospects)}] Image not found: {name} -> {image_url}")
                time.sleep(delay_seconds)
                continue
            if dry_run:
                print(f"  [DRY RUN] {name} -> {image_url}")
                updated += 1
                time.sleep(delay_seconds)
                continue
            try:
                supabase.table("draft_prospects").update({"image_url": image_url}).eq("id", pid).execute()
                updated += 1
                print(f"  [{i+1}/{len(prospects)}] Updated {name} -> {image_url}")
            except Exception as e:
                print(f"  ❌ {name}: {e}")
            time.sleep(delay_seconds)
        if skipped_no_id:
            print(f"Skipped {skipped_no_id} (no ESPN link in search results).")
        if skipped_verify:
            print(f"Skipped {skipped_verify} (image URL returned non-200).")
        print(f"Done. Updated image_url for {updated} prospect(s) via search.")
        return updated
    finally:
        if driver is not None:
            try:
                driver.quit()
            except Exception:
                pass


def main() -> None:
    ap = argparse.ArgumentParser(description="Backfill draft_prospects.image_url from ESPN CDN.")
    ap.add_argument("--draft-year", type=int, default=2026, help="Draft year (default 2026)")
    ap.add_argument("--dry-run", action="store_true", help="Only print what would be updated")
    ap.add_argument("--no-verify", action="store_true", help="Do not HEAD-check image URL before updating")
    ap.add_argument("--overwrite", action="store_true", help="Update even when prospect already has image_url")
    ap.add_argument("--search", action="store_true", help="For prospects missing image_url, search Google/DDG for ESPN player link and use that ID")
    ap.add_argument("--search-engine", choices=("selenium", "duckduckgo", "google", "google_images"), default="selenium", help="Search method for --search: selenium=Chrome (default), duckduckgo/google=requests, google_images=API (needs GOOGLE_API_KEY+GOOGLE_CSE_ID)")
    ap.add_argument("--delay", type=float, default=2.0, help="Seconds between search requests when using --search (default 2)")
    ap.add_argument("--limit", type=int, default=None, metavar="N", help="When using --search, only process first N prospects (for testing)")
    args = ap.parse_args()

    if create_client is None or Client is None:
        print("❌ supabase required. pip install supabase")
        sys.exit(1)
    supabase: Client = create_client(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_SERVICE_ROLE_KEY)

    # 1) From draft_rankings ESPN rows when available
    backfill(
        draft_year=args.draft_year,
        dry_run=args.dry_run,
        verify=not args.no_verify,
        overwrite=args.overwrite,
    )

    # 2) If --search, fill in the rest by searching for "name school site:espn.com mens-college-basketball player"
    if args.search:
        backfill_from_search(
            supabase,
            draft_year=args.draft_year,
            dry_run=args.dry_run,
            verify=not args.no_verify,
            search_engine=args.search_engine,
            delay_seconds=args.delay,
            limit=args.limit,
        )


if __name__ == "__main__":
    main()
