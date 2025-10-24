-- Add transaction_metadata column to fantasy_transactions table
-- This stores additional data about the transaction (e.g., waiver claim details)

ALTER TABLE fantasy_transactions
ADD COLUMN IF NOT EXISTS transaction_metadata JSONB;

COMMENT ON COLUMN fantasy_transactions.transaction_metadata IS 'Additional metadata about the transaction stored as JSONB (e.g., waiver claim details, trade info)';

-- Verify the column was added
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'fantasy_transactions' 
        AND column_name = 'transaction_metadata'
    ) THEN
        RAISE NOTICE '✅ transaction_metadata column added successfully';
    END IF;
END $$;

