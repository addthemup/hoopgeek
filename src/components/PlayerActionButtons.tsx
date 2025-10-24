import React, { useState } from 'react'
import {
  Box,
  Button,
  ButtonGroup,
  IconButton,
  Tooltip,
  Snackbar,
  Alert,
  Modal,
  ModalDialog,
  ModalClose,
  DialogTitle,
  DialogContent,
  DialogActions,
  Textarea,
  FormControl,
  FormLabel,
  Stack,
  Chip,
  Divider,
  Typography
} from '@mui/joy'
import {
  Add,
  Remove,
  Favorite,
  FavoriteBorder,
  Visibility,
  VisibilityOff,
  SwapHoriz,
  PersonAdd,
  PersonRemove,
  Warning
} from '@mui/icons-material'
import { useAuth } from '../hooks/useAuth'
import { useTeams } from '../hooks/useTeams'
import { useLeague } from '../hooks/useLeagues'
import { useAddPlayerToRoster, useRemovePlayerFromRoster, useIsPlayerOnRoster, useGetPlayerRosterInfo } from '../hooks/useRosterActions'
import { useAddToWatchlist, useRemoveFromWatchlist, useIsPlayerOnWatchlist } from '../hooks/usePlayerWatchlist'
import { useAddToFavorites, useRemoveFromFavorites, useIsPlayerFavorite } from '../hooks/usePlayerFavorites'
import { useDropPlayer } from '../hooks/useDropPlayer'
import { usePlayerWaiverStatus } from '../hooks/usePlayersOnWaivers'

interface PlayerActionButtonsProps {
  playerId: string
  playerName: string
  leagueId?: string
  onTradeClick?: (playerId: string, playerName: string, teamId: string, teamName: string) => void
}

export default function PlayerActionButtons({ 
  playerId, 
  playerName, 
  leagueId,
  onTradeClick 
}: PlayerActionButtonsProps) {
  const { user } = useAuth()
  const { data: teams } = useTeams(leagueId || '')
  const { data: league } = useLeague(leagueId || '')
  
  // Get user's team in this league
  const userTeam = teams?.find(team => team.user_id === user?.id)
  
  // Get season ID from user's team (most reliable) or from league data
  const seasonId = userTeam?.season_id || (league as any)?.season_id || (league as any)?.current_season_id
  
  // Debug logging for season ID
  console.log('🔍 PlayerActionButtons season data:', {
    userTeam,
    userTeamSeasonId: userTeam?.season_id,
    league,
    leagueSeasonId: (league as any)?.season_id,
    leagueCurrentSeasonId: (league as any)?.current_season_id,
    finalSeasonId: seasonId
  })
  
  // Roster management hooks
  const { data: rosterInfo } = useIsPlayerOnRoster(userTeam?.id || '', playerId)
  const { data: playerRosterInfo } = useGetPlayerRosterInfo(playerId)
  const addToRosterMutation = useAddPlayerToRoster()
  const removeFromRosterMutation = useRemovePlayerFromRoster()
  const dropPlayerMutation = useDropPlayer()
  
  // Waiver status hook
  const { data: waiverStatus } = usePlayerWaiverStatus(playerId, leagueId || '', seasonId || '')
  
  // Watchlist hooks
  const { data: isOnWatchlist } = useIsPlayerOnWatchlist(leagueId || '', playerId)
  const addToWatchlistMutation = useAddToWatchlist()
  const removeFromWatchlistMutation = useRemoveFromWatchlist()
  
  // Favorites hooks
  const { data: isFavorite } = useIsPlayerFavorite(playerId)
  const addToFavoritesMutation = useAddToFavorites()
  const removeFromFavoritesMutation = useRemoveFromFavorites()
  
  // State
  const [showNotesModal, setShowNotesModal] = useState(false)
  const [notesAction, setNotesAction] = useState<'watchlist' | 'favorite' | null>(null)
  const [notes, setNotes] = useState('')
  const [showDropModal, setShowDropModal] = useState(false)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; color: 'success' | 'error' }>({
    open: false,
    message: '',
    color: 'success'
  })

  const isOnUserRoster = rosterInfo?.isOnRoster || false
  const isOnAnotherTeam = playerRosterInfo && playerRosterInfo.fantasy_teams && playerRosterInfo.fantasy_teams.user_id !== user?.id

  const handleAddToRoster = async () => {
    if (!userTeam) return
    
    try {
      await addToRosterMutation.mutateAsync({
        fantasyTeamId: userTeam.id,
        playerId
      })
      setSnackbar({ open: true, message: `${playerName} added to your roster!`, color: 'success' })
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to add player to roster', color: 'error' })
    }
  }

  const handleRemoveFromRoster = async () => {
    // Open drop modal instead of directly removing
    setShowDropModal(true)
  }

  const handleConfirmDrop = async () => {
    console.log('🎯 handleConfirmDrop called!')
    console.log('📊 Drop player data:', {
      userTeam,
      leagueId,
      seasonId,
      playerId,
      playerName
    })
    
    if (!userTeam || !leagueId || !seasonId) {
      console.error('❌ Missing required data:', { userTeam, leagueId, seasonId })
      setSnackbar({ open: true, message: 'Missing required data to drop player', color: 'error' })
      return
    }
    
    try {
      console.log('🚀 Calling dropPlayerMutation...')
      const result = await dropPlayerMutation.mutateAsync({
        leagueId,
        seasonId,
        fantasyTeamId: userTeam.id,
        playerId,
        notes: `Dropped from player page by user`
      })
      console.log('✅ Drop successful:', result)
      setSnackbar({ open: true, message: `${playerName} has been dropped from your roster!`, color: 'success' })
      setShowDropModal(false)
    } catch (error) {
      console.error('❌ Error dropping player:', error)
      setSnackbar({ open: true, message: 'Failed to drop player', color: 'error' })
      setShowDropModal(false)
    }
  }

  const handleTradeClick = () => {
    if (playerRosterInfo && playerRosterInfo.fantasy_teams && onTradeClick) {
      onTradeClick(
        playerId,
        playerName,
        playerRosterInfo.fantasy_teams.id,
        playerRosterInfo.fantasy_teams.team_name
      )
    }
  }

  const handleWatchlistToggle = async () => {
    if (!leagueId) return
    
    if (isOnWatchlist) {
      try {
        await removeFromWatchlistMutation.mutateAsync({ leagueId, playerId })
        setSnackbar({ open: true, message: `${playerName} removed from watchlist!`, color: 'success' })
      } catch (error) {
        setSnackbar({ open: true, message: 'Failed to remove from watchlist', color: 'error' })
      }
    } else {
      setNotesAction('watchlist')
      setShowNotesModal(true)
    }
  }

  const handleFavoriteToggle = async () => {
    if (isFavorite) {
      try {
        await removeFromFavoritesMutation.mutateAsync({ playerId })
        setSnackbar({ open: true, message: `${playerName} removed from favorites!`, color: 'success' })
      } catch (error) {
        setSnackbar({ open: true, message: 'Failed to remove from favorites', color: 'error' })
      }
    } else {
      setNotesAction('favorite')
      setShowNotesModal(true)
    }
  }

  const handleAddWithNotes = async () => {
    try {
      if (notesAction === 'watchlist' && leagueId) {
        await addToWatchlistMutation.mutateAsync({ leagueId, playerId, notes })
        setSnackbar({ open: true, message: `${playerName} added to watchlist!`, color: 'success' })
      } else if (notesAction === 'favorite') {
        await addToFavoritesMutation.mutateAsync({ playerId, notes })
        setSnackbar({ open: true, message: `${playerName} added to favorites!`, color: 'success' })
      }
      setShowNotesModal(false)
      setNotes('')
      setNotesAction(null)
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to add player', color: 'error' })
    }
  }

  if (!user) {
    return null
  }

  return (
    <>
      <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column', alignItems: 'center' }}>
        {/* Roster Actions */}
        {leagueId && userTeam && (
          <>
            {!isOnUserRoster && !isOnAnotherTeam && (
              <Tooltip title="Add to your roster">
                <IconButton
                  variant="solid"
                  color="primary"
                  onClick={handleAddToRoster}
                  loading={addToRosterMutation.isPending}
                  size="sm"
                >
                  <Add />
                </IconButton>
              </Tooltip>
            )}

            {isOnUserRoster && (
              <Tooltip title="Drop player from roster">
                <IconButton
                  variant="solid"
                  color="danger"
                  onClick={handleRemoveFromRoster}
                  loading={dropPlayerMutation.isPending}
                  size="sm"
                >
                  <PersonRemove />
                </IconButton>
              </Tooltip>
            )}

            {isOnAnotherTeam && (
              <Tooltip title={`Trade for ${playerName}`}>
                <IconButton
                  variant="solid"
                  color="warning"
                  onClick={handleTradeClick}
                  size="sm"
                >
                  <SwapHoriz />
                </IconButton>
              </Tooltip>
            )}
          </>
        )}

        {/* Watchlist Action */}
        {leagueId && (
          <Tooltip title={isOnWatchlist ? "Remove from watchlist" : "Add to watchlist"}>
            <IconButton
              variant={isOnWatchlist ? "solid" : "outlined"}
              color={isOnWatchlist ? "primary" : "neutral"}
              onClick={handleWatchlistToggle}
              loading={addToWatchlistMutation.isPending || removeFromWatchlistMutation.isPending}
              size="sm"
            >
              {isOnWatchlist ? <Visibility /> : <VisibilityOff />}
            </IconButton>
          </Tooltip>
        )}

        {/* Favorites Action */}
        <Tooltip title={isFavorite ? "Remove from favorites" : "Add to favorites"}>
          <IconButton
            variant={isFavorite ? "solid" : "outlined"}
            color={isFavorite ? "danger" : "neutral"}
            onClick={handleFavoriteToggle}
            loading={addToFavoritesMutation.isPending || removeFromFavoritesMutation.isPending}
            size="sm"
          >
            {isFavorite ? <Favorite /> : <FavoriteBorder />}
          </IconButton>
        </Tooltip>

        {/* Player Status Indicators */}
        {waiverStatus && (
          <Chip
            size="sm"
            variant="soft"
            color={waiverStatus.waiver_status === 'free_agent' || new Date(waiverStatus.becomes_free_agent_at) <= new Date() ? 'success' : 'warning'}
            startDecorator={<Warning />}
          >
            {waiverStatus.waiver_status === 'free_agent' || new Date(waiverStatus.becomes_free_agent_at) <= new Date() ? 'Free Agent' : 'On Waivers'}
          </Chip>
        )}

        {!waiverStatus && isOnAnotherTeam && playerRosterInfo && playerRosterInfo.fantasy_teams && (
          <Chip
            size="sm"
            variant="soft"
            color="warning"
          >
            On {playerRosterInfo.fantasy_teams.team_name}
          </Chip>
        )}

        {!waiverStatus && isOnUserRoster && (
          <Chip
            size="sm"
            variant="soft"
            color="success"
          >
            On Your Roster
          </Chip>
        )}
      </Box>

      {/* Notes Modal */}
      <Modal open={showNotesModal} onClose={() => setShowNotesModal(false)}>
        <ModalDialog variant="outlined" role="alertdialog" sx={{ maxWidth: 400 }}>
          <DialogTitle>
            {notesAction === 'watchlist' ? 'Add to Watchlist' : 'Add to Favorites'}
          </DialogTitle>
          <Divider />
          <DialogContent>
            <Stack spacing={2}>
              <Typography level="body-md">
                Add {playerName} to your {notesAction === 'watchlist' ? 'watchlist' : 'favorites'}?
              </Typography>
              <FormControl>
                <FormLabel>Notes (optional)</FormLabel>
                <Textarea
                  placeholder={`Why are you adding ${playerName} to your ${notesAction}?`}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  minRows={2}
                  maxRows={4}
                />
              </FormControl>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button
              variant="plain"
              color="neutral"
              onClick={() => setShowNotesModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="solid"
              color="primary"
              onClick={handleAddWithNotes}
              loading={addToWatchlistMutation.isPending || addToFavoritesMutation.isPending}
            >
              Add {notesAction === 'watchlist' ? 'to Watchlist' : 'to Favorites'}
            </Button>
          </DialogActions>
        </ModalDialog>
      </Modal>

      {/* Drop Player Confirmation Modal */}
      <Modal open={showDropModal} onClose={() => setShowDropModal(false)}>
        <ModalDialog variant="outlined" role="alertdialog" sx={{ maxWidth: 400 }}>
          <DialogTitle sx={{ color: 'danger.500' }}>
            ⚠️ Drop Player?
          </DialogTitle>
          <Divider />
          <DialogContent>
            <Stack spacing={2}>
              <Typography level="body-md">
                Are you sure you want to drop <strong>{playerName}</strong> from your roster?
              </Typography>
              <Alert color="warning" variant="soft">
                <Typography level="body-sm">
                  {(() => {
                    const leagueData = league as any;
                    const waiverType = leagueData?.waiver_type || 'rolling';
                    const waiverPeriodHours = leagueData?.waiver_period_hours || 24;
                    
                    console.log('🕐 Waiver settings:', { waiverType, waiverPeriodHours, leagueData });
                    
                    // If no waivers, player becomes free agent immediately
                    if (waiverType === 'none') {
                      return 'This player will become a free agent immediately and can be picked up by any team.';
                    }
                    
                    // Format the time period
                    const formatWaiverPeriod = (hours: number) => {
                      if (hours < 24) {
                        return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
                      } else if (hours % 24 === 0) {
                        const days = hours / 24;
                        return `${days} ${days === 1 ? 'day' : 'days'}`;
                      } else {
                        const days = Math.floor(hours / 24);
                        const remainingHours = hours % 24;
                        return `${days} ${days === 1 ? 'day' : 'days'} and ${remainingHours} ${remainingHours === 1 ? 'hour' : 'hours'}`;
                      }
                    };
                    
                    const periodText = formatWaiverPeriod(waiverPeriodHours);
                    
                    return `This player will be placed on waivers for ${periodText}. Other teams may be able to claim them during this period.`;
                  })()}
                </Typography>
              </Alert>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button
              variant="plain"
              color="neutral"
              onClick={() => setShowDropModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="solid"
              color="danger"
              onClick={(e) => {
                console.log('🔴 Drop Player button clicked!', e);
                handleConfirmDrop();
              }}
              loading={dropPlayerMutation.isPending}
              startDecorator={<PersonRemove />}
            >
              Drop Player
            </Button>
          </DialogActions>
        </ModalDialog>
      </Modal>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        color={snackbar.color}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        autoHideDuration={3000}
      >
        {snackbar.message}
      </Snackbar>
    </>
  )
}
