import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  Modal,
  ModalDialog,
  ModalClose,
  Table,
  Chip,
} from '@mui/joy';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../utils/supabase';
import PlayerJersey from './PlayerJersey';

interface NightPlayer {
  player_id: string | null;
  nba_player_id: number;
  player_name: string;
  team: string;
  player_position: string;
  jersey_number: string;
  salary: number;
  fantasy_points: number;
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

export default function PlayersOfTheNight() {
  const [selectedPlayer, setSelectedPlayer] = useState<NightPlayer | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Fetch optimal lineup of the night (12 players under salary cap)
  const { data: nightPlayers, isLoading } = useQuery<NightPlayer[]>({
    queryKey: ['optimal-lineup-of-the-night'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_optimal_lineup_of_the_night');

      if (error) {
        console.error('Error fetching players of night:', error);
        return [];
      }

      return data || [];
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Fetch box scores for selected player (yesterday's game)
  const { data: boxScores, isLoading: boxScoresLoading } = useQuery<BoxScore[]>({
    queryKey: ['player-night-box-score', selectedPlayer?.nba_player_id],
    queryFn: async () => {
      if (!selectedPlayer) return [];

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('nba_boxscores')
        .select('*')
        .eq('nba_player_id', selectedPlayer.nba_player_id)
        .eq('game_date', yesterdayStr);

      if (error) {
        console.error('Error fetching box scores:', error);
        return [];
      }

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

  const handlePlayerClick = (player: NightPlayer) => {
    setSelectedPlayer(player);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setTimeout(() => setSelectedPlayer(null), 300);
  };

  // Don't render if loading or no players (no games yesterday)
  if (isLoading || !nightPlayers || nightPlayers.length === 0) {
    return null;
  }

  // Get yesterday's date for display
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayFormatted = yesterday.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  });

  const renderPlayer = (player: NightPlayer) => (
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
        size="small"
      />
      <Typography level="body-xs" sx={{ mt: 0.25, fontWeight: 'bold', color: '#FFFFFF', fontSize: '0.7rem' }}>
        {player.player_name.split(' ').pop()}
      </Typography>
      <Chip 
        size="sm" 
        variant="soft" 
        sx={{ 
          mt: 0.25, 
          bgcolor: '#1a1a1a',
          color: '#FFD700',
          border: '1px solid #333333',
          fontSize: '0.65rem',
          height: '18px',
        }}
      >
        {player.fantasy_points.toFixed(1)} FP
      </Chip>
    </Box>
  );

  return (
    <Card variant="outlined" sx={{ bgcolor: '#000000', borderColor: '#333333' }}>
      <CardContent sx={{ bgcolor: '#000000', p: 1.5 }}>
        {/* Header - Condensed */}
        <Box sx={{ mb: 1.5, textAlign: 'center' }}>
          <Typography level="title-sm" sx={{ mb: 0.25, color: '#FFFFFF', fontWeight: 'bold' }}>
            ⭐ Optimal Lineup of the Night
          </Typography>
          <Typography level="body-xs" sx={{ color: '#CCCCCC', mb: 0.5 }}>
            {nightPlayers && nightPlayers.length > 0 && (
              <>
                {nightPlayers.length} players • ${(nightPlayers.reduce((sum, p) => sum + (p.salary || 0), 0) / 1000000).toFixed(1)}M salary • {nightPlayers.reduce((sum, p) => sum + (p.fantasy_points || 0), 0).toFixed(1)} FP
              </>
            )}
          </Typography>
          <Typography level="body-xs" sx={{ color: '#CCCCCC' }}>
            {yesterdayFormatted}
          </Typography>
        </Box>

        {/* Optimal Lineup - 12 Players in Grid */}
        <Box>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(3, 1fr)', sm: 'repeat(4, 1fr)', md: 'repeat(6, 1fr)' },
              gap: 1.5,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            {nightPlayers.slice(0, 12).map((player) => renderPlayer(player))}
          </Box>
        </Box>
      </CardContent>

      {/* Box Scores Modal */}
      <Modal open={modalOpen} onClose={handleCloseModal}>
        <ModalDialog
          sx={{
            maxWidth: '90vw',
            maxHeight: '90vh',
            overflow: 'auto',
            bgcolor: '#000000',
            borderColor: '#333333',
          }}
        >
          <ModalClose sx={{ color: '#FFFFFF' }} />
          {selectedPlayer && (
            <>
              <Typography level="h4" sx={{ mb: 2, color: '#FFFFFF' }}>
                {selectedPlayer.player_name} - Last Night
              </Typography>
              
              <Stack spacing={2}>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <Chip 
                    size="sm" 
                    variant="soft" 
                    sx={{ 
                      bgcolor: '#1a1a1a',
                      color: '#FFD700',
                      border: '1px solid #333333',
                    }}
                  >
                    {selectedPlayer.fantasy_points.toFixed(1)} FP
                  </Chip>
                  <Chip 
                    size="sm" 
                    variant="soft" 
                    sx={{ 
                      bgcolor: '#1a1a1a',
                      color: '#FFFFFF',
                      border: '1px solid #333333',
                    }}
                  >
                    {selectedPlayer.team} - #{selectedPlayer.jersey_number}
                  </Chip>
                </Box>

                {boxScoresLoading ? (
                  <Typography sx={{ color: '#FFFFFF' }}>Loading stats...</Typography>
                ) : !boxScores || boxScores.length === 0 ? (
                  <Typography sx={{ color: '#FFFFFF' }}>No game found</Typography>
                ) : (
                  <Box sx={{ overflowX: 'auto' }}>
                    <Table size="sm" sx={{ bgcolor: '#000000' }}>
                      <thead>
                        <tr>
                          <th style={{ color: '#FFFFFF' }}>OPP</th>
                          <th style={{ color: '#FFFFFF' }}>MIN</th>
                          <th style={{ color: '#FFFFFF' }}>PTS</th>
                          <th style={{ color: '#FFFFFF' }}>REB</th>
                          <th style={{ color: '#FFFFFF' }}>AST</th>
                          <th style={{ color: '#FFFFFF' }}>STL</th>
                          <th style={{ color: '#FFFFFF' }}>BLK</th>
                          <th style={{ color: '#FFFFFF' }}>TO</th>
                          <th style={{ color: '#FFFFFF' }}>FG</th>
                          <th style={{ color: '#FFFFFF' }}>3PT</th>
                          <th style={{ color: '#FFFFFF' }}>FT</th>
                          <th style={{ color: '#FFFFFF' }}>FP</th>
                        </tr>
                      </thead>
                      <tbody>
                        {boxScores.map((game, idx) => (
                          <tr key={idx}>
                            <td style={{ color: '#CCCCCC' }}>{game.matchup}</td>
                            <td style={{ color: '#CCCCCC' }}>{game.min.toFixed(0)}</td>
                            <td style={{ color: '#FFFFFF', fontWeight: 'bold' }}>{game.pts}</td>
                            <td style={{ color: '#CCCCCC' }}>{game.reb}</td>
                            <td style={{ color: '#CCCCCC' }}>{game.ast}</td>
                            <td style={{ color: '#CCCCCC' }}>{game.stl}</td>
                            <td style={{ color: '#CCCCCC' }}>{game.blk}</td>
                            <td style={{ color: '#CCCCCC' }}>{game.tov}</td>
                            <td style={{ color: '#CCCCCC' }}>{game.fg}</td>
                            <td style={{ color: '#CCCCCC' }}>{game.fg3}</td>
                            <td style={{ color: '#CCCCCC' }}>{game.ft}</td>
                            <td style={{ fontWeight: 'bold', color: '#FFD700' }}>
                              {game.fantasy_points.toFixed(1)}
                            </td>
                          </tr>
                        ))}
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

