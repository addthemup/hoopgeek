import {
  Box,
  Typography,
  Card,
  CardContent,
  Table,
  LinearProgress,
  Alert,
  Chip,
  Button,
} from '@mui/joy';
import { useDFSUserEntries } from '../../hooks/useDFSUserEntries';
import { useAuth } from '../../hooks/useAuth';
import { formatSalary } from '../../hooks/useDFSLineupSalary';
import { Visibility } from '@mui/icons-material';

interface EntriesTabProps {
  onPoolSelect: (poolId: string, view?: 'details' | 'lineup-builder' | 'entry', entryId?: string) => void;
}

export default function EntriesTab({ onPoolSelect }: EntriesTabProps) {
  const { user } = useAuth();
  const { data: entries, isLoading: entriesLoading } = useDFSUserEntries(user?.id || '');

  // Only show past entries (completed/finalized)
  const pastEntries = entries?.filter(entry => 
    entry.pool_status === 'completed' || entry.pool_status === 'finalized'
  ) || [];

  const getDifficultyColor = (tier: string) => {
    switch (tier) {
      case 'elite': return 'danger';
      case 'pro': return 'warning';
      case 'standard': return 'success';
      default: return 'neutral';
    }
  };

  if (!user) {
    return (
      <Alert color="warning" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333' }}>
        <Typography sx={{ color: '#FFFFFF' }}>
          Please log in to view your entries
        </Typography>
      </Alert>
    );
  }

  return (
    <Box>
      <Card variant="outlined" sx={{ bgcolor: '#000000', borderColor: '#333333', mb: 3 }}>
        <CardContent sx={{ bgcolor: '#000000' }}>
          <Typography level="h4" sx={{ mb: 3, fontWeight: 'bold', color: '#FFFFFF' }}>
            Past Entries
          </Typography>

          {entriesLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <LinearProgress sx={{ width: '100%' }} />
            </Box>
          ) : (
            <>
              {pastEntries.length > 0 ? (
                <Box sx={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%' }}>
                  <Table hoverRow size="sm" sx={{ 
                    minWidth: 600, 
                    bgcolor: '#000000',
                    '& tbody td': {
                      color: '#FFFFFF',
                    },
                    '& tbody tr:hover': {
                      bgcolor: '#1a1a1a',
                    },
                  }}>
                    <thead>
                      <tr>
                        <th style={{ color: '#FFFFFF' }}>Contest</th>
                        <th style={{ color: '#FFFFFF' }}>Status</th>
                        <th style={{ color: '#FFFFFF' }}>Entry</th>
                        <th style={{ color: '#FFFFFF' }}>Salary Used</th>
                        <th style={{ color: '#FFFFFF' }}>Final Score</th>
                        <th style={{ color: '#FFFFFF' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pastEntries.map((entry) => (
                        <tr key={entry.entry_id}>
                          <td>
                            <Box>
                              <Typography level="body-sm" sx={{ fontWeight: 'bold', color: '#FFFFFF' }}>
                                {entry.pool_name}
                              </Typography>
                              <Chip 
                                size="sm" 
                                variant="soft" 
                                color={getDifficultyColor(entry.difficulty_tier)}
                                sx={{ mt: 0.5 }}
                              >
                                {entry.difficulty_tier}
                              </Chip>
                            </Box>
                          </td>
                          <td>
                            <Chip
                              size="sm"
                              variant="soft"
                              color={
                                entry.pool_status === 'live' ? 'danger' :
                                entry.pool_status === 'completed' ? 'success' : 'neutral'
                              }
                            >
                              {entry.pool_status === 'live' ? 'LIVE' :
                               entry.pool_status === 'completed' ? 'FINAL' : 'UPCOMING'}
                            </Chip>
                          </td>
                          <td>
                            <Typography level="body-sm" sx={{ color: '#FFFFFF' }}>
                              {entry.is_submitted ? 'Submitted' : 'Draft'}
                            </Typography>
                          </td>
                          <td>
                            <Typography level="body-sm" sx={{ color: '#FFFFFF' }}>
                              {formatSalary(entry.total_salary || 0)}
                            </Typography>
                          </td>
                          <td>
                            <Typography level="body-sm" sx={{ fontWeight: 'bold', color: 'primary.500' }}>
                              {entry.final_score?.toFixed(1) || '0.0'}
                            </Typography>
                          </td>
                          <td>
                            <Button
                              size="sm"
                              variant="outlined"
                              startDecorator={<Visibility />}
                              onClick={() => onPoolSelect(entry.pool_id, 'entry', entry.entry_id)}
                              sx={{ borderColor: '#333333', color: '#FFFFFF' }}
                            >
                              View
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </Box>
              ) : (
                <Alert color="warning" sx={{ bgcolor: '#1a1a1a', borderColor: '#333333' }}>
                  <Typography sx={{ color: '#FFFFFF' }}>
                    No past entries
                  </Typography>
                </Alert>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

