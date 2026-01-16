-- Verify that all columns exist in nba_player_game_stats table
-- Run this in Supabase SQL Editor to check if migration completed successfully

SELECT 
    column_name,
    data_type,
    character_maximum_length,
    numeric_precision,
    numeric_scale,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'nba_player_game_stats'
ORDER BY ordinal_position;

-- Expected columns (34 total):
-- id, player_id, game_id, season_year
-- advanced_playerEfficiencyRating, advanced_offensiveRating, advanced_defensiveRating, 
-- advanced_netRating, advanced_trueShootingPercentage, advanced_usagePercentage,
-- advanced_assistRatio, advanced_reboundPercentage, advanced_pace
-- fourFactors_effectiveFieldGoalPercentage, fourFactors_freeThrowAttemptRate,
-- fourFactors_offensiveReboundPercentage, fourFactors_turnoverPercentage
-- hustle_contestedShots, hustle_contestedShots3pt, hustle_deflections,
-- hustle_looseBallsRecovered, hustle_chargesDrawn, hustle_screenAssists
-- misc_pointsOffTurnovers, misc_pointsSecondChance, misc_pointsFastBreak, misc_pointsPaint
-- playerTrack_touches, playerTrack_passes, playerTrack_timeOfPossession,
-- playerTrack_contestedFieldGoalPercentage, playerTrack_uncontestedFieldGoalsPercentage,
-- playerTrack_defendedAtRimFieldGoalPercentage
-- scoring_restrictedAreaFieldGoalsPercentage, scoring_paintFieldGoalsPercentage,
-- scoring_midRangeFieldGoalsPercentage, scoring_aboveTheBreak3FieldGoalsPercentage,
-- scoring_corner3FieldGoalsPercentage
-- created_at, updated_at

