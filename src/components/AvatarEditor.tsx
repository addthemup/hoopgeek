import { useState, useRef, useEffect } from 'react';
import {
  Box,
  Avatar,
  Button,
  Stack,
  Typography,
  CircularProgress,
  Alert,
  Modal,
  ModalDialog,
  ModalClose,
  Slider,
  IconButton,
} from '@mui/joy';
import { PhotoCamera, ZoomIn, ZoomOut, RotateRight, Crop, Save, Cancel } from '@mui/icons-material';
import { supabase } from '../utils/supabase';
import { useAuth } from '../hooks/useAuth';
import { useUpdateUserProfile } from '../hooks/useUserSettings';

interface AvatarEditorProps {
  currentAvatarUrl?: string | null;
  displayName?: string | null;
  email?: string;
  onUploadSuccess?: (url: string) => void;
  onClose?: () => void;
}

export default function AvatarEditor({
  currentAvatarUrl,
  displayName,
  email,
  onUploadSuccess,
  onClose,
}: AvatarEditorProps) {
  const { user } = useAuth();
  const updateProfile = useUpdateUserProfile();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentAvatarUrl || null);
  const [showEditor, setShowEditor] = useState(false);

  // Update preview when currentAvatarUrl changes (from parent component)
  useEffect(() => {
    if (currentAvatarUrl !== undefined) {
      // Always sync with parent, even if null (to clear preview)
      setPreviewUrl(currentAvatarUrl);
      console.log('AvatarEditor: Syncing preview URL from parent:', currentAvatarUrl);
    }
  }, [currentAvatarUrl]);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [cropSize, setCropSize] = useState(200);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Load image when file is selected
  useEffect(() => {
    if (selectedFile) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImageSrc(e.target?.result as string);
        setShowEditor(true);
        setScale(1);
        setRotation(0);
        setPosition({ x: 0, y: 0 });
      };
      reader.readAsDataURL(selectedFile);
    }
  }, [selectedFile]);

  // Draw image on canvas
  useEffect(() => {
    if (imageSrc && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const img = new Image();
      img.onload = () => {
        imageRef.current = img;
        drawImage();
      };
      img.src = imageSrc;
    }
  }, [imageSrc, scale, rotation, position, cropSize]);

  const drawImage = () => {
    if (!canvasRef.current || !imageRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = cropSize;
    canvas.height = cropSize;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Calculate center
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(scale, scale);
    
    // Draw image centered
    const img = imageRef.current;
    const drawWidth = img.width * scale;
    const drawHeight = img.height * scale;
    
    ctx.drawImage(
      img,
      -drawWidth / 2 + position.x,
      -drawHeight / 2 + position.y,
      drawWidth,
      drawHeight
    );
    
    ctx.restore();
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
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
    setSelectedFile(file);
  };

  const handleSave = async () => {
    if (!canvasRef.current || !user) return;

    setUploading(true);
    setError(null);

    try {
      // Convert canvas to blob
      canvasRef.current.toBlob(async (blob) => {
        if (!blob) {
          setError('Failed to process image');
          setUploading(false);
          return;
        }

        try {
          // Create unique filename with timestamp
          const timestamp = Date.now();
          const randomId = Math.random().toString(36).substring(2, 9);
          const fileName = `${user.id}/avatar-${timestamp}-${randomId}.png`;

          // Upload to Supabase Storage
          const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, blob, {
              cacheControl: '3600',
              upsert: false,
              contentType: 'image/png',
            });

          if (uploadError) throw uploadError;

          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(fileName);

          // Update profile with new avatar URL
          console.log('Updating profile with avatar URL:', publicUrl);
          const updateResult = await updateProfile.mutateAsync({
            user_id: user.id,
            avatar_url: publicUrl,
          });
          console.log('Profile update result:', updateResult);

          // Wait a moment for the query to refetch
          await new Promise(resolve => setTimeout(resolve, 500));

          // Update preview with cache-busting query param
          const cacheBustedUrl = `${publicUrl}?t=${Date.now()}`;
          setPreviewUrl(cacheBustedUrl);
          setShowEditor(false);
          setSelectedFile(null);
          setImageSrc(null);

          // Notify parent component
          if (onUploadSuccess) {
            onUploadSuccess(publicUrl);
          }
        } catch (err: any) {
          console.error('Error uploading avatar:', err);
          setError(err.message || 'Failed to upload avatar');
        } finally {
          setUploading(false);
        }
      }, 'image/png', 0.95);
    } catch (err: any) {
      console.error('Error processing image:', err);
      setError(err.message || 'Failed to process image');
      setUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user) return;

    setUploading(true);
    setError(null);

    try {
      await updateProfile.mutateAsync({
        user_id: user.id,
        avatar_url: null,
      });

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

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <Box>
      <Stack spacing={2} alignItems="center">
        {/* Avatar Preview */}
        <Avatar
          src={previewUrl || undefined}
          alt={displayName || email}
          sx={{
            width: 120,
            height: 120,
            border: '3px solid #000',
            boxShadow: '4px 4px 0px #000',
          }}
        >
          {!previewUrl && (displayName || email || 'U').charAt(0).toUpperCase()}
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
              bgcolor: '#6a59ff',
              color: '#fff',
              fontWeight: 600,
              '&:hover': {
                bgcolor: '#5a49ef',
              },
            }}
          >
            {uploading ? 'Uploading...' : previewUrl ? 'Change Avatar' : 'Upload Avatar'}
          </Button>

          {previewUrl && (
            <Button
              variant="outlined"
              size="sm"
              onClick={handleRemoveAvatar}
              disabled={uploading}
              sx={{
                color: '#DC2626',
                borderColor: '#DC2626',
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

        {/* Error Message */}
        {error && (
          <Alert color="danger" size="sm" sx={{ width: '100%', maxWidth: 400 }}>
            {error}
          </Alert>
        )}
      </Stack>

      {/* Avatar Editor Modal */}
      <Modal open={showEditor} onClose={() => setShowEditor(false)}>
        <ModalDialog
          sx={{
            maxWidth: 600,
            width: '100%',
            bgcolor: '#ffffff',
            p: 3,
          }}
        >
          <ModalClose />
          <Typography level="h4" sx={{ mb: 2, fontWeight: 700, color: '#000' }}>
            Edit Avatar
          </Typography>

          <Stack spacing={3}>
            {/* Canvas Preview */}
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                bgcolor: '#f5f5f5',
                borderRadius: '8px',
                p: 2,
                border: '2px solid #000',
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <canvas
                ref={canvasRef}
                style={{
                  border: '2px solid #6a59ff',
                  borderRadius: '50%',
                  cursor: isDragging ? 'grabbing' : 'grab',
                }}
              />
            </Box>

            {/* Controls */}
            <Stack spacing={2}>
              <Box>
                <Typography level="body-sm" sx={{ mb: 1, color: '#000', fontWeight: 600 }}>
                  Zoom: {Math.round(scale * 100)}%
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <IconButton
                    size="sm"
                    onClick={() => setScale(Math.max(0.5, scale - 0.1))}
                    sx={{ bgcolor: '#f5f5f5' }}
                  >
                    <ZoomOut />
                  </IconButton>
                  <Slider
                    value={scale}
                    min={0.5}
                    max={3}
                    step={0.1}
                    onChange={(_, value) => setScale(value as number)}
                    sx={{ flex: 1 }}
                  />
                  <IconButton
                    size="sm"
                    onClick={() => setScale(Math.min(3, scale + 0.1))}
                    sx={{ bgcolor: '#f5f5f5' }}
                  >
                    <ZoomIn />
                  </IconButton>
                </Stack>
              </Box>

              <Box>
                <Typography level="body-sm" sx={{ mb: 1, color: '#000', fontWeight: 600 }}>
                  Rotate: {rotation}°
                </Typography>
                <Button
                  size="sm"
                  startDecorator={<RotateRight />}
                  onClick={() => setRotation((rotation + 90) % 360)}
                  sx={{ bgcolor: '#f5f5f5', color: '#000' }}
                >
                  Rotate 90°
                </Button>
              </Box>

              <Typography level="body-xs" sx={{ color: '#666', textAlign: 'center' }}>
                Drag the image to reposition it
              </Typography>
            </Stack>

            {/* Action Buttons */}
            <Stack direction="row" spacing={2} justifyContent="flex-end">
              <Button
                variant="outlined"
                onClick={() => {
                  setShowEditor(false);
                  setSelectedFile(null);
                  setImageSrc(null);
                }}
                disabled={uploading}
              >
                Cancel
              </Button>
              <Button
                variant="solid"
                startDecorator={uploading ? <CircularProgress size="sm" /> : <Save />}
                onClick={handleSave}
                disabled={uploading}
                sx={{
                  bgcolor: '#6a59ff',
                  color: '#fff',
                  '&:hover': {
                    bgcolor: '#5a49ef',
                  },
                }}
              >
                {uploading ? 'Saving...' : 'Save Avatar'}
              </Button>
            </Stack>
          </Stack>
        </ModalDialog>
      </Modal>
    </Box>
  );
}

