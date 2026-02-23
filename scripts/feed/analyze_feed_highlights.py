#!/usr/bin/env python3
"""
Analyze /feed/ JSONs (procedurally named by game_id):
- Count JSON files
- Count total MP4 URLs
- List playtype (actionType / subType) distribution for plays that have mp4
"""
import json
from pathlib import Path
from collections import defaultdict

FEED_DIR = Path(__file__).resolve().parent

def main():
    json_files = sorted(FEED_DIR.glob("*.json"))
    total_files = len(json_files)
    total_mp4 = 0
    games_with_mp4 = 0
    games_with_no_plays = 0
    # (actionType, subType) -> count (subType can be None)
    playtype_counts = defaultdict(int)
    # actionType only (for summary)
    action_type_counts = defaultdict(int)

    for jpath in json_files:
        try:
            with open(jpath, "r") as f:
                data = json.load(f)
        except Exception as e:
            print(f"Skip {jpath.name}: {e}")
            continue

        plays = data.get("playByPlay", {}).get("allPlays", [])
        if not plays:
            games_with_no_plays += 1

        file_mp4 = 0
        for p in plays:
            mp4 = p.get("mp4")
            if not mp4 or not str(mp4).strip().startswith("http"):
                continue
            file_mp4 += 1
            action = (p.get("actionType") or "").strip() or "(empty)"
            sub = p.get("subType")
            sub_str = (sub.strip() if sub and str(sub).strip() else None) or "(none)"
            playtype_counts[(action, sub_str)] += 1
            action_type_counts[action] += 1

        total_mp4 += file_mp4
        if file_mp4:
            games_with_mp4 += 1

    print("=" * 60)
    print("FEED HIGHLIGHTS ANALYSIS (scripts/feed/*.json)")
    print("=" * 60)
    print(f"Total JSON files:           {total_files}")
    print(f"Games with at least 1 MP4:  {games_with_mp4}")
    print(f"Games with no allPlays:     {games_with_no_plays}")
    print(f"Total MP4 URLs:             {total_mp4}")
    if total_files:
        print(f"Avg MP4 per game (w/ data): {total_mp4 / max(1, games_with_mp4):.1f}")
    print()

    print("--- Playtypes (actionType) ---")
    for action, count in sorted(action_type_counts.items(), key=lambda x: -x[1]):
        print(f"  {action}: {count}")
    print()

    print("--- Playtypes (actionType + subType) — top 60 by count ---")
    sorted_playtypes = sorted(playtype_counts.items(), key=lambda x: -x[1])[:60]
    for (action, sub), count in sorted_playtypes:
        label = f"{action}"
        if sub and sub != "(none)":
            label += f" / {sub}"
        print(f"  {label}: {count}")
    print()

    # Unique actionTypes and subTypes for "types we have"
    unique_actions = sorted(set(action_type_counts.keys()))
    unique_subs = set()
    for (a, s) in playtype_counts:
        if s and s != "(none)":
            unique_subs.add(s)
    unique_subs_sorted = sorted(unique_subs)
    print("--- Unique actionTypes ---")
    print(f"  Count: {len(unique_actions)}")
    print(" ", ", ".join(unique_actions))
    print()
    print("--- Unique subTypes ---")
    print(f"  Count: {len(unique_subs_sorted)}")
    print("  (sample)", ", ".join(unique_subs_sorted[:80]))
    if len(unique_subs_sorted) > 80:
        print(f"  ... and {len(unique_subs_sorted) - 80} more")

if __name__ == "__main__":
    main()
