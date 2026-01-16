#!/usr/bin/env node

/**
 * Apply Migrations via Direct PostgreSQL Connection
 * 
 * This uses the pg library to connect directly to Supabase PostgreSQL
 */

import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Supabase connection details
// We need to construct the connection string
// Format: postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
// But we don't have the password - the service role key is a JWT

// Actually, Supabase provides a connection pooler that uses the service role key
// But for direct connections, we need the database password

// Alternative: Use Supabase's connection pooling with session mode
// Connection string: postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres

// Since we don't have the database password, let's try using Supabase CLI instead
console.log('📋 To apply migrations, we need the database password.');
console.log('   The service role key is a JWT token, not a database password.\n');
console.log('💡 Options:\n');
console.log('   1. Use Supabase Dashboard SQL Editor (easiest)');
console.log('   2. Get database password from Supabase Dashboard > Settings > Database');
console.log('   3. Use Supabase CLI: npx supabase db push\n');

console.log('🚀 Let me try using Supabase CLI via npx...\n');

// Try using Supabase CLI
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function applyWithCLI() {
  try {
    // First, check if we can link to the project
    // Or use db push with connection string
    
    console.log('Attempting to use Supabase CLI...\n');
    
    // Try to push migrations
    // Note: This requires the project to be linked or connection details
    const { stdout, stderr } = await execAsync('npx supabase db push --db-url "postgresql://postgres:[PASSWORD]@db.qbznyaimnrpibmahisue.supabase.co:5432/postgres"', {
      cwd: __dirname,
      timeout: 30000,
    });
    
    console.log(stdout);
    if (stderr) console.error(stderr);
    
  } catch (error) {
    if (error.message.includes('PASSWORD')) {
      console.log('❌ Database password required for direct connection.\n');
      console.log('📝 Please use one of these methods:\n');
      console.log('   Method 1: Supabase Dashboard (Recommended)');
      console.log('   ===========================================');
      console.log('   1. Go to: https://supabase.com/dashboard/project/qbznyaimnrpibmahisue/sql/new');
      console.log('   2. For each migration file:');
      console.log('      - Open: supabase/migrations/[filename]');
      console.log('      - Copy entire contents');
      console.log('      - Paste into SQL Editor');
      console.log('      - Click "Run"\n');
      console.log('   Method 2: Get Database Password');
      console.log('   ===============================');
      console.log('   1. Go to: https://supabase.com/dashboard/project/qbznyaimnrpibmahisue/settings/database');
      console.log('   2. Copy the database password');
      console.log('   3. Re-run this script with password\n');
    } else {
      console.error('Error:', error.message);
    }
  }
}

// Migration files
const migrations = [
  '20250201000000_create_dfs_points_system.sql',
  '20250201000001_create_dfs_groups_system.sql',
  '20250201000002_add_points_to_dfs_pools.sql',
  '20250201000003_add_points_to_pool_creation.sql',
];

console.log('📋 Migration files ready:');
migrations.forEach((m, i) => console.log(`   ${i + 1}. ${m}`));
console.log('');

applyWithCLI().catch(console.error);

