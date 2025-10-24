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

  // Fetch players of the night
  const { data: nightPlayers, isLoading } = useQuery<NightPlayer[]>({
    queryKey: ['players-of-the-night'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_players_of_the_night');

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

  // Sort players by position
  const guards = nightPlayers.filter(p => 
    p.player_position.toLowerCase().includes('guard') || 
    ['pg', 'sg', 'g'].includes(p.player_position.toLowerCase())
  );
  const forwards = nightPlayers.filter(p => 
    p.player_position.toLowerCase().includes('forward') || 
    ['sf', 'pf', 'f'].includes(p.player_position.toLowerCase())
  );
  const centers = nightPlayers.filter(p => 
    p.player_position.toLowerCase().includes('center') || 
    p.player_position.toLowerCase() === 'c'
  );

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
        size="medium"
      />
      <Typography level="body-xs" sx={{ mt: 0.5, fontWeight: 'bold' }}>
        {player.player_name.split(' ').pop()}
      </Typography>
      <Chip size="sm" variant="soft" color="primary" sx={{ mt: 0.25 }}>
        {player.fantasy_points.toFixed(1)} FP
      </Chip>
    </Box>
  );

  return (
    <Card variant="outlined">
      <CardContent>
        {/* Header */}
        <Box sx={{ mb: 2, textAlign: 'center' }}>
          <Typography level="h3" sx={{ mb: 0.5 }}>
            🔥 Players of the Night
          </Typography>
          <Typography level="body-xs" color="neutral">
            {yesterdayFormatted}
          </Typography>
        </Box>

        {/* Players in Formation */}
        <Box>
          <Stack spacing={2} sx={{ alignItems: 'center' }}>
            {/* Top Row: Forward - Center - Forward */}
            <Stack 
              direction="row" 
              spacing={2} 
              sx={{ justifyContent: 'center', alignItems: 'center' }}
            >
              {forwards[0] && renderPlayer(forwards[0])}
              {centers[0] && renderPlayer(centers[0])}
              {forwards[1] && renderPlayer(forwards[1])}
            </Stack>

            {/* Bottom Row: Guard - Guard */}
            <Stack 
              direction="row" 
              spacing={4} 
              sx={{ justifyContent: 'center', alignItems: 'center' }}
            >
              {guards[0] && renderPlayer(guards[0])}
              {guards[1] && renderPlayer(guards[1])}
            </Stack>
          </Stack>
        </Box>
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
                {selectedPlayer.player_name} - Last Night
              </Typography>
              
              <Stack spacing={2}>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <Chip size="sm" variant="soft" color="primary">
                    {selectedPlayer.fantasy_points.toFixed(1)} FP
                  </Chip>
                  <Chip size="sm" variant="soft" color="neutral">
                    {selectedPlayer.team} - #{selectedPlayer.jersey_number}
                  </Chip>
                </Box>

                {boxScoresLoading ? (
                  <Typography>Loading stats...</Typography>
                ) : !boxScores || boxScores.length === 0 ? (
                  <Typography>No game found</Typography>
                ) : (
                  <Box sx={{ overflowX: 'auto' }}>
                    <Table size="sm">
                      <thead>
                        <tr>
                          <th>OPP</th>
                          <th>MIN</th>
                          <th>PTS</th>
                          <th>REB</th>
                          <th>AST</th>
                          <th>STL</th>
                          <th>BLK</th>
                          <th>TO</th>
                          <th>FG</th>
                          <th>3PT</th>
                          <th>FT</th>
                          <th>FP</th>
                        </tr>
                      </thead>
                      <tbody>
                        {boxScores.map((game, idx) => (
                          <tr key={idx}>
                            <td>{game.matchup}</td>
                            <td>{game.min.toFixed(0)}</td>
                            <td><strong>{game.pts}</strong></td>
                            <td>{game.reb}</td>
                            <td>{game.ast}</td>
                            <td>{game.stl}</td>
                            <td>{game.blk}</td>
                            <td>{game.tov}</td>
                            <td>{game.fg}</td>
                            <td>{game.fg3}</td>
                            <td>{game.ft}</td>
                            <td style={{ fontWeight: 'bold', color: 'var(--joy-palette-primary-500)' }}>
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

