import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Stack,
  Alert,
  Table,
  Avatar,
  Chip,
  IconButton,
  Modal,
  ModalDialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Divider,
  FormControl,
  FormLabel,
  Input,
  Select,
  Option,
  List,
  ListItem,
  ListItemContent,
  ListItemDecorator
} from '@mui/joy'
import {
  ArrowBack,
  Refresh,
  SwapVert,
  Shuffle,
  DragIndicator
} from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { useDraftOrder } from '../hooks/useDraftOrder'
import { useTeams } from '../hooks/useTeams'
import { useDraftSettings } from '../hooks/useDraftSettings'
import { useRegenerateDraftOrder, useUpdateDraftOrder, useSwapDraftPicks } from '../hooks/useDraftOrderManagement'

interface DraftOrderProps {
  leagueId: string
}

export default function DraftOrder({ leagueId }: DraftOrderProps) {
  const navigate = useNavigate()
  const { data: draftOrder, isLoading, error, refetch } = useDraftOrder(leagueId)
  const { data: teams } = useTeams(leagueId)
  const { data: draftSettings } = useDraftSettings(leagueId)
  const regenerateOrderMutation = useRegenerateDraftOrder()
  const updateOrderMutation = useUpdateDraftOrder()
  const swapPicksMutation = useSwapDraftPicks()
  
  const [showRegenerateModal, setShowRegenerateModal] = useState(false)
  const [showSwapModal, setShowSwapModal] = useState(false)
  const [selectedPicks, setSelectedPicks] = useState<{ pick1?: any; pick2?: any }>({})
  const [newRounds, setNewRounds] = useState(15)
  const [firstRoundOrder, setFirstRoundOrder] = useState<any[]>([])
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; color: 'success' | 'error' }>({
    open: false,
    message: '',
    color: 'success'
  })

  // Extract first round order from draft order
  useEffect(() => {
    if (draftOrder && teams) {
      const firstRound = draftOrder
        .filter(pick => pick.round === 1)
        .sort((a, b) => a.pick_number - b.pick_number)
        .map(pick => {
          const team = teams.find((_, index) => index === pick.team_position - 1)
          return {
            ...pick,
            team: team
          }
        })
      setFirstRoundOrder(firstRound)
    }
  }, [draftOrder, teams])

  // Generate snake draft preview
  const generateSnakePreview = (firstRound: any[], rounds: number) => {
    if (!firstRound.length || !rounds) return []
    
    const preview = []
    const teamCount = firstRound.length
    
    for (let round = 1; round <= Math.min(rounds, 3); round++) { // Show first 3 rounds as preview
      const roundPicks = []
      const isReverseRound = round % 2 === 0
      
      for (let i = 0; i < teamCount; i++) {
        const teamIndex = isReverseRound ? teamCount - 1 - i : i
        const pickNumber = (round - 1) * teamCount + i + 1
        const team = firstRound[teamIndex]?.team
        
        roundPicks.push({
          pickNumber,
          round,
          team,
          teamPosition: teamIndex + 1
        })
      }
      preview.push(roundPicks)
    }
    
    return preview
  }

  const handleRegenerateOrder = async () => {
    try {
      await regenerateOrderMutation.mutateAsync({
        leagueId,
        totalRounds: newRounds
      })
      setShowRegenerateModal(false)
      setSnackbar({ open: true, message: 'Draft order regenerated successfully!', color: 'success' })
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to regenerate draft order', color: 'error' })
    }
  }

  const handleSwapPicks = async () => {
    if (!selectedPicks.pick1 || !selectedPicks.pick2) return
    
    try {
      // For snake draft, we need to swap the team positions in the first round
      // This will automatically affect all subsequent rounds
      const newOrder = [...firstRoundOrder]
      const index1 = newOrder.findIndex(pick => pick.id === selectedPicks.pick1.id)
      const index2 = newOrder.findIndex(pick => pick.id === selectedPicks.pick2.id)
      
      if (index1 !== -1 && index2 !== -1) {
        // Swap the team positions
        const temp = newOrder[index1].team_position
        newOrder[index1].team_position = newOrder[index2].team_position
        newOrder[index2].team_position = temp
        
        // Update the draft order in the database
        await updateOrderMutation.mutateAsync({
          leagueId,
          picks: newOrder.map((pick, index) => ({
            round: 1,
            pick_number: index + 1,
            team_position: pick.team_position
          }))
        })
      }
      
      setShowSwapModal(false)
      setSelectedPicks({})
      setSnackbar({ open: true, message: 'Draft order updated successfully!', color: 'success' })
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to update draft order', color: 'error' })
    }
  }

  const openSwapModal = (pick: any) => {
    if (selectedPicks.pick1 && selectedPicks.pick1.id === pick.id) {
      setSelectedPicks({})
    } else if (selectedPicks.pick1) {
      setSelectedPicks({ pick1: selectedPicks.pick1, pick2: pick })
      setShowSwapModal(true)
    } else {
      setSelectedPicks({ pick1: pick })
    }
  }

  const getTeamForPosition = (teamPosition: number) => {
    return teams?.find((_, index) => index === teamPosition - 1)
  }

  const isSelected = (pick: any) => {
    return selectedPicks.pick1?.id === pick.id || selectedPicks.pick2?.id === pick.id
  }

  const isSnakeDraft = draftSettings?.draft_type === 'snake'
  const snakePreview = generateSnakePreview(firstRoundOrder, draftSettings?.draft_rounds || 15)

  if (isLoading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Loading draft order...</Typography>
      </Box>
    )
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert color="danger">
          <Typography>Error loading draft order: {error.message}</Typography>
        </Alert>
      </Box>
    )
  }

  const teamCount = teams?.length || 0
  const totalPicks = (draftSettings?.draft_rounds || 15) * teamCount

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Button 
            variant="outlined" 
            startDecorator={<ArrowBack />} 
            onClick={() => navigate(-1)} 
            size="sm" 
            sx={{ mr: 2 }}
          >
            Back
          </Button>
          <Typography level="h2" component="h1" sx={{ fontWeight: 'bold' }}>
            Draft Order
          </Typography>
        </Box>
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            color="primary"
            startDecorator={<Refresh />}
            onClick={() => refetch()}
          >
            Refresh
          </Button>
          <Button
            variant="solid"
            color="primary"
            startDecorator={<Shuffle />}
            onClick={() => setShowRegenerateModal(true)}
            loading={regenerateOrderMutation.isPending}
          >
            Regenerate Order
          </Button>
        </Stack>
      </Box>

      {/* Draft Summary */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography level="title-lg" sx={{ mb: 2 }}>
            Draft Summary
          </Typography>
          <Stack direction="row" spacing={3}>
            <Box>
              <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
                Draft Type
              </Typography>
              <Typography level="title-md" sx={{ fontWeight: 'bold' }}>
                {draftSettings?.draft_type || 'Snake'} Draft
              </Typography>
            </Box>
            <Box>
              <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
                Total Teams
              </Typography>
              <Typography level="title-md" sx={{ fontWeight: 'bold' }}>
                {teamCount}
              </Typography>
            </Box>
            <Box>
              <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
                Draft Rounds
              </Typography>
              <Typography level="title-md" sx={{ fontWeight: 'bold' }}>
                {draftSettings?.draft_rounds || 15}
              </Typography>
            </Box>
            <Box>
              <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
                Total Picks
              </Typography>
              <Typography level="title-md" sx={{ fontWeight: 'bold' }}>
                {totalPicks}
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {/* First Round Order */}
      <Card variant="outlined" sx={{ mb: 3 }}>
        <CardContent>
          <Typography level="title-lg" sx={{ mb: 2 }}>
            First Round Order {isSnakeDraft && '(Snake Draft)'}
          </Typography>
          {isSnakeDraft ? (
            <Alert color="primary" sx={{ mb: 2 }}>
              <Typography level="body-sm">
                For snake drafts, you only need to set the first round order. 
                Subsequent rounds will automatically snake (reverse order for even rounds).
              </Typography>
            </Alert>
          ) : null}
          
          {firstRoundOrder.length > 0 ? (
            <List>
              {firstRoundOrder.map((pick, index) => (
                <ListItem
                  key={pick.id}
                  sx={{
                    backgroundColor: isSelected(pick) ? 'var(--joy-palette-primary-50)' : 'transparent',
                    cursor: 'pointer',
                    borderRadius: 'sm',
                    '&:hover': {
                      backgroundColor: 'var(--joy-palette-neutral-50)'
                    }
                  }}
                  onClick={() => openSwapModal(pick)}
                >
                  <ListItemDecorator>
                    <Box sx={{ 
                      width: 32, 
                      height: 32, 
                      borderRadius: '50%', 
                      backgroundColor: 'primary.500', 
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold'
                    }}>
                      {index + 1}
                    </Box>
                  </ListItemDecorator>
                  <ListItemContent>
                    <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%' }}>
                      <Avatar size="sm">
                        {pick.team?.team_name.split(' ').map(n => n[0]).join('') || 'T'}
                      </Avatar>
                      <Box sx={{ flex: 1 }}>
                        <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                          {pick.team?.team_name || `Team ${pick.team_position}`}
                        </Typography>
                        <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                          {pick.team?.user_id ? 'Has Owner' : 'Available'}
                        </Typography>
                      </Box>
                      <IconButton
                        size="sm"
                        variant="outlined"
                        color="primary"
                        onClick={(e) => {
                          e.stopPropagation()
                          openSwapModal(pick)
                        }}
                      >
                        <SwapVert />
                      </IconButton>
                    </Stack>
                  </ListItemContent>
                </ListItem>
              ))}
            </List>
          ) : (
            <Alert color="neutral">
              <Typography>No draft order found. Generate a draft order to get started.</Typography>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Snake Draft Preview */}
      {isSnakeDraft && snakePreview.length > 0 && (
        <Card variant="outlined">
          <CardContent>
            <Typography level="title-lg" sx={{ mb: 2 }}>
              Draft Preview (First 3 Rounds)
            </Typography>
            <Typography level="body-sm" sx={{ color: 'text.secondary', mb: 2 }}>
              This shows how the snake draft will work based on your first round order.
            </Typography>
            
            {snakePreview.map((round, roundIndex) => (
              <Box key={roundIndex} sx={{ mb: 3 }}>
                <Typography level="title-sm" sx={{ mb: 1, fontWeight: 'bold' }}>
                  Round {round[0].round}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                  {round.map((pick) => (
                    <Chip
                      key={pick.pickNumber}
                      size="sm"
                      variant="outlined"
                      sx={{ 
                        minWidth: 'auto',
                        '& .MuiChip-label': { 
                          px: 1.5,
                          fontSize: '0.75rem'
                        }
                      }}
                    >
                      #{pick.pickNumber} {pick.team?.team_name || `Team ${pick.teamPosition}`}
                    </Chip>
                  ))}
                </Stack>
              </Box>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Regenerate Order Modal */}
      <Modal open={showRegenerateModal} onClose={() => setShowRegenerateModal(false)}>
        <ModalDialog variant="outlined" role="alertdialog">
          <DialogTitle>Regenerate Draft Order</DialogTitle>
          <Divider />
          <DialogContent>
            <Typography sx={{ mb: 2 }}>
              This will completely regenerate the draft order for your league. Any existing picks will be lost.
            </Typography>
            <FormControl>
              <FormLabel>Number of Rounds</FormLabel>
              <Input
                type="number"
                value={newRounds}
                onChange={(e) => setNewRounds(parseInt(e.target.value) || 15)}
                min={1}
                max={20}
              />
            </FormControl>
          </DialogContent>
          <DialogActions>
            <Button
              variant="plain"
              color="neutral"
              onClick={() => setShowRegenerateModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="solid"
              color="primary"
              onClick={handleRegenerateOrder}
              loading={regenerateOrderMutation.isPending}
            >
              Regenerate Order
            </Button>
          </DialogActions>
        </ModalDialog>
      </Modal>

      {/* Swap Picks Modal */}
      <Modal open={showSwapModal} onClose={() => setShowSwapModal(false)}>
        <ModalDialog variant="outlined" role="alertdialog">
          <DialogTitle>Swap Draft Positions</DialogTitle>
          <Divider />
          <DialogContent>
            <Typography sx={{ mb: 2 }}>
              {isSnakeDraft 
                ? 'Are you sure you want to swap these two teams in the first round? This will affect the entire draft order.'
                : 'Are you sure you want to swap these two picks?'
              }
            </Typography>
            <Stack spacing={2}>
              <Box sx={{ p: 2, backgroundColor: 'neutral.50', borderRadius: 'sm' }}>
                <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                  Position #{selectedPicks.pick1?.pick_number}
                </Typography>
                <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                  {selectedPicks.pick1?.team?.team_name || `Team ${selectedPicks.pick1?.team_position}`}
                </Typography>
              </Box>
              <Box sx={{ p: 2, backgroundColor: 'neutral.50', borderRadius: 'sm' }}>
                <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                  Position #{selectedPicks.pick2?.pick_number}
                </Typography>
                <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                  {selectedPicks.pick2?.team?.team_name || `Team ${selectedPicks.pick2?.team_position}`}
                </Typography>
              </Box>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button
              variant="plain"
              color="neutral"
              onClick={() => setShowSwapModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="solid"
              color="primary"
              onClick={handleSwapPicks}
              loading={updateOrderMutation.isPending}
            >
              Swap Positions
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
    </Box>
  )
}
