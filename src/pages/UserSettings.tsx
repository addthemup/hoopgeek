import { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Stack,
  Divider,
  Avatar,
  Button,
  Input,
  Textarea,
  FormControl,
  FormLabel,
  Switch,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemContent,
  ListItemDecorator,
  Select,
  Option,
  Slider,
  Alert,
  CircularProgress,
  Tabs,
  TabList,
  Tab,
  TabPanel,
} from '@mui/joy';
import {
  Person,
  Star,
  Notifications,
  Tune,
  Delete,
  Edit,
  Save,
  Cancel,
  SportsBasketball,
  Group,
  Article,
  MonetizationOn,
  DynamicFeed,
  Analytics,
  PhotoCamera,
  AccountBalanceWallet
} from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';
import { useIsAdmin } from '../hooks/useIsAdmin';
import {
  useUserProfile,
  useUpdateUserProfile,
  useFavoriteTeams,
  useNotificationPreferences,
  useUpdateNotificationPreferences,
  useFeedPreferences,
  useUpdateFeedPreferences,
  useToggleFavoriteTeam
} from '../hooks/useUserSettings';
import { usePlayerFavorites, useRemoveFromFavorites } from '../hooks/usePlayerFavorites';
import { useNavigate } from 'react-router-dom';
import BlogManager from '../components/Admin/BlogManager';
import DFSPoolManager from '../components/Admin/DFSPoolManager';
import FeedContentManager from '../components/Admin/FeedContentManager';
import InvestorDashboard from './InvestorDashboard';
import WalletTab from '../components/Wallet/WalletTab';

export default function UserSettings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: isAdmin, isLoading: adminLoading } = useIsAdmin();
  const [activeTab, setActiveTab] = useState(0);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Profile state
  const { data: userProfile, isLoading: profileLoading } = useUserProfile(user?.id);
  const updateProfile = useUpdateUserProfile();
  const [profileForm, setProfileForm] = useState({
    display_name: '',
    bio: '',
    theme: 'system' as 'light' | 'dark' | 'system'
  });

  // Favorites
  const { data: favoritePlayers, isLoading: playersLoading } = usePlayerFavorites();
  const { data: favoriteTeams, isLoading: teamsLoading } = useFavoriteTeams(user?.id);
  const removeFromFavorites = useRemoveFromFavorites();
  const toggleTeam = useToggleFavoriteTeam();

  // Notifications
  const { data: notifPrefs, isLoading: notifsLoading } = useNotificationPreferences(user?.id);
  const updateNotifications = useUpdateNotificationPreferences();

  // Feed preferences
  const { data: feedPrefs, isLoading: feedLoading } = useFeedPreferences(user?.id);
  const updateFeed = useUpdateFeedPreferences();

  // Initialize form when profile loads
  useState(() => {
    if (userProfile) {
      setProfileForm({
        display_name: userProfile.display_name || '',
        bio: userProfile.bio || '',
        theme: userProfile.theme || 'system'
      });
    }
  });

  const handleSaveProfile = async () => {
    if (!user?.id) return;

    try {
      await updateProfile.mutateAsync({
        user_id: user.id,
        display_name: profileForm.display_name,
        bio: profileForm.bio,
        theme: profileForm.theme
      });
      setIsEditingProfile(false);
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user?.id) return;

    setIsUploadingAvatar(true);
    try {
      // Import supabase client
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY
      );

      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Math.random()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update user profile with new avatar URL
      await updateProfile.mutateAsync({
        user_id: user.id,
        avatar_url: publicUrl
      });

      console.log('Avatar uploaded successfully:', publicUrl);
    } catch (error) {
      console.error('Error uploading avatar:', error);
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleRemoveFavoritePlayer = async (playerId: string) => {
    if (!user?.id) return;
    await removeFromFavorites.mutateAsync({ playerId });
  };

  const handleRemoveFavoriteTeam = async (teamId: number) => {
    if (!user?.id) return;
    await toggleTeam.mutateAsync({ userId: user.id, teamId });
  };

  const handleNotificationToggle = async (key: string, value: boolean) => {
    if (!user?.id) return;
    await updateNotifications.mutateAsync({
      user_id: user.id,
      [key]: value
    });
  };

  const handleFeedPreferenceChange = async (key: string, value: any) => {
    if (!user?.id) return;
    await updateFeed.mutateAsync({
      user_id: user.id,
      [key]: value
    });
  };

  if (!user) {
    return (
      <Box sx={{ 
        maxWidth: { xs: '100%', sm: 805, md: 1035 },
        mx: 'auto',
        pt: { xs: '77px', md: '85px' },
        px: { xs: 2, md: 2 },
        pb: 4,
      }}>
        <Card
          sx={{
            border: '3px solid #000',
            borderRadius: 0,
            boxShadow: '4px 4px 0px #000',
            p: 4,
            textAlign: 'center',
            bgcolor: '#FFC72C',
          }}
        >
          <Typography level="h3" sx={{ fontFamily: 'serif', fontWeight: 900, mb: 2, textTransform: 'uppercase' }}>
            Sign In Required
          </Typography>
          <Typography sx={{ fontFamily: 'serif', mb: 3 }}>
            Please sign in to access your settings
          </Typography>
          <Button
            onClick={() => navigate('/login')}
            sx={{
              bgcolor: '#000',
              color: '#fff',
              fontFamily: 'serif',
              fontWeight: 900,
              border: '3px solid #000',
              borderRadius: 0,
              textTransform: 'uppercase',
              '&:hover': {
                bgcolor: '#333',
                transform: 'translate(-2px, -2px)',
                boxShadow: '4px 4px 0px #000',
              }
            }}
          >
            Sign In
          </Button>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ 
      maxWidth: { xs: '100%', sm: 805, md: 1035 },
      mx: 'auto',
      pt: { xs: '57px', md: '65px' },
      px: { xs: 2, md: 2 },
      pb: 4,
    }}>
      {/* User Info Card */}
      <Card
        sx={{
          mb: 2,
          border: '3px solid #000',
          borderRadius: 0,
          boxShadow: '4px 4px 0px #000',
          overflow: 'hidden',
          bgcolor: '#fff',
        }}
      >
        <Box sx={{ bgcolor: '#000', color: '#fff', p: 2 }}>
          <Stack direction="row" spacing={2} alignItems="center">
            {/* Avatar Upload */}
            <Box sx={{ position: 'relative' }}>
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                id="avatar-upload-input"
                onChange={handleAvatarUpload}
              />
              <label htmlFor="avatar-upload-input">
                <Box
                  sx={{
                    position: 'relative',
                    cursor: 'pointer',
                    '&:hover .avatar-overlay': {
                      opacity: 1,
                    },
                  }}
                >
                  <Avatar 
                    sx={{ 
                      '--Avatar-size': '64px',
                      border: '3px solid #fff',
                      boxShadow: '0 0 0 2px #000',
                    }}
                    src={userProfile?.avatar_url || undefined}
                    alt={userProfile?.display_name || user.email}
                  >
                    {user.email?.charAt(0).toUpperCase() || '?'}
                  </Avatar>
                  {/* Hover Overlay */}
                  <Box
                    className="avatar-overlay"
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      bgcolor: 'rgba(0, 0, 0, 0.7)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '50%',
                      opacity: 0,
                      transition: 'opacity 0.2s',
                    }}
                  >
                    {isUploadingAvatar ? (
                      <CircularProgress size="sm" sx={{ color: '#fff' }} />
                    ) : (
                      <PhotoCamera sx={{ color: '#fff', fontSize: 28 }} />
                    )}
                  </Box>
                </Box>
              </label>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Typography sx={{ fontFamily: 'serif', fontWeight: 900, fontSize: '1.5rem' }}>
                  {userProfile?.display_name || user.email?.split('@')[0]}
                </Typography>
                {isAdmin && (
                  <Chip
                    size="sm"
                    sx={{
                      bgcolor: '#FFD700',
                      color: '#000',
                      fontFamily: 'serif',
                      fontWeight: 900,
                      borderRadius: 0,
                      border: '2px solid #fff',
                    }}
                  >
                    🛡️ ADMIN
                  </Chip>
                )}
              </Stack>
              <Typography sx={{ fontFamily: 'serif', fontSize: '0.85rem', color: '#fff' }}>
                {user.email}
              </Typography>
            </Box>
          </Stack>
        </Box>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value as number)}>
        <TabList
          sx={{
            bgcolor: '#fff',
            border: '3px solid #000',
            borderRadius: 0,
            boxShadow: '3px 3px 0px #000',
            mb: 3,
            '--List-padding': '0px',
            '--List-radius': '0px',
            '--ListItem-minHeight': '48px',
            overflowX: 'auto',
            flexWrap: 'nowrap',
          }}
        >
          <Tab
            value={0}
            sx={{
              fontFamily: 'serif',
              fontWeight: 900,
              fontSize: { xs: '0.85rem', md: '0.95rem' },
              textTransform: 'uppercase',
              borderRadius: 0,
              borderRight: '2px solid #000',
              gap: 1,
              '&.Mui-selected': {
                bgcolor: '#000',
                color: '#fff',
              },
              '&:hover': {
                bgcolor: '#f0f0f0',
              },
              '&.Mui-selected:hover': {
                bgcolor: '#333',
              },
            }}
          >
            <Person sx={{ fontSize: 20 }} /> Profile
          </Tab>
          <Tab
            value={1}
            sx={{
              fontFamily: 'serif',
              fontWeight: 900,
              fontSize: { xs: '0.85rem', md: '0.95rem' },
              textTransform: 'uppercase',
              borderRadius: 0,
              borderRight: '2px solid #000',
              gap: 1,
              '&.Mui-selected': {
                bgcolor: '#000',
                color: '#fff',
              },
              '&:hover': {
                bgcolor: '#f0f0f0',
              },
              '&.Mui-selected:hover': {
                bgcolor: '#333',
              },
            }}
          >
            <Star sx={{ fontSize: 20 }} /> Favorites
          </Tab>
          <Tab
            value={2}
            sx={{
              fontFamily: 'serif',
              fontWeight: 900,
              fontSize: { xs: '0.85rem', md: '0.95rem' },
              textTransform: 'uppercase',
              borderRadius: 0,
              borderRight: '2px solid #000',
              gap: 1,
              '&.Mui-selected': {
                bgcolor: '#000',
                color: '#fff',
              },
              '&:hover': {
                bgcolor: '#f0f0f0',
              },
              '&.Mui-selected:hover': {
                bgcolor: '#333',
              },
            }}
          >
            <Notifications sx={{ fontSize: 20 }} /> Notifs
          </Tab>
          <Tab
            value={3}
            sx={{
              fontFamily: 'serif',
              fontWeight: 900,
              fontSize: { xs: '0.85rem', md: '0.95rem' },
              textTransform: 'uppercase',
              borderRadius: 0,
              borderRight: '2px solid #000',
              gap: 1,
              '&.Mui-selected': {
                bgcolor: '#000',
                color: '#fff',
              },
              '&:hover': {
                bgcolor: '#f0f0f0',
              },
              '&.Mui-selected:hover': {
                bgcolor: '#333',
              },
            }}
          >
            <Tune sx={{ fontSize: 20 }} /> Feed
          </Tab>
          <Tab
            value={4}
            sx={{
              fontFamily: 'serif',
              fontWeight: 900,
              fontSize: { xs: '0.85rem', md: '0.95rem' },
              textTransform: 'uppercase',
              borderRadius: 0,
              borderRight: isAdmin ? '2px solid #000' : 'none',
              gap: 1,
              '&.Mui-selected': {
                bgcolor: '#000',
                color: '#fff',
              },
              '&:hover': {
                bgcolor: '#f0f0f0',
              },
              '&.Mui-selected:hover': {
                bgcolor: '#333',
              },
            }}
          >
            <AccountBalanceWallet sx={{ fontSize: 20 }} /> Wallet
          </Tab>
          {isAdmin && (
            <>
              <Tab
                value={5}
                sx={{
                  fontFamily: 'serif',
                  fontWeight: 900,
                  fontSize: { xs: '0.85rem', md: '0.95rem' },
                  textTransform: 'uppercase',
                  borderRadius: 0,
                  borderRight: '2px solid #000',
                  gap: 1,
                  bgcolor: '#FFC72C',
                  '&.Mui-selected': {
                    bgcolor: '#000',
                    color: '#fff',
                  },
                  '&:hover': {
                    bgcolor: '#FFD700',
                  },
                  '&.Mui-selected:hover': {
                    bgcolor: '#333',
                  },
                }}
              >
                <DynamicFeed sx={{ fontSize: 20 }} /> Content
              </Tab>
              <Tab
                value={6}
                sx={{
                  fontFamily: 'serif',
                  fontWeight: 900,
                  fontSize: { xs: '0.85rem', md: '0.95rem' },
                  textTransform: 'uppercase',
                  borderRadius: 0,
                  borderRight: '2px solid #000',
                  gap: 1,
                  bgcolor: '#FFC72C',
                  '&.Mui-selected': {
                    bgcolor: '#000',
                    color: '#fff',
                  },
                  '&:hover': {
                    bgcolor: '#FFD700',
                  },
                  '&.Mui-selected:hover': {
                    bgcolor: '#333',
                  },
                }}
              >
                <Article sx={{ fontSize: 20 }} /> Blog
              </Tab>
              <Tab
                value={7}
                sx={{
                  fontFamily: 'serif',
                  fontWeight: 900,
                  fontSize: { xs: '0.85rem', md: '0.95rem' },
                  textTransform: 'uppercase',
                  borderRadius: 0,
                  borderRight: '2px solid #000',
                  gap: 1,
                  bgcolor: '#FFC72C',
                  '&.Mui-selected': {
                    bgcolor: '#000',
                    color: '#fff',
                  },
                  '&:hover': {
                    bgcolor: '#FFD700',
                  },
                  '&.Mui-selected:hover': {
                    bgcolor: '#333',
                  },
                }}
              >
                <MonetizationOn sx={{ fontSize: 20 }} /> DFS
              </Tab>
              <Tab
                value={8}
                sx={{
                  fontFamily: 'serif',
                  fontWeight: 900,
                  fontSize: { xs: '0.85rem', md: '0.95rem' },
                  textTransform: 'uppercase',
                  borderRadius: 0,
                  gap: 1,
                  bgcolor: '#16A34A',
                  color: '#fff',
                  '&.Mui-selected': {
                    bgcolor: '#000',
                    color: '#fff',
                  },
                  '&:hover': {
                    bgcolor: '#15803d',
                  },
                  '&.Mui-selected:hover': {
                    bgcolor: '#333',
                  },
                }}
              >
                <Analytics sx={{ fontSize: 20 }} /> Analytics
              </Tab>
            </>
          )}
        </TabList>

        {/* Profile Tab */}
        <TabPanel value={0} sx={{ p: 0 }}>
          <Stack spacing={3}>
            {/* Profile Information */}
            <Card
              sx={{
                border: '3px solid #000',
                borderRadius: 0,
                boxShadow: '4px 4px 0px #000',
                overflow: 'hidden',
                bgcolor: '#fff',
              }}
            >
              <Box sx={{ bgcolor: '#000', color: '#fff', px: 2, py: 1.5 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography sx={{ 
                    fontFamily: 'serif',
                    fontWeight: 900,
                    fontSize: '1rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>
                    ✏️ Profile Information
                  </Typography>
                  {!isEditingProfile ? (
                    <Button
                      size="sm"
                      startDecorator={<Edit />}
                      onClick={() => setIsEditingProfile(true)}
                      sx={{
                        bgcolor: '#fff',
                        color: '#000',
                        fontFamily: 'serif',
                        fontWeight: 'bold',
                        borderRadius: 0,
                        '&:hover': {
                          bgcolor: '#f0f0f0',
                        }
                      }}
                    >
                      Edit
                    </Button>
                  ) : (
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="sm"
                        startDecorator={<Cancel />}
                        onClick={() => setIsEditingProfile(false)}
                        sx={{
                          bgcolor: '#666',
                          color: '#fff',
                          fontFamily: 'serif',
                          fontWeight: 'bold',
                          borderRadius: 0,
                          '&:hover': {
                            bgcolor: '#555',
                          }
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        startDecorator={<Save />}
                        onClick={handleSaveProfile}
                        loading={updateProfile.isPending}
                        sx={{
                          bgcolor: '#16A34A',
                          color: '#fff',
                          fontFamily: 'serif',
                          fontWeight: 'bold',
                          borderRadius: 0,
                          '&:hover': {
                            bgcolor: '#15803d',
                          }
                        }}
                      >
                        Save
                      </Button>
                    </Stack>
                  )}
                </Stack>
              </Box>

              <Box sx={{ p: 2.5 }}>
                <Stack spacing={2.5}>
                  <FormControl>
                    <FormLabel sx={{ fontFamily: 'serif', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.85rem' }}>
                      Display Name
                    </FormLabel>
                    <Input
                      value={profileForm.display_name}
                      onChange={(e) => setProfileForm({ ...profileForm, display_name: e.target.value })}
                      disabled={!isEditingProfile}
                      placeholder="Enter your display name"
                      sx={{
                        fontFamily: 'serif',
                        border: '2px solid #000',
                        borderRadius: 0,
                        '&:focus-within': {
                          borderColor: '#000',
                          outline: '2px solid #000',
                        }
                      }}
                    />
                  </FormControl>

                  <FormControl>
                    <FormLabel sx={{ fontFamily: 'serif', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.85rem' }}>
                      Email
                    </FormLabel>
                    <Input
                      value={user.email || ''}
                      disabled
                      sx={{
                        fontFamily: 'serif',
                        border: '2px solid #000',
                        borderRadius: 0,
                        bgcolor: '#f0f0f0',
                      }}
                    />
                    <Typography level="body-xs" sx={{ mt: 0.5, fontFamily: 'serif', fontWeight: 'bold', color: '#000' }}>
                      Email cannot be changed
                    </Typography>
                  </FormControl>

                  <FormControl>
                    <FormLabel sx={{ fontFamily: 'serif', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.85rem' }}>
                      Bio
                    </FormLabel>
                    <Textarea
                      value={profileForm.bio}
                      onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                      disabled={!isEditingProfile}
                      placeholder="Tell us about yourself..."
                      minRows={3}
                      sx={{
                        fontFamily: 'serif',
                        border: '2px solid #000',
                        borderRadius: 0,
                        '&:focus-within': {
                          borderColor: '#000',
                          outline: '2px solid #000',
                        }
                      }}
                    />
                  </FormControl>

                  <FormControl>
                    <FormLabel sx={{ fontFamily: 'serif', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.85rem' }}>
                      Theme
                    </FormLabel>
                    <Select
                      value={profileForm.theme}
                      onChange={(_, value) => setProfileForm({ ...profileForm, theme: value as any })}
                      disabled={!isEditingProfile}
                      sx={{
                        fontFamily: 'serif',
                        border: '2px solid #000',
                        borderRadius: 0,
                      }}
                    >
                      <Option value="light">Light</Option>
                      <Option value="dark">Dark</Option>
                      <Option value="system">System</Option>
                    </Select>
                  </FormControl>
                </Stack>
              </Box>
            </Card>
          </Stack>
        </TabPanel>

        {/* Favorites Tab */}
        <TabPanel value={1} sx={{ p: 0 }}>
          <Stack spacing={3}>
            {/* Favorite Players */}
            <Card
              sx={{
                border: '3px solid #000',
                borderRadius: 0,
                boxShadow: '4px 4px 0px #000',
                overflow: 'hidden',
                bgcolor: '#fff',
              }}
            >
              <Box sx={{ bgcolor: '#000', color: '#fff', px: 2, py: 1.5 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography sx={{ 
                    fontFamily: 'serif',
                    fontWeight: 900,
                    fontSize: '1rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>
                    🏀 Favorite Players ({favoritePlayers?.length || 0})
                  </Typography>
                  <Button
                    size="sm"
                    onClick={() => navigate('/players')}
                    sx={{
                      bgcolor: '#fff',
                      color: '#000',
                      fontFamily: 'serif',
                      fontWeight: 'bold',
                      borderRadius: 0,
                      '&:hover': {
                        bgcolor: '#f0f0f0',
                      }
                    }}
                  >
                    Browse
                  </Button>
                </Stack>
              </Box>

              <Box sx={{ p: 2.5 }}>
                {playersLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                  </Box>
                ) : favoritePlayers && favoritePlayers.length > 0 ? (
                  <List sx={{ '--List-padding': '0px', '--List-gap': '0px' }}>
                    {favoritePlayers.map((favorite) => (
                      <ListItem key={favorite.id} sx={{ p: 0, borderBottom: '2px solid #000', '&:last-child': { borderBottom: 'none' } }}>
                        <ListItemButton
                          onClick={() => navigate(`/player/${favorite.player_id}`)}
                          sx={{
                            fontFamily: 'serif',
                            p: 1.5,
                            '&:hover': {
                              bgcolor: '#f0f0f0',
                            }
                          }}
                        >
                          <ListItemDecorator>
                            <Avatar
                              src={`https://cdn.nba.com/headshots/nba/latest/260x190/${favorite.nba_players.nba_player_id}.png`}
                              size="sm"
                              alt={favorite.nba_players.name}
                              sx={{
                                border: '2px solid #000',
                              }}
                            >
                              {favorite.nba_players.name.charAt(0).toUpperCase()}
                            </Avatar>
                          </ListItemDecorator>
                          <ListItemContent>
                            <Typography level="title-sm" sx={{ fontFamily: 'serif', fontWeight: 'bold' }}>
                              {favorite.nba_players.name}
                            </Typography>
                            <Typography level="body-xs" sx={{ fontFamily: 'serif' }}>
                              {favorite.nba_players.position || 'N/A'} • {favorite.nba_players.team_name || 'Free Agent'}
                            </Typography>
                          </ListItemContent>
                          <IconButton
                            color="danger"
                            variant="solid"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveFavoritePlayer(favorite.player_id);
                            }}
                            sx={{
                              borderRadius: 0,
                              bgcolor: '#ef4444',
                              '&:hover': {
                                bgcolor: '#dc2626',
                              }
                            }}
                          >
                            <Delete />
                          </IconButton>
                        </ListItemButton>
                      </ListItem>
                    ))}
                  </List>
                ) : (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography sx={{ fontFamily: 'serif', fontWeight: 'bold', color: '#000' }}>
                      No favorite players yet. Browse the player database to add some!
                    </Typography>
                  </Box>
                )}
              </Box>
            </Card>

            {/* Favorite Teams */}
            <Card
              sx={{
                border: '3px solid #000',
                borderRadius: 0,
                boxShadow: '4px 4px 0px #000',
                overflow: 'hidden',
                bgcolor: '#fff',
              }}
            >
              <Box sx={{ bgcolor: '#000', color: '#fff', px: 2, py: 1.5 }}>
                <Typography sx={{ 
                  fontFamily: 'serif',
                  fontWeight: 900,
                  fontSize: '1rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  🏆 Favorite Teams ({favoriteTeams?.length || 0})
                </Typography>
              </Box>

              <Box sx={{ p: 2.5 }}>
                {teamsLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                  </Box>
                ) : favoriteTeams && favoriteTeams.length > 0 ? (
                  <List sx={{ '--List-padding': '0px', '--List-gap': '0px' }}>
                    {favoriteTeams.map((team) => (
                      <ListItem key={team.id} sx={{ p: 0, borderBottom: '2px solid #000', '&:last-child': { borderBottom: 'none' } }}>
                        <ListItemButton
                          sx={{
                            fontFamily: 'serif',
                            p: 1.5,
                            '&:hover': {
                              bgcolor: '#f0f0f0',
                            }
                          }}
                        >
                          <ListItemDecorator>
                            <Box
                              component="img"
                              src={`https://a.espncdn.com/combiner/i?img=/i/teamlogos/nba/500/${team.team_abbreviation}.png&h=50&w=50`}
                              alt={team.team_abbreviation}
                              sx={{ width: 32, height: 32, border: '2px solid #000' }}
                            />
                          </ListItemDecorator>
                          <ListItemContent>
                            <Typography level="title-sm" sx={{ fontFamily: 'serif', fontWeight: 'bold' }}>
                              {team.team_name}
                            </Typography>
                            <Typography level="body-xs" sx={{ fontFamily: 'serif' }}>
                              {team.team_conference} • {team.team_division}
                            </Typography>
                          </ListItemContent>
                          <IconButton
                            color="danger"
                            variant="solid"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveFavoriteTeam(team.team_id);
                            }}
                            sx={{
                              borderRadius: 0,
                              bgcolor: '#ef4444',
                              '&:hover': {
                                bgcolor: '#dc2626',
                              }
                            }}
                          >
                            <Delete />
                          </IconButton>
                        </ListItemButton>
                      </ListItem>
                    ))}
                  </List>
                ) : (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography sx={{ fontFamily: 'serif', fontWeight: 'bold', color: '#000' }}>
                      No favorite teams yet.
                    </Typography>
                  </Box>
                )}
              </Box>
            </Card>
          </Stack>
        </TabPanel>

        {/* Notifications Tab */}
        <TabPanel value={2} sx={{ p: 0 }}>
          <Stack spacing={3}>
            {notifsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                {/* General Notifications */}
                <Card
                  sx={{
                    border: '3px solid #000',
                    borderRadius: 0,
                    boxShadow: '4px 4px 0px #000',
                    overflow: 'hidden',
                    bgcolor: '#fff',
                  }}
                >
                  <Box sx={{ bgcolor: '#000', color: '#fff', px: 2, py: 1.5 }}>
                    <Typography sx={{ 
                      fontFamily: 'serif',
                      fontWeight: 900,
                      fontSize: '1rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}>
                      🔔 General
                    </Typography>
                  </Box>
                  <Box sx={{ p: 2.5 }}>
                    <Stack spacing={2}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 2, borderBottom: '2px solid #000' }}>
                        <Box>
                          <Typography level="title-sm" sx={{ fontFamily: 'serif', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.85rem' }}>
                            Enable Notifications
                          </Typography>
                          <Typography level="body-xs" sx={{ fontFamily: 'serif', fontWeight: 'bold', color: '#000' }}>
                            Master toggle for all notifications
                          </Typography>
                        </Box>
                        <Switch
                          checked={notifPrefs?.notifications_enabled ?? true}
                          onChange={(e) => handleNotificationToggle('notifications_enabled', e.target.checked)}
                        />
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                          <Typography level="title-sm" sx={{ fontFamily: 'serif', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.85rem' }}>
                            Email Notifications
                          </Typography>
                          <Typography level="body-xs" sx={{ fontFamily: 'serif', fontWeight: 'bold', color: '#000' }}>
                            Receive notifications via email
                          </Typography>
                        </Box>
                        <Switch
                          checked={notifPrefs?.email_notifications ?? true}
                          onChange={(e) => handleNotificationToggle('email_notifications', e.target.checked)}
                        />
                      </Box>
                    </Stack>
                  </Box>
                </Card>

                {/* Content Notifications */}
                <Card
                  sx={{
                    border: '3px solid #000',
                    borderRadius: 0,
                    boxShadow: '4px 4px 0px #000',
                    overflow: 'hidden',
                    bgcolor: '#fff',
                  }}
                >
                  <Box sx={{ bgcolor: '#000', color: '#fff', px: 2, py: 1.5 }}>
                    <Typography sx={{ 
                      fontFamily: 'serif',
                      fontWeight: 900,
                      fontSize: '1rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}>
                      📺 Content
                    </Typography>
                  </Box>
                  <Box sx={{ p: 2.5 }}>
                    <Stack spacing={2}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 2, borderBottom: '2px solid #000' }}>
                        <Box>
                          <Typography level="title-sm" sx={{ fontFamily: 'serif', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.85rem' }}>
                            New Highlights
                          </Typography>
                          <Typography level="body-xs" sx={{ fontFamily: 'serif', fontWeight: 'bold', color: '#000' }}>
                            Notify when new game highlights are available
                          </Typography>
                        </Box>
                        <Switch
                          checked={notifPrefs?.new_highlights ?? true}
                          onChange={(e) => handleNotificationToggle('new_highlights', e.target.checked)}
                        />
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                          <Typography level="title-sm" sx={{ fontFamily: 'serif', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.85rem' }}>
                            Featured Games
                          </Typography>
                          <Typography level="body-xs" sx={{ fontFamily: 'serif', fontWeight: 'bold', color: '#000' }}>
                            Notify about high fun score games
                          </Typography>
                        </Box>
                        <Switch
                          checked={notifPrefs?.featured_games ?? true}
                          onChange={(e) => handleNotificationToggle('featured_games', e.target.checked)}
                        />
                      </Box>
                    </Stack>
                  </Box>
                </Card>

                {/* Fantasy League Notifications */}
                <Card
                  sx={{
                    border: '3px solid #000',
                    borderRadius: 0,
                    boxShadow: '4px 4px 0px #000',
                    overflow: 'hidden',
                    bgcolor: '#fff',
                  }}
                >
                  <Box sx={{ bgcolor: '#000', color: '#fff', px: 2, py: 1.5 }}>
                    <Typography sx={{ 
                      fontFamily: 'serif',
                      fontWeight: 900,
                      fontSize: '1rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}>
                      🏀 Fantasy Leagues
                    </Typography>
                  </Box>
                  <Box sx={{ p: 2.5 }}>
                    <Stack spacing={2}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 2, borderBottom: '2px solid #000' }}>
                        <Box>
                          <Typography level="title-sm" sx={{ fontFamily: 'serif', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.85rem' }}>
                            League Results
                          </Typography>
                          <Typography level="body-xs" sx={{ fontFamily: 'serif', fontWeight: 'bold', color: '#000' }}>
                            Matchup results and weekly recaps
                          </Typography>
                        </Box>
                        <Switch
                          checked={notifPrefs?.league_results ?? true}
                          onChange={(e) => handleNotificationToggle('league_results', e.target.checked)}
                        />
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 2, borderBottom: '2px solid #000' }}>
                        <Box>
                          <Typography level="title-sm" sx={{ fontFamily: 'serif', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.85rem' }}>
                            Trade Proposals
                          </Typography>
                          <Typography level="body-xs" sx={{ fontFamily: 'serif', fontWeight: 'bold', color: '#000' }}>
                            New trade offers and updates
                          </Typography>
                        </Box>
                        <Switch
                          checked={notifPrefs?.trade_proposals ?? true}
                          onChange={(e) => handleNotificationToggle('trade_proposals', e.target.checked)}
                        />
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                          <Typography level="title-sm" sx={{ fontFamily: 'serif', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.85rem' }}>
                            Lineup Reminders
                          </Typography>
                          <Typography level="body-xs" sx={{ fontFamily: 'serif', fontWeight: 'bold', color: '#000' }}>
                            Set your lineup before games start
                          </Typography>
                        </Box>
                        <Switch
                          checked={notifPrefs?.lineup_reminders ?? true}
                          onChange={(e) => handleNotificationToggle('lineup_reminders', e.target.checked)}
                        />
                      </Box>
                    </Stack>
                  </Box>
                </Card>

                {/* Player Notifications */}
                <Card
                  sx={{
                    border: '3px solid #000',
                    borderRadius: 0,
                    boxShadow: '4px 4px 0px #000',
                    overflow: 'hidden',
                    bgcolor: '#fff',
                  }}
                >
                  <Box sx={{ bgcolor: '#000', color: '#fff', px: 2, py: 1.5 }}>
                    <Typography sx={{ 
                      fontFamily: 'serif',
                      fontWeight: 900,
                      fontSize: '1rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}>
                      ⭐ Players
                    </Typography>
                  </Box>
                  <Box sx={{ p: 2.5 }}>
                    <Stack spacing={2}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 2, borderBottom: '2px solid #000' }}>
                        <Box>
                          <Typography level="title-sm" sx={{ fontFamily: 'serif', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.85rem' }}>
                            Injury Reports
                          </Typography>
                          <Typography level="body-xs" sx={{ fontFamily: 'serif', fontWeight: 'bold', color: '#000' }}>
                            Player injury news and updates
                          </Typography>
                        </Box>
                        <Switch
                          checked={notifPrefs?.player_injury_reports ?? true}
                          onChange={(e) => handleNotificationToggle('player_injury_reports', e.target.checked)}
                        />
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                          <Typography level="title-sm" sx={{ fontFamily: 'serif', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.85rem' }}>
                            Favorite Player Games
                          </Typography>
                          <Typography level="body-xs" sx={{ fontFamily: 'serif', fontWeight: 'bold', color: '#000' }}>
                            Notify when favorite players have games
                          </Typography>
                        </Box>
                        <Switch
                          checked={notifPrefs?.favorite_player_games ?? true}
                          onChange={(e) => handleNotificationToggle('favorite_player_games', e.target.checked)}
                        />
                      </Box>
                    </Stack>
                  </Box>
                </Card>
              </>
            )}
          </Stack>
        </TabPanel>

        {/* Feed Tab */}
        <TabPanel value={3} sx={{ p: 0 }}>
          <Stack spacing={3}>
            {feedLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                {/* Algorithm Preferences */}
                <Card
                  sx={{
                    border: '3px solid #000',
                    borderRadius: 0,
                    boxShadow: '4px 4px 0px #000',
                    overflow: 'hidden',
                    bgcolor: '#fff',
                  }}
                >
                  <Box sx={{ bgcolor: '#000', color: '#fff', px: 2, py: 1.5 }}>
                    <Typography sx={{ 
                      fontFamily: 'serif',
                      fontWeight: 900,
                      fontSize: '1rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}>
                      🎯 Feed Algorithm
                    </Typography>
                  </Box>
                  <Box sx={{ p: 2.5 }}>
                    <Stack spacing={3}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 2, borderBottom: '2px solid #000' }}>
                        <Box>
                          <Typography level="title-sm" sx={{ fontFamily: 'serif', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.85rem' }}>
                            Prioritize Favorite Teams
                          </Typography>
                          <Typography level="body-xs" sx={{ fontFamily: 'serif', fontWeight: 'bold', color: '#000' }}>
                            Show games with your favorite teams first
                          </Typography>
                        </Box>
                        <Switch
                          checked={feedPrefs?.prioritize_favorite_teams ?? true}
                          onChange={(e) => handleFeedPreferenceChange('prioritize_favorite_teams', e.target.checked)}
                        />
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 2, borderBottom: '2px solid #000' }}>
                        <Box>
                          <Typography level="title-sm" sx={{ fontFamily: 'serif', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.85rem' }}>
                            Prioritize Favorite Players
                          </Typography>
                          <Typography level="body-xs" sx={{ fontFamily: 'serif', fontWeight: 'bold', color: '#000' }}>
                            Show games with your favorite players first
                          </Typography>
                        </Box>
                        <Switch
                          checked={feedPrefs?.prioritize_favorite_players ?? true}
                          onChange={(e) => handleFeedPreferenceChange('prioritize_favorite_players', e.target.checked)}
                        />
                      </Box>
                      
                      <FormControl>
                        <FormLabel sx={{ fontFamily: 'serif', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.85rem' }}>
                          Minimum Fun Score Threshold
                        </FormLabel>
                        <Stack direction="row" spacing={2} alignItems="center">
                          <Slider
                            value={feedPrefs?.min_fun_score_threshold ?? 7.0}
                            onChange={(_, value) => handleFeedPreferenceChange('min_fun_score_threshold', value)}
                            min={0}
                            max={10}
                            step={0.5}
                            marks
                            valueLabelDisplay="on"
                            sx={{ 
                              flex: 1,
                              '& .MuiSlider-markLabel': {
                                fontFamily: 'serif',
                              }
                            }}
                          />
                          <Chip
                            size="md"
                            sx={{
                              minWidth: '60px',
                              bgcolor: '#000',
                              color: '#fff',
                              fontFamily: 'serif',
                              fontWeight: 'bold',
                              borderRadius: 0,
                            }}
                          >
                            {feedPrefs?.min_fun_score_threshold ?? 7.0}
                          </Chip>
                        </Stack>
                        <Typography level="body-xs" sx={{ fontFamily: 'serif', fontWeight: 'bold', color: '#000', mt: 0.5 }}>
                          Only show games above this fun score
                        </Typography>
                      </FormControl>

                      <FormControl>
                        <FormLabel sx={{ fontFamily: 'serif', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.85rem' }}>
                          Days Back to Show
                        </FormLabel>
                        <Stack direction="row" spacing={2} alignItems="center">
                          <Slider
                            value={feedPrefs?.days_back_to_show ?? 90}
                            onChange={(_, value) => handleFeedPreferenceChange('days_back_to_show', value)}
                            min={7}
                            max={365}
                            step={7}
                            valueLabelDisplay="on"
                            sx={{ 
                              flex: 1,
                              '& .MuiSlider-markLabel': {
                                fontFamily: 'serif',
                              }
                            }}
                          />
                          <Chip
                            size="md"
                            sx={{
                              minWidth: '80px',
                              bgcolor: '#000',
                              color: '#fff',
                              fontFamily: 'serif',
                              fontWeight: 'bold',
                              borderRadius: 0,
                            }}
                          >
                            {feedPrefs?.days_back_to_show ?? 90}d
                          </Chip>
                        </Stack>
                      </FormControl>
                    </Stack>
                  </Box>
                </Card>

                {/* Content Filters */}
                <Card
                  sx={{
                    border: '3px solid #000',
                    borderRadius: 0,
                    boxShadow: '4px 4px 0px #000',
                    overflow: 'hidden',
                    bgcolor: '#fff',
                  }}
                >
                  <Box sx={{ bgcolor: '#000', color: '#fff', px: 2, py: 1.5 }}>
                    <Typography sx={{ 
                      fontFamily: 'serif',
                      fontWeight: 900,
                      fontSize: '1rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}>
                      🎮 Content Filters
                    </Typography>
                  </Box>
                  <Box sx={{ p: 2.5 }}>
                    <Stack spacing={2}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 2, borderBottom: '2px solid #000' }}>
                        <Typography level="title-sm" sx={{ fontFamily: 'serif', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.85rem' }}>
                          Buzzer Beaters
                        </Typography>
                        <Switch
                          checked={feedPrefs?.show_buzzer_beaters ?? true}
                          onChange={(e) => handleFeedPreferenceChange('show_buzzer_beaters', e.target.checked)}
                        />
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 2, borderBottom: '2px solid #000' }}>
                        <Typography level="title-sm" sx={{ fontFamily: 'serif', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.85rem' }}>
                          Close Games
                        </Typography>
                        <Switch
                          checked={feedPrefs?.show_close_games ?? true}
                          onChange={(e) => handleFeedPreferenceChange('show_close_games', e.target.checked)}
                        />
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 2, borderBottom: '2px solid #000' }}>
                        <Typography level="title-sm" sx={{ fontFamily: 'serif', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.85rem' }}>
                          High Scoring
                        </Typography>
                        <Switch
                          checked={feedPrefs?.show_high_scoring ?? true}
                          onChange={(e) => handleFeedPreferenceChange('show_high_scoring', e.target.checked)}
                        />
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography level="title-sm" sx={{ fontFamily: 'serif', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.85rem' }}>
                          Overtime Games
                        </Typography>
                        <Switch
                          checked={feedPrefs?.show_overtime_games ?? true}
                          onChange={(e) => handleFeedPreferenceChange('show_overtime_games', e.target.checked)}
                        />
                      </Box>
                    </Stack>
                  </Box>
                </Card>

                {/* View Preferences */}
                <Card
                  sx={{
                    border: '3px solid #000',
                    borderRadius: 0,
                    boxShadow: '4px 4px 0px #000',
                    overflow: 'hidden',
                    bgcolor: '#fff',
                  }}
                >
                  <Box sx={{ bgcolor: '#000', color: '#fff', px: 2, py: 1.5 }}>
                    <Typography sx={{ 
                      fontFamily: 'serif',
                      fontWeight: 900,
                      fontSize: '1rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}>
                      👁️ View Settings
                    </Typography>
                  </Box>
                  <Box sx={{ p: 2.5 }}>
                    <Stack spacing={2.5}>
                      <FormControl>
                        <FormLabel sx={{ fontFamily: 'serif', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.85rem' }}>
                          Default Feed View
                        </FormLabel>
                        <Select
                          value={feedPrefs?.default_feed_view ?? 'grid'}
                          onChange={(_, value) => handleFeedPreferenceChange('default_feed_view', value)}
                          sx={{
                            fontFamily: 'serif',
                            border: '2px solid #000',
                            borderRadius: 0,
                          }}
                        >
                          <Option value="grid">Grid</Option>
                          <Option value="list">List</Option>
                          <Option value="compact">Compact</Option>
                        </Select>
                      </FormControl>

                      <FormControl>
                        <FormLabel sx={{ fontFamily: 'serif', fontWeight: 700, textTransform: 'uppercase', fontSize: '0.85rem' }}>
                          Games Per Page
                        </FormLabel>
                        <Select
                          value={feedPrefs?.games_per_page ?? 12}
                          onChange={(_, value) => handleFeedPreferenceChange('games_per_page', value)}
                          sx={{
                            fontFamily: 'serif',
                            border: '2px solid #000',
                            borderRadius: 0,
                          }}
                        >
                          <Option value={6}>6 games</Option>
                          <Option value={12}>12 games</Option>
                          <Option value={24}>24 games</Option>
                          <Option value={36}>36 games</Option>
                        </Select>
                      </FormControl>
                    </Stack>
                  </Box>
                </Card>
              </>
            )}
          </Stack>
        </TabPanel>

        {/* Wallet Tab */}
        <TabPanel value={4} sx={{ p: 0 }}>
          <WalletTab />
        </TabPanel>

        {/* Admin Tabs */}
        {isAdmin && (
          <>
            {/* Feed Content Management Tab */}
            <TabPanel value={5} sx={{ p: 0 }}>
              <Card
                sx={{
                  border: '3px solid #000',
                  borderRadius: 0,
                  boxShadow: '4px 4px 0px #000',
                  overflow: 'hidden',
                  bgcolor: '#fff',
                }}
              >
                <Box sx={{ bgcolor: '#FFC72C', color: '#000', px: 2, py: 1.5, borderBottom: '3px solid #000' }}>
                  <Typography sx={{ 
                    fontFamily: 'serif',
                    fontWeight: 900,
                    fontSize: '1rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>
                    🛡️ Feed Content Management
                  </Typography>
                </Box>
                <Box sx={{ p: 2.5 }}>
                  <FeedContentManager />
                </Box>
              </Card>
            </TabPanel>

            {/* Blog Management Tab */}
            <TabPanel value={6} sx={{ p: 0 }}>
              <Card
                sx={{
                  border: '3px solid #000',
                  borderRadius: 0,
                  boxShadow: '4px 4px 0px #000',
                  overflow: 'hidden',
                  bgcolor: '#fff',
                }}
              >
                <Box sx={{ bgcolor: '#FFC72C', color: '#000', px: 2, py: 1.5, borderBottom: '3px solid #000' }}>
                  <Typography sx={{ 
                    fontFamily: 'serif',
                    fontWeight: 900,
                    fontSize: '1rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>
                    📝 Blog Management
                  </Typography>
                </Box>
                <Box sx={{ p: 2.5 }}>
                  <BlogManager />
                </Box>
              </Card>
            </TabPanel>

            {/* DFS Pool Management Tab */}
            <TabPanel value={7} sx={{ p: 0 }}>
              <Card
                sx={{
                  border: '3px solid #000',
                  borderRadius: 0,
                  boxShadow: '4px 4px 0px #000',
                  overflow: 'hidden',
                  bgcolor: '#fff',
                }}
              >
                <Box sx={{ bgcolor: '#FFC72C', color: '#000', px: 2, py: 1.5, borderBottom: '3px solid #000' }}>
                  <Typography sx={{ 
                    fontFamily: 'serif',
                    fontWeight: 900,
                    fontSize: '1rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>
                    💰 DFS Pool Management
                  </Typography>
                </Box>
                <Box sx={{ p: 2.5 }}>
                  <DFSPoolManager />
                </Box>
              </Card>
            </TabPanel>

            {/* Analytics Dashboard Tab */}
            <TabPanel value={8} sx={{ p: 0 }}>
              <Card
                sx={{
                  border: '3px solid #000',
                  borderRadius: 0,
                  boxShadow: '4px 4px 0px #000',
                  overflow: 'hidden',
                  bgcolor: '#fff',
                }}
              >
                <Box sx={{ bgcolor: '#16A34A', color: '#fff', px: 2, py: 1.5, borderBottom: '3px solid #000' }}>
                  <Typography sx={{ 
                    fontFamily: 'serif',
                    fontWeight: 900,
                    fontSize: '1rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>
                    📊 Analytics Dashboard
                  </Typography>
                </Box>
                <Box sx={{ p: 2.5 }}>
                  <InvestorDashboard />
                </Box>
              </Card>
            </TabPanel>
          </>
        )}
      </Tabs>
    </Box>
  );
}
