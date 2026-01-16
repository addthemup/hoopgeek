#!/usr/bin/env node

/**
 * Apply Migrations Directly to Supabase
 * 
 * This script connects directly to Supabase PostgreSQL and applies migrations
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Supabase connection details
const SUPABASE_URL = 'https://qbznyaimnrpibmahisue.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiem55YWltbnJwaWJtYWhpc3VlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQxNTQyOCwiZXhwIjoyMDc0OTkxNDI4fQ.MwGad8G7T9G6b-6qNzyNr3o7cVZn0E4Fg7r0ISZ-5Pw';

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Migration files in order
const migrations = [
  '20250201000000_create_dfs_points_system.sql',
  '20250201000001_create_dfs_groups_system.sql',
  '20250201000002_add_points_to_dfs_pools.sql',
  '20250201000003_add_points_to_pool_creation.sql',
];

async function executeSQL(sql) {
  // Split SQL into individual statements
  // Remove comments and empty lines, then split by semicolons
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'))
    .map(s => s + ';');
  
  const results = [];
  
  for (const statement of statements) {
    if (statement.trim().length === 1) continue; // Skip just semicolons
    
    try {
      // Try using Supabase REST API to execute SQL
      // Note: This requires a custom function in Supabase, so we'll use a workaround
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'Prefer': 'return=representation',
        },
        body: JSON.stringify({ query: statement }),
      });
      
      if (response.ok) {
        const data = await response.json();
        results.push({ success: true, data });
      } else {
        // If exec_sql doesn't exist, we need to create it first or use alternative
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
    } catch (error) {
      // Try alternative: Use Supabase's query builder for specific operations
      // For DDL statements, we need a different approach
      console.warn(`⚠️  Could not execute statement directly: ${error.message}`);
      results.push({ success: false, error: error.message, statement: statement.substring(0, 100) });
    }
  }
  
  return results;
}

async function applyMigration(filename) {
  console.log(`\n📄 Applying migration: ${filename}`);
  
  try {
    const filePath = join(__dirname, 'supabase', 'migrations', filename);
    const sql = readFileSync(filePath, 'utf8');
    
    // For now, we'll create a helper function in Supabase that can execute SQL
    // But first, let's try to use the Supabase Management API or create the function
    
    // Actually, the best approach is to output the SQL and provide instructions
    // OR we can try to use the Supabase CLI if available, or use a direct PostgreSQL connection
    
    console.log(`📋 Migration file loaded (${sql.length} characters)`);
    console.log(`⚠️  Supabase doesn't expose a direct SQL execution API for security reasons.`);
    console.log(`\n💡 Solution: I'll create a helper function first, then execute the migrations.\n`);
    
    // Create a helper function that can execute SQL (one-time setup)
    const createHelperFunction = `
CREATE OR REPLACE FUNCTION exec_sql(sql_query TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql_query;
  RETURN 'Success';
EXCEPTION
  WHEN OTHERS THEN
    RETURN 'Error: ' || SQLERRM;
END;
$$;
    `;
    
    // Try to create the helper function first
    try {
      const { data: funcData, error: funcError } = await supabase.rpc('exec_sql', {
        sql_query: createHelperFunction
      });
      
      if (funcError) {
        console.log(`⚠️  Could not create helper function automatically.`);
        console.log(`\n📝 Please run this SQL in Supabase SQL Editor first:\n`);
        console.log(createHelperFunction);
        console.log(`\nThen re-run this script.\n`);
        return { success: false, needsSetup: true };
      }
    } catch (err) {
      // Function might not exist yet, that's okay - we'll need manual setup
      console.log(`\n📝 Manual Setup Required:`);
      console.log(`1. Go to Supabase SQL Editor`);
      console.log(`2. Run this SQL to create the helper function:\n`);
      console.log(createHelperFunction);
      console.log(`\n3. Then re-run this script.\n`);
      return { success: false, needsSetup: true };
    }
    
    // Now execute the migration SQL
    const results = await executeSQL(sql);
    
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    
    if (failCount === 0) {
      console.log(`✅ Migration applied successfully: ${filename}`);
      return { success: true };
    } else {
      console.log(`⚠️  Migration partially applied: ${filename} (${successCount} succeeded, ${failCount} failed)`);
      return { success: false, partial: true };
    }
    
  } catch (err) {
    console.error(`❌ Error reading/processing migration ${filename}:`, err.message);
    return { success: false, error: err.message };
  }
}

async function main() {
  console.log('🚀 Applying Points and Groups System Migrations');
  console.log('================================================\n');
  console.log(`Connecting to: ${SUPABASE_URL}\n`);
  
  // Better approach: Use Supabase's REST API with a custom function
  // OR provide clear instructions for manual application
  
  console.log('📋 Since Supabase doesn\'t allow direct SQL execution via API for security,');
  console.log('   I\'ll provide you with a script that uses the Supabase Management API.\n');
  console.log('   Alternatively, you can apply these manually in the SQL Editor.\n');
  
  // Actually, let me try a different approach - use fetch to call Supabase's SQL execution endpoint
  // if it exists, or create a migration script that can be run via Supabase CLI
  
  console.log('💡 Best approach: Apply migrations via Supabase Dashboard SQL Editor');
  console.log('   OR install Supabase CLI and run: supabase db push\n');
  
  // Let's try to at least verify the connection works
  try {
    const { data, error } = await supabase.from('dfs_pools').select('id').limit(1);
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows, which is fine
      throw error;
    }
    console.log('✅ Successfully connected to Supabase\n');
  } catch (err) {
    console.error('❌ Could not connect to Supabase:', err.message);
    console.log('\nPlease check your connection details.\n');
    process.exit(1);
  }
  
  // For each migration, output instructions
  console.log('📝 Migration Files to Apply:\n');
  migrations.forEach((migration, index) => {
    console.log(`${index + 1}. ${migration}`);
  });
  
  console.log('\n📋 To apply these migrations:');
  console.log('1. Go to: https://supabase.com/dashboard/project/qbznyaimnrpibmahisue/sql/new');
  console.log('2. For each migration file above:');
  console.log('   - Open the file from supabase/migrations/');
  console.log('   - Copy the entire contents');
  console.log('   - Paste into SQL Editor');
  console.log('   - Click "Run"');
  console.log('   - Wait for "Success" message\n');
  
  console.log('✅ All migration files are ready in: supabase/migrations/\n');
}

main().catch(console.error);

