-- ============================================================================
-- USER AVATAR SUPPORT
-- ============================================================================
-- Add avatar_url column to profiles table for storing user profile images
-- Images can be stored in Supabase Storage and referenced via URL
-- ============================================================================

-- Add avatar_url column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'avatar_url'
  ) THEN
    ALTER TABLE profiles 
    ADD COLUMN avatar_url TEXT;
    
    COMMENT ON COLUMN profiles.avatar_url IS 
    'URL to user profile avatar image stored in Supabase Storage';
  END IF;
END $$;

-- ============================================================================
-- STORAGE BUCKET FOR AVATARS
-- ============================================================================
-- Create a storage bucket for user avatars if it doesn't exist
-- This allows users to upload their profile pictures

-- Insert bucket (idempotent - will skip if already exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true, -- Public bucket so avatars can be displayed
  2097152, -- 2MB file size limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STORAGE POLICIES FOR AVATARS
-- ============================================================================

-- Allow authenticated users to view all avatars
CREATE POLICY IF NOT EXISTS "Avatars are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Allow users to upload their own avatar
CREATE POLICY IF NOT EXISTS "Users can upload their own avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to update their own avatar
CREATE POLICY IF NOT EXISTS "Users can update their own avatar"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own avatar
CREATE POLICY IF NOT EXISTS "Users can delete their own avatar"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- ============================================================================
-- HELPER FUNCTION TO GET AVATAR URL
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_avatar_url(user_id UUID)
RETURNS TEXT AS $$
DECLARE
  avatar_url TEXT;
BEGIN
  SELECT p.avatar_url INTO avatar_url
  FROM profiles p
  WHERE p.id = user_id;
  
  RETURN avatar_url;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_user_avatar_url IS 
'Helper function to retrieve user avatar URL from profiles';

-- ============================================================================
-- USAGE INSTRUCTIONS
-- ============================================================================
-- 
-- To upload an avatar from your app:
-- 
-- 1. Upload file to storage:
--    const { data, error } = await supabase.storage
--      .from('avatars')
--      .upload(`${userId}/avatar.png`, file, {
--        cacheControl: '3600',
--        upsert: true
--      });
-- 
-- 2. Get public URL:
--    const { data: { publicUrl } } = supabase.storage
--      .from('avatars')
--      .getPublicUrl(`${userId}/avatar.png`);
-- 
-- 3. Update profile with avatar URL:
--    await supabase
--      .from('profiles')
--      .update({ avatar_url: publicUrl })
--      .eq('id', userId);
-- 
-- To display avatar:
--    <Avatar src={user.avatar_url} alt={user.email}>
--      {!user.avatar_url && user.email?.charAt(0).toUpperCase()}
--    </Avatar>
-- 
-- ============================================================================

-- Grant necessary permissions
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT ALL ON storage.objects TO authenticated;
GRANT ALL ON storage.buckets TO authenticated;

