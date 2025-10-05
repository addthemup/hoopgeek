import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Stack,
  List,
  ListItem,
  ListItemContent,
  Chip,
  Divider,
} from '@mui/joy';

interface DraftRulesProps {
  leagueId: string;
}

export default function DraftRules({ leagueId }: DraftRulesProps) {
  const draftRules = [
    {
      title: "Draft Format",
      rules: [
        "Snake draft format (Round 1: 1-12, Round 2: 12-1, etc.)",
        "12 rounds total",
        "2:00 per pick (can be extended up to 3 times)",
        "Auto-pick if time expires"
      ]
    },
    {
      title: "Roster Requirements",
      rules: [
        "10 starters: 2 PG, 2 SG, 2 SF, 2 PF, 2 C",
        "3 bench players",
        "1 injured reserve spot",
        "Total roster: 14 players"
      ]
    },
    {
      title: "Trading",
      rules: [
        "Trades allowed during draft",
        "Can trade picks for players",
        "Can trade players for future picks",
        "Both parties must approve trades"
      ]
    },
    {
      title: "Scoring",
      rules: [
        "Points: 1 point",
        "Rebounds: 1.2 points",
        "Assists: 1.5 points",
        "Steals: 2 points",
        "Blocks: 2 points",
        "Turnovers: -1 point"
      ]
    },
    {
      title: "Lineup Changes",
      rules: [
        "Weekly lineup changes",
        "Lineups lock at first game of the week",
        "No daily lineup changes"
      ]
    }
  ];

  return (
    <Box>
      {/* Header */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent sx={{ textAlign: 'center' }}>
          <Typography level="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
            📖 Draft Rules
          </Typography>
          <Typography level="body-sm" color="neutral">
            League rules and settings
          </Typography>
        </CardContent>
      </Card>

      {/* Rules Sections */}
      <Stack spacing={2}>
        {draftRules.map((section, index) => (
          <Card key={index} variant="outlined">
            <CardContent>
              <Typography level="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
                {section.title}
              </Typography>
              <List size="sm">
                {section.rules.map((rule, ruleIndex) => (
                  <ListItem key={ruleIndex}>
                    <ListItemContent>
                      <Typography level="body-sm">
                        {rule}
                      </Typography>
                    </ListItemContent>
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        ))}
      </Stack>

      {/* Additional Info */}
      <Card variant="outlined" sx={{ mt: 2 }}>
        <CardContent>
          <Typography level="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
            ℹ️ Additional Information
          </Typography>
          <Stack spacing={1}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip size="sm" color="primary" variant="soft">
                Commissioner
              </Chip>
              <Typography level="body-sm">
                Can pause draft, make manual picks, override trades
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip size="sm" color="success" variant="soft">
                Auto-Pick
              </Chip>
              <Typography level="body-sm">
                Based on pre-draft rankings if time expires
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Chip size="sm" color="warning" variant="soft">
                Time Extensions
              </Chip>
              <Typography level="body-sm">
                Each team gets 3 time extensions (+2:00 each)
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
