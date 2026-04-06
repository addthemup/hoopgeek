/**
 * Direct messages inbox — schema + RLS exist; compose UI will expand in a later pass.
 */

import { Link, useNavigate } from 'react-router-dom';
import { Box, Typography, Card, CardContent, Button } from '@mui/joy';
import ArrowBackIosNewRounded from '@mui/icons-material/ArrowBackIosNewRounded';

export default function MessagesPage() {
  const navigate = useNavigate();

  return (
    <Box sx={{ maxWidth: 640, mx: 'auto', p: 3, pb: 6 }}>
      <Button
        variant="plain"
        color="neutral"
        size="sm"
        startDecorator={<ArrowBackIosNewRounded sx={{ fontSize: 16 }} />}
        onClick={() => navigate('/profile')}
        sx={{ mb: 2 }}
      >
        Profile
      </Button>
      <Typography level="h3" sx={{ mb: 1 }}>
        Messages
      </Typography>
      <Typography level="body-sm" sx={{ color: 'text.secondary', mb: 3 }}>
        Conversations and realtime delivery will show here. Tables: <code>conversations</code>,{' '}
        <code>conversation_members</code>, <code>messages</code> (see migration).
      </Typography>
      <Card variant="outlined">
        <CardContent>
          <Typography level="body-sm" sx={{ color: 'text.secondary' }}>
            No conversations yet.
          </Typography>
        </CardContent>
      </Card>
      <Box sx={{ mt: 2 }}>
        <Link to="/feed">Feed</Link>
      </Box>
    </Box>
  );
}
