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
  Grid,
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
  TabPanel
} from '@mui/joy';
import {
  Person,
  Star,
  Notifications,
  Tune,
  Security,
  ChevronRight,
  Delete,
  Edit,
  Save,
  Cancel,
  SportsBasketball,
  Group
} from '@mui/icons-material';
import { useAuth } from '../hooks/useAuth';
import {
  useUserProfile,
  useUpdateUserProfile,
  useFavoritePlayers,
  useFavoriteTeams,
  useNotificationPreferences,
  useUpdateNotificationPreferences,
  useFeedPreferences,
  useUpdateFeedPreferences,
  useToggleFavoritePlayer,
  useToggleFavoriteTeam
} from '../hooks/useUserSettings';
import { useNavigate } from 'react-router-dom';

export default function UserSettings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  // Profile state
  const { data: userProfile, isLoading: profileLoading } = useUserProfile(user?.id);
  const updateProfile = useUpdateUserProfile();
  const [profileForm, setProfileForm] = useState({
    display_name: '',
    bio: '',
    theme: 'system' as 'light' | 'dark' | 'system'
  });

  // Favorites
  const { data: favoritePlayers, isLoading: playersLoading } = useFavoritePlayers(user?.id);
  const { data: favoriteTeams, isLoading: teamsLoading } = useFavoriteTeams(user?.id);
  const togglePlayer = useToggleFavoritePlayer();
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

  const handleRemoveFavoritePlayer = async (playerId: number) => {
    if (!user?.id) return;
    await togglePlayer.mutateAsync({ userId: user.id, playerId });
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
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Alert color="warning">
          Please sign in to access settings
        </Alert>
        <Button sx={{ mt: 2 }} onClick={() => navigate('/login')}>
          Sign In
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: { xs: 2, md: 4 } }}>
      {/* Header */}
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 4 }}>
        <Avatar sx={{ '--Avatar-size': '64px' }}>
          {userProfile?.display_name?.charAt(0) || user.email?.charAt(0)}
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Typography level="h2">
            {userProfile?.display_name || user.email}
          </Typography>
          <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
            Manage your account settings and preferences
          </Typography>
        </Box>
      </Stack>

      {/* Tabs */}
      <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value as number)}>
        <TabList>
          <Tab><Person sx={{ mr: 1 }} /> Profile</Tab>
          <Tab><Star sx={{ mr: 1 }} /> Favorites</Tab>
          <Tab><Notifications sx={{ mr: 1 }} /> Notifications</Tab>
          <Tab><Tune sx={{ mr: 1 }} /> Feed</Tab>
        </TabList>

        {/* Profile Tab */}
        <TabPanel value={0}>
          <Card variant="outlined">
            <CardContent>
              <Stack spacing={3}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography level="h4">Profile Information</Typography>
                  {!isEditingProfile ? (
                    <Button
                      size="sm"
                      variant="soft"
                      startDecorator={<Edit />}
                      onClick={() => setIsEditingProfile(true)}
                    >
                      Edit
                    </Button>
                  ) : (
                    <Stack direction="row" spacing={1}>
                      <Button
                        size="sm"
                        variant="soft"
                        color="neutral"
                        startDecorator={<Cancel />}
                        onClick={() => setIsEditingProfile(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        variant="solid"
                        startDecorator={<Save />}
                        onClick={handleSaveProfile}
                        loading={updateProfile.isPending}
                      >
                        Save
                      </Button>
                    </Stack>
                  )}
                </Box>

                <Divider />

                <FormControl>
                  <FormLabel>Display Name</FormLabel>
                  <Input
                    value={profileForm.display_name}
                    onChange={(e) => setProfileForm({ ...profileForm, display_name: e.target.value })}
                    disabled={!isEditingProfile}
                    placeholder="Enter your display name"
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Email</FormLabel>
                  <Input value={user.email || ''} disabled />
                  <Typography level="body-xs" sx={{ mt: 0.5, color: 'text.secondary' }}>
                    Email cannot be changed
                  </Typography>
                </FormControl>

                <FormControl>
                  <FormLabel>Bio</FormLabel>
                  <Textarea
                    value={profileForm.bio}
                    onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                    disabled={!isEditingProfile}
                    placeholder="Tell us about yourself..."
                    minRows={3}
                  />
                </FormControl>

                <FormControl>
                  <FormLabel>Theme</FormLabel>
                  <Select
                    value={profileForm.theme}
                    onChange={(_, value) => setProfileForm({ ...profileForm, theme: value as any })}
                    disabled={!isEditingProfile}
                  >
                    <Option value="light">Light</Option>
                    <Option value="dark">Dark</Option>
                    <Option value="system">System</Option>
                  </Select>
                </FormControl>
              </Stack>
            </CardContent>
          </Card>
        </TabPanel>

        {/* Favorites Tab */}
        <TabPanel value={1}>
          <Stack spacing={3}>
            {/* Favorite Players */}
            <Card variant="outlined">
              <CardContent>
                <Stack spacing={2}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography level="h4" startDecorator={<SportsBasketball />}>
                      Favorite Players ({favoritePlayers?.length || 0})
                    </Typography>
                    <Button
                      size="sm"
                      variant="soft"
                      onClick={() => navigate('/players')}
                    >
                      Browse Players
                    </Button>
                  </Box>

                  <Divider />

                  {playersLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                      <CircularProgress />
                    </Box>
                  ) : favoritePlayers && favoritePlayers.length > 0 ? (
                    <List>
                      {favoritePlayers.map((player) => (
                        <ListItem key={player.id}>
                          <ListItemButton onClick={() => navigate(`/players/${player.player_id}`)}>
                            <ListItemDecorator>
                              <Avatar
                                src={`https://cdn.nba.com/headshots/nba/latest/260x190/${player.nba_player_id}.png`}
                                size="sm"
                              >
                                {player.player_name.charAt(0)}
                              </Avatar>
                            </ListItemDecorator>
                            <ListItemContent>
                              <Typography level="title-sm">{player.player_name}</Typography>
                              <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                                {player.player_position} • {player.player_team}
                              </Typography>
                            </ListItemContent>
                            <IconButton
                              color="danger"
                              variant="soft"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveFavoritePlayer(player.player_id);
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
                      <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
                        No favorite players yet. Browse the player database to add some!
                      </Typography>
                    </Box>
                  )}
                </Stack>
              </CardContent>
            </Card>

            {/* Favorite Teams */}
            <Card variant="outlined">
              <CardContent>
                <Stack spacing={2}>
                  <Typography level="h4" startDecorator={<Group />}>
                    Favorite Teams ({favoriteTeams?.length || 0})
                  </Typography>

                  <Divider />

                  {teamsLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                      <CircularProgress />
                    </Box>
                  ) : favoriteTeams && favoriteTeams.length > 0 ? (
                    <List>
                      {favoriteTeams.map((team) => (
                        <ListItem key={team.id}>
                          <ListItemButton>
                            <ListItemDecorator>
                              <Box
                                component="img"
                                src={`https://a.espncdn.com/combiner/i?img=/i/teamlogos/nba/500/${team.team_abbreviation}.png&h=50&w=50`}
                                alt={team.team_abbreviation}
                                sx={{ width: 32, height: 32 }}
                              />
                            </ListItemDecorator>
                            <ListItemContent>
                              <Typography level="title-sm">{team.team_name}</Typography>
                              <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                                {team.team_conference} • {team.team_division}
                              </Typography>
                            </ListItemContent>
                            <IconButton
                              color="danger"
                              variant="soft"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveFavoriteTeam(team.team_id);
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
                      <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
                        No favorite teams yet.
                      </Typography>
                    </Box>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </TabPanel>

        {/* Notifications Tab */}
        <TabPanel value={2}>
          <Stack spacing={3}>
            {notifsLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                {/* General Notifications */}
                <Card variant="outlined">
                  <CardContent>
                    <Typography level="h4" sx={{ mb: 2 }}>General</Typography>
                    <Divider sx={{ mb: 2 }} />
                    <Stack spacing={2}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                          <Typography level="title-sm">Enable Notifications</Typography>
                          <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
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
                          <Typography level="title-sm">Email Notifications</Typography>
                          <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                            Receive notifications via email
                          </Typography>
                        </Box>
                        <Switch
                          checked={notifPrefs?.email_notifications ?? true}
                          onChange={(e) => handleNotificationToggle('email_notifications', e.target.checked)}
                        />
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>

                {/* Content Notifications */}
                <Card variant="outlined">
                  <CardContent>
                    <Typography level="h4" sx={{ mb: 2 }}>Content</Typography>
                    <Divider sx={{ mb: 2 }} />
                    <Stack spacing={2}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                          <Typography level="title-sm">New Highlights</Typography>
                          <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
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
                          <Typography level="title-sm">Featured Games</Typography>
                          <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                            Notify about high fun score games
                          </Typography>
                        </Box>
                        <Switch
                          checked={notifPrefs?.featured_games ?? true}
                          onChange={(e) => handleNotificationToggle('featured_games', e.target.checked)}
                        />
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>

                {/* Fantasy League Notifications */}
                <Card variant="outlined">
                  <CardContent>
                    <Typography level="h4" sx={{ mb: 2 }}>Fantasy Leagues</Typography>
                    <Divider sx={{ mb: 2 }} />
                    <Stack spacing={2}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                          <Typography level="title-sm">League Results</Typography>
                          <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                            Matchup results and weekly recaps
                          </Typography>
                        </Box>
                        <Switch
                          checked={notifPrefs?.league_results ?? true}
                          onChange={(e) => handleNotificationToggle('league_results', e.target.checked)}
                        />
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                          <Typography level="title-sm">Trade Proposals</Typography>
                          <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
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
                          <Typography level="title-sm">Lineup Reminders</Typography>
                          <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                            Set your lineup before games start
                          </Typography>
                        </Box>
                        <Switch
                          checked={notifPrefs?.lineup_reminders ?? true}
                          onChange={(e) => handleNotificationToggle('lineup_reminders', e.target.checked)}
                        />
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>

                {/* Player Notifications */}
                <Card variant="outlined">
                  <CardContent>
                    <Typography level="h4" sx={{ mb: 2 }}>Players</Typography>
                    <Divider sx={{ mb: 2 }} />
                    <Stack spacing={2}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                          <Typography level="title-sm">Injury Reports</Typography>
                          <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
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
                          <Typography level="title-sm">Favorite Player Games</Typography>
                          <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                            Notify when favorite players have games
                          </Typography>
                        </Box>
                        <Switch
                          checked={notifPrefs?.favorite_player_games ?? true}
                          onChange={(e) => handleNotificationToggle('favorite_player_games', e.target.checked)}
                        />
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </>
            )}
          </Stack>
        </TabPanel>

        {/* Feed Tab */}
        <TabPanel value={3}>
          <Stack spacing={3}>
            {feedLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                {/* Algorithm Preferences */}
                <Card variant="outlined">
                  <CardContent>
                    <Typography level="h4" sx={{ mb: 2 }}>Feed Algorithm</Typography>
                    <Divider sx={{ mb: 2 }} />
                    <Stack spacing={3}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                          <Typography level="title-sm">Prioritize Favorite Teams</Typography>
                          <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                            Show games with your favorite teams first
                          </Typography>
                        </Box>
                        <Switch
                          checked={feedPrefs?.prioritize_favorite_teams ?? true}
                          onChange={(e) => handleFeedPreferenceChange('prioritize_favorite_teams', e.target.checked)}
                        />
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                          <Typography level="title-sm">Prioritize Favorite Players</Typography>
                          <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                            Show games with your favorite players first
                          </Typography>
                        </Box>
                        <Switch
                          checked={feedPrefs?.prioritize_favorite_players ?? true}
                          onChange={(e) => handleFeedPreferenceChange('prioritize_favorite_players', e.target.checked)}
                        />
                      </Box>
                      
                      <FormControl>
                        <FormLabel>Minimum Fun Score Threshold</FormLabel>
                        <Stack direction="row" spacing={2} alignItems="center">
                          <Slider
                            value={feedPrefs?.min_fun_score_threshold ?? 7.0}
                            onChange={(_, value) => handleFeedPreferenceChange('min_fun_score_threshold', value)}
                            min={0}
                            max={10}
                            step={0.5}
                            marks
                            valueLabelDisplay="on"
                            sx={{ flex: 1 }}
                          />
                          <Typography level="body-sm" sx={{ minWidth: '40px' }}>
                            {feedPrefs?.min_fun_score_threshold ?? 7.0}
                          </Typography>
                        </Stack>
                        <Typography level="body-xs" sx={{ color: 'text.secondary', mt: 0.5 }}>
                          Only show games above this fun score
                        </Typography>
                      </FormControl>

                      <FormControl>
                        <FormLabel>Days Back to Show</FormLabel>
                        <Stack direction="row" spacing={2} alignItems="center">
                          <Slider
                            value={feedPrefs?.days_back_to_show ?? 90}
                            onChange={(_, value) => handleFeedPreferenceChange('days_back_to_show', value)}
                            min={7}
                            max={365}
                            step={7}
                            valueLabelDisplay="on"
                            sx={{ flex: 1 }}
                          />
                          <Typography level="body-sm" sx={{ minWidth: '60px' }}>
                            {feedPrefs?.days_back_to_show ?? 90} days
                          </Typography>
                        </Stack>
                      </FormControl>
                    </Stack>
                  </CardContent>
                </Card>

                {/* Content Filters */}
                <Card variant="outlined">
                  <CardContent>
                    <Typography level="h4" sx={{ mb: 2 }}>Content Filters</Typography>
                    <Divider sx={{ mb: 2 }} />
                    <Stack spacing={2}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography level="title-sm">Buzzer Beaters</Typography>
                        <Switch
                          checked={feedPrefs?.show_buzzer_beaters ?? true}
                          onChange={(e) => handleFeedPreferenceChange('show_buzzer_beaters', e.target.checked)}
                        />
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography level="title-sm">Close Games</Typography>
                        <Switch
                          checked={feedPrefs?.show_close_games ?? true}
                          onChange={(e) => handleFeedPreferenceChange('show_close_games', e.target.checked)}
                        />
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography level="title-sm">High Scoring</Typography>
                        <Switch
                          checked={feedPrefs?.show_high_scoring ?? true}
                          onChange={(e) => handleFeedPreferenceChange('show_high_scoring', e.target.checked)}
                        />
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography level="title-sm">Overtime Games</Typography>
                        <Switch
                          checked={feedPrefs?.show_overtime_games ?? true}
                          onChange={(e) => handleFeedPreferenceChange('show_overtime_games', e.target.checked)}
                        />
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>

                {/* View Preferences */}
                <Card variant="outlined">
                  <CardContent>
                    <Typography level="h4" sx={{ mb: 2 }}>View Settings</Typography>
                    <Divider sx={{ mb: 2 }} />
                    <Stack spacing={2}>
                      <FormControl>
                        <FormLabel>Default Feed View</FormLabel>
                        <Select
                          value={feedPrefs?.default_feed_view ?? 'grid'}
                          onChange={(_, value) => handleFeedPreferenceChange('default_feed_view', value)}
                        >
                          <Option value="grid">Grid</Option>
                          <Option value="list">List</Option>
                          <Option value="compact">Compact</Option>
                        </Select>
                      </FormControl>

                      <FormControl>
                        <FormLabel>Games Per Page</FormLabel>
                        <Select
                          value={feedPrefs?.games_per_page ?? 12}
                          onChange={(_, value) => handleFeedPreferenceChange('games_per_page', value)}
                        >
                          <Option value={6}>6 games</Option>
                          <Option value={12}>12 games</Option>
                          <Option value={24}>24 games</Option>
                          <Option value={36}>36 games</Option>
                        </Select>
                      </FormControl>
                    </Stack>
                  </CardContent>
                </Card>
              </>
            )}
          </Stack>
        </TabPanel>
      </Tabs>
    </Box>
  );
}

