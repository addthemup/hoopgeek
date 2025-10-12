import React from 'react';
import { Box, Typography, Card, CardContent, List, ListItem, ListItemContent, ListItemDecorator, Chip } from '@mui/joy';
import { SwapHoriz, PersonAdd, PersonRemove } from '@mui/icons-material';

interface RecentTransactionsProps {
  teamId: string;
}

export default function RecentTransactions({ teamId }: RecentTransactionsProps) {
  // Placeholder mock data
  const transactions = [
    { id: 1, type: 'trade', description: 'Traded Player A for Player B', date: '2 days ago' },
    { id: 2, type: 'add', description: 'Added Player C from waivers', date: '5 days ago' },
    { id: 3, type: 'drop', description: 'Dropped Player D', date: '1 week ago' },
  ];

  const getIcon = (type: string) => {
    switch (type) {
      case 'trade': return <SwapHoriz />;
      case 'add': return <PersonAdd />;
      case 'drop': return <PersonRemove />;
      default: return <SwapHoriz />;
    }
  };

  const getColor = (type: string) => {
    switch (type) {
      case 'trade': return 'primary';
      case 'add': return 'success';
      case 'drop': return 'danger';
      default: return 'neutral';
    }
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography level="h6" sx={{ mb: 2, fontWeight: 'bold' }}>
          📋 Recent Transactions
        </Typography>
        
        {transactions.length === 0 ? (
          <Typography level="body-sm" color="neutral" sx={{ textAlign: 'center', py: 3 }}>
            No recent transactions
          </Typography>
        ) : (
          <List size="sm">
            {transactions.map((transaction) => (
              <ListItem key={transaction.id}>
                <ListItemDecorator>
                  <Chip color={getColor(transaction.type)} size="sm">
                    {getIcon(transaction.type)}
                  </Chip>
                </ListItemDecorator>
                <ListItemContent>
                  <Typography level="body-sm">{transaction.description}</Typography>
                  <Typography level="body-xs" color="neutral">{transaction.date}</Typography>
                </ListItemContent>
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
}

