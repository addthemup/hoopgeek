import json
import os
from typing import Dict, Any
from supabase import create_client, Client
import requests

# Initialize Supabase client
url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_ANON_KEY")
supabase: Client = create_client(url, key)

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Fetch NBA players data and sync to Supabase
    """
    try:
        # For now, we'll use a mock approach since nba_api is Python-only
        # In production, you'd want to set up a separate Python service
        
        # Mock NBA players data (replace with actual nba_api calls)
        players_data = [
            {
                "id": "203999",
                "name": "Nikola Jokić",
                "position": "C",
                "team": "DEN",
                "salary": 47607350,
                "stats": {
                    "points": 24.5,
                    "rebounds": 11.8,
                    "assists": 9.8,
                    "steals": 1.3,
                    "blocks": 0.9,
                    "field_goal_percentage": 0.583,
                    "free_throw_percentage": 0.821,
                    "three_point_percentage": 0.338
                }
            },
            {
                "id": "201939",
                "name": "Stephen Curry",
                "position": "PG",
                "team": "GSW",
                "salary": 51915615,
                "stats": {
                    "points": 26.4,
                    "rebounds": 4.5,
                    "assists": 5.1,
                    "steals": 1.0,
                    "blocks": 0.4,
                    "field_goal_percentage": 0.430,
                    "free_throw_percentage": 0.915,
                    "three_point_percentage": 0.357
                }
            },
            {
                "id": "201142",
                "name": "Kevin Durant",
                "position": "PF",
                "team": "PHX",
                "salary": 46400000,
                "stats": {
                    "points": 27.1,
                    "rebounds": 6.7,
                    "assists": 5.0,
                    "steals": 0.9,
                    "blocks": 1.2,
                    "field_goal_percentage": 0.529,
                    "free_throw_percentage": 0.853,
                    "three_point_percentage": 0.410
                }
            }
        ]
        
        # Insert/update players in Supabase
        for player in players_data:
            result = supabase.table("players").upsert({
                "id": player["id"],
                "name": player["name"],
                "position": player["position"],
                "team": player["team"],
                "salary": player["salary"],
                "stats": player["stats"],
                "updated_at": "now()"
            }).execute()
        
        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
            },
            "body": json.dumps({
                "message": f"Successfully synced {len(players_data)} players",
                "players_count": len(players_data)
            })
        }
        
    except Exception as e:
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            "body": json.dumps({
                "error": str(e)
            })
        }
