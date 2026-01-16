#!/usr/bin/env node

/**
 * Debug script to test player page OG image generation and meta tag injection
 * Usage: node scripts/test_player_og_image_debug.js <playerId>
 */

const playerId = process.argv[2];

if (!playerId) {
  console.error('❌ Please provide a player ID');
  console.log('Usage: node scripts/test_player_og_image_debug.js <playerId>');
  process.exit(1);
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://qbznyaimnrpibmahisue.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFiem55YWltbnJwaWJtYWhpc3VlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk0MTU0MjgsImV4cCI6MjA3NDk5MTQyOH0.bV4FULUCT0tJg6Scu2-B86Pui8nIeMsXDb-x5iVEHuU';
const BASE_URL = 'https://hoop-geek.com';

async function testOGImageFlow() {
  console.log('🔍 Testing Player Page OG Image Flow\n');
  console.log(`Player ID: ${playerId}\n`);

  // Step 1: Test Edge Function - Generate OG Image
  console.log('1️⃣ Testing Edge Function - Generate OG Image...');
  try {
    const edgeFunctionResponse = await fetch(`${SUPABASE_URL}/functions/v1/generate-og-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ player_id: playerId }),
    });

    if (edgeFunctionResponse.ok) {
      const data = await edgeFunctionResponse.json();
      console.log('✅ Edge Function Response:', JSON.stringify(data, null, 2));
      if (data.og_image_url) {
        console.log(`✅ OG Image URL in storage: ${data.og_image_url}`);
      }
    } else {
      const errorText = await edgeFunctionResponse.text();
      console.error(`❌ Edge Function Error: ${edgeFunctionResponse.status} - ${errorText}`);
    }
  } catch (error) {
    console.error('❌ Edge Function Request Failed:', error.message);
  }

  console.log('\n');

  // Step 2: Test Player OG Image Route (PNG conversion)
  console.log('2️⃣ Testing Player OG Image Route (PNG)...');
  const playerOgImageUrl = `${BASE_URL}/player-og-image/${playerId}`;
  console.log(`URL: ${playerOgImageUrl}`);
  
  try {
    const imageResponse = await fetch(playerOgImageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AppleBot/1.0)',
        'Accept': 'image/png,image/*,*/*',
      },
    });

    console.log(`Status: ${imageResponse.status}`);
    console.log(`Content-Type: ${imageResponse.headers.get('content-type')}`);
    
    if (imageResponse.ok) {
      const contentType = imageResponse.headers.get('content-type');
      if (contentType?.includes('image/png')) {
        console.log('✅ PNG image served successfully');
      } else if (contentType?.includes('image/svg')) {
        console.log('⚠️ SVG served (PNG conversion may have failed)');
      } else {
        console.log(`⚠️ Unexpected content type: ${contentType}`);
      }
    } else {
      const errorText = await imageResponse.text();
      console.error(`❌ Image Route Error: ${errorText.substring(0, 200)}`);
    }
  } catch (error) {
    console.error('❌ Image Route Request Failed:', error.message);
  }

  console.log('\n');

  // Step 3: Test Player Page HTML (Meta Tag Injection)
  console.log('3️⃣ Testing Player Page HTML (Meta Tag Injection)...');
  const playerPageUrl = `${BASE_URL}/player/${playerId}`;
  console.log(`URL: ${playerPageUrl}`);
  
  try {
    const htmlResponse = await fetch(playerPageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    console.log(`Status: ${htmlResponse.status}`);
    
    if (htmlResponse.ok) {
      const html = await htmlResponse.text();
      
      // Check for OG image meta tag
      const ogImageMatch = html.match(/<meta\s+property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i);
      if (ogImageMatch) {
        console.log('✅ OG Image meta tag found!');
        console.log(`   URL: ${ogImageMatch[1]}`);
        
        // Check if it's the PNG route
        if (ogImageMatch[1].includes('/player-og-image/')) {
          console.log('✅ Using PNG route (correct)');
        } else {
          console.log('⚠️ Not using PNG route - may be using SVG directly');
        }
      } else {
        console.error('❌ OG Image meta tag NOT found in HTML!');
        console.log('   Searching for any og:image tags...');
        const allOgImages = html.match(/<meta[^>]*og:image[^>]*>/gi);
        if (allOgImages) {
          console.log(`   Found ${allOgImages.length} og:image related tags:`);
          allOgImages.forEach((tag, i) => {
            console.log(`   ${i + 1}. ${tag.substring(0, 100)}...`);
          });
        } else {
          console.log('   No og:image tags found at all');
        }
      }

      // Check for other OG tags
      const ogTitleMatch = html.match(/<meta\s+property=["']og:title["'][^>]*>/i);
      const ogDescriptionMatch = html.match(/<meta\s+property=["']og:description["'][^>]*>/i);
      
      console.log(`\n   OG Title: ${ogTitleMatch ? '✅ Found' : '❌ Missing'}`);
      console.log(`   OG Description: ${ogDescriptionMatch ? '✅ Found' : '❌ Missing'}`);
      
    } else {
      const errorText = await htmlResponse.text();
      console.error(`❌ HTML Response Error: ${htmlResponse.status}`);
      console.error(`   ${errorText.substring(0, 200)}`);
    }
  } catch (error) {
    console.error('❌ HTML Request Failed:', error.message);
  }

  console.log('\n✅ Debug test complete!');
}

testOGImageFlow().catch(console.error);

