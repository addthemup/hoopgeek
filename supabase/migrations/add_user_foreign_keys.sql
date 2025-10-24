-- Add foreign keys from user_profiles and dfs_entries to auth.users

-- 1. Add foreign key from user_profiles.user_id to auth.users.id
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'user_profiles_user_id_fkey' 
        AND table_name = 'user_profiles'
    ) THEN
        ALTER TABLE user_profiles
        ADD CONSTRAINT user_profiles_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
        
        RAISE NOTICE 'Added foreign key: user_profiles.user_id -> auth.users.id';
    ELSE
        RAISE NOTICE 'Foreign key user_profiles_user_id_fkey already exists';
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
        
        RAISE NOTICE 'Added foreign key: dfs_entries.user_id -> auth.users.id';
    ELSE
        RAISE NOTICE 'Foreign key dfs_entries_user_id_fkey already exists';
    END IF;
END $$;

-- 3. Create index on user_profiles.user_id if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);

-- 4. Create index on dfs_entries.user_id if it doesn't exist  
CREATE INDEX IF NOT EXISTS idx_dfs_entries_user_id ON dfs_entries(user_id);

COMMENT ON CONSTRAINT user_profiles_user_id_fkey ON user_profiles IS 
'Ensures user profiles are linked to valid auth users and cascade deletes';

COMMENT ON CONSTRAINT dfs_entries_user_id_fkey ON dfs_entries IS 
'Ensures DFS entries are linked to valid auth users and cascade deletes';

-- 5. Add foreign key from dfs_user_balances.user_id to auth.users.id (if table exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'dfs_user_balances') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'dfs_user_balances_user_id_fkey' 
            AND table_name = 'dfs_user_balances'
        ) THEN
            ALTER TABLE dfs_user_balances
            ADD CONSTRAINT dfs_user_balances_user_id_fkey
            FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
            
            CREATE INDEX IF NOT EXISTS idx_dfs_user_balances_user_id ON dfs_user_balances(user_id);
            
            RAISE NOTICE 'Added foreign key: dfs_user_balances.user_id -> auth.users.id';
        END IF;
    END IF;
END $$;

-- 6. Add foreign key from dfs_user_statistics.user_id to auth.users.id (if table exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'dfs_user_statistics') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'dfs_user_statistics_user_id_fkey' 
            AND table_name = 'dfs_user_statistics'
        ) THEN
            ALTER TABLE dfs_user_statistics
            ADD CONSTRAINT dfs_user_statistics_user_id_fkey
            FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
            
            CREATE INDEX IF NOT EXISTS idx_dfs_user_statistics_user_id ON dfs_user_statistics(user_id);
            
            RAISE NOTICE 'Added foreign key: dfs_user_statistics.user_id -> auth.users.id';
        END IF;
    END IF;
END $$;

-- 7. Add foreign key from admin_users.user_id to auth.users.id (if table exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_users') THEN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'admin_users_user_id_fkey' 
            AND table_name = 'admin_users'
        ) THEN
            ALTER TABLE admin_users
            ADD CONSTRAINT admin_users_user_id_fkey
            FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
            
            CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON admin_users(user_id);
            
            RAISE NOTICE 'Added foreign key: admin_users.user_id -> auth.users.id';
        END IF;
    END IF;
END $$;
