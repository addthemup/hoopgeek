import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Table,
  Button,
  Stack,
  Chip,
} from '@mui/joy';
import { PlayArrow } from '@mui/icons-material';
import { getTeamLogoUrl } from '../utils/nbaTeamLogos';
import { getTeamColors } from '../utils/nbaTeamColors';
import { hexToRgba } from './MarginBars';
import LoadingAvatar from './LoadingAvatar';

interface PlayerStats {
  nba_player_id: number;
  player_id?: string;
  player_name: string;
  team_tricode: string;
  /** Current team (nba_players); used to exclude traded players from the wrong roster */
  current_team_tricode?: string;
  stats: {
    pts?: number;
    reb?: number;
    ast?: number;
    stl?: number;
    blk?: number;
    tov?: number;
    fgm?: number;
    fga?: number;
    fg_pct?: number;
    fg3m?: number;
    fg3a?: number;
    fg3_pct?: number;
    ftm?: number;
    fta?: number;
    ft_pct?: number;
    oreb?: number;
    dreb?: number;
    pf?: number;
    min?: number;
    plus_minus?: number;
  };
  position?: string;
  fantasy_points?: number;
}

interface FeedPost {
  id: string;
  post_type: 'fun_score' | 'player_spotlight';
  person_id?: number;
  title?: string;
}

interface BoxScoreProps {
  gameId: string;
  homeTeamTricode: string;
  awayTeamTricode: string;
  homeTeamScore: number;
  awayTeamScore: number;
  players: PlayerStats[];
  isGameOver: boolean;
  feedPosts?: FeedPost[];
  quarterScores?: {
    away: number[];
    home: number[];
  };
  selectedTeam?: 'away' | 'home';
}

export default function BoxScore({
  gameId,
  homeTeamTricode,
  awayTeamTricode,
  homeTeamScore,
  awayTeamScore,
  players,
  isGameOver,
  feedPosts = [],
  quarterScores,
  selectedTeam = 'away',
}: BoxScoreProps) {
  const navigate = useNavigate();
  const homeColors = getTeamColors(homeTeamTricode);
  const awayColors = getTeamColors(awayTeamTricode);

  // Separate players by team (use current_team_tricode when present so traded players don't show under old team)
  const normalizeTricode = (s: string | null | undefined) => (s ?? '').toString().trim().toUpperCase();
  const effectiveTeam = (p: PlayerStats) => p.current_team_tricode ?? p.team_tricode;
  const homePlayers = useMemo(() => {
    const filtered = players.filter(p => normalizeTricode(effectiveTeam(p)) === normalizeTricode(homeTeamTricode));
    
    // If no players found, check if all players have null team_tricode
    // In that case, split players between teams as fallback
    if (filtered.length === 0 && players.length > 0) {
      const playersWithTeams = players.filter(p => effectiveTeam(p));
      if (playersWithTeams.length === 0) {
        // All players have null team_tricode - split them
        const sorted = [...players].sort((a, b) => (b.stats?.min || 0) - (a.stats?.min || 0));
        const half = Math.ceil(sorted.length / 2);
        console.log('📊 Splitting players - home team gets first', half, 'players');
        return sorted.slice(0, half);
      }
    }
    
    return filtered.sort((a, b) => (b.stats?.min || 0) - (a.stats?.min || 0));
  }, [players, homeTeamTricode]);

  const awayPlayers = useMemo(() => {
    const filtered = players.filter(p => normalizeTricode(effectiveTeam(p)) === normalizeTricode(awayTeamTricode));
    
    // If no players found, check if all players have null team_tricode
    // In that case, split players between teams as fallback
    if (filtered.length === 0 && players.length > 0) {
      const playersWithTeams = players.filter(p => effectiveTeam(p));
      if (playersWithTeams.length === 0) {
        // All players have null team_tricode - split them
        const sorted = [...players].sort((a, b) => (b.stats?.min || 0) - (a.stats?.min || 0));
        const half = Math.ceil(sorted.length / 2);
        console.log('📊 Splitting players - away team gets last', sorted.length - half, 'players');
        return sorted.slice(half);
      }
    }
    
    return filtered.sort((a, b) => (b.stats?.min || 0) - (a.stats?.min || 0));
  }, [players, awayTeamTricode]);

  console.log('📊 BoxScore - Total players:', players.length);
  console.log('📊 BoxScore - Home players:', homePlayers.length);
  console.log('📊 BoxScore - Away players:', awayPlayers.length);
  console.log('📊 BoxScore - Home team:', homeTeamTricode, 'Away team:', awayTeamTricode);
  console.log('📊 BoxScore - Sample players:', players.slice(0, 3).map(p => ({ name: p.player_name, team: p.team_tricode })));

  // Calculate team totals
  const calculateTeamTotals = (teamPlayers: PlayerStats[]) => {
    return teamPlayers.reduce(
      (acc, player) => {
        const stats = player.stats || {};
        return {
          pts: acc.pts + (stats.pts || 0),
          reb: acc.reb + (stats.reb || 0),
          ast: acc.ast + (stats.ast || 0),
          stl: acc.stl + (stats.stl || 0),
          blk: acc.blk + (stats.blk || 0),
          tov: acc.tov + (stats.tov || 0),
          fgm: acc.fgm + (stats.fgm || 0),
          fga: acc.fga + (stats.fga || 0),
          fg3m: acc.fg3m + (stats.fg3m || 0),
          fg3a: acc.fg3a + (stats.fg3a || 0),
          ftm: acc.ftm + (stats.ftm || 0),
          fta: acc.fta + (stats.fta || 0),
          oreb: acc.oreb + (stats.oreb || 0),
          dreb: acc.dreb + (stats.dreb || 0),
          pf: acc.pf + (stats.pf || 0),
          min: acc.min + (stats.min || 0),
          fantasy_points: acc.fantasy_points + (player.fantasy_points || 0),
        };
      },
      {
        pts: 0,
        reb: 0,
        ast: 0,
        stl: 0,
        blk: 0,
        tov: 0,
        fgm: 0,
        fga: 0,
        fg3m: 0,
        fg3a: 0,
        ftm: 0,
        fta: 0,
        oreb: 0,
        dreb: 0,
        pf: 0,
        min: 0,
        fantasy_points: 0,
      }
    );
  };

  const homeTotals = useMemo(() => calculateTeamTotals(homePlayers), [homePlayers]);
  const awayTotals = useMemo(() => calculateTeamTotals(awayPlayers), [awayPlayers]);

  // Find feed posts
  const funScorePost = useMemo(
    () => feedPosts.find(p => p.post_type === 'fun_score'),
    [feedPosts]
  );

  const playerSpotlightPosts = useMemo(() => {
    const map = new Map<number, FeedPost>();
    feedPosts
      .filter(p => p.post_type === 'player_spotlight' && p.person_id)
      .forEach(p => {
        if (p.person_id) {
          map.set(p.person_id, p);
        }
      });
    return map;
  }, [feedPosts]);

  const handleWatchHighlights = (postId: string) => {
    navigate(`/?postId=${postId}`);
  };

  const handlePlayerHighlight = (nbaPlayerId: number) => {
    const post = playerSpotlightPosts.get(nbaPlayerId);
    if (post) {
      handleWatchHighlights(post.id);
    }
  };

  const formatMinutes = (min?: number) => {
    if (!min) return '0';
    const rounded = Math.round(min);
    return rounded.toString();
  };

  const formatPercentage = (made: number, attempted: number) => {
    if (attempted === 0) return '-';
    return `${((made / attempted) * 100).toFixed(1)}%`;
  };

  const renderPlayerRow = (player: PlayerStats, isHome: boolean) => {
    const stats = player.stats || {};
    const hasHighlight = isGameOver && playerSpotlightPosts.has(player.nba_player_id);
    const teamColors = isHome ? homeColors : awayColors;

    // Format position abbreviation
    const formatPositionAbbreviation = (position?: string): string => {
      if (!position) return '';
      const pos = position.toLowerCase();
      if (pos.includes('guard')) return 'G';
      if (pos.includes('forward')) return 'F';
      if (pos.includes('center')) return 'C';
      // Handle combined positions like "Forward-Center"
      if (pos.includes('-')) {
        return pos.split('-').map(p => {
          if (p.includes('guard')) return 'G';
          if (p.includes('forward')) return 'F';
          if (p.includes('center')) return 'C';
          return p.charAt(0).toUpperCase();
        }).join('-');
      }
      return position;
    };

    return (
      <tr
        key={player.nba_player_id}
        onClick={() => {
          if (player.player_id) {
            navigate(`/player/${player.player_id}`);
          }
        }}
        style={{
          cursor: player.player_id ? 'pointer' : 'default',
          borderBottom: '1px solid #333333',
        }}
        onMouseEnter={(e) => {
          if (player.player_id) {
            e.currentTarget.style.backgroundColor = 'rgba(255, 199, 44, 0.1)';
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <td style={{ minWidth: '180px', width: '180px', maxWidth: '180px' }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, alignItems: 'center' }}>
              {player.position && (
                <Typography sx={{ color: '#CCCCCC', fontSize: '0.65rem', lineHeight: 1.2 }}>
                  {formatPositionAbbreviation(player.position)}
                </Typography>
              )}
              <Typography sx={{ 
                color: '#FFFFFF', 
                fontSize: '0.75rem',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                lineHeight: 1.2,
                mt: player.position ? 0.25 : 0,
                textAlign: 'center',
              }}>
                {player.player_name}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {hasHighlight && (
                <Button
                  size="sm"
                  variant="soft"
                  color="primary"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePlayerHighlight(player.nba_player_id);
                  }}
                  sx={{
                    minWidth: 'auto',
                    width: '20px',
                    height: '20px',
                    padding: 0,
                    bgcolor: '#FFC72C',
                    '&:hover': { bgcolor: '#FFD700' },
                  }}
                >
                  <PlayArrow sx={{ fontSize: '12px' }} />
                </Button>
              )}
              <LoadingAvatar
                nbaPlayerId={player.nba_player_id}
                playerName={player.player_name}
                size={24}
                teamColors={teamColors}
              />
            </Box>
          </Box>
        </td>
        <td style={{ textAlign: 'right', color: '#FFFFFF', fontSize: '0.75rem', padding: '8px 12px' }}>
          {formatMinutes(stats.min)}
        </td>
        <td style={{ textAlign: 'right', color: '#FFFFFF', fontSize: '0.75rem', padding: '8px 12px' }}>
          {stats.pts || 0}
        </td>
        <td style={{ textAlign: 'center', color: '#FFFFFF', fontSize: '0.75rem', padding: '8px 12px' }}>
          {stats.fgm || 0}-{stats.fga || 0}
        </td>
        <td style={{ textAlign: 'center', color: '#FFFFFF', fontSize: '0.75rem', padding: '8px 12px' }}>
          {stats.fg3m || 0}-{stats.fg3a || 0}
        </td>
        <td style={{ textAlign: 'center', color: '#FFFFFF', fontSize: '0.75rem', padding: '8px 12px' }}>
          {stats.ftm || 0}-{stats.fta || 0}
        </td>
        <td style={{ textAlign: 'right', color: '#FFFFFF', fontSize: '0.75rem', padding: '8px 12px' }}>
          {stats.oreb || 0}
        </td>
        <td style={{ textAlign: 'right', color: '#FFFFFF', fontSize: '0.75rem', padding: '8px 12px' }}>
          {stats.dreb || 0}
        </td>
        <td style={{ textAlign: 'right', color: '#FFFFFF', fontSize: '0.75rem', padding: '8px 12px' }}>
          {stats.tov || 0}
        </td>
        <td style={{ textAlign: 'right', color: '#FFFFFF', fontSize: '0.75rem', padding: '8px 12px' }}>
          {stats.ast || 0}
        </td>
        <td style={{ textAlign: 'right', color: '#FFFFFF', fontSize: '0.75rem', padding: '8px 12px' }}>
          {stats.blk || 0}
        </td>
        <td style={{ textAlign: 'right', color: '#FFFFFF', fontSize: '0.75rem', padding: '8px 12px' }}>
          {stats.stl || 0}
        </td>
        <td style={{ textAlign: 'right', color: '#FFFFFF', fontSize: '0.75rem', padding: '8px 12px' }}>
          {stats.pf || 0}
        </td>
      </tr>
    );
  };

  return (
    <Box sx={{ bgcolor: '#000000', color: '#FFFFFF' }}>
      {/* Quarter Scores Table */}
      {quarterScores && (
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'center' }}>
          <Table
            sx={{
              '& th, & td': {
                color: '#FFFFFF',
                borderColor: 'rgba(255, 255, 255, 0.1)',
                padding: '8px 10px',
                textAlign: 'center',
              },
              bgcolor: '#1a1a1a',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <thead>
              <tr style={{ bgcolor: '#333333' }}>
                <th style={{ textAlign: 'left', paddingLeft: '10px' }}></th>
                <th>1</th>
                <th>2</th>
                <th>3</th>
                <th>4</th>
                <th>T</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ textAlign: 'left', paddingLeft: '10px', fontWeight: 'bold' }}>
                  {awayTeamTricode}
                </td>
                {quarterScores.away.map((score, idx) => (
                  <td key={idx}>{score}</td>
                ))}
                <td style={{ fontWeight: 'bold', bgcolor: '#333333' }}>{awayTeamScore}</td>
              </tr>
              <tr>
                <td style={{ textAlign: 'left', paddingLeft: '10px', fontWeight: 'bold' }}>
                  {homeTeamTricode}
                </td>
                {quarterScores.home.map((score, idx) => (
                  <td key={idx}>{score}</td>
                ))}
                <td style={{ fontWeight: 'bold', bgcolor: '#333333' }}>{homeTeamScore}</td>
              </tr>
            </tbody>
          </Table>
        </Box>
      )}

      {/* Selected Team Box Score */}
      {(() => {
        const isHome = selectedTeam === 'home';
        const teamTricode = isHome ? homeTeamTricode : awayTeamTricode;
        const teamPlayers = isHome ? homePlayers : awayPlayers;
        const teamTotals = isHome ? homeTotals : awayTotals;
        const teamColors = isHome ? homeColors : awayColors;
        const teamScore = isHome ? homeTeamScore : awayTeamScore;

        return (
          <Box sx={{ mb: 4 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                mb: 2,
                fontWeight: 'bold',
              }}
            >
              <Box
                component="img"
                src={getTeamLogoUrl(teamTricode)}
                alt={teamTricode}
                sx={{ width: 20, height: 20 }}
              />
              <Typography level="h4" sx={{ color: '#FFFFFF', fontWeight: 'bold' }}>
                {teamTricode}
              </Typography>
              {teamScore !== null && (
                <Typography level="h4" sx={{ color: '#FFC72C', fontWeight: 'bold', ml: 'auto' }}>
                  {teamScore}
                </Typography>
              )}
            </Box>

            <Box sx={{ overflowX: 'auto', width: '100%' }}>
              <Table sx={{ bgcolor: '#000000', width: '100%', minWidth: '800px' }}>
                <thead>
                  <tr>
                    <th style={{ color: '#FFFFFF', fontSize: '0.75rem', minWidth: '180px', width: '180px' }}>Player</th>
                    <th style={{ color: '#FFFFFF', fontSize: '0.75rem', textAlign: 'right' }}>MIN</th>
                    <th style={{ color: '#FFFFFF', fontSize: '0.75rem', textAlign: 'right' }}>PTS</th>
                    <th style={{ color: '#FFFFFF', fontSize: '0.75rem', textAlign: 'center' }}>FG</th>
                    <th style={{ color: '#FFFFFF', fontSize: '0.75rem', textAlign: 'center' }}>3PT</th>
                    <th style={{ color: '#FFFFFF', fontSize: '0.75rem', textAlign: 'center' }}>FT</th>
                    <th style={{ color: '#FFFFFF', fontSize: '0.75rem', textAlign: 'right' }}>OREB</th>
                    <th style={{ color: '#FFFFFF', fontSize: '0.75rem', textAlign: 'right' }}>DREB</th>
                    <th style={{ color: '#FFFFFF', fontSize: '0.75rem', textAlign: 'right' }}>TO</th>
                    <th style={{ color: '#FFFFFF', fontSize: '0.75rem', textAlign: 'right' }}>AST</th>
                    <th style={{ color: '#FFFFFF', fontSize: '0.75rem', textAlign: 'right' }}>BLK</th>
                    <th style={{ color: '#FFFFFF', fontSize: '0.75rem', textAlign: 'right' }}>STL</th>
                    <th style={{ color: '#FFFFFF', fontSize: '0.75rem', textAlign: 'right' }}>PF</th>
                  </tr>
                </thead>
                <tbody>
                  {teamPlayers.length === 0 ? (
                    <tr>
                      <td colSpan={13} style={{ textAlign: 'center', padding: '20px', color: '#888888' }}>
                        No players found
                      </td>
                    </tr>
                  ) : (
                    <>
                      {teamPlayers.map(player => renderPlayerRow(player, isHome))}
                      <tr style={{ bgcolor: hexToRgba(teamColors.primary, 0.1), fontWeight: 'bold' }}>
                        <td style={{ padding: '8px 12px', color: '#FFFFFF', fontSize: '0.75rem' }}>Game Total</td>
                        <td style={{ textAlign: 'right', padding: '8px 12px', color: '#FFFFFF', fontSize: '0.75rem' }}>
                          {formatMinutes(teamTotals.min)}
                        </td>
                        <td style={{ textAlign: 'right', padding: '8px 12px', color: '#FFFFFF', fontSize: '0.75rem' }}>{teamTotals.pts}</td>
                        <td style={{ textAlign: 'center', padding: '8px 12px', color: '#FFFFFF', fontSize: '0.75rem' }}>
                          {teamTotals.fgm}-{teamTotals.fga}
                        </td>
                        <td style={{ textAlign: 'center', padding: '8px 12px', color: '#FFFFFF', fontSize: '0.75rem' }}>
                          {teamTotals.fg3m}-{teamTotals.fg3a}
                        </td>
                        <td style={{ textAlign: 'center', padding: '8px 12px', color: '#FFFFFF', fontSize: '0.75rem' }}>
                          {teamTotals.ftm}-{teamTotals.fta}
                        </td>
                        <td style={{ textAlign: 'right', padding: '8px 12px', color: '#FFFFFF', fontSize: '0.75rem' }}>{teamTotals.oreb}</td>
                        <td style={{ textAlign: 'right', padding: '8px 12px', color: '#FFFFFF', fontSize: '0.75rem' }}>{teamTotals.dreb}</td>
                        <td style={{ textAlign: 'right', padding: '8px 12px', color: '#FFFFFF', fontSize: '0.75rem' }}>{teamTotals.tov}</td>
                        <td style={{ textAlign: 'right', padding: '8px 12px', color: '#FFFFFF', fontSize: '0.75rem' }}>{teamTotals.ast}</td>
                        <td style={{ textAlign: 'right', padding: '8px 12px', color: '#FFFFFF', fontSize: '0.75rem' }}>{teamTotals.blk}</td>
                        <td style={{ textAlign: 'right', padding: '8px 12px', color: '#FFFFFF', fontSize: '0.75rem' }}>{teamTotals.stl}</td>
                        <td style={{ textAlign: 'right', padding: '8px 12px', color: '#FFFFFF', fontSize: '0.75rem' }}>{teamTotals.pf}</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </Table>
            </Box>
          </Box>
        );
      })()}
    </Box>
  );
}

