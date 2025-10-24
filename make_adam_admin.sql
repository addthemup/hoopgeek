-- ============================================================================
-- MAKE ADAM CARVER AN ADMIN
-- ============================================================================
-- Run this in Supabase SQL Editor
-- ============================================================================

INSERT INTO admin_users (
  user_id,
  role,
  is_active,
  created_at
) VALUES (
  '2e74e426-f943-4e25-b48a-96821997baf8',
  'super_admin',
  TRUE,
  now()
)
ON CONFLICT (user_id) DO UPDATE
SET 
  role = 'super_admin',
  is_active = TRUE;

-- Verify it worked
SELECT 
  au.user_id,
  au.role,
  au.is_active,
  au.created_at,
  u.email
FROM admin_users au
JOIN auth.users u ON au.user_id = u.id
WHERE au.user_id = '2e74e426-f943-4e25-b48a-96821997baf8';

-- Should return:
-- user_id: 2e74e426-f943-4e25-b48a-96821997baf8
-- role: super_admin
-- is_active: true
-- email: awcarv@gmail.com (from auth.users)

