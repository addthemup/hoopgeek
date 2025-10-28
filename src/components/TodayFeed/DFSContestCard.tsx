import {
  Box,
  Typography,
  Chip,
  Button,
  IconButton,
  Avatar,
  AvatarGroup,
  Table,
  Sheet,
  LinearProgress,
  Tooltip,
} from '@mui/joy';
import {
  InfoOutlined,
  Share,
  EmojiEvents,
} from '@mui/icons-material';
import { useState } from 'react';
import { getTeamLogoUrl } from '../../utils/nbaTeamLogos';
import { getTeamPrimaryColor } from '../../utils/nbaTeamColors';

interface DFSContest {
  pool_id: string;
  name: string;
  description: string;
  slate_name: string;
  slate_date: string;
  lock_time: string;
  entry_fee: number;
  prize_pool: number;
  current_entries: number;
  max_entries: number;
  min_entries: number;
  max_entries_per_user: number;
  difficulty_tier: 'elite' | 'pro' | 'standard';
  salary_cap: number;
  prize_type: string;
  is_guaranteed: boolean;
  is_featured: boolean;
  status: string;
  fill_percentage: number;
  games_count: number;
  active_players_count: number;
  seconds_until_lock: number;
  games: Array<{
    game_id: string;
    home_team: string;
    away_team: string;
    game_date: string;
  }>;
}

export interface DFSContestTableProps {
  contests: DFSContest[];
  onDetailsClick?: (contest: DFSContest) => void;
  onJoinClick?: (contest: DFSContest) => void;
}

export default function DFSContestTable({ contests, onDetailsClick, onJoinClick }: DFSContestTableProps) {
  const [copiedPoolId, setCopiedPoolId] = useState<string | null>(null);

  const handleShare = (poolId: string) => {
    const shareUrl = `${window.location.origin}/dfs/join/${poolId}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopiedPoolId(poolId);
      setTimeout(() => setCopiedPoolId(null), 2000);
    });
  };

  const getDifficultyColor = (tier: string): 'danger' | 'warning' | 'success' | 'neutral' => {
    switch (tier) {
      case 'elite': return 'danger';
      case 'pro': return 'warning';
      case 'standard': return 'success';
      default: return 'neutral';
    }
  };

  const getDifficultyName = (tier: string) => {
    switch (tier) {
      case 'elite': return 'Standard';
      case 'pro': return 'Apron 1';
      case 'standard': return 'Apron 2';
      default: return tier;
    }
  };

  const formatSalaryCap = (cap: number) => {
    return `$${(cap / 1000000).toFixed(1)}M`;
  };

  const formatTimeUntilLock = (seconds: number) => {
    if (seconds <= 0) return 'Locked';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Create game avatar with split colors
  const renderGameAvatar = (game: { home_team: string; away_team: string }, size: number = 32) => (
    <Avatar
      sx={{
        '--Avatar-size': `${size}px`,
        border: '2px solid #000',
        borderRadius: '50%',
        overflow: 'hidden',
        position: 'relative',
        bgcolor: 'transparent',
      }}
    >
      {/* Split background with team colors */}
      <Box
        sx={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '50%',
          height: '100%',
          bgcolor: getTeamPrimaryColor(game.away_team),
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          right: 0,
          top: 0,
          width: '50%',
          height: '100%',
          bgcolor: getTeamPrimaryColor(game.home_team),
        }}
      />
      
      {/* Team logos */}
      <Box
        sx={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '50%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1,
        }}
      >
        <Box
          component="img"
          src={getTeamLogoUrl(game.away_team)}
          alt={game.away_team}
          sx={{
            width: size * 0.5,
            height: size * 0.5,
            objectFit: 'contain',
            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))',
          }}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
          }}
        />
      </Box>
      
      <Box
        sx={{
          position: 'absolute',
          right: 0,
          top: 0,
          width: '50%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1,
        }}
      >
        <Box
          component="img"
          src={getTeamLogoUrl(game.home_team)}
          alt={game.home_team}
          sx={{
            width: size * 0.5,
            height: size * 0.5,
            objectFit: 'contain',
            filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))',
          }}
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
          }}
        />
      </Box>

      {/* Vertical divider line */}
      <Box
        sx={{
          position: 'absolute',
          left: '50%',
          top: '10%',
          bottom: '10%',
          width: '1px',
          bgcolor: 'rgba(0, 0, 0, 0.3)',
          transform: 'translateX(-0.5px)',
          zIndex: 2,
        }}
      />
    </Avatar>
  );

  if (!contests || contests.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography sx={{ fontFamily: 'serif', color: '#000', fontWeight: 'bold' }}>
          No contests available right now
        </Typography>
      </Box>
    );
  }

  return (
    <Sheet
      variant="outlined"
      sx={{
        width: '100%',
        borderRadius: 0,
        border: '3px solid #000',
        boxShadow: '4px 4px 0px #000',
        overflow: 'auto',
        bgcolor: '#fff',
      }}
    >
      <Table
        stickyHeader
        sx={{
          '& thead th': {
            bgcolor: '#000',
            color: '#fff',
            fontFamily: 'serif',
            fontWeight: 900,
            textTransform: 'uppercase',
            borderBottom: '3px solid #000',
            fontSize: '0.75rem',
            letterSpacing: '0.05em',
            whiteSpace: 'nowrap',
          },
          '& tbody td': {
            borderBottom: '2px solid #000',
            fontFamily: 'serif',
            py: 1.5,
          },
          '& tbody tr:hover': {
            bgcolor: '#f0f0f0',
          },
          '& tbody tr:last-child td': {
            borderBottom: 'none',
          },
        }}
      >
        <thead>
          <tr>
            <th style={{ width: '120px' }}>Games</th>
            <th>Pool Name</th>
            <th style={{ width: '100px' }}>Entry</th>
            <th style={{ width: '120px' }}>Prize Pool</th>
            <th style={{ width: '130px' }}>Entries</th>
            <th style={{ width: '100px' }}>Locks In</th>
            <th style={{ width: '180px', textAlign: 'center' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {contests.map((contest) => (
            <tr key={contest.pool_id}>
              {/* Games Column */}
              <td>
                <AvatarGroup sx={{ '--Avatar-size': '32px', '--Avatar-ringSize': '2px' }}>
                  {contest.games.slice(0, 3).map((game) => (
                    <Tooltip
                      key={game.game_id}
                      title={`${game.away_team} @ ${game.home_team}`}
                      placement="top"
                    >
                      <Box>{renderGameAvatar(game, 32)}</Box>
                    </Tooltip>
                  ))}
                  {contest.games.length > 3 && (
                    <Tooltip title={`${contest.games.length - 3} more games`} placement="top">
                      <Avatar
                        sx={{
                          '--Avatar-size': '32px',
                          border: '2px solid #000',
                          bgcolor: '#000',
                          color: '#fff',
                          fontFamily: 'serif',
                          fontWeight: 900,
                          fontSize: '0.7rem',
                        }}
                      >
                        +{contest.games.length - 3}
                      </Avatar>
                    </Tooltip>
                  )}
                </AvatarGroup>
              </td>

              {/* Pool Name Column */}
              <td>
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                    <Typography
                      sx={{
                        fontFamily: 'serif',
                        fontWeight: 900,
                        fontSize: '0.95rem',
                        textTransform: 'uppercase',
                      }}
                    >
                      {contest.name}
                    </Typography>
                    {contest.is_featured && (
                      <Chip
                        size="sm"
                        sx={{
                          bgcolor: '#FFD700',
                          color: '#000',
                          fontWeight: 900,
                          borderRadius: 0,
                          border: '1px solid #000',
                          minHeight: '18px',
                          fontSize: '0.65rem',
                          px: 0.5,
                        }}
                      >
                        ⭐
                      </Chip>
                    )}
                    {contest.is_guaranteed && (
                      <Chip
                        size="sm"
                        sx={{
                          bgcolor: '#16A34A',
                          color: '#fff',
                          fontWeight: 900,
                          borderRadius: 0,
                          border: '1px solid #000',
                          minHeight: '18px',
                          fontSize: '0.65rem',
                          px: 0.5,
                        }}
                      >
                        ✓
                      </Chip>
                    )}
                  </Box>
                  <Typography
                    sx={{
                      fontFamily: 'serif',
                      fontSize: '0.75rem',
                      color: '#000',
                      fontWeight: 'bold',
                    }}
                  >
                    {contest.slate_name} • {formatSalaryCap(contest.salary_cap)}
                  </Typography>
                </Box>
              </td>

              {/* Entry Fee Column */}
              <td>
                <Typography
                  sx={{
                    fontFamily: 'serif',
                    fontWeight: 900,
                    fontSize: '1rem',
                  }}
                >
                  ${contest.entry_fee.toFixed(2)}
                </Typography>
              </td>

              {/* Prize Pool Column */}
              <td>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <EmojiEvents sx={{ fontSize: 18, color: '#FFC72C' }} />
                  <Typography
                    sx={{
                      fontFamily: 'serif',
                      fontWeight: 900,
                      fontSize: '1rem',
                      color: '#000',
                    }}
                  >
                    ${contest.prize_pool.toLocaleString()}
                  </Typography>
                </Box>
              </td>

              {/* Entries Column */}
              <td>
                <Box>
                  <Typography
                    sx={{
                      fontFamily: 'serif',
                      fontSize: '0.8rem',
                      fontWeight: 'bold',
                      mb: 0.5,
                    }}
                  >
                    {contest.current_entries}/{contest.max_entries}
                  </Typography>
                  <LinearProgress
                    determinate
                    value={contest.fill_percentage}
                    sx={{
                      height: 6,
                      borderRadius: 0,
                      border: '1px solid #000',
                      bgcolor: '#f0f0f0',
                      '& .MuiLinearProgress-bar': {
                        bgcolor:
                          contest.fill_percentage >= 80
                            ? '#16A34A'
                            : contest.fill_percentage >= 50
                            ? '#FFC72C'
                            : '#000',
                      },
                    }}
                  />
                </Box>
              </td>

              {/* Lock Time Column */}
              <td>
                <Chip
                  size="sm"
                  sx={{
                    bgcolor: contest.seconds_until_lock < 3600 ? '#ef4444' : '#000',
                    color: '#fff',
                    fontWeight: 900,
                    fontFamily: 'serif',
                    borderRadius: 0,
                    fontSize: '0.8rem',
                  }}
                >
                  {formatTimeUntilLock(contest.seconds_until_lock)}
                </Chip>
              </td>

              {/* Actions Column */}
              <td>
                <Box sx={{ display: 'flex', gap: 0.75, justifyContent: 'center' }}>
                  <Tooltip title="Share contest">
                    <IconButton
                      size="sm"
                      variant="outlined"
                      onClick={() => handleShare(contest.pool_id)}
                      sx={{
                        borderRadius: 0,
                        border: '2px solid #000',
                        bgcolor: copiedPoolId === contest.pool_id ? '#16A34A' : 'transparent',
                        color: copiedPoolId === contest.pool_id ? '#fff' : '#000',
                        minWidth: 32,
                        minHeight: 32,
                        '&:hover': {
                          bgcolor: copiedPoolId === contest.pool_id ? '#15803d' : '#f0f0f0',
                        },
                      }}
                    >
                      <Share sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>

                  <Tooltip title="View details">
                    <IconButton
                      size="sm"
                      variant="outlined"
                      onClick={() => onDetailsClick?.(contest)}
                      sx={{
                        borderRadius: 0,
                        border: '2px solid #000',
                        color: '#000',
                        minWidth: 32,
                        minHeight: 32,
                        '&:hover': {
                          bgcolor: '#f0f0f0',
                        },
                      }}
                    >
                      <InfoOutlined sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>

                  <Button
                    size="sm"
                    onClick={() => onJoinClick?.(contest)}
                    disabled={contest.seconds_until_lock <= 0}
                    sx={{
                      borderRadius: 0,
                      border: '2px solid #000',
                      bgcolor: '#000',
                      color: '#fff',
                      fontFamily: 'serif',
                      fontWeight: 900,
                      fontSize: '0.75rem',
                      px: 1.5,
                      minHeight: 32,
                      '&:hover': {
                        bgcolor: '#333',
                      },
                      '&:disabled': {
                        bgcolor: '#666',
                        color: '#999',
                      },
                    }}
                  >
                    {contest.seconds_until_lock <= 0 ? 'LOCKED' : 'JOIN'}
                  </Button>
                </Box>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Sheet>
  );
}
