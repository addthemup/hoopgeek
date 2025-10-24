import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Modal,
  ModalDialog,
  ModalClose,
  Table,
  Stack,
} from '@mui/joy';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../utils/supabase';
import PlayerJersey from '../PlayerJersey';

interface TeamPlayer {
  player_id: string | null;
  nba_player_id: number;
  player_name: string;
  team: string;
  player_position: string; // Note: function returns player_position, not position
  jersey_number: string;
  salary: number;
  avg_fantasy_points: number;
  games_played: number;
}

interface BoxScore {
  game_date: string;
  matchup: string;
  min: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  fg: string;
  fg_pct: number;
  fg3: string;
  fg3_pct: number;
  ft: string;
  ft_pct: number;
  fantasy_points: number;
}

export default function TeamOfTheWeek() {
  const [selectedPlayer, setSelectedPlayer] = useState<TeamPlayer | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Fetch previous week info
  const { data: weekInfo } = useQuery({
    queryKey: ['previous-week-info'],
    queryFn: async () => {
      // Get current week
      const { data: currentWeek } = await supabase
        .from('nba_season_weeks')
        .select('week_number, week_name, start_date, end_date')
        .eq('season_year', 2026)
        .lte('start_date', new Date().toISOString().split('T')[0])
        .gte('end_date', new Date().toISOString().split('T')[0])
        .single();

      if (!currentWeek) return null;

      // Get previous week
      const { data: previousWeek } = await supabase
        .from('nba_season_weeks')
        .select('week_number, week_name, start_date, end_date')
        .eq('season_year', 2026)
        .eq('week_number', currentWeek.week_number - 1)
        .single();

      return previousWeek;
    },
  });

  // Fetch team of the week
  const { data: teamPlayers, isLoading, error } = useQuery<TeamPlayer[]>({
    queryKey: ['dfs-team-of-week'],
    queryFn: async () => {
      console.log('🏆 Fetching team of the week...');
      
      // Get top 5 performing players from previous week
      // Based on fantasy points average (FanDuel scoring)
      const { data, error } = await supabase.rpc('get_dfs_team_of_week');

      if (error) {
        console.error('❌ Error fetching team of week:', error);
        console.error('Error details:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        throw error;
      }

      console.log('✅ Team of week data:', data);
      return data || [];
    },
    retry: 1,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Fetch box scores for selected player
  const { data: boxScores, isLoading: boxScoresLoading } = useQuery<BoxScore[]>({
    queryKey: ['player-box-scores', selectedPlayer?.nba_player_id],
    queryFn: async () => {
      if (!selectedPlayer) return [];

      console.log('📊 Fetching box scores for:', selectedPlayer.player_name);

      // Get previous week's date range
      const { data: weekData } = await supabase
        .from('nba_season_weeks')
        .select('start_date, end_date, week_number')
        .eq('season_year', 2026)
        .lte('start_date', new Date().toISOString().split('T')[0])
        .gte('end_date', new Date().toISOString().split('T')[0])
        .single();

      if (!weekData) return [];

      // Get the previous week
      const { data: prevWeekData } = await supabase
        .from('nba_season_weeks')
        .select('start_date, end_date')
        .eq('season_year', 2026)
        .eq('week_number', weekData.week_number - 1)
        .single();

      if (!prevWeekData) return [];

      // Fetch box scores
      const { data, error } = await supabase
        .from('nba_boxscores')
        .select('*')
        .eq('nba_player_id', selectedPlayer.nba_player_id)
        .gte('game_date', prevWeekData.start_date)
        .lte('game_date', prevWeekData.end_date)
        .order('game_date', { ascending: false });

      if (error) {
        console.error('Error fetching box scores:', error);
        return [];
      }

      // Calculate fantasy points for each game
      return (data || []).map(game => ({
        game_date: game.game_date,
        matchup: game.matchup || '',
        min: game.min || 0,
        pts: game.pts || 0,
        reb: game.reb || 0,
        ast: game.ast || 0,
        stl: game.stl || 0,
        blk: game.blk || 0,
        tov: game.tov || 0,
        fg: `${game.fgm || 0}-${game.fga || 0}`,
        fg_pct: game.fg_pct || 0,
        fg3: `${game.fg3m || 0}-${game.fg3a || 0}`,
        fg3_pct: game.fg3_pct || 0,
        ft: `${game.ftm || 0}-${game.fta || 0}`,
        ft_pct: game.ft_pct || 0,
        fantasy_points: (game.pts || 0) + 
                       ((game.reb || 0) * 1.2) + 
                       ((game.ast || 0) * 1.5) + 
                       ((game.stl || 0) * 3) + 
                       ((game.blk || 0) * 3) - 
                       (game.tov || 0)
      }));
    },
    enabled: !!selectedPlayer,
  });

  const handlePlayerClick = (player: TeamPlayer) => {
    setSelectedPlayer(player);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setTimeout(() => setSelectedPlayer(null), 300); // Clear after animation
  };

  const formatSalary = (salary: number) => {
    return `$${(salary / 1000000).toFixed(1)}M`;
  };

  return (
    <Card variant="outlined">
      <CardContent>
        {/* Header */}
        <Box sx={{ mb: 3, textAlign: 'center' }}>
          <Typography level="h2" sx={{ mb: 0.5 }}>
            🏆 Team of the Week
          </Typography>
          {weekInfo && (
          <Typography level="body-sm" color="neutral">
              {weekInfo.week_name} ({new Date(weekInfo.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(weekInfo.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})
          </Typography>
          )}
        </Box>

        {/* Players in Formation */}
        {isLoading ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography level="h4" color="neutral">
                Loading Team of the Week...
              </Typography>
            </Box>
        ) : error ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography level="h4" color="danger">
                Unable to load Team of the Week
              </Typography>
              <Typography level="body-sm" color="neutral" sx={{ mt: 1 }}>
                Check back soon!
              </Typography>
            </Box>
        ) : (!teamPlayers || teamPlayers.length === 0) ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography level="h4" color="neutral">
                No games played yet
              </Typography>
              <Typography level="body-sm" color="neutral" sx={{ mt: 1 }}>
                Team of the Week will appear after the first games
              </Typography>
            </Box>
        ) : (
          <Box sx={{ py: 4 }}>
            {(() => {
              // Sort players by position
              const guards = teamPlayers.filter(p => 
                p.player_position.toLowerCase().includes('guard') || 
                ['pg', 'sg', 'g'].includes(p.player_position.toLowerCase())
              );
              const forwards = teamPlayers.filter(p => 
                p.player_position.toLowerCase().includes('forward') || 
                ['sf', 'pf', 'f'].includes(p.player_position.toLowerCase())
              );
              const centers = teamPlayers.filter(p => 
                p.player_position.toLowerCase().includes('center') || 
                p.player_position.toLowerCase() === 'c'
              );

              const renderPlayer = (player: TeamPlayer) => (
                <Box
                  key={player.player_id}
                  sx={{
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'transform 0.2s',
                    '&:hover': {
                      transform: 'scale(1.05)',
                    },
                  }}
                  onClick={() => handlePlayerClick(player)}
                >
                  <PlayerJersey
                    playerName={player.player_name}
                    jerseyNumber={player.jersey_number}
                    nbaTeam={player.team}
                    position={player.player_position}
                    size="large"
                  />
                  <Typography level="body-sm" sx={{ mt: 1, fontWeight: 'bold' }}>
                    {player.player_name.split(' ').pop()}
                  </Typography>
                  <Chip size="sm" variant="soft" color="primary" sx={{ mt: 0.5 }}>
                    {player.avg_fantasy_points.toFixed(1)} FP
                  </Chip>
                </Box>
              );

              return (
                <Stack spacing={4} sx={{ alignItems: 'center' }}>
                  {/* Top Row: Forward - Center - Forward */}
                  <Stack 
                    direction="row" 
                    spacing={3} 
                    sx={{ justifyContent: 'center', alignItems: 'center' }}
                  >
                    {forwards[0] && renderPlayer(forwards[0])}
                    {centers[0] && renderPlayer(centers[0])}
                    {forwards[1] && renderPlayer(forwards[1])}
                  </Stack>

                  {/* Bottom Row: Guard - Guard */}
                  <Stack 
                    direction="row" 
                    spacing={8} 
                    sx={{ justifyContent: 'center', alignItems: 'center' }}
                  >
                    {guards[0] && renderPlayer(guards[0])}
                    {guards[1] && renderPlayer(guards[1])}
                  </Stack>
                </Stack>
              );
            })()}
          </Box>
        )}

      </CardContent>

      {/* Box Scores Modal */}
      <Modal open={modalOpen} onClose={handleCloseModal}>
        <ModalDialog
          sx={{
            maxWidth: '90vw',
            maxHeight: '90vh',
            overflow: 'auto',
          }}
        >
          <ModalClose />
          {selectedPlayer && (
            <>
              <Typography level="h4" sx={{ mb: 2 }}>
                {selectedPlayer.player_name} - Week Game Log
              </Typography>
              
              <Stack spacing={2}>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Chip size="sm" variant="soft" color="primary">
                    Avg: {selectedPlayer.avg_fantasy_points.toFixed(1)} FP
          </Chip>
          <Chip size="sm" variant="soft" color="success">
                    {selectedPlayer.games_played} Games
                  </Chip>
                  <Chip size="sm" variant="soft" color="neutral">
                    {selectedPlayer.team} - #{selectedPlayer.jersey_number}
          </Chip>
        </Box>

                {boxScoresLoading ? (
                  <Typography>Loading game log...</Typography>
                ) : !boxScores || boxScores.length === 0 ? (
                  <Typography>No games found</Typography>
                ) : (
                  <Box sx={{ overflowX: 'auto' }}>
                    <Table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>OPP</th>
                          <th>MIN</th>
                          <th>PTS</th>
                          <th>REB</th>
                          <th>AST</th>
                          <th>STL</th>
                          <th>BLK</th>
                          <th>TO</th>
                          <th>FG</th>
                          <th>FG%</th>
                          <th>3PT</th>
                          <th>3P%</th>
                          <th>FT</th>
                          <th>FT%</th>
                          <th style={{ fontWeight: 'bold', color: 'var(--joy-palette-primary-500)' }}>
                            FP
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {boxScores.map((game, idx) => (
                          <tr key={idx}>
                            <td>{new Date(game.game_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                            <td>{game.matchup}</td>
                            <td>{game.min.toFixed(0)}</td>
                            <td><strong>{game.pts}</strong></td>
                            <td>{game.reb}</td>
                            <td>{game.ast}</td>
                            <td>{game.stl}</td>
                            <td>{game.blk}</td>
                            <td>{game.tov}</td>
                            <td>{game.fg}</td>
                            <td>{(game.fg_pct * 100).toFixed(1)}%</td>
                            <td>{game.fg3}</td>
                            <td>{(game.fg3_pct * 100).toFixed(1)}%</td>
                            <td>{game.ft}</td>
                            <td>{(game.ft_pct * 100).toFixed(1)}%</td>
                            <td style={{ fontWeight: 'bold', color: 'var(--joy-palette-primary-500)' }}>
                              {game.fantasy_points.toFixed(1)}
                            </td>
                          </tr>
                        ))}
                        {boxScores.length > 1 && (
                          <tr style={{ fontWeight: 'bold', backgroundColor: 'var(--joy-palette-background-level1)' }}>
                            <td colSpan={3}>AVERAGE</td>
                            <td>{(boxScores.reduce((sum, g) => sum + g.pts, 0) / boxScores.length).toFixed(1)}</td>
                            <td>{(boxScores.reduce((sum, g) => sum + g.reb, 0) / boxScores.length).toFixed(1)}</td>
                            <td>{(boxScores.reduce((sum, g) => sum + g.ast, 0) / boxScores.length).toFixed(1)}</td>
                            <td>{(boxScores.reduce((sum, g) => sum + g.stl, 0) / boxScores.length).toFixed(1)}</td>
                            <td>{(boxScores.reduce((sum, g) => sum + g.blk, 0) / boxScores.length).toFixed(1)}</td>
                            <td>{(boxScores.reduce((sum, g) => sum + g.tov, 0) / boxScores.length).toFixed(1)}</td>
                            <td colSpan={6}></td>
                            <td style={{ color: 'var(--joy-palette-primary-500)' }}>
                              {selectedPlayer.avg_fantasy_points.toFixed(1)}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </Table>
                  </Box>
                )}
              </Stack>
            </>
          )}
        </ModalDialog>
      </Modal>
    </Card>
  );
}

