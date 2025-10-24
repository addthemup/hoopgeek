-- Fix the transaction_type CHECK constraint to allow 'waiver_claim'
-- This allows us to track waiver claim transactions separately from regular adds

-- Drop the existing CHECK constraint
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT constraint_name 
        FROM information_schema.constraint_column_usage 
        WHERE table_name = 'fantasy_transactions' 
        AND column_name = 'transaction_type'
    LOOP
        EXECUTE 'ALTER TABLE fantasy_transactions DROP CONSTRAINT IF EXISTS ' || r.constraint_name || ' CASCADE';
    END LOOP;
END $$;

-- Add the updated CHECK constraint with 'waiver_claim' included
ALTER TABLE fantasy_transactions
ADD CONSTRAINT fantasy_transactions_transaction_type_check 
CHECK (transaction_type IN ('add', 'cut', 'waiver_claim'));

-- Verify the constraint was added
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage 
        WHERE table_name = 'fantasy_transactions' 
        AND column_name = 'transaction_type'
    ) THEN
        RAISE NOTICE '✅ transaction_type CHECK constraint updated successfully';
        RAISE NOTICE 'Allowed values: add, cut, waiver_claim';
    END IF;
END $$;

