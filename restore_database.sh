#!/bin/bash

# HoopGeek Database Restoration Script
# This script will restore your database from the database.sql file and apply all migrations

set -e  # Exit on any error

echo "🏀 HoopGeek Database Restoration Script"
echo "========================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "supabase/database.sql" ]; then
    print_error "database.sql not found. Please run this script from the project root directory."
    exit 1
fi

print_status "Found database.sql file"

# Check if Supabase CLI is available
if command -v supabase &> /dev/null; then
    SUPABASE_CLI_AVAILABLE=true
    print_success "Supabase CLI found"
else
    SUPABASE_CLI_AVAILABLE=false
    print_warning "Supabase CLI not found. Will try alternative methods."
fi

# Function to start Supabase locally
start_supabase() {
    if [ "$SUPABASE_CLI_AVAILABLE" = true ]; then
        print_status "Starting Supabase locally..."
        supabase start
        if [ $? -eq 0 ]; then
            print_success "Supabase started successfully"
            return 0
        else
            print_error "Failed to start Supabase"
            return 1
        fi
    else
        print_warning "Cannot start Supabase without CLI. Please install Supabase CLI or start manually."
        return 1
    fi
}

# Function to apply database schema
apply_database_schema() {
    print_status "Applying main database schema..."
    
    if [ "$SUPABASE_CLI_AVAILABLE" = true ]; then
        # Use Supabase CLI to apply the schema
        supabase db reset --db-url "postgresql://postgres:postgres@127.0.0.1:54322/postgres" < supabase/database.sql
    else
        # Try to connect directly to PostgreSQL
        print_warning "Attempting direct PostgreSQL connection..."
        # You'll need to adjust these connection details based on your setup
        psql -h localhost -p 5432 -U postgres -d postgres -f supabase/database.sql || {
            print_error "Failed to apply database schema. Please check your PostgreSQL connection."
            return 1
        }
    fi
    
    print_success "Database schema applied successfully"
}

# Function to run migrations
run_migrations() {
    print_status "Running migrations..."
    
    if [ "$SUPABASE_CLI_AVAILABLE" = true ]; then
        # Use Supabase CLI to run migrations
        supabase db push
        if [ $? -eq 0 ]; then
            print_success "Migrations applied successfully"
        else
            print_error "Failed to apply migrations"
            return 1
        fi
    else
        # Apply migrations manually in chronological order
        print_warning "Applying migrations manually..."
        
        # Get list of migration files in chronological order
        migration_files=($(ls supabase/migrations/*.sql | sort))
        
        for migration_file in "${migration_files[@]}"; do
            print_status "Applying migration: $(basename "$migration_file")"
            psql -h localhost -p 5432 -U postgres -d postgres -f "$migration_file" || {
                print_error "Failed to apply migration: $migration_file"
                return 1
            }
        done
        
        print_success "All migrations applied successfully"
    fi
}

# Function to verify database
verify_database() {
    print_status "Verifying database..."
    
    # Check if key tables exist
    tables_to_check=("players" "leagues" "fantasy_teams" "draft_picks" "weekly_matchups")
    
    for table in "${tables_to_check[@]}"; do
        if [ "$SUPABASE_CLI_AVAILABLE" = true ]; then
            result=$(supabase db shell --db-url "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "SELECT COUNT(*) FROM $table;" 2>/dev/null || echo "0")
        else
            result=$(psql -h localhost -p 5432 -U postgres -d postgres -t -c "SELECT COUNT(*) FROM $table;" 2>/dev/null || echo "0")
        fi
        
        if [ "$result" != "0" ] || [ "$result" != "" ]; then
            print_success "Table '$table' exists"
        else
            print_warning "Table '$table' may not exist or is empty"
        fi
    done
    
    print_success "Database verification completed"
}

# Main restoration process
main() {
    print_status "Starting database restoration process..."
    
    # Step 1: Start Supabase (if CLI available)
    if [ "$SUPABASE_CLI_AVAILABLE" = true ]; then
        start_supabase || {
            print_error "Failed to start Supabase. Please check your setup."
            exit 1
        }
    else
        print_warning "Skipping Supabase start (CLI not available)"
    fi
    
    # Step 2: Apply main database schema
    apply_database_schema || {
        print_error "Failed to apply database schema"
        exit 1
    }
    
    # Step 3: Run migrations
    run_migrations || {
        print_error "Failed to run migrations"
        exit 1
    }
    
    # Step 4: Verify database
    verify_database || {
        print_error "Database verification failed"
        exit 1
    }
    
    print_success "🎉 Database restoration completed successfully!"
    print_status "Your HoopGeek database should now be fully restored."
    
    if [ "$SUPABASE_CLI_AVAILABLE" = true ]; then
        print_status "Supabase Studio should be available at: http://localhost:54323"
        print_status "API URL: http://localhost:54321"
    fi
}

# Run the main function
main "$@"
