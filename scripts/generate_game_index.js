/**
 * Generate Game Index
 * 
 * This script scans all JSON files in src/assets/json/ and creates a lightweight
 * index file containing only the data needed for the feed (Home.tsx).
 * 
 * This avoids loading 500 massive JSON files on page load.
 * 
 * Run: node scripts/generate_game_index.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const GAMES_DIR = path.join(__dirname, '../src/assets/json');
const INDEX_OUTPUT = path.join(__dirname, '../src/assets/json/games-index.json');

console.log('🏀 Generating game index...\n');

// Get all JSON files (excluding the index itself)
const files = fs.readdirSync(GAMES_DIR)
  .filter(file => file.endsWith('.json') && file !== 'games-index.json')
  .sort();

console.log(`Found ${files.length} game files`);

const gamesIndex = [];
let processed = 0;
let errors = 0;

for (const file of files) {
  try {
    const filePath = path.join(GAMES_DIR, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);
    
    // Extract only the data needed for the feed
    const gameId = data.gameId;
    const scoreData = data.score?.[gameId] || data.score || {};
    
    const indexEntry = {
      gameId: gameId,
      date: data.gameMetadata?.date || data.date,
      fun_score: scoreData.fun_score || data.fun_score || 0,
      
      // Story data (minimal)
      story: {
        matchup: data.story?.matchup || '',
        final_score: data.story?.final_score || '',
        teams: data.story?.teams || {
          winner: {
            name: data.gameMetadata?.homeTeam?.name || '',
            city: data.gameMetadata?.homeTeam?.city || '',
            tricode: data.gameMetadata?.homeTeam?.abbreviation || '',
            teamId: data.gameMetadata?.homeTeam?.team_id || 0,
            points: data.gameMetadata?.homeTeam?.points || 0
          },
          loser: {
            name: data.gameMetadata?.awayTeam?.name || '',
            city: data.gameMetadata?.awayTeam?.city || '',
            tricode: data.gameMetadata?.awayTeam?.abbreviation || '',
            teamId: data.gameMetadata?.awayTeam?.team_id || 0,
            points: data.gameMetadata?.awayTeam?.points || 0
          }
        },
        advantages: (data.story?.advantages || []).slice(0, 3) // Top 3 only for feed
      },
      
      // Excitement metrics
      lead_changes: scoreData.lead_changes || data.lead_changes || {
        total: 0,
        last_5_minutes: 0,
        last_minute: 0,
        buzzer_beater: 0
      },
      
      dunk_stats: scoreData.dunk_stats || data.dunk_stats || {
        'Total Dunks': 0,
        'Alley Oop': 0,
        'Putback': 0
      },
      
      deep_shots: scoreData.deep_shots || data.deep_shots || {
        deep_threes: 0,
        four_pointers: 0
      },
      
      // Media (if available)
      thumbnail_url: data.thumbnail_url || null,
      video_url: data.video_url || 
                 data.script?.video_script?.[0]?.mp4 || // Use first video from script
                 null,
      
      // Engagement (default to 0 for now)
      views: data.views || 0,
      likes: data.likes || 0
    };
    
    gamesIndex.push(indexEntry);
    processed++;
    
    if (processed % 50 === 0) {
      console.log(`Processed ${processed}/${files.length} games...`);
    }
    
  } catch (error) {
    console.error(`❌ Error processing ${file}:`, error.message);
    errors++;
  }
}

// Sort by date (most recent first)
gamesIndex.sort((a, b) => new Date(b.date) - new Date(a.date));

// Write index file
fs.writeFileSync(INDEX_OUTPUT, JSON.stringify(gamesIndex, null, 2));

console.log('\n✅ Index generation complete!');
console.log(`📊 Stats:`);
console.log(`   - Total games: ${files.length}`);
console.log(`   - Successfully processed: ${processed}`);
console.log(`   - Errors: ${errors}`);
console.log(`   - Index file: ${INDEX_OUTPUT}`);
console.log(`   - Index size: ${(fs.statSync(INDEX_OUTPUT).size / 1024 / 1024).toFixed(2)} MB`);

// Calculate some stats
const avgFunScore = gamesIndex.reduce((sum, g) => sum + g.fun_score, 0) / gamesIndex.length;
const topGames = gamesIndex.slice().sort((a, b) => b.fun_score - a.fun_score).slice(0, 5);

console.log(`\n🔥 Fun Score Stats:`);
console.log(`   - Average: ${avgFunScore.toFixed(1)}`);
console.log(`   - Top 5 Games:`);
topGames.forEach((game, i) => {
  console.log(`     ${i + 1}. ${game.story.matchup} (${game.fun_score.toFixed(1)})`);
});

