/**
 * Cloudflare Worker: DFS Pool Management
 * Runs every 5 minutes during game hours to manage DFS pool lifecycle
 * 
 * This worker:
 * 1. Updates pool statuses (scheduled → live → completed)
 * 2. Finalizes completed pools (scoring + ranking)
 * 3. Updates entry statuses
 */

// ============================================================================
// MAIN HANDLER
// ============================================================================

export default {
  // Scheduled event (triggered by cron)
  async scheduled(event, env, ctx) {
    console.log('🏀 DFS Cron triggered - Managing pool lifecycle...');
    
    try {
      const result = await manageDFSPools(env);
      console.log('✅ DFS Cron completed:', result);
    } catch (error) {
      console.error('❌ DFS Cron failed:', error);
    }
  },

  // HTTP handler (for manual testing)
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    console.log('🏀 DFS Manual trigger - Managing pool lifecycle...');
    
    try {
      const result = await manageDFSPools(env);
      
      return new Response(JSON.stringify(result, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    } catch (error) {
      console.error('❌ Error:', error);
      
      return new Response(JSON.stringify({ 
        success: false, 
        error: error.message,
        stack: error.stack 
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  },
};

// ============================================================================
// CORE LOGIC
// ============================================================================

async function manageDFSPools(env) {
  const startTime = Date.now();
  
  try {
    console.log('📊 Starting DFS pool management...');
    
    // Step 1: Update pool statuses (scheduled → live → completed)
    const poolsUpdated = await updatePoolStatuses(env);
    
    // Step 2: Finalize completed pools (score + rank)
    const poolsFinalized = await finalizeCompletedPools(env);
    
    return {
      success: true,
      message: `Updated ${poolsUpdated} pool statuses, finalized ${poolsFinalized} pools`,
      poolsUpdated,
      poolsFinalized,
      duration: `${Date.now() - startTime}ms`,
      timestamp: new Date().toISOString(),
    };
    
  } catch (error) {
    console.error('❌ DFS pool management failed:', error);
    throw error;
  }
}

// ============================================================================
// POOL STATUS UPDATES
// ============================================================================

async function updatePoolStatuses(env) {
  const url = `${env.SUPABASE_URL}/rest/v1/rpc/update_dfs_pool_statuses`;
  
  try {
    console.log('🔄 Updating DFS pool statuses...');
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error(`❌ Failed to update pool statuses (${response.status}):`, error);
      return 0;
    }
    
    const result = await response.json();
    const count = result?.length || 0;
    
    if (count > 0) {
      console.log(`✅ Updated ${count} pool status(es)`);
      
      // Log details of updated pools
      result.forEach(pool => {
        console.log(`   • Pool ${pool.pool_id}: ${pool.old_status} → ${pool.new_status}`);
      });
    } else {
      console.log('ℹ️  No pool status updates needed');
    }
    
    return count;
  } catch (error) {
    console.error('❌ Error updating pool statuses:', error);
    return 0;
  }
}

// ============================================================================
// POOL FINALIZATION
// ============================================================================

async function finalizeCompletedPools(env) {
  try {
    console.log('🏁 Checking for completed pools to finalize...');
    
    // Get all completed pools that haven't been finalized yet
    const pools = await getCompletedPools(env);
    
    if (pools.length === 0) {
      console.log('ℹ️  No pools ready to finalize');
      return 0;
    }
    
    console.log(`📊 Found ${pools.length} pool(s) to finalize`);
    
    let finalized = 0;
    for (const pool of pools) {
      console.log(`   Finalizing pool: ${pool.name} (${pool.id})`);
      const success = await scoreAndFinalizePool(pool.id, env);
      if (success) {
        finalized++;
        console.log(`   ✅ Pool ${pool.name} finalized successfully`);
      } else {
        console.error(`   ❌ Failed to finalize pool ${pool.name}`);
      }
    }
    
    console.log(`✅ Finalized ${finalized}/${pools.length} pool(s)`);
    return finalized;
    
  } catch (error) {
    console.error('❌ Error finalizing pools:', error);
    return 0;
  }
}

async function getCompletedPools(env) {
  const url = `${env.SUPABASE_URL}/rest/v1/dfs_pools`;
  
  try {
    const response = await fetch(
      `${url}?status=eq.completed&finalized_at=is.null&select=id,name,slate_date`,
      {
        headers: {
          'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );
    
    if (!response.ok) {
      console.error(`❌ Failed to fetch completed pools: ${response.status}`);
      return [];
    }
    
    return await response.json();
  } catch (error) {
    console.error('❌ Error fetching completed pools:', error);
    return [];
  }
}

async function scoreAndFinalizePool(poolId, env) {
  try {
    // Step 1: Call score_dfs_pool to calculate all scores and rankings
    const scoreUrl = `${env.SUPABASE_URL}/rest/v1/rpc/score_dfs_pool`;
    const scoreResponse = await fetch(scoreUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ p_pool_id: poolId }),
    });
    
    if (!scoreResponse.ok) {
      const error = await scoreResponse.text();
      console.error(`❌ Failed to score pool ${poolId} (${scoreResponse.status}):`, error);
      return false;
    }
    
    const scoreResult = await scoreResponse.json();
    console.log(`   📊 Scored ${scoreResult?.length || 0} entries`);
    
    // Step 2: Mark pool as finalized
    const updateUrl = `${env.SUPABASE_URL}/rest/v1/dfs_pools`;
    const updateResponse = await fetch(`${updateUrl}?id=eq.${poolId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ 
        finalized_at: new Date().toISOString(),
        status: 'completed'  // Ensure status is set to completed
      }),
    });
    
    if (!updateResponse.ok) {
      const error = await updateResponse.text();
      console.error(`❌ Failed to mark pool ${poolId} as finalized:`, error);
      return false;
    }
    
    return true;
    
  } catch (error) {
    console.error(`❌ Error scoring/finalizing pool ${poolId}:`, error);
    return false;
  }
}

