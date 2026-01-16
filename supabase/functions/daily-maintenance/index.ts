/**
 * Supabase Edge Function: Daily NBA Data Maintenance
 * Orchestrates all daily maintenance tasks to run overnight
 * 
 * This function runs all daily maintenance tasks in sequence:
 * 1. Import Daily Boxscores
 * 2. Import Player Props
 * 3. Import NBA Standings
 * 4. Import NBA Leaders
 * 5. Import NBA Team Rosters
 * 6. Import Player Game Stats (if edge function exists, otherwise skip)
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TaskResult {
  name: string
  success: boolean
  duration: number
  message?: string
  error?: string
}

interface MaintenanceResult {
  success: boolean
  totalTasks: number
  successful: number
  failed: number
  duration: string
  timestamp: string
  results: TaskResult[]
  failedTasks: string[]
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

    console.log('🏀 Daily NBA Data Maintenance - Starting...')
    console.log('========================================')
    console.log(`Started at: ${new Date().toISOString()}`)
    console.log('========================================')
    
    const result = await runDailyMaintenance(supabaseUrl, supabaseKey)
    
    return new Response(JSON.stringify(result, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: result.success ? 200 : 500,
    })
  } catch (error) {
    console.error('❌ Fatal error in daily maintenance:', error)
    
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
// MAIN ORCHESTRATOR
// ============================================================================

async function runDailyMaintenance(
  supabaseUrl: string,
  supabaseKey: string
): Promise<MaintenanceResult> {
  const startTime = Date.now()
  const results: TaskResult[] = []
  const failedTasks: string[] = []
  
  const tasks = [
    {
      name: 'Import Daily Boxscores',
      functionName: 'import-boxscores',
      description: 'Import box scores from today and the last 2 days'
    },
    {
      name: 'Import Player Props',
      functionName: 'import-player-props',
      description: 'Import player props for today\'s games'
    },
    {
      name: 'Import NBA Standings',
      functionName: 'update-standings',
      description: 'Update NBA conference standings'
    },
    {
      name: 'Import NBA Leaders',
      functionName: 'update-leaders',
      description: 'Update NBA statistical leaders'
    },
    {
      name: 'Import NBA Team Rosters',
      functionName: 'import-team-rosters',
      description: 'Update NBA team rosters'
    },
    // Note: Player Game Stats import is a Python script that processes JSON files
    // It may need to be run separately or converted to an edge function
    // For now, we'll skip it or you can add it as a separate task if needed
  ]

  console.log(`📋 Running ${tasks.length} maintenance tasks...\n`)

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i]
    const taskNumber = i + 1
    
    console.log(`\n[${taskNumber}/${tasks.length}] Running: ${task.name}`)
    console.log('----------------------------------------')
    
    const taskStartTime = Date.now()
    
    try {
      const result = await runTask(supabaseUrl, supabaseKey, task.functionName, task.name)
      const duration = Date.now() - taskStartTime
      
      results.push({
        name: task.name,
        success: result.success,
        duration,
        message: result.message,
        error: result.error
      })
      
      if (result.success) {
        console.log(`✅ ${task.name} completed successfully (${duration}ms)`)
        if (result.message) {
          console.log(`   ${result.message}`)
        }
      } else {
        console.error(`❌ ${task.name} failed (${duration}ms)`)
        if (result.error) {
          console.error(`   Error: ${result.error}`)
        }
        failedTasks.push(task.name)
      }
    } catch (error) {
      const duration = Date.now() - taskStartTime
      console.error(`❌ ${task.name} threw an error:`, error)
      
      results.push({
        name: task.name,
        success: false,
        duration,
        error: error.message
      })
      failedTasks.push(task.name)
    }
    
    console.log('----------------------------------------')
  }

  const totalDuration = Date.now() - startTime
  const successful = results.filter(r => r.success).length
  const failed = results.filter(r => !r.success).length

  console.log('\n========================================')
  console.log('📊 Summary')
  console.log('========================================')
  console.log(`Total tasks: ${tasks.length}`)
  console.log(`✅ Successful: ${successful}`)
  console.log(`❌ Failed: ${failed}`)
  if (failedTasks.length > 0) {
    console.log('\nFailed tasks:')
    failedTasks.forEach(task => console.log(`  - ${task}`))
  }
  console.log(`\nCompleted at: ${new Date().toISOString()}`)
  console.log(`Total duration: ${totalDuration}ms`)
  console.log('========================================\n')

  return {
    success: failed === 0,
    totalTasks: tasks.length,
    successful,
    failed,
    duration: `${totalDuration}ms`,
    timestamp: new Date().toISOString(),
    results,
    failedTasks
  }
}

// ============================================================================
// TASK RUNNER
// ============================================================================

async function runTask(
  supabaseUrl: string,
  supabaseKey: string,
  functionName: string,
  taskName: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    // Call the edge function via HTTP
    const functionUrl = `${supabaseUrl}/functions/v1/${functionName}`
    
    console.log(`   Calling: ${functionUrl}`)
    
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
      },
      body: JSON.stringify({})
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = `HTTP ${response.status}`
      try {
        const errorJson = JSON.parse(errorText)
        errorMessage = errorJson.error || errorJson.message || errorMessage
      } catch {
        errorMessage = errorText || errorMessage
      }
      
      return {
        success: false,
        error: errorMessage
      }
    }

    const result = await response.json()
    
    // Extract success status and message from response
    const success = result.success !== false && response.status === 200
    const message = result.message || result.success ? 'Task completed' : undefined
    
    return {
      success,
      message,
      error: success ? undefined : (result.error || 'Unknown error')
    }
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Network error'
    }
  }
}

