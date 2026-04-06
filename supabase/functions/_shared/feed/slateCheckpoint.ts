/**
 * feed_automation_slate_checkpoints — for post types not keyed by game_id (TOTN, TOTW, draft, POW/POM).
 * checkpoint_key should match feed_posts.source_ref for idempotency with feed_posts unique constraint.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

export async function isSlateAutomationDone(supabase: SupabaseClient, checkpointKey: string): Promise<boolean> {
  const { data } = await supabase
    .from('feed_automation_slate_checkpoints')
    .select('batch_done')
    .eq('checkpoint_key', checkpointKey)
    .maybeSingle()
  return data?.batch_done === true
}

export async function markSlateAutomationDone(supabase: SupabaseClient, checkpointKey: string): Promise<void> {
  await supabase.from('feed_automation_slate_checkpoints').upsert(
    { checkpoint_key: checkpointKey, batch_done: true },
    { onConflict: 'checkpoint_key' },
  )
}
