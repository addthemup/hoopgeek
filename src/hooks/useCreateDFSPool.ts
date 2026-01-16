import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
import { useAuth } from './useAuth';

// Generate OG image for DFS pool (similar to feed posts)
// Includes retry logic for reliability
const generateOGImageForPool = async (poolId: string, retries = 3): Promise<void> => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`🎨 Calling OG image generation for pool (attempt ${attempt}/${retries}):`, poolId);
      
      // Call Supabase Edge Function to generate OG image
      const { data, error } = await supabase.functions.invoke('generate-og-image', {
        body: {
          pool_id: poolId
        }
      });
      
      if (error) {
        console.error(`❌ Failed to generate OG image (attempt ${attempt}/${retries}):`, error);
        if (attempt === retries) {
          console.error('❌ All retry attempts exhausted for OG image generation');
          return;
        }
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }
      
      if (data?.og_image_url) {
        console.log('✅ OG image generated for pool:', data.og_image_url);
        return; // Success, exit retry loop
      } else {
        console.warn(`⚠️ OG image function returned no URL (attempt ${attempt}/${retries}):`, data);
        if (attempt === retries) {
          console.error('❌ OG image generation failed after all retries');
          return;
        }
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }
    } catch (error) {
      console.error(`❌ Error generating OG image (attempt ${attempt}/${retries}):`, error);
      if (attempt === retries) {
        console.error('❌ All retry attempts exhausted due to errors');
        return;
      }
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
};

export interface LineupRequirements {
  // Team-based requirements
  min_players_per_team?: number;
  max_players_per_team?: number;
  min_players_from_teams?: Array<{ team: string; min: number }>;
  max_players_from_teams?: Array<{ team: string; max: number }>;
  min_different_teams?: number;
  max_players_same_team?: number;
  
  // Player-based requirements
  required_player_ids?: number[];
  required_player_groups?: Array<{ name: string; player_ids: number[]; min: number }>;
  excluded_player_ids?: number[];
  
  // Rookie requirements
  max_rookies?: number;
  
  // Position-based requirements
  min_players_per_position?: Array<{ position: string; min: number }>;
  max_players_per_position?: Array<{ position: string; max: number }>;
  min_salary_per_position?: Array<{ position: string; min_salary: number }>;
  max_salary_per_position?: Array<{ position: string; max_salary: number }>;
  
  // Age requirements
  min_lineup_age?: number;
  max_lineup_age?: number;
  min_players_under_age?: number;
  max_players_over_age?: number;
  age_threshold?: number;
  
  // Game-based requirements
  min_players_per_game?: number;
  max_players_same_game?: number;
  required_game_ids?: string[];
  min_players_home_teams?: number;
  max_players_home_teams?: number;
  min_players_away_teams?: number;
  max_players_away_teams?: number;
  
  // Record-based requirements
  min_players_from_winning_teams?: number;
  max_players_from_winning_teams?: number;
  min_players_from_losing_teams?: number;
  max_players_from_losing_teams?: number;
  min_players_top_teams?: number;
  max_players_top_teams?: number;
  top_teams_count?: number;
  min_players_bottom_teams?: number;
  max_players_bottom_teams?: number;
  bottom_teams_count?: number;
  
  // Conference/Division requirements
  min_players_east_conference?: number;
  max_players_east_conference?: number;
  min_players_west_conference?: number;
  max_players_west_conference?: number;
  max_players_same_division?: number;
  
  // Stat-based requirements
  min_players_stat_threshold?: Array<{ stat: string; threshold: number; min: number }>;
  max_players_stat_threshold?: Array<{ stat: string; threshold: number; max: number }>;
  
  // Playoff/Season requirements
  max_players_playoff_teams?: number;
  min_players_non_playoff_teams?: number;
  
  // Spread/Total requirements
  min_players_high_total_games?: number;
  max_players_high_total_games?: number;
  high_total_threshold?: number;
  min_players_close_games?: number;
  max_players_close_games?: number;
  close_game_spread_threshold?: number;
}

export interface CreateDFSPoolParams {
  pool_name: string;
  slate_name: string;
  description?: string;
  slate_date: string;
  game_ids: string[];
  entry_fee: number;
  max_entries: number;
  difficulty: 'elite' | 'pro' | 'standard';
  prize_type?: 'top_n' | 'top_percent' | '50_50' | 'winner_take_all' | 'satellites';
  is_guaranteed?: boolean;
  guaranteed_amount?: number;
  roster_config?: 'compact' | 'full';
  scoring_format?: 'FanDuel' | 'DraftKings' | 'Yahoo' | 'ESPN' | 'Custom';
  icon_name?: string;
  html_color_primary?: string;
  html_color_secondary?: string;
  lineup_requirements?: LineupRequirements;
  // Point configuration
  points_entry?: number;
  points_win?: number;
  points_placement?: Array<{ rank: number; points: number }>;
  points_top_percent?: Array<{ percent: number; points: number }>;
  points_enabled?: boolean;
  group_id?: string | null; // null = public, string = private group
}

export interface CreateDFSPoolResult {
  pool_id: string;
  message: string;
  players_added: number;
  games_added: number;
}

export function useCreateDFSPool() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<CreateDFSPoolResult, Error, CreateDFSPoolParams>({
    mutationFn: async (params) => {
      console.log('🏀 Creating DFS pool:', params);

      if (!user) {
        throw new Error('Must be logged in to create pools');
      }

      // Determine roster counts based on configuration
      const rosterConfig = params.roster_config || 'compact';
      const [startersCount, rotationCount, benchCount] = 
        rosterConfig === 'full' 
          ? [5, 5, 3]  // Full: G G F F C / G G F F C / UTIL UTIL UTIL
          : [5, 3, 2]; // Compact: G G F F C / G F C / UTIL UTIL

      // Build lineup requirements JSONB object (only include defined fields)
      const lineupRequirements: any = {};
      if (params.lineup_requirements) {
        Object.entries(params.lineup_requirements).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            lineupRequirements[key] = value;
          }
        });
      }

      // Convert points arrays to JSONB
      const pointsPlacementJson = params.points_placement && params.points_placement.length > 0
        ? JSON.stringify(params.points_placement)
        : '[]';
      const pointsTopPercentJson = params.points_top_percent && params.points_top_percent.length > 0
        ? JSON.stringify(params.points_top_percent)
        : '[]';

      const { data, error } = await supabase.rpc('create_dfs_pool_from_games', {
        // Required parameters
        p_pool_name: params.pool_name,
        p_slate_name: params.slate_name,
        p_slate_date: params.slate_date,
        p_game_ids: params.game_ids,
        // Optional parameters
        p_description: params.description || '',
        p_entry_fee: params.entry_fee,
        p_max_entries: params.max_entries,
        p_difficulty_tier: params.difficulty,
        p_starters_count: startersCount,
        p_rotation_count: rotationCount,
        p_bench_count: benchCount,
        p_scoring_format: params.scoring_format || 'FanDuel',
        // Icon parameters
        p_icon_name: params.icon_name || null,
        p_html_color_primary: params.html_color_primary || null,
        p_html_color_secondary: params.html_color_secondary || null,
        // Lineup requirements
        p_lineup_requirements: Object.keys(lineupRequirements).length > 0 ? lineupRequirements : null,
        // Point configuration
        p_points_entry: params.points_entry ?? 10,
        p_points_win: params.points_win ?? 100,
        p_points_placement: pointsPlacementJson as any,
        p_points_top_percent: pointsTopPercentJson as any,
        p_points_enabled: params.points_enabled ?? true,
      });

      if (error) {
        console.error('❌ Failed to create DFS pool:', error);
        throw new Error(error.message || 'Failed to create pool');
      }

      console.log('✅ Pool created successfully:', data);
      console.log('📊 Data type:', Array.isArray(data) ? 'array' : typeof data);
      console.log('📊 Data length:', Array.isArray(data) ? data.length : 'N/A');
      
      // RPC function returns TABLE, so data is an array - get first row
      const poolResult = Array.isArray(data) && data.length > 0 ? data[0] : data;
      const poolId = poolResult?.pool_id;
      
      console.log('🔍 Extracted pool_id:', poolId);
      console.log('🔍 Full pool result:', poolResult);

      // Link pool to group if group_id is provided
      if (params.group_id && poolId) {
        console.log('🔗 Linking pool to group:', params.group_id);
        
        // First, set is_public = false for private pools
        const { error: updateError } = await supabase
          .from('dfs_pools')
          .update({ is_public: false })
          .eq('id', poolId);

        if (updateError) {
          console.error('❌ Failed to update pool visibility:', updateError);
          // Don't throw - pool was created successfully
        }

        // Link to group
        const { error: linkError } = await supabase
          .from('dfs_group_pools')
          .insert({
            group_id: params.group_id,
            pool_id: poolId,
            created_by: user.id,
          });

        if (linkError) {
          console.error('❌ Failed to link pool to group:', linkError);
          // Don't throw - pool was created successfully, just not linked
        } else {
          console.log('✅ Pool linked to group successfully');
        }
      } else if (poolId) {
        // Ensure public pools are marked as public
        const { error: updateError } = await supabase
          .from('dfs_pools')
          .update({ is_public: true })
          .eq('id', poolId);

        if (updateError) {
          console.error('❌ Failed to update pool visibility:', updateError);
        }
      }
      
      // Generate OG image for the pool (similar to feed posts)
      if (poolId) {
        console.log('🎨 Generating OG image for DFS pool:', poolId);
        generateOGImageForPool(poolId).catch(err => {
          console.error('❌ Failed to generate OG image for pool:', err);
          // Don't fail the pool creation if OG image generation fails
        });
      } else {
        console.warn('⚠️ No pool_id found in result:', poolResult);
      }
      
      return poolResult || data;
    },
    onSuccess: (data) => {
      console.log('✅ Pool created, invalidating queries');
      // Invalidate admin pools query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['dfs-admin-pools'] });
      queryClient.invalidateQueries({ queryKey: ['dfs-pools'] });
    },
    onError: (error) => {
      console.error('❌ Create pool mutation error:', error);
    },
  });
}

