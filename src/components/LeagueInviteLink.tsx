import React, { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Stack,
  Button,
  Input,
  IconButton,
  Chip,
  Alert,
} from '@mui/joy';
import { ContentCopy, Check, Link as LinkIcon, People } from '@mui/icons-material';

interface LeagueInviteLinkProps {
  inviteCode: string;
  leagueId: string;
  leagueName: string;
  currentTeams: number;
  maxTeams: number;
}

export default function LeagueInviteLink({
  inviteCode,
  leagueId,
  leagueName,
  currentTeams,
  maxTeams,
}: LeagueInviteLinkProps) {
  const [copied, setCopied] = useState(false);
  
  const inviteUrl = `${window.location.origin}/join/${inviteCode}`;
  
  const handleCopy = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const spotsRemaining = maxTeams - currentTeams;
  const isFull = currentTeams >= maxTeams;

  return (
    <Card variant="outlined" sx={{ bgcolor: 'background.level1' }}>
      <CardContent>
        <Stack spacing={2}>
          {/* Header */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <LinkIcon color="primary" />
              <Typography level="title-md" sx={{ fontWeight: 'bold' }}>
                Invite Link
              </Typography>
            </Stack>
            <Chip
              size="sm"
              color={isFull ? 'danger' : 'success'}
              variant="soft"
            >
              {isFull ? 'Full' : `${spotsRemaining} spots left`}
            </Chip>
          </Box>

          {/* Description */}
          <Typography level="body-sm" color="neutral">
            Share this link with anyone you want to invite to <strong>{leagueName}</strong>. 
            First {maxTeams} people to join get a team!
          </Typography>

          {/* URL Display with Copy Button */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Input
              value={inviteUrl}
              readOnly
              sx={{ flex: 1 }}
              endDecorator={
                <IconButton
                  size="sm"
                  variant="plain"
                  onClick={handleCopy}
                  sx={{ minWidth: 32 }}
                >
                  {copied ? <Check color="success" /> : <ContentCopy />}
                </IconButton>
              }
            />
          </Box>

          {copied && (
            <Alert color="success" variant="soft" size="sm">
              <Typography level="body-xs">
                ✓ Link copied to clipboard!
              </Typography>
            </Alert>
          )}

          {/* Stats */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <People sx={{ fontSize: 18, color: 'neutral.500' }} />
              <Typography level="body-sm" color="neutral">
                {currentTeams} / {maxTeams} teams joined
              </Typography>
            </Stack>
            <Typography level="body-xs" color="neutral">
              Code: <strong>{inviteCode}</strong>
            </Typography>
          </Box>

          {/* Share Buttons */}
          <Stack direction="row" spacing={1}>
            <Button
              size="sm"
              variant="outlined"
              onClick={handleCopy}
              fullWidth
            >
              {copied ? 'Copied!' : 'Copy Link'}
            </Button>
            <Button
              size="sm"
              variant="outlined"
              onClick={() => {
                // Open email client with pre-filled invite
                const subject = encodeURIComponent(`Join my fantasy basketball league: ${leagueName}`);
                const body = encodeURIComponent(
                  `Hey! I created a fantasy basketball league and I'd love for you to join.\n\n` +
                  `League: ${leagueName}\n` +
                  `Join here: ${inviteUrl}\n\n` +
                  `First ${maxTeams} people to join get a spot. Hope to see you there!`
                );
                window.location.href = `mailto:?subject=${subject}&body=${body}`;
              }}
              fullWidth
            >
              Email Invite
            </Button>
          </Stack>

          {isFull && (
            <Alert color="warning" variant="soft" size="sm">
              <Typography level="body-xs">
                League is full. No more teams can join via this link.
              </Typography>
            </Alert>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}


