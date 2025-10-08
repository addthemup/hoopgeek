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
  PersonRemove
} from '@mui/icons-material'
import { useAuth } from '../hooks/useAuth'
import { useTeams } from '../hooks/useTeams'
import { useAddPlayerToRoster, useRemovePlayerFromRoster, useIsPlayerOnRoster, useGetPlayerRosterInfo } from '../hooks/useRosterActions'
import { useAddToWatchlist, useRemoveFromWatchlist, useIsPlayerOnWatchlist } from '../hooks/usePlayerWatchlist'
import { useAddToFavorites, useRemoveFromFavorites, useIsPlayerFavorite } from '../hooks/usePlayerFavorites'

interface PlayerActionButtonsProps {
  playerId: number
  playerName: string
  leagueId?: string
  onTradeClick?: (playerId: number, playerName: string, teamId: string, teamName: string) => void
}

export default function PlayerActionButtons({ 
  playerId, 
  playerName, 
  leagueId,
  onTradeClick 
}: PlayerActionButtonsProps) {
  const { user } = useAuth()
  const { data: teams } = useTeams(leagueId || '')
  
  // Get user's team in this league
  const userTeam = teams?.find(team => team.user_id === user?.id)
  
  // Roster management hooks
  const { data: rosterInfo } = useIsPlayerOnRoster(userTeam?.id || '', playerId)
  const { data: playerRosterInfo } = useGetPlayerRosterInfo(playerId)
  const addToRosterMutation = useAddPlayerToRoster()
  const removeFromRosterMutation = useRemovePlayerFromRoster()
  
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
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; color: 'success' | 'error' }>({
    open: false,
    message: '',
    color: 'success'
  })

  const isOnUserRoster = rosterInfo?.isOnRoster || false
  const isOnAnotherTeam = playerRosterInfo && playerRosterInfo.fantasy_teams?.user_id !== user?.id

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
    if (!userTeam) return
    
    try {
      await removeFromRosterMutation.mutateAsync({
        fantasyTeamId: userTeam.id,
        playerId
      })
      setSnackbar({ open: true, message: `${playerName} removed from your roster!`, color: 'success' })
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to remove player from roster', color: 'error' })
    }
  }

  const handleTradeClick = () => {
    if (playerRosterInfo && onTradeClick) {
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
              <Tooltip title="Remove from your roster">
                <IconButton
                  variant="solid"
                  color="danger"
                  onClick={handleRemoveFromRoster}
                  loading={removeFromRosterMutation.isPending}
                  size="sm"
                >
                  <Remove />
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
        {isOnAnotherTeam && playerRosterInfo && (
          <Chip
            size="sm"
            variant="soft"
            color="warning"
          >
            On {playerRosterInfo.fantasy_teams.team_name}
          </Chip>
        )}

        {isOnUserRoster && (
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
