-- =====================================================
-- FIX TRADE FUNCTION CONFLICT
-- =====================================================
-- Drop the old create_trade_offer function with INTEGER[] parameters
-- to resolve the function signature conflict
-- =====================================================

-- Drop the old function with INTEGER[] parameters
DROP FUNCTION IF EXISTS create_trade_offer(UUID, UUID, UUID, INTEGER[], INTEGER[], INTEGER[], INTEGER[]);

-- Drop any other conflicting versions
DROP FUNCTION IF EXISTS create_trade_offer(UUID, UUID, UUID, INTEGER[], INTEGER[], UUID[], INTEGER[]);
DROP FUNCTION IF EXISTS create_trade_offer(UUID, UUID, UUID, UUID[], INTEGER[], INTEGER[], INTEGER[]);

-- Now the clean version with UUID[] parameters should work
-- (This will be deployed via restore_working_draft_trades_clean.sql)

DO $$
BEGIN
    RAISE NOTICE '✅ Dropped conflicting create_trade_offer functions';
    RAISE NOTICE '✅ Ready to deploy clean version with UUID[] parameters';
END $$;
