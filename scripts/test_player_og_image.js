#!/usr/bin/env node
/**
 * Test script to generate OG image for a player page
 * Usage: node scripts/test_player_og_image.js <player_id>
 */

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://qbznyaimnrpibmahisue.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiem55YWltbnJwaWJtYWhpc3VlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MTU0MjgsImV4cCI6MjA3NDk5MTQyOH0.bV4FULUCT0tJg6Scu2-B86Pui8nIeMsxDb-x5iVEHuU';

async function testPlayerOGImage(playerId) {
  console.log(`🧪 Testing OG image generation for player: ${playerId}`);
  console.log(`📡 Calling: ${SUPABASE_URL}/functions/v1/generate-og-image`);
  
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-og-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        player_id: playerId
      })
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Success!');
      console.log('Response:', JSON.stringify(data, null, 2));
      
      if (data.og_image_url) {
        console.log(`\n📸 OG Image URL: ${data.og_image_url}`);
        console.log(`\n🔗 Check in Supabase Storage: og-images/player-pages/${playerId}.svg`);
      }
    } else {
      console.error('❌ Error:', response.status, response.statusText);
      console.error('Response:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('❌ Exception:', error);
  }
}

// Get player ID from command line
const playerId = process.argv[2];

if (!playerId) {
  console.error('Usage: node scripts/test_player_og_image.js <player_id>');
  console.error('Example: node scripts/test_player_og_image.js 0c2d9a2f-fff6-4ee5-89cd-31f18991c5af');
  process.exit(1);
}

testPlayerOGImage(playerId);

