#!/usr/bin/env python3
"""
HoopGeek Database Setup Script
==============================

This script sets up the complete HoopGeek database by importing all necessary data in the correct order:
1. Import players (basic player data)
2. Import player info (comprehensive player data)
3. Import 2024-25 games
4. Import player game logs

Usage:
    python3 scripts/supa_setup.py

Requirements:
    - Supabase environment variables set
    - All import scripts available in the scripts/ directory
"""

import os
import sys
import subprocess
import time
from pathlib import Path

# Add the scripts directory to the Python path
script_dir = Path(__file__).parent
sys.path.insert(0, str(script_dir))

def run_script(script_name, description):
    """Run a Python script and handle errors"""
    print(f"\n{'='*60}")
    print(f"🚀 {description}")
    print(f"📄 Running: {script_name}")
    print(f"{'='*60}")
    
    script_path = script_dir / script_name
    
    if not script_path.exists():
        print(f"❌ Error: Script {script_name} not found!")
        return False
    
    try:
        # Run the script
        result = subprocess.run([
            sys.executable, str(script_path)
        ], capture_output=True, text=True, cwd=script_dir.parent)
        
        if result.returncode == 0:
            print(f"✅ {description} completed successfully!")
            if result.stdout:
                print("📋 Output:")
                print(result.stdout)
            return True
        else:
            print(f"❌ {description} failed!")
            print("📋 Error output:")
            print(result.stderr)
            if result.stdout:
                print("📋 Standard output:")
                print(result.stdout)
            return False
            
    except Exception as e:
        print(f"❌ Error running {script_name}: {str(e)}")
        return False

def check_environment():
    """Check if required environment variables are set"""
    print("🔍 Checking environment variables...")
    
    required_vars = [
        'VITE_SUPABASE_URL',
        'SUPABASE_SERVICE_ROLE_KEY',
        'SUPABASE_URL',
        'SUPABASE_KEY'
    ]
    
    missing_vars = []
    for var in required_vars:
        if not os.environ.get(var):
            missing_vars.append(var)
    
    if missing_vars:
        print(f"❌ Missing required environment variables: {', '.join(missing_vars)}")
        print("\nPlease set the following environment variables:")
        for var in missing_vars:
            print(f"  export {var}=your_value_here")
        return False
    
    print("✅ Environment variables are set correctly")
    return True

def main():
    """Main setup function"""
    print("🏀 HoopGeek Database Setup")
    print("=" * 60)
    print("This script will import all NBA data in the correct order:")
    print("1. Import players (basic player data)")
    print("2. Import ESPN projections")
    print("3. Import HoopsHype salaries")
    print("4. Import player info (comprehensive player data)")
    print("5. Import career stats")
    print("6. Import 2024-25 games")
    print("7. Import player game logs")
    print("8. Import 2025-26 season")
    print("9. Import preseason box scores")
    print("=" * 60)
    
    # Check environment
    if not check_environment():
        sys.exit(1)
    
    # Define the import steps
    import_steps = [
        {
            'script': 'import_nba_players_robust.py',
            'description': 'Import NBA Players (Basic Data)',
            'required': True
        },
        {
            'script': 'import_espn_projections.py',
            'description': 'Import ESPN Fantasy Projections',
            'required': False
        },
        {
            'script': 'import_hoopshype_salaries.py',
            'description': 'Import HoopsHype Player Salaries',
            'required': False
        },
        {
            'script': 'import_player_index.py',
            'description': 'Import Player Index Data',
            'required': True
        },
        {
            'script': 'import_comprehensive_player_data.py',
            'description': 'Import Comprehensive Player Data',
            'required': True
        },
        {
            'script': 'import_career_stats_nba_api.py',
            'description': 'Import Career Stats',
            'required': True
        },
        {
            'script': 'nba_games_import_fixed.py',
            'description': 'Import 2024-25 NBA Games',
            'required': True
        },
        {
            'script': 'import_2024_25_player_game_logs.py',
            'description': 'Import 2024-25 Player Game Logs',
            'required': True
        },
        {
            'script': 'import_2025_26_season.py',
            'description': 'Import 2025-26 Season Schedule',
            'required': True
        },
        {
            'script': 'fetch_preseason_boxscores_final.py',
            'description': 'Import Preseason Box Scores (2025)',
            'required': False
        }
    ]
    
    # Track success/failure
    successful_imports = []
    failed_imports = []
    
    # Run each import step
    for i, step in enumerate(import_steps, 1):
        print(f"\n📊 Progress: {i}/{len(import_steps)}")
        
        success = run_script(step['script'], step['description'])
        
        if success:
            successful_imports.append(step)
        else:
            failed_imports.append(step)
            if step['required']:
                print(f"\n❌ Required step failed: {step['description']}")
                print("🛑 Stopping setup process due to critical failure")
                break
        
        # Add a small delay between imports
        if i < len(import_steps):
            print("⏳ Waiting 3 seconds before next import...")
            time.sleep(3)
    
    # Print final summary
    print(f"\n{'='*60}")
    print("📊 SETUP SUMMARY")
    print(f"{'='*60}")
    
    print(f"✅ Successful imports: {len(successful_imports)}")
    for step in successful_imports:
        print(f"   • {step['description']}")
    
    if failed_imports:
        print(f"\n❌ Failed imports: {len(failed_imports)}")
        for step in failed_imports:
            print(f"   • {step['description']}")
    
    if not failed_imports:
        print(f"\n🎉 Database setup completed successfully!")
        print("🏀 Your HoopGeek database is ready to use!")
    else:
        print(f"\n⚠️  Setup completed with {len(failed_imports)} failure(s)")
        print("🔧 Please check the error messages above and retry failed imports")
        sys.exit(1)

if __name__ == "__main__":
    main()
