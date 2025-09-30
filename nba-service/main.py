from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client, Client
import os
from dotenv import load_dotenv
from nba_api.stats.endpoints import commonplayerinfo, playercareerstats
from nba_api.stats.static import players
import pandas as pd
from typing import List, Dict, Any

load_dotenv()

app = FastAPI(title="NBA Data Service", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://your-domain.com"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(supabase_url, supabase_key)

@app.get("/")
async def root():
    return {"message": "NBA Data Service is running"}

@app.get("/players")
async def get_players():
    """Get all NBA players"""
    try:
        result = supabase.table("players").select("*").execute()
        return {"players": result.data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/sync-players")
async def sync_players():
    """Sync NBA players data from nba_api to Supabase"""
    try:
        # Get all active players from NBA API
        nba_players = players.get_players()
        
        players_data = []
        for player in nba_players[:50]:  # Limit to first 50 for demo
            try:
                # Get player career stats
                career_stats = playercareerstats.PlayerCareerStats(player_id=player['id'])
                career_df = career_stats.get_data_frames()[0]
                
                # Get latest season stats
                if not career_df.empty:
                    latest_season = career_df.iloc[-1]
                    
                    player_data = {
                        "id": str(player['id']),
                        "name": player['full_name'],
                        "position": player['position'],
                        "team": player['team_abbreviation'] or "FA",
                        "salary": 0,  # Would need to get from another source
                        "stats": {
                            "points": float(latest_season.get('PTS', 0)),
                            "rebounds": float(latest_season.get('REB', 0)),
                            "assists": float(latest_season.get('AST', 0)),
                            "steals": float(latest_season.get('STL', 0)),
                            "blocks": float(latest_season.get('BLK', 0)),
                            "field_goal_percentage": float(latest_season.get('FG_PCT', 0)),
                            "free_throw_percentage": float(latest_season.get('FT_PCT', 0)),
                            "three_point_percentage": float(latest_season.get('FG3_PCT', 0))
                        }
                    }
                    players_data.append(player_data)
                    
            except Exception as e:
                print(f"Error processing player {player['full_name']}: {e}")
                continue
        
        # Upsert players to Supabase
        for player in players_data:
            supabase.table("players").upsert(player).execute()
        
        return {
            "message": f"Successfully synced {len(players_data)} players",
            "players_count": len(players_data)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/player/{player_id}/stats")
async def get_player_stats(player_id: str):
    """Get specific player stats"""
    try:
        result = supabase.table("players").select("*").eq("id", player_id).execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Player not found")
        return {"player": result.data[0]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
