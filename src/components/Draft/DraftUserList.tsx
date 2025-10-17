import React from 'react'
import { Box, Typography, Avatar, Chip, Stack } from '@mui/joy'
import { useLeagueMembers } from '../../hooks/useLeagueMembers'
import { useAuth } from '../../hooks/useAuth'
import './DraftUserList.css'

interface DraftUserListProps {
  leagueId: string
  onUserMention: (username: string) => void
}

export function DraftUserList({ leagueId, onUserMention }: DraftUserListProps) {
  const { user } = useAuth()
  const { data: members, isLoading, error } = useLeagueMembers(leagueId)

  if (isLoading) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography level="body-sm" color="neutral">
          Loading members...
        </Typography>
      </Box>
    )
  }

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography level="body-sm" color="danger">
          Error loading members
        </Typography>
      </Box>
    )
  }

  if (!members || members.length === 0) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography level="body-sm" color="neutral">
          No members found
        </Typography>
      </Box>
    )
  }

  const handleDragStart = (e: React.DragEvent, username: string) => {
    e.dataTransfer.setData('text/plain', `@${username}`)
    e.dataTransfer.effectAllowed = 'copy'
  }

  const handleClick = (username: string) => {
    onUserMention(username)
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography level="title-sm" sx={{ mb: 2, fontWeight: 'bold' }}>
        League Members
      </Typography>
      
      <Stack spacing={1}>
        {members.map((member) => {
          const isCurrentUser = member.user_id === user?.id
          const isOnline = member.is_online
          const displayName = member.team_name || 'Empty Team'
          
          return (
            <Box
              key={member.id}
              draggable
              onDragStart={(e) => handleDragStart(e, displayName)}
              onClick={() => handleClick(displayName)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                p: 1,
                borderRadius: 'sm',
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  bgcolor: 'neutral.100',
                },
                '&:active': {
                  bgcolor: 'neutral.200',
                }
              }}
            >
              <Avatar
                size="sm"
                sx={{
                  bgcolor: isOnline ? 'success.500' : 'neutral.300',
                  color: isOnline ? 'white' : 'neutral.600',
                  fontSize: '0.75rem',
                  fontWeight: 'bold'
                }}
              >
                {displayName.charAt(0).toUpperCase()}
              </Avatar>
              
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  level="body-sm"
                  sx={{
                    color: isOnline ? 'text.primary' : 'neutral.500',
                    fontWeight: isCurrentUser ? 'bold' : 'normal',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {displayName}
                </Typography>
                
                {member.is_commissioner && (
                  <Chip
                    size="sm"
                    color="primary"
                    variant="soft"
                    sx={{ mt: 0.5, fontSize: '0.65rem', height: '16px' }}
                  >
                    Commish
                  </Chip>
                )}
              </Box>
              
              {isOnline && (
                <Box
                  className="online-indicator"
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: 'success.500'
                  }}
                />
              )}
            </Box>
          )
        })}
      </Stack>
    </Box>
  )
}
