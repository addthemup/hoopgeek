import {
  Modal,
  ModalDialog,
  ModalClose,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  Stack,
  Chip,
  Divider,
  Grid,
  Card,
  CardContent
} from '@mui/joy';
import {
  EmojiEvents,
  Speed,
  Sports,
  TrendingUp,
  FlashOn,
  SwapHoriz,
  Straighten
} from '@mui/icons-material';

interface FunScoreData {
  fun_score: number;
  team_stats: {
    Pace: number;
    'Margin of Victory': number;
    'Combined Threes': number;
    'Combined Three %': number;
    'Combined Contested Shots': number;
    'Combined Contested Shot %': number;
    'Combined Contested Threes': number;
    'Combined Contested Three %': number;
    'Combined Fast Break Points': number;
    'Team Pace': { team1: number; team2: number };
    'Team Threes': { team1: number; team2: number };
    'Team Three %': { team1: number; team2: number };
    'Team Contested Shots': { team1: number; team2: number };
    'Team Contested Shot %': { team1: number; team2: number };
    'Team Contested Threes': { team1: number; team2: number };
    'Team Contested Three %': { team1: number; team2: number };
    'Team Fast Break Points': { team1: number; team2: number };
  };
  lead_changes: {
    total: number;
    last_5_minutes: number;
    last_minute: number;
    buzzer_beater: number;
  };
  dunk_stats: {
    'Alley Oop': number;
    Putback: number;
    Running: number;
    Driving: number;
    Tip: number;
    Cutting: number;
    'Total Dunks': number;
  };
  deep_shots: {
    deep_threes: number;
    four_pointers: number;
  };
  scoring_milestones: {
    '70 Ball': any[];
    '60 Ball': any[];
    '50 Ball': any[];
    '40 Ball': any[];
    'Triple Double': any[];
  };
}

interface FunScoreDataModalProps {
  open: boolean;
  onClose: () => void;
  funScoreData: FunScoreData | null;
  gameId?: string;
}

export default function FunScoreDataModal({
  open,
  onClose,
  funScoreData,
  gameId
}: FunScoreDataModalProps) {
  if (!funScoreData) return null;

  const StatCard = ({ 
    icon, 
    title, 
    value, 
    color = 'neutral' 
  }: { 
    icon: React.ReactNode; 
    title: string; 
    value: string | number; 
    color?: 'primary' | 'success' | 'warning' | 'danger' | 'neutral';
  }) => (
    <Card variant="outlined" sx={{ height: '100%', p: 0.5 }}>
      <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
        <Stack spacing={0.5} alignItems="center">
          <Box sx={{ color: `${color}.500`, fontSize: '1rem' }}>{icon}</Box>
          <Typography level="body-xs" textColor="text.tertiary" textAlign="center" sx={{ fontSize: '0.65rem' }}>
            {title}
          </Typography>
          <Typography level="title-lg" fontWeight="bold">
            {value}
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );

  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog
        sx={{
          maxWidth: 900,
          width: '95vw',
          maxHeight: '95vh',
          overflow: 'auto',
          p: 2
        }}
      >
        <ModalClose />
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <EmojiEvents sx={{ color: 'warning.500', fontSize: '1.25rem' }} />
            <Typography level="title-lg">Fun Score Data</Typography>
            {gameId && (
              <Chip size="sm" variant="soft" color="primary">
                {gameId}
              </Chip>
            )}
          </Stack>
        </DialogTitle>

        <DialogContent sx={{ p: 2 }}>
          <Stack spacing={2}>
            {/* Fun Score Header - Compact */}
            <Box
              sx={{
                bgcolor: 'warning.50',
                p: 1.5,
                borderRadius: 'md',
                textAlign: 'center'
              }}
            >
              <Typography level="body-xs" sx={{ color: '#000', fontWeight: 'bold' }} mb={0.5}>
                Overall Fun Score
              </Typography>
              <Typography level="h2" fontWeight="bold" color="warning">
                {funScoreData.fun_score}
              </Typography>
            </Box>

            {/* Lead Changes */}
            <Box>
              <Typography level="title-sm" mb={1} startDecorator={<SwapHoriz fontSize="small" />}>
                Lead Changes
              </Typography>
              <Grid container spacing={1}>
                <Grid xs={3}>
                  <StatCard
                    icon={<SwapHoriz />}
                    title="Total"
                    value={funScoreData.lead_changes.total}
                    color="primary"
                  />
                </Grid>
                <Grid xs={3}>
                  <StatCard
                    icon={<TrendingUp />}
                    title="Last 5 Min"
                    value={funScoreData.lead_changes.last_5_minutes}
                    color="success"
                  />
                </Grid>
                <Grid xs={3}>
                  <StatCard
                    icon={<FlashOn />}
                    title="Last Minute"
                    value={funScoreData.lead_changes.last_minute}
                    color="warning"
                  />
                </Grid>
                <Grid xs={3}>
                  <StatCard
                    icon={<EmojiEvents />}
                    title="Buzzer Beaters"
                    value={funScoreData.lead_changes.buzzer_beater}
                    color="danger"
                  />
                </Grid>
              </Grid>
            </Box>

            {/* Dunk Stats & Deep Shots - Combined Row */}
            <Grid container spacing={2}>
              <Grid xs={12} md={8}>
                <Typography level="title-sm" mb={1} startDecorator={<Sports fontSize="small" />}>
                  Dunk Breakdown
                </Typography>
                <Grid container spacing={1}>
                  <Grid xs={3}>
                    <StatCard
                      icon={<Sports />}
                      title="Total"
                      value={funScoreData.dunk_stats['Total Dunks']}
                      color="primary"
                    />
                  </Grid>
                  <Grid xs={3}>
                    <StatCard
                      icon={<Typography level="body-sm">🏀</Typography>}
                      title="Alley Oop"
                      value={funScoreData.dunk_stats['Alley Oop']}
                    />
                  </Grid>
                  <Grid xs={3}>
                    <StatCard
                      icon={<Typography level="body-sm">⚡</Typography>}
                      title="Running"
                      value={funScoreData.dunk_stats.Running}
                    />
                  </Grid>
                  <Grid xs={3}>
                    <StatCard
                      icon={<Typography level="body-sm">🚀</Typography>}
                      title="Driving"
                      value={funScoreData.dunk_stats.Driving}
                    />
                  </Grid>
                </Grid>
              </Grid>
              
              <Grid xs={12} md={4}>
                <Typography level="title-sm" mb={1} startDecorator={<Straighten fontSize="small" />}>
                  Deep Shots
                </Typography>
                <Grid container spacing={1}>
                  <Grid xs={6}>
                    <StatCard
                      icon={<Straighten />}
                      title="Deep 3s"
                      value={funScoreData.deep_shots.deep_threes}
                      color="success"
                    />
                  </Grid>
                  <Grid xs={6}>
                    <StatCard
                      icon={<Straighten />}
                      title="4-Pts"
                      value={funScoreData.deep_shots.four_pointers}
                      color="warning"
                    />
                  </Grid>
                </Grid>
              </Grid>
            </Grid>


            {/* Team Stats - Compact */}
            <Box>
              <Typography level="title-sm" mb={1} startDecorator={<Speed fontSize="small" />}>
                Team Stats
              </Typography>
              <Grid container spacing={1}>
                <Grid xs={12} sm={4}>
                  <Stack spacing={0.5}>
                    <Typography level="body-xs" fontWeight="bold">Game Pace</Typography>
                    <Chip size="sm" variant="soft" color="primary">
                      {funScoreData.team_stats.Pace}
                    </Chip>
                  </Stack>
                </Grid>
                <Grid xs={12} sm={4}>
                  <Stack spacing={0.5}>
                    <Typography level="body-xs" fontWeight="bold">Fast Break Pts</Typography>
                    <Stack direction="row" spacing={0.5}>
                      <Chip size="sm" variant="soft">{funScoreData.team_stats['Team Fast Break Points'].team1}</Chip>
                      <Chip size="sm" variant="soft">{funScoreData.team_stats['Team Fast Break Points'].team2}</Chip>
                    </Stack>
                  </Stack>
                </Grid>
                <Grid xs={12} sm={4}>
                  <Stack spacing={0.5}>
                    <Typography level="body-xs" fontWeight="bold">Three Pointers</Typography>
                    <Stack direction="row" spacing={0.5}>
                      <Chip size="sm" variant="soft">{funScoreData.team_stats['Team Threes'].team1}</Chip>
                      <Chip size="sm" variant="soft">{funScoreData.team_stats['Team Threes'].team2}</Chip>
                    </Stack>
                  </Stack>
                </Grid>
              </Grid>
            </Box>

            {/* Scoring Milestones - Compact */}
            {(funScoreData.scoring_milestones['40 Ball'].length > 0 ||
              funScoreData.scoring_milestones['50 Ball'].length > 0 ||
              funScoreData.scoring_milestones['60 Ball'].length > 0 ||
              funScoreData.scoring_milestones['70 Ball'].length > 0 ||
              funScoreData.scoring_milestones['Triple Double'].length > 0) && (
              <Box>
                <Typography level="title-sm" mb={1} startDecorator={<EmojiEvents fontSize="small" />}>
                  Scoring Milestones
                </Typography>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                  {funScoreData.scoring_milestones['70 Ball'].length > 0 && (
                    <Chip color="danger" size="sm">70+: {funScoreData.scoring_milestones['70 Ball'].length}</Chip>
                  )}
                  {funScoreData.scoring_milestones['60 Ball'].length > 0 && (
                    <Chip color="warning" size="sm">60+: {funScoreData.scoring_milestones['60 Ball'].length}</Chip>
                  )}
                  {funScoreData.scoring_milestones['50 Ball'].length > 0 && (
                    <Chip color="success" size="sm">50+: {funScoreData.scoring_milestones['50 Ball'].length}</Chip>
                  )}
                  {funScoreData.scoring_milestones['40 Ball'].length > 0 && (
                    <Chip color="primary" size="sm">40+: {funScoreData.scoring_milestones['40 Ball'].length}</Chip>
                  )}
                  {funScoreData.scoring_milestones['Triple Double'].length > 0 && (
                    <Chip color="neutral" size="sm">Triple Doubles: {funScoreData.scoring_milestones['Triple Double'].length}</Chip>
                  )}
                </Stack>
              </Box>
            )}
          </Stack>
        </DialogContent>
      </ModalDialog>
    </Modal>
  );
}

