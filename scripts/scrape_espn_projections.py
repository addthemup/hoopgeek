#!/usr/bin/env python3
"""
Scrape ESPN Fantasy Basketball Player Projections across all pages using Selenium + ChromeDriver.

Output: JSON file with one object per player row, including all visible columns.

Usage:
  python3 scripts/scrape_espn_projections.py \
    --url https://fantasy.espn.com/basketball/players/projections \
    --pages 22 \
    --output supabase/espn_projections.json \
    --headless

Notes:
  - Requires Chrome/Chromium and a compatible chromedriver.
  - Set CHROME_BINARY and CHROMEDRIVER_PATH if auto-detection fails.
  - Falls back to parsing a local HTML file if --url points to a local path ending in .html.
"""

import argparse
import json
import os
import sys
import time
from typing import Dict, List, Any

from bs4 import BeautifulSoup

# Selenium
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException, ElementClickInterceptedException


def build_driver(headless: bool = True) -> webdriver.Chrome:
    chrome_binary = os.getenv("CHROME_BINARY")
    chromedriver_path = os.getenv("CHROMEDRIVER_PATH")

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
    options.add_experimental_option('useAutomationExtension', False)

    if chrome_binary:
        options.binary_location = chrome_binary

    # Ensure Selenium Manager is used (avoid incompatible chromedriver in PATH)
    path_entries = (os.environ.get("PATH") or "").split(os.pathsep)
    filtered = [p for p in path_entries if "chromedriver" not in p.lower()]
    os.environ["PATH"] = os.pathsep.join(filtered)

    service = Service()  # Let Selenium Manager resolve the correct driver
    driver = webdriver.Chrome(service=service, options=options)

    # Hint sites we are not automation (best-effort)
    driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {
        "source": """
            Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
        """
    })

    return driver


def wait_for_table(driver: webdriver.Chrome, timeout: int = 20) -> None:
    # Wait for any table to be present in the main content area
    WebDriverWait(driver, timeout).until(
        EC.presence_of_element_located((By.TAG_NAME, "table"))
    )


def _parse_single_table(table_tag) -> List[Dict[str, Any]]:
    # Extract headers (th)
    headers: List[str] = []
    thead = table_tag.find("thead")
    if thead:
        header_row = thead.find("tr")
        if header_row:
            for th in header_row.find_all(["th", "td"]):
                col = (th.get_text(strip=True) or "").strip()
                headers.append(col)

    # Fallback: try first row as header if thead missing
    if not headers:
        first_tr = table_tag.find("tr")
        if first_tr:
            for th in first_tr.find_all(["th", "td"]):
                headers.append((th.get_text(strip=True) or "").strip())

    # Normalize headers: ensure unique keys
    seen = {}
    norm_headers: List[str] = []
    for h in headers:
        base = h if h else "COL"
        key = base
        idx = 2
        while key in seen:
            key = f"{base}_{idx}"
            idx += 1
        seen[key] = True
        norm_headers.append(key)

    # Extract rows
    tbody = table_tag.find("tbody") or table_tag
    data: List[Dict[str, Any]] = []
    for tr in tbody.find_all("tr"):
        cells = tr.find_all(["td", "th"])
        if not cells:
            continue
        row: Dict[str, Any] = {}
        for i, cell in enumerate(cells):
            text = cell.get_text(" ", strip=True)
            link = cell.find("a")
            img = cell.find("img")
            val: Any = text
            if link and link.get("href"):
                val = {"text": text, "href": link.get("href")}
                if img and img.get("src"):
                    val["img"] = img.get("src")
            elif img and img.get("src"):
                val = {"text": text, "img": img.get("src")}

            key = norm_headers[i] if i < len(norm_headers) else f"COL_{i+1}"
            row[key] = val
        data.append(row)
    return data


def parse_player_projections(html: str) -> List[Dict[str, Any]]:
    """Parse ESPN player projections from full-projection-table divs.
    
    Extracts for each player:
    - Name, Team, Position
    - 2025 Statistics 
    - 2026 Projections
    - 2026 Outlook
    """
    soup = BeautifulSoup(html, "html.parser")
    all_player_data: List[Dict[str, Any]] = []

    # Find all player projection sections
    player_sections = soup.find_all("div", class_="full-projection-table")

    for section in player_sections:
        player_data: Dict[str, Any] = {}

        # Extract player info (Name, Team, Position)
        player_info_section = section.find("div", class_="player-info-section")
        if player_info_section:
            # Extract player name
            player_name_tag = player_info_section.find("span", class_="truncate")
            if player_name_tag:
                name_link = player_name_tag.find("a")
                if name_link:
                    player_data["Name"] = name_link.get_text(strip=True)

            # Extract team name
            team_span = player_info_section.find("span", class_="player-teamname")
            if team_span:
                player_data["Team"] = team_span.get_text(strip=True)

            # Extract position
            position_span = player_info_section.find("span", class_="position-eligibility")
            if position_span:
                player_data["Position"] = position_span.get_text(strip=True)

        # Extract statistics tables (2025 STATISTICS and 2026 PROJECTIONS)
        stat_info_section = section.find("div", class_="stat-info-section")
        if stat_info_section:
            stat_tables = stat_info_section.find_all("table", class_="Table")
            for stat_table in stat_tables:
                # Get headers
                headers: List[str] = []
                thead = stat_table.find("thead")
                if thead:
                    header_row = thead.find("tr")
                    if header_row:
                        for th in header_row.find_all("th"):
                            header_text = th.get_text(strip=True)
                            if header_text and header_text != "year":  # Skip the year column header
                                headers.append(header_text)

                # Extract data rows
                tbody = stat_table.find("tbody")
                if tbody:
                    for tr in tbody.find_all("tr"):
                        cells = tr.find_all(["td", "th"])
                        if not cells:
                            continue
                        
                        # First cell contains the year/type (2025 STATISTICS, 2026 PROJECTIONS)
                        year_cell = cells[0]
                        year_text = year_cell.get_text(strip=True)
                        
                        # Extract stats from remaining cells
                        stats: Dict[str, Any] = {}
                        for i, cell in enumerate(cells[1:], 1):  # Skip the year cell
                            if i-1 < len(headers):  # Ensure we have a header for this stat
                                stat_name = headers[i-1]
                                stats[stat_name] = cell.get_text(strip=True)
                        
                        # Store stats based on year type
                        if "2025" in year_text and "STATISTICS" in year_text:
                            player_data["2025 Statistics"] = stats
                        elif "2026" in year_text and "PROJECTIONS" in year_text:
                            player_data["2026 Projections"] = stats

        # Extract 2026 Outlook
        outlook_section = section.find("div", class_="full-projection-player-outlook")
        if outlook_section:
            outlook_content = outlook_section.find("div", class_="full-projection-player-outlook__content")
            if outlook_content:
                player_data["2026 Outlook"] = outlook_content.get_text(strip=True)

        # Only add if we have at least the player name
        if "Name" in player_data:
            all_player_data.append(player_data)

    return all_player_data


def parse_tables_merge(html: str) -> List[Dict[str, Any]]:
    """Parse all tables on the page and merge rows by index when lengths match.

    If multiple tables have the same row count, merge their columns into a single
    row object keyed by column names (with numeric suffixes to avoid collisions).
    If row counts differ, return the rows from the largest table.
    """
    soup = BeautifulSoup(html, "html.parser")
    tables = soup.find_all("table")
    if not tables:
        return []

    parsed_tables: List[List[Dict[str, Any]]] = []
    for t in tables:
        try:
            parsed_tables.append(_parse_single_table(t))
        except Exception:
            continue

    if not parsed_tables:
        return []

    # Choose target length (max rows among tables)
    max_len = max(len(tbl) for tbl in parsed_tables)
    same_len_tables = [tbl for tbl in parsed_tables if len(tbl) == max_len]

    if len(same_len_tables) <= 1:
        # Return the largest table only
        for tbl in parsed_tables:
            if len(tbl) == max_len:
                return tbl
        return parsed_tables[0]

    # Merge by row index
    merged_rows: List[Dict[str, Any]] = []
    for i in range(max_len):
        merged: Dict[str, Any] = {}
        col_seen: Dict[str, int] = {}
        for tbl in same_len_tables:
            row = tbl[i] if i < len(tbl) else {}
            for k, v in row.items():
                key = k
                if key in merged:
                    col_seen[key] = col_seen.get(key, 1) + 1
                    key = f"{key}_{col_seen[key]}"
                merged[key] = v
        merged_rows.append(merged)
    return merged_rows


def click_next_if_present(driver: webdriver.Chrome) -> bool:
    """Attempt to click the pagination next button. Return True if navigated, else False."""
    try:
        # ESPN pagination structure: button with class "Pagination__Button--next"
        next_btn = driver.find_elements(By.CSS_SELECTOR, "button.Pagination__Button--next")
        
        # Fallback: look for button with right arrow icon
        if not next_btn:
            next_btn = driver.find_elements(By.CSS_SELECTOR, "button[data-nav-item]")
            # Filter for next button (usually has data-nav-item with next page number)
            next_btn = [btn for btn in next_btn if btn.get_attribute("class") and "next" in btn.get_attribute("class").lower()]
        
        # Another fallback: look for button containing right arrow SVG
        if not next_btn:
            next_btn = driver.find_elements(By.XPATH, "//button[.//svg[contains(@viewBox, '0 0 24 24')] and .//use[contains(@xlink:href, 'caret__right')]]")

        for el in next_btn:
            try:
                disabled = el.get_attribute("disabled")
                aria_disabled = el.get_attribute("aria-disabled")
                classes = (el.get_attribute("class") or "")
                
                if disabled or aria_disabled == "true" or "disabled" in classes:
                    continue
                    
                el.click()
                return True
            except (ElementClickInterceptedException, NoSuchElementException):
                continue
    except Exception:
        return False
    return False


def is_local_html(path_or_url: str) -> bool:
    return path_or_url.lower().endswith(".html") and os.path.exists(path_or_url)


def scrape_projections(url: str, pages: int, headless: bool) -> List[Dict[str, Any]]:
    all_rows: List[Dict[str, Any]] = []

    if is_local_html(url):
        # Parse the provided local HTML snapshot (single page). Use player projections parser.
        with open(url, "r", encoding="utf-8") as f:
            html = f.read()
        page_rows = parse_player_projections(html)
        all_rows.extend(page_rows)
        return all_rows

    driver = build_driver(headless=headless)
    try:
        driver.get(url)
        wait_for_table(driver)
        time.sleep(1.0)

        for page in range(1, pages + 1):
            print(f"📄 Scraping page {page}...")
            
            # Ensure table is present/updated
            try:
                wait_for_table(driver, timeout=20)
            except TimeoutException:
                # Try once more quickly
                time.sleep(2)
                try:
                    wait_for_table(driver, timeout=10)
                except TimeoutException:
                    print(f"⚠️ Timeout waiting for table on page {page}")
                    break

            html = driver.page_source
            page_rows = parse_player_projections(html)
            print(f"   Found {len(page_rows)} players on page {page}")
            
            # Add all players (we'll deduplicate at the end)
            all_rows.extend(page_rows)
            print(f"   Added {len(page_rows)} players (total: {len(all_rows)})")
            
            # Check if we got any players at all
            if len(page_rows) == 0:
                print(f"   No players found on page {page}, stopping pagination")
                break

            # Attempt to navigate to next page unless we reached the last expected page
            if page < pages:
                moved = click_next_if_present(driver)
                if not moved:
                    print(f"   No next button found on page {page}, stopping pagination")
                    break
                # Small wait for page transition
                time.sleep(2.0)
            else:
                break
    finally:
        try:
            driver.quit()
        except Exception:
            pass

    # Deduplicate by player name
    print(f"🔍 Deduplicating {len(all_rows)} total players...")
    seen_names = set()
    unique_players = []
    duplicates = 0
    
    for player in all_rows:
        name = player.get("Name")
        if name and name not in seen_names:
            seen_names.add(name)
            unique_players.append(player)
        else:
            duplicates += 1
    
    print(f"   Removed {duplicates} duplicates")
    print(f"   Final unique players: {len(unique_players)}")
    
    return unique_players


def save_json(rows: List[Dict[str, Any]], output_path: str) -> None:
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(rows, f, ensure_ascii=False, indent=2)


def main():
    parser = argparse.ArgumentParser(description="Scrape ESPN Fantasy Basketball player projections")
    parser.add_argument("--url", default="https://fantasy.espn.com/basketball/players/projections", help="Target URL or local HTML path")
    parser.add_argument("--pages", type=int, default=22, help="Number of pages to traverse")
    parser.add_argument("--output", default="supabase/espn_projections.json", help="Output JSON file path")
    parser.add_argument("--headless", action="store_true", help="Run Chrome in headless mode")
    args = parser.parse_args()

    rows = scrape_projections(args.url, args.pages, args.headless)
    print(f"✅ Scraped {len(rows)} total rows")
    save_json(rows, args.output)
    print(f"💾 Saved to {args.output}")


if __name__ == "__main__":
    main()


