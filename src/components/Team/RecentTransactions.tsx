import { Box, Typography, Card, CardContent, List, ListItem, ListItemContent, ListItemDecorator, Chip, Avatar } from '@mui/joy';
import { PersonAdd, PersonRemove, Gavel } from '@mui/icons-material';
import { useTeamTransactions } from '../../hooks/useTeamTransactions';
import { formatDistanceToNow } from 'date-fns';

interface RecentTransactionsProps {
  teamId: string;
  leagueId: string;
}

export default function RecentTransactions({ teamId, leagueId }: RecentTransactionsProps) {
  const { data: transactions = [], isLoading } = useTeamTransactions(leagueId, teamId, 10);

  const getIcon = (type: string) => {
    switch (type) {
      case 'add': return <PersonAdd />;
      case 'cut': return <PersonRemove />;
      case 'waiver_claim': return <Gavel />;
      default: return <PersonAdd />;
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case 'add': return 'success';
      case 'cut': return 'danger';
      case 'waiver_claim': return 'warning';
      default: return 'neutral';
    }
  };

  const getDescription = (transaction: any) => {
    if (transaction.transaction_type === 'add') {
      return `Added ${transaction.player_name}`;
    } else if (transaction.transaction_type === 'cut') {
      return `Dropped ${transaction.player_name}`;
    } else if (transaction.transaction_type === 'waiver_claim') {
      return `Claimed ${transaction.player_name} via waivers`;
    }
    return 'Unknown transaction';
  };

  const getRelativeTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return 'recently';
    }
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography level="title-md" sx={{ mb: 2, fontWeight: 'bold' }}>
          📋 Recent Transactions
        </Typography>
        
        {isLoading ? (
          <Typography level="body-sm" color="neutral" sx={{ textAlign: 'center', py: 3 }}>
            Loading transactions...
          </Typography>
        ) : transactions.length === 0 ? (
          <Typography level="body-sm" color="neutral" sx={{ textAlign: 'center', py: 3 }}>
            No recent transactions
          </Typography>
        ) : (
          <List size="sm">
            {transactions.map((transaction) => (
              <ListItem key={transaction.transaction_id}>
                <ListItemDecorator>
                  <Chip color={getColor(transaction.transaction_type)} size="sm" variant="soft">
                    {getIcon(transaction.transaction_type)}
                  </Chip>
                </ListItemDecorator>
                <ListItemContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography level="body-sm" sx={{ fontWeight: 'bold' }}>
                      {getDescription(transaction)}
                    </Typography>
                    {transaction.player_position && (
                      <Chip size="sm" variant="outlined" sx={{ fontSize: '0.65rem', minHeight: '18px', py: 0 }}>
                        {transaction.player_position}
                      </Chip>
                    )}
                  </Box>
                  <Typography level="body-xs" color="neutral">
                    {getRelativeTime(transaction.transaction_date)}
                    {transaction.player_team && ` • ${transaction.player_team}`}
                  </Typography>
                </ListItemContent>
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
}

