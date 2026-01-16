#!/usr/bin/env python3
"""
Diagnostic script to check SportsGameOdds API rate limit usage
Uses the /account/usage endpoint to see current rate limit status
"""

import os
import sys
import json
from datetime import datetime

# Try to load environment variables
try:
    from dotenv import load_dotenv
    load_dotenv('.env.local')
    load_dotenv('.env')
except ImportError:
    pass
except:
    pass

# Get API key
API_KEY = os.getenv("VITE_SPORTS_ODDS_API_KEY") or os.getenv("SPORTS_ODDS_API_KEY") or "79ae5f47830d3d87e70896e36b5eefc3"
API_BASE_URL = "https://api.sportsgameodds.com/v2"

def check_rate_limit_usage():
    """Check current rate limit usage from SGO API"""
    print("🔍 Checking SportsGameOdds API Rate Limit Usage...")
    print(f"📅 Time: {datetime.now().isoformat()}\n")
    
    url = f"{API_BASE_URL}/account/usage"
    headers = {
        'X-Api-Key': API_KEY,
        'Content-Type': 'application/json'
    }
    
    try:
        import requests
        response = requests.get(url, headers=headers, timeout=10)
        
        if response.status_code == 200:
            data = response.json()
            
            if data.get('success'):
                usage_data = data.get('data', {})
                
                print("=" * 70)
                print("📊 RATE LIMIT STATUS")
                print("=" * 70)
                
                print(f"\n🔑 Key ID: {usage_data.get('keyID', 'N/A')}")
                print(f"👤 Customer ID: {usage_data.get('customerID', 'N/A')}")
                print(f"✅ Active: {usage_data.get('isActive', 'N/A')}")
                
                rate_limits = usage_data.get('rateLimits', {})
                
                print("\n" + "-" * 70)
                print("⏱️  RATE LIMITS BY INTERVAL")
                print("-" * 70)
                
                intervals = ['per-second', 'per-minute', 'per-hour', 'per-day', 'per-month']
                
                for interval in intervals:
                    limit_info = rate_limits.get(interval, {})
                    max_requests = limit_info.get('maxRequestsPerInterval', 'unlimited')
                    max_entities = limit_info.get('maxEntitiesPerInterval', 'unlimited')
                    current_requests = limit_info.get('currentIntervalRequests', 'n/a')
                    current_entities = limit_info.get('currentIntervalEntities', 'n/a')
                    interval_end = limit_info.get('currentIntervalEndTime', 'n/a')
                    
                    print(f"\n📌 {interval.upper().replace('-', ' ')}:")
                    print(f"   Max Requests: {max_requests}")
                    print(f"   Max Entities: {max_entities}")
                    print(f"   Current Requests: {current_requests}")
                    print(f"   Current Entities: {current_entities}")
                    if interval_end != 'n/a':
                        print(f"   Interval Ends: {interval_end}")
                    
                    # Calculate usage percentage if possible
                    if max_requests != 'unlimited' and current_requests != 'n/a':
                        try:
                            max_req = int(max_requests)
                            curr_req = int(current_requests)
                            usage_pct = (curr_req / max_req) * 100
                            print(f"   Usage: {usage_pct:.1f}% ({curr_req}/{max_req})")
                            
                            if usage_pct > 80:
                                print(f"   ⚠️  WARNING: High usage! ({usage_pct:.1f}%)")
                            elif usage_pct > 50:
                                print(f"   ⚠️  CAUTION: Moderate usage ({usage_pct:.1f}%)")
                        except:
                            pass
                
                print("\n" + "=" * 70)
                print("✅ Rate limit check complete")
                print("=" * 70)
                
                return data
            else:
                print(f"❌ API returned success=false: {data}")
                return None
        else:
            print(f"❌ API request failed: {response.status_code}")
            print(f"   Response: {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Error checking rate limits: {e}")
        import traceback
        traceback.print_exc()
        return None

if __name__ == '__main__':
    result = check_rate_limit_usage()
    if result:
        sys.exit(0)
    else:
        sys.exit(1)

