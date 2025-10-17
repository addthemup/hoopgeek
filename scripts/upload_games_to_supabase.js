/**
 * Upload Games to Supabase
 * 
 * This script imports game metadata into Supabase for fast queries.
 * Full JSON files remain in storage for detailed game pages.
 * 
 * Prerequisites:
 * 1. Create games table in Supabase (see SQL below)
 * 2. Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env
 * 
 * Run: node scripts/upload_games_to_supabase.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config();

// Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // Service key for admin operations

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const GAMES_DIR = path.join(__dirname, '../src/assets/json');

console.log('🏀 Uploading games to Supabase...\n');

/**
 * SQL to create the games table in Supabase:
 * 
 * CREATE TABLE games (
 *   game_id TEXT PRIMARY KEY,
 *   date TIMESTAMPTZ NOT NULL,
 *   fun_score DECIMAL NOT NULL DEFAULT 0,
 *   
 *   -- Story data
 *   matchup TEXT,
 *   final_score TEXT,
 *   winner_tricode TEXT,
 *   winner_city TEXT,
 *   winner_points INTEGER,
 *   loser_tricode TEXT,
 *   loser_city TEXT,
 *   loser_points INTEGER,
 *   
 *   -- Excitement metrics
 *   lead_changes INTEGER DEFAULT 0,
 *   lead_changes_5min INTEGER DEFAULT 0,
 *   lead_changes_1min INTEGER DEFAULT 0,
 *   buzzer_beaters INTEGER DEFAULT 0,
 *   total_dunks INTEGER DEFAULT 0,
 *   deep_threes INTEGER DEFAULT 0,
 *   four_pointers INTEGER DEFAULT 0,
 *   
 *   -- Full JSON (optional - for backup or quick access)
 *   full_data JSONB,
 *   
 *   -- Media
 *   thumbnail_url TEXT,
 *   video_url TEXT,
 *   
 *   -- Engagement
 *   views INTEGER DEFAULT 0,
 *   likes INTEGER DEFAULT 0,
 *   
 *   -- Metadata
 *   arena TEXT,
 *   season TEXT,
 *   
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   updated_at TIMESTAMPTZ DEFAULT NOW()
 * );
 * 
 * -- Indexes for fast queries
 * CREATE INDEX idx_games_date ON games(date DESC);
 * CREATE INDEX idx_games_fun_score ON games(fun_score DESC);
 * CREATE INDEX idx_games_date_fun_score ON games(date DESC, fun_score DESC);
 * CREATE INDEX idx_games_winner_tricode ON games(winner_tricode);
 * CREATE INDEX idx_games_loser_tricode ON games(loser_tricode);
 */

async function uploadGames() {
  const files = fs.readdirSync(GAMES_DIR)
    .filter(file => file.endsWith('.json') && file !== 'games-index.json')
    .sort();

  console.log(`Found ${files.length} game files\n`);

  let uploaded = 0;
  let skipped = 0;
  let errors = 0;

  // Process in batches of 100
  const BATCH_SIZE = 100;
  
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    const gamesToUpload = [];

    for (const file of batch) {
      try {
        const filePath = path.join(GAMES_DIR, file);
        const content = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(content);

        // Extract data for database
        const gameRecord = {
          game_id: data.gameId,
          date: data.gameMetadata?.date || data.date,
          fun_score: data.fun_score || data.score?.fun_score || 0,
          
          // Story
          matchup: data.story?.matchup || '',
          final_score: data.story?.final_score || '',
          winner_tricode: data.story?.teams?.winner?.tricode || '',
          winner_city: data.story?.teams?.winner?.city || '',
          winner_points: data.story?.teams?.winner?.points || 0,
          loser_tricode: data.story?.teams?.loser?.tricode || '',
          loser_city: data.story?.teams?.loser?.city || '',
          loser_points: data.story?.teams?.loser?.points || 0,
          
          // Excitement
          lead_changes: data.lead_changes?.total || 0,
          lead_changes_5min: data.lead_changes?.last_5_minutes || 0,
          lead_changes_1min: data.lead_changes?.last_minute || 0,
          buzzer_beaters: data.lead_changes?.buzzer_beater || 0,
          total_dunks: data.dunk_stats?.['Total Dunks'] || 0,
          deep_threes: data.deep_shots?.deep_threes || 0,
          four_pointers: data.deep_shots?.four_pointers || 0,
          
          // Optionally store full JSON (be careful with size)
          // full_data: data,
          
          // Media
          thumbnail_url: data.thumbnail_url || null,
          video_url: data.video_url || null,
          
          // Engagement
          views: data.views || 0,
          likes: data.likes || 0,
          
          // Metadata
          arena: data.gameMetadata?.arena || '',
          season: data.gameMetadata?.season || ''
        };

        gamesToUpload.push(gameRecord);
        
      } catch (error) {
        console.error(`❌ Error processing ${file}:`, error.message);
        errors++;
      }
    }

    // Upload batch
    if (gamesToUpload.length > 0) {
      const { data, error } = await supabase
        .from('games')
        .upsert(gamesToUpload, { 
          onConflict: 'game_id',
          ignoreDuplicates: false 
        });

      if (error) {
        console.error(`❌ Error uploading batch:`, error);
        errors += gamesToUpload.length;
      } else {
        uploaded += gamesToUpload.length;
        console.log(`✅ Uploaded batch ${Math.floor(i / BATCH_SIZE) + 1} (${uploaded}/${files.length})`);
      }
    }
  }

  console.log('\n📊 Upload Summary:');
  console.log(`   - Total files: ${files.length}`);
  console.log(`   - Successfully uploaded: ${uploaded}`);
  console.log(`   - Errors: ${errors}`);
  
  if (uploaded > 0) {
    console.log('\n✅ Games uploaded to Supabase!');
    console.log('\n💡 Update your gameLoader.ts to fetch from Supabase:');
    console.log('   - Use supabase.from("games").select() for the feed');
    console.log('   - Keep full JSON files for detailed game pages');
  }
}

// Run the upload
uploadGames().catch(console.error);

