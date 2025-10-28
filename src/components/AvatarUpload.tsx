import { useState, useRef } from 'react';
import { Box, Avatar, Button, Stack, Typography, CircularProgress, Alert } from '@mui/joy';
import { PhotoCamera, Delete } from '@mui/icons-material';
import { supabase } from '../utils/supabase';
import { useAuth } from '../hooks/useAuth';

interface AvatarUploadProps {
  currentAvatarUrl?: string | null;
  displayName?: string | null;
  email?: string;
  onUploadSuccess?: (url: string) => void;
}

export default function AvatarUpload({ 
  currentAvatarUrl, 
  displayName, 
  email,
  onUploadSuccess 
}: AvatarUploadProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentAvatarUrl || null);

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      setError('Image must be less than 2MB');
      return;
    }

    setError(null);
    setUploading(true);

    try {
      // Create a unique file name
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      // Upload to Supabase Storage
      const { error: uploadError, data } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true, // Replace existing file
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      console.log('✅ Avatar uploaded:', publicUrl);

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) {
        console.error('Profile update error:', updateError);
        throw updateError;
      }

      // Update preview
      setPreviewUrl(publicUrl);
      
      // Notify parent component
      if (onUploadSuccess) {
        onUploadSuccess(publicUrl);
      }

      // Force a small delay to ensure cache is updated
      setTimeout(() => {
        setPreviewUrl(publicUrl + '?t=' + Date.now());
      }, 500);

    } catch (err: any) {
      console.error('Error uploading avatar:', err);
      setError(err.message || 'Failed to upload avatar');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user) return;

    setUploading(true);
    setError(null);

    try {
      // Update profile to remove avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setPreviewUrl(null);
      
      if (onUploadSuccess) {
        onUploadSuccess('');
      }
    } catch (err: any) {
      console.error('Error removing avatar:', err);
      setError(err.message || 'Failed to remove avatar');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box>
      <Stack spacing={2} alignItems="center">
        {/* Avatar Preview */}
        <Avatar
          src={previewUrl || undefined}
          alt={displayName || email}
          sx={{
            '--Avatar-size': '120px',
            border: '3px solid #000',
            boxShadow: '4px 4px 0px #000',
          }}
        >
          {email?.charAt(0).toUpperCase() || '?'}
        </Avatar>

        {/* Upload Buttons */}
        <Stack direction="row" spacing={1}>
          <Button
            variant="solid"
            size="sm"
            startDecorator={uploading ? <CircularProgress size="sm" /> : <PhotoCamera />}
            onClick={handleFileSelect}
            disabled={uploading}
            sx={{
              bgcolor: '#000',
              color: '#fff',
              fontFamily: 'serif',
              fontWeight: 700,
              borderRadius: 0,
              border: '2px solid #000',
              textTransform: 'uppercase',
              fontSize: '0.75rem',
              '&:hover': {
                bgcolor: '#333',
              },
            }}
          >
            {uploading ? 'Uploading...' : previewUrl ? 'Change Avatar' : 'Upload Avatar'}
          </Button>

          {previewUrl && (
            <Button
              variant="outlined"
              size="sm"
              startDecorator={<Delete />}
              onClick={handleRemoveAvatar}
              disabled={uploading}
              sx={{
                color: '#DC2626',
                borderColor: '#DC2626',
                fontFamily: 'serif',
                fontWeight: 700,
                borderRadius: 0,
                border: '2px solid #DC2626',
                textTransform: 'uppercase',
                fontSize: '0.75rem',
                '&:hover': {
                  bgcolor: '#DC2626',
                  color: '#fff',
                },
              }}
            >
              Remove
            </Button>
          )}
        </Stack>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        {/* Upload Instructions */}
        <Typography
          level="body-xs"
          sx={{
            textAlign: 'center',
            color: '#666',
            fontFamily: 'serif',
            maxWidth: 300,
          }}
        >
          Upload a profile picture (JPG, PNG, GIF, WebP)
          <br />
          Maximum size: 2MB
        </Typography>

        {/* Error Message */}
        {error && (
          <Alert color="danger" size="sm" sx={{ width: '100%' }}>
            {error}
          </Alert>
        )}
      </Stack>
    </Box>
  );
}

