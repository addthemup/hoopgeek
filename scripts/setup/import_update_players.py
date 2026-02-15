#!/usr/bin/env python3
"""
Import/update NBA players for season 2025-26 using CommonTeamRoster + CommonPlayerInfo.
Gets or creates players and updates their teams. After running, reports players added,
players who changed teams, and which teams had roster changes.
"""

import os
import sys
import time
from datetime import datetime
from typing import Any, Dict, List, Optional, Set, Tuple

from supabase import create_client, Client
from nba_api.stats.endpoints import CommonTeamRoster, CommonPlayerInfo

# Load .env from project root (works when run from repo root or scripts/setup/)
try:
    from dotenv import load_dotenv
    _script_dir = os.path.dirname(os.path.abspath(__file__))
    _root = os.path.dirname(os.path.dirname(_script_dir))
    load_dotenv(os.path.join(_root, ".env.local"))
    load_dotenv(os.path.join(_root, ".env"))
    load_dotenv(".env.local")
    load_dotenv(".env")
except ImportError:
    pass
except Exception:
    pass

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
SEASON = "2025-26"
API_DELAY_SEC = 0.2  # delay between CommonPlayerInfo calls to avoid rate limit


def setup_supabase() -> Client:
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("❌ Error: SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY must be set.")
        print("   Add them to .env in the project root or export in the shell.")
        sys.exit(1)
    return create_client(SUPABASE_URL, SUPABASE_KEY)


def get_team_ids(supabase: Client) -> List[int]:
    """Return list of nba_teams.team_id from DB."""
    try:
        r = supabase.table("nba_teams").select("team_id").execute()
        return [row["team_id"] for row in (r.data or [])]
    except Exception as e:
        print(f"❌ Error fetching teams: {e}")
        return []


def get_roster_player_ids(team_ids: List[int]) -> List[int]:
    """Fetch 2025-26 rosters for all teams; return unique PLAYER_ID list."""
    all_ids: List[int] = []
    for i, team_id in enumerate(team_ids):
        try:
            roster = CommonTeamRoster(team_id=team_id, season=SEASON)
            df = roster.common_team_roster.get_data_frame()
            if df is not None and not df.empty and "PLAYER_ID" in df.columns:
                all_ids.extend(df["PLAYER_ID"].dropna().astype(int).tolist())
        except Exception as e:
            print(f"   ⚠️ Roster for team_id {team_id}: {e}")
        if (i + 1) % 5 == 0:
            print(f"   Rosters: {i + 1}/{len(team_ids)} teams")
        time.sleep(0.1)
    return list(dict.fromkeys(all_ids))  # unique, order preserved


def fetch_existing_players(supabase: Client, nba_player_ids: List[int]) -> Dict[int, Dict[str, Any]]:
    """Return dict nba_player_id -> { team_id, team_abbreviation, team_name }."""
    out: Dict[int, Dict[str, Any]] = {}
    chunk = 500
    for start in range(0, len(nba_player_ids), chunk):
        ids_chunk = nba_player_ids[start : start + chunk]
        r = (
            supabase.table("nba_players")
            .select("nba_player_id, team_id, team_abbreviation, team_name")
            .in_("nba_player_id", ids_chunk)
            .execute()
        )
        for row in r.data or []:
            out[row["nba_player_id"]] = {
                "team_id": row.get("team_id"),
                "team_abbreviation": (row.get("team_abbreviation") or "").strip() or None,
                "team_name": (row.get("team_name") or "").strip() or None,
            }
    return out


def safe_str(v: Any) -> Any:
    if v is None or (isinstance(v, float) and str(v) == "nan"):
        return None
    s = str(v).strip()
    return s if s else None


def safe_int(v: Any) -> Any:
    if v is None or (isinstance(v, float) and str(v) == "nan"):
        return None
    try:
        return int(v)
    except (ValueError, TypeError):
        return None


def parse_birthdate(v: Any) -> Any:
    if v is None or (isinstance(v, float) and str(v) == "nan"):
        return None
    s = str(v).strip()
    if "T" in s:
        return s.split("T")[0]
    return s


def common_player_info_to_upsert(row: Dict[str, Any]) -> Dict[str, Any]:
    """Build upsert_nba_player kwargs from CommonPlayerInfo row (e.g. from DataFrame iloc[0].to_dict())."""
    roster_status = safe_str(row.get("ROSTERSTATUS"))
    is_active = (roster_status or "").lower() == "active"
    season_exp = safe_int(row.get("SEASON_EXP")) or 0
    return {
        "p_nba_player_id": int(row.get("PERSON_ID", 0)),
        "p_name": safe_str(row.get("DISPLAY_FIRST_LAST")) or "",
        "p_first_name": safe_str(row.get("FIRST_NAME")),
        "p_last_name": safe_str(row.get("LAST_NAME")),
        "p_player_slug": safe_str(row.get("PLAYER_SLUG")),
        "p_position": safe_str(row.get("POSITION")),
        "p_team_id": safe_int(row.get("TEAM_ID")),
        "p_team_name": safe_str(row.get("TEAM_NAME")),
        "p_team_abbreviation": safe_str(row.get("TEAM_ABBREVIATION")),
        "p_team_slug": safe_str(row.get("TEAM_CODE")),
        "p_team_city": safe_str(row.get("TEAM_CITY")),
        "p_jersey_number": safe_str(row.get("JERSEY")),
        "p_height": safe_str(row.get("HEIGHT")),
        "p_weight": safe_int(row.get("WEIGHT")),
        "p_age": None,
        "p_birth_date": parse_birthdate(row.get("BIRTHDATE")),
        "p_birth_city": None,
        "p_birth_state": None,
        "p_birth_country": safe_str(row.get("COUNTRY")),
        "p_college": safe_str(row.get("SCHOOL")),
        "p_draft_year": safe_int(row.get("DRAFT_YEAR")),
        "p_draft_round": safe_int(row.get("DRAFT_ROUND")),
        "p_draft_number": safe_int(row.get("DRAFT_NUMBER")),
        "p_salary": 0,
        "p_is_active": is_active,
        "p_is_rookie": season_exp == 0,
        "p_years_pro": season_exp,
        "p_from_year": safe_int(row.get("FROM_YEAR")),
        "p_to_year": safe_int(row.get("TO_YEAR")),
    }


def get_player_info_from_api(player_id: int) -> Optional[Dict[str, Any]]:
    """Call CommonPlayerInfo for one player; return first row as dict or None."""
    try:
        api = CommonPlayerInfo(player_id=player_id)
        dfs = api.get_data_frames()
        # get_data_frames() returns a list of DataFrames, not a dict (e.g. [CommonPlayerInfo, PlayerHeadlineStats, AvailableSeasons])
        if not dfs:
            return None
        if isinstance(dfs, dict):
            for name, df in dfs.items():
                if df is not None and not df.empty and "PERSON_ID" in df.columns:
                    return df.iloc[0].to_dict()
            for name, df in dfs.items():
                if df is not None and not df.empty:
                    return df.iloc[0].to_dict()
        else:
            for df in dfs:
                if df is not None and not df.empty and "PERSON_ID" in df.columns:
                    return df.iloc[0].to_dict()
            for df in dfs:
                if df is not None and not df.empty:
                    return df.iloc[0].to_dict()
        return None
    except Exception as e:
        print(f"   ⚠️ API error for player_id {player_id}: {e}")
        return None


def run_import(
    supabase: Client,
    player_ids: List[int],
    existing: Dict[int, Dict[str, Any]],
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], int]:
    """
    For each player_id: fetch CommonPlayerInfo, upsert, track added/changed teams.
    Returns (added_list, changed_teams_list, error_count).
    """
    added: List[Dict[str, Any]] = []
    changed_teams: List[Dict[str, Any]] = []
    errors = 0

    for i, nba_id in enumerate(player_ids):
        data = get_player_info_from_api(nba_id)
        time.sleep(API_DELAY_SEC)

        if not data:
            errors += 1
            if (i + 1) % 50 == 0:
                print(f"   Progress: {i + 1}/{len(player_ids)}")
            continue

        payload = common_player_info_to_upsert(data)
        name = payload.get("p_name") or "Unknown"
        new_team_id = payload.get("p_team_id")
        new_abbr = (payload.get("p_team_abbreviation") or "").strip() or None
        new_team_name = (payload.get("p_team_name") or "").strip() or None
        prev = existing.get(nba_id)
        is_new = prev is None

        try:
            supabase.rpc("upsert_nba_player", payload).execute()
        except Exception as e:
            print(f"   ⚠️ Upsert failed for {name} ({nba_id}): {e}")
            errors += 1
            if (i + 1) % 50 == 0:
                print(f"   Progress: {i + 1}/{len(player_ids)}")
            continue

        if is_new:
            added.append({
                "name": name,
                "team": new_team_name or new_abbr or str(new_team_id) or "—",
                "position": payload.get("p_position") or "—",
            })
        else:
            old_id = prev.get("team_id")
            old_abbr = prev.get("team_abbreviation")
            old_name = prev.get("team_name")
            team_changed = (old_id != new_team_id) or ((old_abbr or "") != (new_abbr or ""))
            if team_changed:
                old_display = (old_name or old_abbr or (str(old_id) if old_id else "FA") or "FA").strip()
                new_display = (new_team_name or new_abbr or (str(new_team_id) if new_team_id else "FA") or "FA").strip()
                changed_teams.append({"name": name, "old_team": old_display, "new_team": new_display})

        if (i + 1) % 50 == 0:
            print(f"   Progress: {i + 1}/{len(player_ids)}")

    return added, changed_teams, errors


def main() -> None:
    print("=" * 60)
    print("Import/update players (season 2025-26) – CommonTeamRoster + CommonPlayerInfo")
    print("=" * 60)

    supabase = setup_supabase()
    print("✅ Supabase connected")

    team_ids = get_team_ids(supabase)
    if not team_ids:
        print("❌ No teams found in nba_teams")
        sys.exit(1)
    print(f"📋 Found {len(team_ids)} teams")

    print(f"\n📥 Fetching rosters for {SEASON}...")
    player_ids = get_roster_player_ids(team_ids)
    print(f"   Unique players on rosters: {len(player_ids)}")

    if not player_ids:
        print("❌ No player IDs from rosters")
        sys.exit(1)

    print("\n📂 Loading existing nba_players for those IDs...")
    existing = fetch_existing_players(supabase, player_ids)

    print("\n🔄 Fetching CommonPlayerInfo and upserting...")
    added, changed_teams, errors = run_import(supabase, player_ids, existing)

    # Teams with roster changes = any team that appears as old or new in changed_teams, or that has an added player
    teams_changed: Set[str] = set()
    for r in changed_teams:
        if r.get("old_team") and r["old_team"] != "FA":
            teams_changed.add(r["old_team"])
        if r.get("new_team") and r["new_team"] != "FA":
            teams_changed.add(r["new_team"])
    for r in added:
        t = (r.get("team") or "").strip()
        if t and t != "—":
            teams_changed.add(t)

    # --- Report ---
    print("\n" + "=" * 60)
    print("📥 PLAYERS ADDED (new in database)")
    print("=" * 60)
    if not added:
        print("   (none)")
    else:
        for p in added:
            print(f"   • {p['name']}  |  {p['team']}  |  {p.get('position', '—')}")
        print(f"   Total: {len(added)}")

    print("\n" + "=" * 60)
    print("🔄 PLAYERS WHO CHANGED TEAMS")
    print("=" * 60)
    if not changed_teams:
        print("   (none)")
    else:
        for p in changed_teams:
            print(f"   • {p['name']}:  {p['old_team']}  →  {p['new_team']}")
        print(f"   Total: {len(changed_teams)}")

    print("\n" + "=" * 60)
    print("🏀 TEAMS WITH ROSTER CHANGES (had adds or team changes)")
    print("=" * 60)
    if not teams_changed:
        print("   (none)")
    else:
        for t in sorted(teams_changed):
            print(f"   • {t}")
        print(f"   Total: {len(teams_changed)}")

    print("\n" + "-" * 60)
    print(f"   Processed: {len(player_ids)}  |  Added: {len(added)}  |  Team changes: {len(changed_teams)}  |  Errors: {errors}")
    print("=" * 60)


if __name__ == "__main__":
    main()
