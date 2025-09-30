#!/usr/bin/env python3
"""
Test Supabase Connection Script
Tests connection to Supabase with different credentials
"""

import os
import sys
from supabase import create_client, Client

# Test with the credentials from the script
SUPABASE_URL = "https://lsnqmdeagfzuvrypiiwi.supabase.co"
SUPABASE_SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxzbnFtZGVhZ2Z6dXZyeXBpaXdpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTI1MTU5MSwiZXhwIjoyMDc0ODI3NTkxfQ.uOD1oFhjd6ISP7XJu7OtYYG_SwU7uZR74h8byY3HNPo"

def test_connection():
    """Test Supabase connection"""
    print("🔧 Testing Supabase connection...")
    print(f"URL: {SUPABASE_URL}")
    print(f"Service Key: {SUPABASE_SERVICE_KEY[:20]}...")
    
    try:
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        print("✅ Supabase client created successfully")
        
        # Test a simple query
        print("🔍 Testing database query...")
        result = supabase.table('players').select('id', count='exact').limit(1).execute()
        print(f"✅ Query successful! Found {result.count} players in database")
        
        return True
        
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return False

if __name__ == "__main__":
    success = test_connection()
    sys.exit(0 if success else 1)
