/**
 * Supabase Edge Function: DFS Pool Management
 * Runs on schedule to manage DFS pool lifecycle
 * 
 * This function:
 * 1. Updates pool statuses (scheduled → live → completed)
 * 2. Finalizes completed pools (scoring + ranking)
 * 3. Updates entry statuses
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PoolStatusUpdate {
  pool_id: string
  old_status: string
  new_status: string
}

interface CompletedPool {
  id: string
  name: string
  slate_date: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    console.log('🏀 DFS Pool Management triggered - Managing pool lifecycle...')
    
    const result = await manageDFSPools(supabase)
    
    return new Response(JSON.stringify(result, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('❌ Error:', error)
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message,
      stack: error.stack 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// ============================================================================
// CORE LOGIC
// ============================================================================

async function manageDFSPools(supabase: any) {
  const startTime = Date.now()
  
  try {
    console.log('📊 Starting DFS pool management...')
    
    // Step 1: Update pool statuses (scheduled → live → completed)
    const poolsUpdated = await updatePoolStatuses(supabase)
    
    // Step 2: Finalize completed pools (score + rank)
    const poolsFinalized = await finalizeCompletedPools(supabase)
    
    return {
      success: true,
      message: `Updated ${poolsUpdated} pool statuses, finalized ${poolsFinalized} pools`,
      poolsUpdated,
      poolsFinalized,
      duration: `${Date.now() - startTime}ms`,
      timestamp: new Date().toISOString(),
    }
    
  } catch (error) {
    console.error('❌ DFS pool management failed:', error)
    throw error
  }
}

// ============================================================================
// POOL STATUS UPDATES
// ============================================================================

async function updatePoolStatuses(supabase: any): Promise<number> {
  try {
    console.log('🔄 Updating DFS pool statuses...')
    
    const { data, error } = await supabase.rpc('update_dfs_pool_statuses')
    
    if (error) {
      console.error(`❌ Failed to update pool statuses:`, error)
      return 0
    }
    
    const result = data as PoolStatusUpdate[]
    const count = result?.length || 0
    
    if (count > 0) {
      console.log(`✅ Updated ${count} pool status(es)`)
      
      // Log details of updated pools
      result.forEach(pool => {
        console.log(`   • Pool ${pool.pool_id}: ${pool.old_status} → ${pool.new_status}`)
      })
    } else {
      console.log('ℹ️  No pool status updates needed')
    }
    
    return count
  } catch (error) {
    console.error('❌ Error updating pool statuses:', error)
    return 0
  }
}

// ============================================================================
// POOL FINALIZATION
// ============================================================================

async function finalizeCompletedPools(supabase: any): Promise<number> {
  try {
    console.log('🏁 Checking for completed pools to finalize...')
    
    // Get all completed pools that haven't been finalized yet
    const pools = await getCompletedPools(supabase)
    
    if (pools.length === 0) {
      console.log('ℹ️  No pools ready to finalize')
      return 0
    }
    
    console.log(`📊 Found ${pools.length} pool(s) to finalize`)
    
    let finalized = 0
    for (const pool of pools) {
      console.log(`   Finalizing pool: ${pool.name} (${pool.id})`)
      const success = await scoreAndFinalizePool(pool.id, supabase)
      if (success) {
        finalized++
        console.log(`   ✅ Pool ${pool.name} finalized successfully`)
      } else {
        console.error(`   ❌ Failed to finalize pool ${pool.name}`)
      }
    }
    
    console.log(`✅ Finalized ${finalized}/${pools.length} pool(s)`)
    return finalized
    
  } catch (error) {
    console.error('❌ Error finalizing pools:', error)
    return 0
  }
}

async function getCompletedPools(supabase: any): Promise<CompletedPool[]> {
  try {
    const { data, error } = await supabase
      .from('dfs_pools')
      .select('id, name, slate_date')
      .eq('status', 'completed')
      .is('finalized_at', null)
    
    if (error) {
      console.error(`❌ Failed to fetch completed pools:`, error)
      return []
    }
    
    return data || []
  } catch (error) {
    console.error('❌ Error fetching completed pools:', error)
    return []
  }
}

async function scoreAndFinalizePool(poolId: string, supabase: any): Promise<boolean> {
  try {
    // Step 1: Call score_dfs_pool to calculate all scores and rankings
    const { data: scoreResult, error: scoreError } = await supabase.rpc('score_dfs_pool', {
      p_pool_id: poolId
    })
    
    if (scoreError) {
      console.error(`❌ Failed to score pool ${poolId}:`, scoreError)
      return false
    }
    
    console.log(`   📊 Scored ${scoreResult?.length || 0} entries`)
    
    // Step 2: Mark pool as finalized
    const { error: updateError } = await supabase
      .from('dfs_pools')
      .update({ 
        finalized_at: new Date().toISOString(),
        status: 'completed'  // Ensure status is set to completed
      })
      .eq('id', poolId)
    
    if (updateError) {
      console.error(`❌ Failed to mark pool ${poolId} as finalized:`, updateError)
      return false
    }
    
    return true
    
  } catch (error) {
    console.error(`❌ Error scoring/finalizing pool ${poolId}:`, error)
    return false
  }
}

