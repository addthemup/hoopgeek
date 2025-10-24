// Supabase Edge Function to automatically process waiver claims
// This runs on a schedule (cron job) to process waivers for all leagues

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🕐 Starting scheduled waiver processing...')

    // Verify this is a legitimate cron request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('❌ Missing Authorization header')
      return new Response(
        JSON.stringify({ error: 'Missing authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client with service role key for admin access
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get the current time
    const now = new Date()
    const currentHour = now.getUTCHours()
    const currentMinute = now.getUTCMinutes()
    const currentDay = now.getUTCDay() // 0 = Sunday, 1 = Monday, etc.

    console.log(`📅 Current UTC time: ${now.toISOString()} (Day: ${currentDay}, Hour: ${currentHour}, Minute: ${currentMinute})`)

    // Get all active league seasons with their waiver settings
    const { data: seasons, error: seasonsError } = await supabase
      .from('fantasy_league_seasons')
      .select(`
        id,
        league_id,
        waiver_type,
        waiver_period_hours,
        waiver_process_time,
        waiver_claim_days,
        waiver_processing_day,
        waiver_processing_time,
        is_active
      `)
      .eq('is_active', true)

    if (seasonsError) {
      console.error('❌ Error fetching seasons:', seasonsError)
      throw seasonsError
    }

    console.log(`📊 Found ${seasons?.length || 0} active seasons`)

    let totalProcessed = 0
    let totalAwarded = 0
    let totalFailed = 0
    const results: any[] = []

    // Process each league season
    for (const season of seasons || []) {
      console.log(`\n🏀 Processing league ${season.league_id} (season ${season.id})...`)

      // Check if this league should process waivers now
      let shouldProcess = false

      if (season.waiver_type === 'none') {
        console.log('⏭️  Waiver type is "none", skipping...')
        continue
      }

      // For FAAB and continuous waivers, check if it's the right day/time
      if (season.waiver_claim_days && Array.isArray(season.waiver_claim_days)) {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        const currentDayName = dayNames[currentDay]
        
        if (season.waiver_claim_days.includes(currentDayName)) {
          // Check if we're at or past the processing time
          const processTime = season.waiver_processing_time || season.waiver_process_time || '03:00:00'
          const [processHour, processMinute] = processTime.split(':').map(Number)
          
          // Process if we're within 1 minute of the scheduled time
          if (currentHour === processHour && Math.abs(currentMinute - processMinute) <= 1) {
            shouldProcess = true
            console.log(`✅ It's ${currentDayName} at ${processTime} UTC - processing!`)
          } else {
            console.log(`⏰ Not time yet. Current: ${currentHour}:${currentMinute}, Target: ${processHour}:${processMinute}`)
          }
        } else {
          console.log(`📅 Not a processing day. Current: ${currentDayName}, Allowed: ${season.waiver_claim_days.join(', ')}`)
        }
      } else {
        // Fallback: Process every hour for leagues without specific claim days
        if (currentMinute <= 5) {
          shouldProcess = true
          console.log('✅ No specific claim days set - processing hourly')
        }
      }

      if (!shouldProcess) {
        console.log('⏭️  Skipping this league (not scheduled to process now)')
        continue
      }

      // Call the process_waiver_claims RPC function
      const { data: result, error: processError } = await supabase.rpc('process_waiver_claims', {
        p_league_id: season.league_id,
        p_season_id: season.id,
      })

      if (processError) {
        console.error(`❌ Error processing waivers for league ${season.league_id}:`, processError)
        results.push({
          league_id: season.league_id,
          season_id: season.id,
          success: false,
          error: processError.message,
        })
        continue
      }

      console.log(`✅ Processed league ${season.league_id}:`, result)
      
      totalProcessed++
      totalAwarded += result?.awarded_count || 0
      totalFailed += result?.failed_count || 0

      results.push({
        league_id: season.league_id,
        season_id: season.id,
        success: true,
        awarded_count: result?.awarded_count || 0,
        failed_count: result?.failed_count || 0,
      })
    }

    console.log(`\n🎉 Waiver processing complete!`)
    console.log(`📊 Summary: ${totalProcessed} leagues processed, ${totalAwarded} claims awarded, ${totalFailed} claims failed`)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Waiver processing complete',
        timestamp: now.toISOString(),
        leagues_processed: totalProcessed,
        total_awarded: totalAwarded,
        total_failed: totalFailed,
        results,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('❌ Fatal error in waiver processing:', error)
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

