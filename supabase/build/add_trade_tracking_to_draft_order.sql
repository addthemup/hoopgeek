-- =====================================================
-- ADD TRADE TRACKING TO DRAFT ORDER
-- =====================================================
-- Add columns to track trade information for draft picks
-- =====================================================

-- Add trade tracking columns to fantasy_draft_order
ALTER TABLE fantasy_draft_order 
ADD COLUMN IF NOT EXISTS original_team_id UUID REFERENCES fantasy_teams(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS current_team_id UUID REFERENCES fantasy_teams(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS trade_count INTEGER DEFAULT 0;

-- Update existing records to set original_team_id and current_team_id
UPDATE fantasy_draft_order 
SET 
  original_team_id = fantasy_team_id,
  current_team_id = fantasy_team_id
WHERE original_team_id IS NULL OR current_team_id IS NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_fantasy_draft_order_original_team ON fantasy_draft_order(original_team_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_draft_order_current_team ON fantasy_draft_order(current_team_id);
CREATE INDEX IF NOT EXISTS idx_fantasy_draft_order_traded ON fantasy_draft_order(is_traded) WHERE is_traded = true;

-- Function to execute a draft pick trade
CREATE OR REPLACE FUNCTION execute_draft_pick_trade(
  pick_number_param INTEGER,
  league_id_param UUID,
  from_team_id_param UUID,
  to_team_id_param UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  pick_record RECORD;
BEGIN
  -- Get the pick record
  SELECT * INTO pick_record 
  FROM fantasy_draft_order 
  WHERE pick_number = pick_number_param 
    AND league_id = league_id_param;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pick not found';
  END IF;
  
  -- Validate that the from_team currently owns the pick
  IF pick_record.current_team_id != from_team_id_param THEN
    RAISE EXCEPTION 'From team does not own this pick';
  END IF;
  
  -- Update the pick to reflect the trade
  UPDATE fantasy_draft_order 
  SET 
    current_team_id = to_team_id_param,
    is_traded = true,
    trade_count = trade_count + 1,
    updated_at = NOW()
  WHERE pick_number = pick_number_param 
    AND league_id = league_id_param;
  
  RETURN TRUE;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION execute_draft_pick_trade(INTEGER, UUID, UUID, UUID) TO authenticated;

DO $$
BEGIN
    RAISE NOTICE '✅ Added trade tracking columns to fantasy_draft_order';
    RAISE NOTICE '✅ Created execute_draft_pick_trade function';
    RAISE NOTICE '✅ Ready for draft pick trades';
END $$;