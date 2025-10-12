import React from 'react';
import { Box, Typography, Card, CardContent, List, ListItem, Avatar, Chip, Button } from '@mui/joy';
import { LocalOffer } from '@mui/icons-material';

interface TradingBlockProps {
  teamId: string;
}

export default function TradingBlock({ teamId }: TradingBlockProps) {
  // Placeholder mock data
  const tradingBlockPlayers = [
    { id: 1, name: 'Player A', position: 'PG', status: 'available' },
    { id: 2, name: 'Player B', position: 'SF', status: 'listening' },
  ];

  return (
    <Card variant="outlined">
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography level="h6" sx={{ fontWeight: 'bold' }}>
            🏷️ Trading Block
          </Typography>
          <Button size="sm" variant="soft" color="primary">
            Manage
          </Button>
        </Box>
        
        {tradingBlockPlayers.length === 0 ? (
          <Typography level="body-sm" color="neutral" sx={{ textAlign: 'center', py: 3 }}>
            No players on trading block
          </Typography>
        ) : (
          <List size="sm">
            {tradingBlockPlayers.map((player) => (
              <ListItem key={player.id}>
                <Avatar sx={{ mr: 1 }}>{player.name.charAt(0)}</Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                    {player.name}
                  </Typography>
                  <Typography level="body-xs" color="neutral">
                    {player.position}
                  </Typography>
                </Box>
                <Chip size="sm" color={player.status === 'available' ? 'success' : 'warning'}>
                  {player.status}
                </Chip>
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
}

