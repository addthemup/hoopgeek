#!/usr/bin/env node

/**
 * Apply Points and Groups System Migrations
 * 
 * This script applies the new migrations for the DFS points and groups systems
 * using the Supabase connection.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get environment variables
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://qbznyaimnrpibmahisue.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiem55YWltbnJwaWJtYWhpc3VlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQxNTQyOCwiZXhwIjoyMDc0OTkxNDI4fQ.MwGad8G7T9G6b-6qNzyNr3o7cVZn0E4Fg7r0ISZ-5Pw';

// Create Supabase client with service role key (bypasses RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Migration files in order
const migrations = [
  '20250201000000_create_dfs_points_system.sql',
  '20250201000001_create_dfs_groups_system.sql',
  '20250201000002_add_points_to_dfs_pools.sql',
  '20250201000003_add_points_to_pool_creation.sql',
];

async function applyMigration(filename) {
  console.log(`\n📄 Applying migration: ${filename}`);
  
  try {
    const filePath = join(__dirname, 'supabase', 'migrations', filename);
    const sql = readFileSync(filePath, 'utf8');
    
    // Split SQL by semicolons and execute each statement
    // Note: Supabase doesn't support multi-statement queries directly
    // So we'll use the REST API to execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      // If exec_sql doesn't exist, try direct SQL execution via REST API
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
        body: JSON.stringify({ sql_query: sql }),
      });
      
      if (!response.ok) {
        // Try alternative: execute via PostgREST or direct connection
        console.log(`⚠️  RPC method not available, trying alternative approach...`);
        
        // For now, we'll output the SQL so user can apply manually
        console.log(`\n📋 Please apply this migration manually in Supabase SQL Editor:\n`);
        console.log(`File: ${filename}`);
        console.log(`\n${sql.substring(0, 500)}...\n`);
        return { success: false, needsManual: true };
      }
    }
    
    console.log(`✅ Migration applied successfully: ${filename}`);
    return { success: true };
  } catch (err) {
    console.error(`❌ Error applying migration ${filename}:`, err.message);
    return { success: false, error: err.message };
  }
}

async function main() {
  console.log('🚀 Applying Points and Groups System Migrations');
  console.log('================================================\n');
  
  const results = [];
  
  for (const migration of migrations) {
    const result = await applyMigration(migration);
    results.push({ migration, ...result });
    
    // Small delay between migrations
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n================================================');
  console.log('📊 Migration Summary:');
  console.log('================================================\n');
  
  let successCount = 0;
  let manualCount = 0;
  let errorCount = 0;
  
  results.forEach(({ migration, success, needsManual, error }) => {
    if (success) {
      console.log(`✅ ${migration}`);
      successCount++;
    } else if (needsManual) {
      console.log(`⚠️  ${migration} - Needs manual application`);
      manualCount++;
    } else {
      console.log(`❌ ${migration} - ${error || 'Failed'}`);
      errorCount++;
    }
  });
  
  console.log(`\n✅ Successful: ${successCount}`);
  console.log(`⚠️  Manual: ${manualCount}`);
  console.log(`❌ Failed: ${errorCount}`);
  
  if (manualCount > 0 || errorCount > 0) {
    console.log('\n📝 To apply migrations manually:');
    console.log('1. Go to https://supabase.com/dashboard');
    console.log('2. Select your project');
    console.log('3. Navigate to SQL Editor');
    console.log('4. Copy and paste each migration file content');
    console.log('5. Click "Run" for each migration');
  }
  
  if (successCount === migrations.length) {
    console.log('\n🎉 All migrations applied successfully!');
  }
}

main().catch(console.error);

