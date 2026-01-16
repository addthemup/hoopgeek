#!/usr/bin/env python3
"""
Analyze shot coordinates to calibrate the coordinate system.
Uses shotDistance from description to validate xLegacy/yLegacy coordinates.
"""

import json
import math
import os
from pathlib import Path
from collections import defaultdict

def analyze_shot_coordinates(json_file_path):
    """Analyze shots from a single JSON file."""
    with open(json_file_path, 'r') as f:
        data = json.load(f)
    
    shots = []
    play_by_play = data.get('playByPlay', {})
    all_plays = play_by_play.get('allPlays', [])
    
    for play in all_plays:
        if play.get('isFieldGoal') == 1:
            shot_distance = play.get('shotDistance')
            x_legacy = play.get('xLegacy')
            y_legacy = play.get('yLegacy')
            
            if shot_distance is not None and x_legacy is not None and y_legacy is not None:
                # Calculate distance from basket (assuming basket at 0,0)
                coord_distance = math.sqrt(x_legacy**2 + y_legacy**2)
                
                shots.append({
                    'shotDistance': shot_distance,
                    'xLegacy': x_legacy,
                    'yLegacy': y_legacy,
                    'coordDistance': coord_distance,
                    'scaleFactor': coord_distance / shot_distance if shot_distance > 0 else None,
                    'description': play.get('description', ''),
                    'period': play.get('period', 1)
                })
    
    return shots

def main():
    """Analyze all JSON files in the feed directory."""
    feed_dir = Path(__file__).parent
    json_files = list(feed_dir.glob('*.json'))
    
    all_shots = []
    for json_file in json_files:
        print(f"Analyzing {json_file.name}...")
        shots = analyze_shot_coordinates(json_file)
        all_shots.extend(shots)
        print(f"  Found {len(shots)} shots with coordinates")
    
    print(f"\nTotal shots analyzed: {len(all_shots)}")
    
    if not all_shots:
        print("No shots found with coordinates!")
        return
    
    # Calculate statistics
    scale_factors = [s['scaleFactor'] for s in all_shots if s['scaleFactor'] is not None]
    
    if scale_factors:
        avg_scale = sum(scale_factors) / len(scale_factors)
        median_scale = sorted(scale_factors)[len(scale_factors) // 2]
        min_scale = min(scale_factors)
        max_scale = max(scale_factors)
        
        print(f"\nScale Factor Statistics (coordinate units per foot):")
        print(f"  Average: {avg_scale:.2f}")
        print(f"  Median: {median_scale:.2f}")
        print(f"  Min: {min_scale:.2f}")
        print(f"  Max: {max_scale:.2f}")
    
    # Group by distance to see patterns
    print("\nSample shots by distance:")
    print(f"{'Distance':<8} {'xLegacy':<10} {'yLegacy':<10} {'Coord Dist':<12} {'Scale':<8} {'Description':<50}")
    print("-" * 110)
    
    # Show samples from different distances
    distance_groups = defaultdict(list)
    for shot in all_shots:
        distance_groups[shot['shotDistance']].append(shot)
    
    for distance in sorted(distance_groups.keys())[:20]:  # Show first 20 distance groups
        shots_at_distance = distance_groups[distance]
        sample = shots_at_distance[0]
        print(f"{sample['shotDistance']:<8} {sample['xLegacy']:<10} {sample['yLegacy']:<10} "
              f"{sample['coordDistance']:<12.1f} {sample['scaleFactor']:<8.2f} "
              f"{sample['description'][:50]}")
    
    # Analyze if basket is at (0,0) or somewhere else
    print("\n\nAnalyzing basket position hypothesis...")
    print("Assuming basket is at (0,0), calculating errors:")
    
    errors = []
    for shot in all_shots[:100]:  # Sample first 100
        if shot['scaleFactor']:
            expected_coord_dist = shot['shotDistance'] * avg_scale
            actual_coord_dist = shot['coordDistance']
            error = abs(expected_coord_dist - actual_coord_dist)
            errors.append({
                'shotDistance': shot['shotDistance'],
                'error': error,
                'xLegacy': shot['xLegacy'],
                'yLegacy': shot['yLegacy']
            })
    
    if errors:
        avg_error = sum(e['error'] for e in errors) / len(errors)
        print(f"  Average error: {avg_error:.2f} coordinate units")
        print(f"  Using scale factor: {avg_scale:.2f} units per foot")
    
    # Check for period-based differences
    print("\n\nAnalyzing by period (to check for court flipping):")
    period_stats = defaultdict(lambda: {'count': 0, 'scale_factors': []})
    for shot in all_shots:
        period = shot['period']
        if shot['scaleFactor']:
            period_stats[period]['count'] += 1
            period_stats[period]['scale_factors'].append(shot['scaleFactor'])
    
    for period in sorted(period_stats.keys()):
        stats = period_stats[period]
        if stats['scale_factors']:
            avg = sum(stats['scale_factors']) / len(stats['scale_factors'])
            print(f"  Period {period}: {stats['count']} shots, avg scale: {avg:.2f}")

if __name__ == '__main__':
    main()

