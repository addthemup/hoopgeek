#!/usr/bin/env python3

import requests
import json

def test_nba_api():
    """Test NBA API endpoints to see what's working"""
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Referer': 'https://www.nba.com/',
        'Origin': 'https://www.nba.com',
        'Connection': 'keep-alive',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-site'
    }
    
    # Test player info endpoint
    player_id = "2030"  # LeBron James
    url = f"https://stats.nba.com/stats/commonplayerinfo?PlayerID={player_id}"
    
    print(f"Testing NBA API: {url}")
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        print(f"Response Headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            data = response.json()
            print("✅ Success! Got response from NBA API")
            print(f"Result sets: {len(data.get('resultSets', []))}")
            
            if data.get('resultSets') and len(data['resultSets']) > 0:
                player_data = data['resultSets'][0]['rowSet'][0]
                headers_list = data['resultSets'][0]['headers']
                print(f"Player data keys: {headers_list[:10]}...")  # First 10 keys
                print(f"Player name: {player_data[headers_list.index('DISPLAY_FIRST_LAST')] if 'DISPLAY_FIRST_LAST' in headers_list else 'Not found'}")
            else:
                print("❌ No result sets in response")
        else:
            print(f"❌ Error: {response.status_code}")
            print(f"Response text: {response.text[:500]}")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")

if __name__ == "__main__":
    test_nba_api()
