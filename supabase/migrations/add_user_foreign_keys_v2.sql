-- Add foreign keys from user tables to auth.users
-- This version checks for actual column names first

-- 1. Add foreign key from user_profiles to auth.users
-- Check if the table has 'user_id' or 'id' column
DO $$ 
DECLARE
    v_column_name TEXT;
BEGIN
    -- Find the foreign key column (could be 'user_id', 'id', etc.)
    SELECT column_name INTO v_column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user_profiles'
    AND column_name IN ('user_id', 'id')
    AND data_type = 'uuid'
    LIMIT 1;
    
    IF v_column_name IS NOT NULL THEN
        -- Check if constraint already exists
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE table_name = 'user_profiles'
            AND constraint_type = 'FOREIGN KEY'
            AND constraint_name LIKE '%user%fkey'
        ) THEN
            EXECUTE format('
                ALTER TABLE user_profiles
                ADD CONSTRAINT user_profiles_%I_fkey
                FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE CASCADE
            ', v_column_name, v_column_name);
            
            EXECUTE format('CREATE INDEX IF NOT EXISTS idx_user_profiles_%I ON user_profiles(%I)', 
                v_column_name, v_column_name);
            
            RAISE NOTICE 'Added foreign key: user_profiles.% -> auth.users.id', v_column_name;
        ELSE
            RAISE NOTICE 'Foreign key for user_profiles already exists';
        END IF;
    ELSE
        RAISE NOTICE 'Could not find suitable UUID column in user_profiles for foreign key';
    END IF;
END $$;

-- 2. Add foreign key from dfs_entries.user_id to auth.users.id
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'dfs_entries_user_id_fkey' 
        AND table_name = 'dfs_entries'
    ) THEN
        ALTER TABLE dfs_entries
        ADD CONSTRAINT dfs_entries_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
        
        CREATE INDEX IF NOT EXISTS idx_dfs_entries_user_id ON dfs_entries(user_id);
        
        RAISE NOTICE 'Added foreign key: dfs_entries.user_id -> auth.users.id';
    ELSE
        RAISE NOTICE 'Foreign key dfs_entries_user_id_fkey already exists';
    END IF;
END $$;

-- 3-7. Add foreign keys for other user-related tables (skip views)
DO $$ 
DECLARE
    v_table_name TEXT;
    v_constraint_name TEXT;
    v_table_type TEXT;
BEGIN
    FOR v_table_name IN 
        SELECT unnest(ARRAY['dfs_user_balances', 'dfs_user_statistics', 'admin_users'])
    LOOP
        -- Check if it's a table (not a view)
        SELECT table_type INTO v_table_type
        FROM information_schema.tables 
        WHERE table_schema = 'public'
        AND table_name = v_table_name;
        
        IF v_table_type = 'BASE TABLE' THEN
            v_constraint_name := v_table_name || '_user_id_fkey';
            
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints 
                WHERE constraint_name = v_constraint_name 
                AND table_name = v_table_name
            ) THEN
                EXECUTE format('
                    ALTER TABLE %I
                    ADD CONSTRAINT %I
                    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
                ', v_table_name, v_constraint_name);
                
                EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_user_id ON %I(user_id)', 
                    v_table_name, v_table_name);
                
                RAISE NOTICE 'Added foreign key: %.user_id -> auth.users.id', v_table_name;
            END IF;
        ELSIF v_table_type = 'VIEW' THEN
            RAISE NOTICE '% is a view, skipping foreign key constraint', v_table_name;
        END IF;
    END LOOP;
END $$;

-- Show what was created
SELECT 
    tc.table_name,
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS references_table
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu 
    ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_schema = 'public'
AND ccu.table_name = 'users'
AND ccu.table_schema = 'auth'
ORDER BY tc.table_name;
