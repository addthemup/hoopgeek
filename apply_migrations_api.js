#!/usr/bin/env node

/**
 * Apply Migrations via Supabase Management API
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SUPABASE_URL = 'https://qbznyaimnrpibmahisue.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiem55YWltbnJwaWJtYWhpc3VlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTQxNTQyOCwiZXhwIjoyMDc0OTkxNDI4fQ.MwGad8G7T9G6b-6qNzyNr3o7cVZn0E4Fg7r0ISZ-5Pw';

const migrations = [
  '20250201000000_create_dfs_points_system.sql',
  '20250201000001_create_dfs_groups_system.sql',
  '20250201000002_add_points_to_dfs_pools.sql',
  '20250201000003_add_points_to_pool_creation.sql',
];

async function executeSQL(sql) {
  // Supabase doesn't have a direct SQL execution endpoint
  // But we can try using the REST API with a custom RPC function
  // OR use the Management API if available
  
  // Try using Supabase's query endpoint (won't work for DDL, but let's try)
  // Actually, the best way is to use the Supabase Dashboard SQL Editor
  // OR use the Supabase CLI
  
  // For now, let's output the SQL and provide a way to apply it
  return { needsManual: true, sql };
}

async function applyMigration(filename) {
  console.log(`\n📄 Processing: ${filename}`);
  
  const filePath = join(__dirname, 'supabase', 'migrations', filename);
  const sql = readFileSync(filePath, 'utf8');
  
  // Try to execute via Supabase Management API
  // The Management API endpoint is: /v1/projects/{ref}/database/query
  const projectRef = SUPABASE_URL.split('//')[1].split('.')[0];
  
  try {
    const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({
        query: sql,
      }),
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✅ Migration applied: ${filename}`);
      return { success: true, data };
    } else {
      const errorText = await response.text();
      console.log(`⚠️  API call failed: ${response.status}`);
      console.log(`   Response: ${errorText.substring(0, 200)}`);
      return { success: false, needsManual: true };
    }
  } catch (error) {
    console.log(`⚠️  Error: ${error.message}`);
    return { success: false, needsManual: true, error: error.message };
  }
}

async function main() {
  console.log('🚀 Applying Migrations via Supabase API');
  console.log('========================================\n');
  
  const results = [];
  
  for (const migration of migrations) {
    const result = await applyMigration(migration);
    results.push({ migration, ...result });
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  const successCount = results.filter(r => r.success).length;
  const manualCount = results.filter(r => r.needsManual).length;
  
  if (manualCount > 0) {
    console.log('\n📋 Some migrations need manual application.');
    console.log('   Using Supabase Dashboard SQL Editor:\n');
    console.log('   1. Go to: https://supabase.com/dashboard/project/qbznyaimnrpibmahisue/sql/new');
    console.log('   2. Copy and paste each migration file content');
    console.log('   3. Click "Run"\n');
  }
  
  if (successCount === migrations.length) {
    console.log('🎉 All migrations applied successfully!');
  }
}

main().catch(console.error);

