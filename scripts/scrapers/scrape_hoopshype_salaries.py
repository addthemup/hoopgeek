#!/usr/bin/env python3
"""
HoopsHype NBA Player Salaries Scraper
=====================================

This script scrapes NBA player salary data from HoopsHype.com
and saves it to a JSON file for database import.

Usage:
    python3 scripts/scrape_hoopshype_salaries.py [--pages N] [--headless]

Requirements:
    - selenium
    - beautifulsoup4
    - requests
"""

import os
import sys
import time
import json
import argparse
from typing import List, Dict, Any, Optional
from urllib.parse import urljoin

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from bs4 import BeautifulSoup


def build_driver(headless: bool = True) -> webdriver.Chrome:
    """Build and configure Chrome WebDriver"""
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

    # Use Selenium Manager for automatic driver management
    driver = webdriver.Chrome(options=options)

    # Hint sites we are not automation (best-effort)
    driver.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {
        "source": """
            Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
        """
    })

    return driver


def wait_for_table(driver: webdriver.Chrome, timeout: int = 30) -> None:
    """Wait for the salary table to load"""
    try:
        WebDriverWait(driver, timeout).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "table.bserqJ__bserqJ"))
        )
        print("✅ Salary table loaded successfully")
    except TimeoutException:
        print("⚠️  Timeout waiting for salary table to load")


def parse_salary_table(html: str) -> List[Dict[str, Any]]:
    """Parse the salary table HTML and extract player data"""
    soup = BeautifulSoup(html, "html.parser")
    players: List[Dict[str, Any]] = []

    # Find the salary table
    table = soup.find("table", class_="bserqJ__bserqJ")
    if not table:
        print("❌ Could not find salary table")
        return players

    # Get table headers
    headers = []
    thead = table.find("thead")
    if thead:
        header_row = thead.find("tr")
        if header_row:
            for th in header_row.find_all("th"):
                headers.append(th.get_text(strip=True))

    print(f"📋 Table headers: {headers}")

    # Parse table rows
    tbody = table.find("tbody")
    if not tbody:
        print("❌ Could not find table body")
        return players

    rows = tbody.find_all("tr")
    print(f"📊 Found {len(rows)} player rows")

    for row in rows:
        cells = row.find_all("td")
        if len(cells) < 6:  # Need at least rank, player, and 4 salary columns
            continue

        try:
            # Extract rank (first cell)
            rank = cells[0].get_text(strip=True)
            
            # Extract player name and team (second cell)
            player_cell = cells[1]
            player_name = None
            team = None
            
            # Find player name in the link
            player_link = player_cell.find("a", class_="_9hWOUd__9hWOUd")
            if player_link:
                name_div = player_link.find("div", class_="_0cD6l-__0cD6l-")
                if name_div:
                    player_name = name_div.get_text(strip=True)
            
            # Find team logo to determine team
            team_img = player_cell.find("img")
            if team_img:
                # Extract team from image src - teams are numbered
                img_src = team_img.get("src", "")
                if "nba/logos/" in img_src:
                    # Extract team number from URL
                    team_num = img_src.split("nba/logos/")[1].split(".")[0]
                    team = get_team_name_from_number(team_num)
            
            # Extract salary data (columns 2-5)
            salary_2025_26 = parse_salary_value(cells[2])
            salary_2026_27 = parse_salary_value(cells[3])
            salary_2027_28 = parse_salary_value(cells[4])
            salary_2028_29 = parse_salary_value(cells[5])

            if player_name:
                player_data = {
                    "Name": player_name,
                    "Team": team,
                    "2025-26": salary_2025_26,
                    "2026-27": salary_2026_27,
                    "2027-28": salary_2027_28,
                    "2028-29": salary_2028_29
                }
                players.append(player_data)
                print(f"✅ Parsed: {player_name} ({team}) - ${salary_2025_26 or 'N/A'}")
            else:
                print(f"⚠️  Could not extract player name from row")

        except Exception as e:
            print(f"❌ Error parsing row: {e}")
            continue

    return players


def parse_salary_value(cell) -> Optional[str]:
    """Parse salary value from table cell"""
    if not cell:
        return None
    
    # Check if cell contains "-" (no salary)
    cell_text = cell.get_text(strip=True)
    if cell_text == "-":
        return None
    
    # Look for salary span with class (the actual salary amount)
    salary_spans = cell.find_all("span")
    for span in salary_spans:
        # Skip spans that contain sup elements (P, T, Q, etc.)
        if span.find("sup"):
            continue
            
        salary_text = span.get_text(strip=True)
        if salary_text and salary_text.startswith("$"):
            return salary_text
    
    return None


def get_team_name_from_number(team_num: str) -> str:
    """Map team number to team name based on HoopsHype's numbering"""
    team_mapping = {
        "1": "Atlanta Hawks",
        "2": "Boston Celtics", 
        "3": "Brooklyn Nets",
        "4": "Charlotte Hornets",
        "5": "Cleveland Cavaliers",
        "6": "Los Angeles Lakers",
        "7": "Denver Nuggets",
        "8": "Detroit Pistons",
        "9": "Golden State Warriors",
        "10": "Phoenix Suns",
        "11": "Houston Rockets",
        "12": "LA Clippers",
        "13": "Los Angeles Lakers",  # Duplicate for Lakers
        "14": "Indiana Pacers",
        "15": "Milwaukee Bucks",
        "16": "Miami Heat",
        "17": "Minnesota Timberwolves",
        "18": "Minnesota Timberwolves",  # Duplicate
        "19": "New Orleans Pelicans",
        "20": "Philadelphia 76ers",
        "21": "Phoenix Suns",  # Duplicate
        "22": "Portland Trail Blazers",
        "23": "Chicago Bulls",
        "24": "Sacramento Kings",
        "25": "San Antonio Spurs",
        "26": "Utah Jazz",
        "27": "Orlando Magic",
        "28": "Washington Wizards",
        "29": "Toronto Raptors",
        "30": "New York Knicks"
    }
    return team_mapping.get(team_num, f"Team {team_num}")


def click_next_if_present(driver: webdriver.Chrome) -> bool:
    """Click the next page button if present"""
    try:
        # Look for next button - it's the second button in the pagination
        next_button = driver.find_element(By.CSS_SELECTOR, "button.hd3Vfp__hd3Vfp._3JhbLM__3JhbLM")
        if next_button.is_enabled():
            driver.execute_script("arguments[0].click();", next_button)
            print("✅ Clicked next page button")
            return True
        else:
            print("ℹ️  Next button is disabled (last page)")
            return False
    except NoSuchElementException:
        print("ℹ️  No next button found")
        return False
    except Exception as e:
        print(f"❌ Error clicking next button: {e}")
        return False


def save_players_to_json(players: List[Dict[str, Any]], filename: str) -> None:
    """Save players data to JSON file"""
    try:
        with open(filename, "w", encoding="utf-8") as f:
            json.dump(players, f, indent=2, ensure_ascii=False)
        print(f"💾 Saved {len(players)} players to {filename}")
    except Exception as e:
        print(f"❌ Error saving to {filename}: {e}")


def scrape_salaries(url: str, pages: int, headless: bool) -> List[Dict[str, Any]]:
    """Scrape salary data from HoopsHype"""
    all_players: List[Dict[str, Any]] = []
    output_file = "supabase/hoopshype_salaries.json"
    
    driver = build_driver(headless=headless)
    try:
        print(f"🌐 Navigating to: {url}")
        driver.get(url)
        wait_for_table(driver)
        time.sleep(2.0)

        for page in range(1, pages + 1):
            print(f"\n📄 Processing page {page}/{pages}")
            
            html = driver.page_source
            page_players = parse_salary_table(html)
            all_players.extend(page_players)
            
            print(f"📊 Found {len(page_players)} players on page {page}")
            
            # Save incrementally after each page
            if page_players:
                save_players_to_json(all_players, output_file)
            
            if len(page_players) == 0:
                print("⚠️  No players found on this page, stopping")
                break

            if page < pages:
                moved = click_next_if_present(driver)
                if not moved:
                    print("ℹ️  Could not navigate to next page, stopping")
                    break
                time.sleep(15.0)  # Wait 15 seconds between pages
            else:
                break

    except KeyboardInterrupt:
        print("\n⚠️  Scraping interrupted by user")
    except Exception as e:
        print(f"\n❌ Error during scraping: {e}")
    finally:
        try:
            driver.quit()
        except Exception:
            pass

    # Remove duplicates based on player name
    seen_names = set()
    unique_players = []
    duplicates = 0
    
    for player in all_players:
        name = player.get("Name")
        if name and name not in seen_names:
            seen_names.add(name)
            unique_players.append(player)
        else:
            duplicates += 1
    
    print(f"\n📊 Summary:")
    print(f"   Total players scraped: {len(all_players)}")
    print(f"   Duplicates removed: {duplicates}")
    print(f"   Unique players: {len(unique_players)}")
    
    # Final save with deduplicated data
    if unique_players:
        save_players_to_json(unique_players, output_file)
    
    return unique_players


def main():
    """Main function"""
    parser = argparse.ArgumentParser(description="Scrape HoopsHype NBA player salaries")
    parser.add_argument("--pages", type=int, default=33, help="Number of pages to scrape (default: 33)")
    parser.add_argument("--headless", action="store_true", default=True, help="Run in headless mode")
    parser.add_argument("--no-headless", action="store_true", help="Run with browser visible")
    
    args = parser.parse_args()
    
    if args.no_headless:
        args.headless = False
    
    url = "https://www.hoopshype.com/salaries/players/"
    
    print("🏀 HoopsHype NBA Player Salaries Scraper")
    print("=" * 50)
    print(f"URL: {url}")
    print(f"Pages: {args.pages}")
    print(f"Headless: {args.headless}")
    print("=" * 50)
    
    # Scrape the data
    players = scrape_salaries(url, args.pages, args.headless)
    
    if not players:
        print("❌ No player data scraped!")
        sys.exit(1)
    
    print(f"\n✅ Scraping completed! Final count: {len(players)} players")


if __name__ == "__main__":
    main()
