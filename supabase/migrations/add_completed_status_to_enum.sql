-- Add 'completed' status to dfs_pool_status ENUM if it doesn't exist
DO $$ 
BEGIN
    -- Check if 'completed' already exists in the enum
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'completed' 
        AND enumtypid = 'dfs_pool_status'::regtype
    ) THEN
        -- Add 'completed' to the enum
        ALTER TYPE dfs_pool_status ADD VALUE 'completed';
        RAISE NOTICE 'Added completed status to dfs_pool_status enum';
    ELSE
        RAISE NOTICE 'completed status already exists in dfs_pool_status enum';
    END IF;
END $$;

-- Verify the enum values
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = 'dfs_pool_status'::regtype
ORDER BY enumsortorder;

