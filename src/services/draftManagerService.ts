/**
 * Draft Manager Service
 * 
 * Provides a background polling service for the draft-manager
 * that continues to run even when the user switches tabs.
 * 
 * This ensures drafts progress even if no one is actively watching.
 */

import { supabase } from '../utils/supabase';

class DraftManagerService {
  private pollingInterval: number | null = null;
  private isPolling: boolean = false;
  private pollFrequency: number = 3000; // 3 seconds for responsive drafts
  
  /**
   * Start polling the draft-manager for all active drafts
   */
  start() {
    if (this.isPolling) {
      console.log('🏀 Draft manager already polling');
      return;
    }

    console.log('🏀 Starting global draft manager service');
    this.isPolling = true;

    // Call immediately
    this.pollDraftManager();

    // Then poll every 3 seconds
    this.pollingInterval = window.setInterval(() => {
      this.pollDraftManager();
    }, this.pollFrequency);
  }

  /**
   * Stop polling
   */
  stop() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.isPolling = false;
    console.log('🛑 Stopped global draft manager service');
  }

  /**
   * Check if currently polling
   */
  isActive(): boolean {
    return this.isPolling;
  }

  /**
   * Poll the draft-manager edge function
   * This processes ALL active drafts, not just one league
   */
  private async pollDraftManager() {
    try {
      // First check if there are any active drafts
      const { data: activeDrafts, error: draftError } = await supabase
        .from('fantasy_league_seasons')
        .select('league_id, draft_status')
        .eq('draft_status', 'in_progress')
        .limit(1);

      if (draftError) {
        console.error('❌ Error checking active drafts:', draftError);
        return;
      }

      // If no active drafts, don't call the function
      if (!activeDrafts || activeDrafts.length === 0) {
        // Stop polling if no active drafts for more than 1 minute
        if (this.isPolling) {
          console.log('⏸️ No active drafts - service still running in background');
        }
        return;
      }

      console.log(`🏀 Processing ${activeDrafts.length} active draft(s)...`);

      // Call draft-manager to process all active drafts
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/draft-manager`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            trigger: 'global_poll',
            timestamp: new Date().toISOString()
          })
        }
      );

      if (!response.ok) {
        console.error('❌ Draft-manager error:', response.status, await response.text());
      } else {
        const result = await response.json();
        console.log('✅ Draft-manager processed:', result);
      }
    } catch (error) {
      console.error('❌ Failed to poll draft-manager:', error);
    }
  }
}

// Create singleton instance
export const draftManagerService = new DraftManagerService();

// Auto-start when app loads (will check for active drafts before doing anything)
if (typeof window !== 'undefined') {
  // Start after a short delay to ensure app is initialized
  setTimeout(() => {
    draftManagerService.start();
  }, 2000);
  
  // Keep it running even if user is idle
  // This ensures drafts progress even with no active users
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      console.log('📴 Page hidden - but draft manager continues running');
    } else {
      console.log('👁️ Page visible - draft manager still running');
      // Trigger immediate check when user returns
      if (draftManagerService.isActive()) {
        draftManagerService.stop();
        draftManagerService.start();
      }
    }
  });
}

