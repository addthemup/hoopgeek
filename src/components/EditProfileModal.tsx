/**
 * Edit Profile Modal Component
 * MUI Joy modal for editing user profile
 */

import { useState, useEffect } from 'react';
import {
  Modal,
  ModalDialog,
  ModalClose,
  Stack,
  Typography,
  FormControl,
  FormLabel,
  Input,
  Textarea,
  Select,
  Option,
  Button,
  Avatar,
  Box,
  Divider,
} from '@mui/joy';
import { Save, Cancel } from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';
import { useUserProfile, useUpdateUserProfile } from '../hooks/useUserSettings';
import AvatarEditor from './AvatarEditor';

interface EditProfileModalProps {
  open: boolean;
  onClose: () => void;
}

export default function EditProfileModal({ open, onClose }: EditProfileModalProps) {
  const { user } = useAuth();
  const { data: userProfile, isLoading } = useUserProfile(user?.id);
  const updateProfile = useUpdateUserProfile();

  const [formData, setFormData] = useState({
    display_name: '',
    bio: '',
    theme: 'system' as 'light' | 'dark' | 'system',
  });

  // Initialize form when profile loads
  useEffect(() => {
    if (userProfile) {
      setFormData({
        display_name: userProfile.display_name || '',
        bio: userProfile.bio || '',
        theme: (userProfile.theme as 'light' | 'dark' | 'system') || 'system',
      });
    }
  }, [userProfile]);

  const handleSave = async () => {
    if (!user?.id) return;

    try {
      await updateProfile.mutateAsync({
        user_id: user.id,
        display_name: formData.display_name,
        bio: formData.bio,
        theme: formData.theme,
      });
      onClose();
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog
        sx={{
          maxWidth: 600,
          width: '90%',
          maxHeight: '90vh',
          overflow: 'auto',
        }}
      >
        <ModalClose />
        <Stack spacing={3}>
          <Typography level="h3" sx={{ fontFamily: 'serif', fontWeight: 700 }}>
            Edit Profile
          </Typography>

          {isLoading ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography>Loading...</Typography>
            </Box>
          ) : (
            <>
              {/* Avatar Section */}
              <Box>
                <FormLabel sx={{ mb: 1 }}>Profile Picture</FormLabel>
                <AvatarEditor
                  currentAvatarUrl={userProfile?.avatar_url}
                  displayName={userProfile?.display_name}
                  email={user?.email}
                  onUploadSuccess={() => {}}
                />
              </Box>

              <Divider />

              {/* Display Name */}
              <FormControl>
                <FormLabel>Display Name</FormLabel>
                <Input
                  value={formData.display_name}
                  onChange={(e) =>
                    setFormData({ ...formData, display_name: e.target.value })
                  }
                  placeholder="Enter your display name"
                />
              </FormControl>

              {/* Email (read-only) */}
              <FormControl>
                <FormLabel>Email</FormLabel>
                <Input value={user?.email || ''} disabled />
              </FormControl>

              {/* Bio */}
              <FormControl>
                <FormLabel>Bio</FormLabel>
                <Textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  placeholder="Tell us about yourself..."
                  minRows={4}
                />
              </FormControl>

              {/* Theme Preference */}
              <FormControl>
                <FormLabel>Theme Preference</FormLabel>
                <Select
                  value={formData.theme}
                  onChange={(_, value) =>
                    setFormData({ ...formData, theme: value as any })
                  }
                >
                  <Option value="light">Light</Option>
                  <Option value="dark">Dark</Option>
                  <Option value="system">System</Option>
                </Select>
              </FormControl>

              {/* Actions */}
              <Stack direction="row" spacing={2} justifyContent="flex-end">
                <Button
                  variant="outlined"
                  startDecorator={<Cancel />}
                  onClick={onClose}
                >
                  Cancel
                </Button>
                <Button
                  variant="solid"
                  color="primary"
                  startDecorator={<Save />}
                  onClick={handleSave}
                  loading={updateProfile.isPending}
                >
                  Save Changes
                </Button>
              </Stack>
            </>
          )}
        </Stack>
      </ModalDialog>
    </Modal>
  );
}

