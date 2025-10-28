import { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Stack,
  Button,
  Input,
  FormControl,
  FormLabel,
  Alert,
  CircularProgress,
  Chip,
  Table,
  Sheet,
  Divider,
  Modal,
  ModalDialog,
  ModalClose,
  Select,
  Option,
} from '@mui/joy';
import {
  AccountBalanceWallet,
  Add,
  Remove,
  TrendingUp,
  TrendingDown,
  Verified,
  Warning,
  Info,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../utils/supabase';
import { useAuth } from '../../hooks/useAuth';

interface WalletBalance {
  total_balance: number;
  withdrawable_balance: number;
  bonus_balance: number;
  pending_balance: number;
}

interface Transaction {
  id: string;
  type: string;
  amount_cents: number;
  bonus_amount_cents: number;
  fee_cents: number;
  status: string;
  description: string;
  created_at: string;
  completed_at: string | null;
}

export default function WalletTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('stripe_card');

  // Fetch wallet balance
  const { data: wallet, isLoading: walletLoading } = useQuery({
    queryKey: ['wallet-balance', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_wallets')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;

      return {
        total_balance: (data.balance_cents / 100).toFixed(2),
        withdrawable_balance: (data.withdrawable_balance_cents / 100).toFixed(2),
        bonus_balance: (data.bonus_balance_cents / 100).toFixed(2),
        pending_balance: (data.pending_balance_cents / 100).toFixed(2),
        status: data.status,
        kyc_verified: data.kyc_verified,
        has_payment_method: data.has_payment_method,
      };
    },
    enabled: !!user?.id,
  });

  // Fetch transaction history
  const { data: transactions, isLoading: transactionsLoading } = useQuery<Transaction[]>({
    queryKey: ['wallet-transactions', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const formatCurrency = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getTransactionTypeColor = (type: string) => {
    switch (type) {
      case 'deposit':
        return 'success';
      case 'withdrawal':
        return 'warning';
      case 'contest_entry':
        return 'neutral';
      case 'contest_win':
        return 'success';
      case 'bonus':
        return 'primary';
      default:
        return 'neutral';
    }
  };

  const getTransactionTypeIcon = (type: string) => {
    switch (type) {
      case 'deposit':
        return <TrendingUp />;
      case 'withdrawal':
        return <TrendingDown />;
      case 'contest_win':
        return <TrendingUp />;
      default:
        return <Info />;
    }
  };

  const getStatusColor = (status: string): 'success' | 'warning' | 'danger' | 'neutral' => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'pending':
      case 'processing':
        return 'warning';
      case 'failed':
      case 'cancelled':
        return 'danger';
      default:
        return 'neutral';
    }
  };

  const handleDeposit = async () => {
    // TODO: Integrate with Stripe/PayPal
    console.log('Deposit:', depositAmount, selectedPaymentMethod);
    setDepositModalOpen(false);
  };

  const handleWithdraw = async () => {
    // TODO: Integrate with Stripe/PayPal
    console.log('Withdraw:', withdrawAmount);
    setWithdrawModalOpen(false);
  };

  if (!user) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography>Please log in to view your wallet</Typography>
      </Box>
    );
  }

  if (walletLoading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* KYC Warning */}
      {!wallet?.kyc_verified && (
        <Alert
          color="warning"
          startDecorator={<Warning />}
          sx={{
            mb: 3,
            border: '2px solid #000',
            borderRadius: 0,
            bgcolor: '#FFC72C',
            color: '#000',
          }}
        >
          <Box>
            <Typography level="title-md" sx={{ fontWeight: 900, fontFamily: 'serif' }}>
              Verify Your Identity
            </Typography>
            <Typography level="body-sm" sx={{ fontWeight: 'bold', fontFamily: 'serif' }}>
              Complete identity verification to enable withdrawals. This is required by law for real-money gaming.
            </Typography>
            <Button
              size="sm"
              sx={{
                mt: 1,
                bgcolor: '#000',
                color: '#fff',
                borderRadius: 0,
                border: '2px solid #000',
                fontFamily: 'serif',
                fontWeight: 900,
              }}
            >
              Verify Identity
            </Button>
          </Box>
        </Alert>
      )}

      {/* Balance Cards */}
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 3 }}>
        {/* Total Balance */}
        <Card
          variant="outlined"
          sx={{
            flex: 1,
            border: '3px solid #000',
            borderRadius: 0,
            boxShadow: '4px 4px 0px #000',
            bgcolor: '#fff',
          }}
        >
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Box>
                <Typography level="body-sm" sx={{ fontFamily: 'serif', fontWeight: 700, textTransform: 'uppercase', mb: 0.5 }}>
                  Total Balance
                </Typography>
                <Typography level="h2" sx={{ fontFamily: 'serif', fontWeight: 900, fontSize: '2.5rem' }}>
                  ${wallet?.total_balance || '0.00'}
                </Typography>
              </Box>
              <AccountBalanceWallet sx={{ fontSize: 40, color: '#000' }} />
            </Stack>
          </CardContent>
        </Card>

        {/* Withdrawable Balance */}
        <Card
          variant="outlined"
          sx={{
            flex: 1,
            border: '3px solid #000',
            borderRadius: 0,
            boxShadow: '4px 4px 0px #000',
            bgcolor: '#16A34A',
            color: '#fff',
          }}
        >
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Box>
                <Typography level="body-sm" sx={{ fontFamily: 'serif', fontWeight: 700, textTransform: 'uppercase', mb: 0.5, color: '#fff' }}>
                  Withdrawable
                </Typography>
                <Typography level="h2" sx={{ fontFamily: 'serif', fontWeight: 900, fontSize: '2.5rem', color: '#fff' }}>
                  ${wallet?.withdrawable_balance || '0.00'}
                </Typography>
              </Box>
              <TrendingUp sx={{ fontSize: 40, color: '#fff' }} />
            </Stack>
          </CardContent>
        </Card>

        {/* Bonus Balance */}
        <Card
          variant="outlined"
          sx={{
            flex: 1,
            border: '3px solid #000',
            borderRadius: 0,
            boxShadow: '4px 4px 0px #000',
            bgcolor: '#FFC72C',
            color: '#000',
          }}
        >
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Box>
                <Typography level="body-sm" sx={{ fontFamily: 'serif', fontWeight: 700, textTransform: 'uppercase', mb: 0.5 }}>
                  Bonus
                </Typography>
                <Typography level="h2" sx={{ fontFamily: 'serif', fontWeight: 900, fontSize: '2.5rem' }}>
                  ${wallet?.bonus_balance || '0.00'}
                </Typography>
              </Box>
              <Info sx={{ fontSize: 40 }} />
            </Stack>
          </CardContent>
        </Card>
      </Stack>

      {/* Action Buttons */}
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <Button
          size="lg"
          startDecorator={<Add />}
          onClick={() => setDepositModalOpen(true)}
          sx={{
            flex: 1,
            borderRadius: 0,
            border: '3px solid #000',
            bgcolor: '#16A34A',
            color: '#fff',
            fontFamily: 'serif',
            fontWeight: 900,
            fontSize: '1.1rem',
            py: 1.5,
            '&:hover': {
              bgcolor: '#15803d',
              transform: 'translate(-2px, -2px)',
              boxShadow: '4px 4px 0px #000',
            },
          }}
        >
          Deposit
        </Button>
        <Button
          size="lg"
          startDecorator={<Remove />}
          onClick={() => setWithdrawModalOpen(true)}
          disabled={!wallet?.kyc_verified}
          sx={{
            flex: 1,
            borderRadius: 0,
            border: '3px solid #000',
            bgcolor: '#000',
            color: '#fff',
            fontFamily: 'serif',
            fontWeight: 900,
            fontSize: '1.1rem',
            py: 1.5,
            '&:hover': {
              bgcolor: '#333',
              transform: 'translate(-2px, -2px)',
              boxShadow: '4px 4px 0px #000',
            },
            '&:disabled': {
              bgcolor: '#666',
              color: '#999',
            },
          }}
        >
          Withdraw
        </Button>
      </Stack>

      {/* Transaction History */}
      <Box>
        <Typography level="h3" sx={{ fontFamily: 'serif', fontWeight: 900, mb: 2, textTransform: 'uppercase' }}>
          Transaction History
        </Typography>
        
        {transactionsLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : transactions && transactions.length > 0 ? (
          <Sheet
            variant="outlined"
            sx={{
              border: '3px solid #000',
              borderRadius: 0,
              boxShadow: '4px 4px 0px #000',
              overflow: 'auto',
            }}
          >
            <Table
              stickyHeader
              sx={{
                '& thead th': {
                  bgcolor: '#000',
                  color: '#fff',
                  fontFamily: 'serif',
                  fontWeight: 900,
                  textTransform: 'uppercase',
                  borderBottom: '3px solid #000',
                  fontSize: '0.75rem',
                },
                '& tbody td': {
                  borderBottom: '2px solid #000',
                  fontFamily: 'serif',
                  py: 1.5,
                },
                '& tbody tr:hover': {
                  bgcolor: '#f0f0f0',
                },
                '& tbody tr:last-child td': {
                  borderBottom: 'none',
                },
              }}
            >
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td>
                      <Typography level="body-sm" sx={{ fontFamily: 'serif', fontWeight: 'bold' }}>
                        {formatDate(transaction.created_at)}
                      </Typography>
                    </td>
                    <td>
                      <Chip
                        size="sm"
                        color={getTransactionTypeColor(transaction.type)}
                        startDecorator={getTransactionTypeIcon(transaction.type)}
                        sx={{
                          borderRadius: 0,
                          fontFamily: 'serif',
                          fontWeight: 'bold',
                          textTransform: 'uppercase',
                          fontSize: '0.7rem',
                        }}
                      >
                        {transaction.type.replace('_', ' ')}
                      </Chip>
                    </td>
                    <td>
                      <Typography level="body-sm" sx={{ fontFamily: 'serif', fontWeight: 'bold' }}>
                        {transaction.description}
                      </Typography>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Typography
                        level="body-md"
                        sx={{
                          fontFamily: 'serif',
                          fontWeight: 900,
                          color: transaction.amount_cents > 0 ? '#16A34A' : '#ef4444',
                        }}
                      >
                        {transaction.amount_cents > 0 ? '+' : ''}
                        {formatCurrency(transaction.amount_cents)}
                      </Typography>
                      {transaction.fee_cents > 0 && (
                        <Typography level="body-xs" sx={{ color: '#666', fontFamily: 'serif' }}>
                          Fee: {formatCurrency(transaction.fee_cents)}
                        </Typography>
                      )}
                    </td>
                    <td>
                      <Chip
                        size="sm"
                        color={getStatusColor(transaction.status)}
                        sx={{
                          borderRadius: 0,
                          fontFamily: 'serif',
                          fontWeight: 'bold',
                          fontSize: '0.7rem',
                        }}
                      >
                        {transaction.status}
                      </Chip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Sheet>
        ) : (
          <Card
            variant="outlined"
            sx={{
              border: '2px solid #000',
              borderRadius: 0,
              p: 4,
              textAlign: 'center',
            }}
          >
            <Typography sx={{ fontFamily: 'serif', fontWeight: 'bold', color: '#666' }}>
              No transactions yet
            </Typography>
          </Card>
        )}
      </Box>

      {/* Deposit Modal */}
      <Modal open={depositModalOpen} onClose={() => setDepositModalOpen(false)}>
        <ModalDialog
          sx={{
            maxWidth: 500,
            border: '3px solid #000',
            borderRadius: 0,
            boxShadow: '6px 6px 0px #000',
            p: 0,
          }}
        >
          <Box sx={{ bgcolor: '#000', color: '#fff', p: 2 }}>
            <Typography level="h4" sx={{ fontFamily: 'serif', fontWeight: 900 }}>
              Deposit Funds
            </Typography>
          </Box>
          <ModalClose sx={{ top: 12, right: 12, bgcolor: '#fff', color: '#000', border: '2px solid #000', borderRadius: 0 }} />
          
          <Box sx={{ p: 3 }}>
            <Stack spacing={3}>
              <FormControl>
                <FormLabel sx={{ fontFamily: 'serif', fontWeight: 700, color: '#000' }}>Amount</FormLabel>
                <Input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  startDecorator="$"
                  placeholder="0.00"
                  sx={{
                    fontFamily: 'serif',
                    fontWeight: 'bold',
                    fontSize: '1.5rem',
                    border: '2px solid #000',
                    borderRadius: 0,
                    '&:focus-within': {
                      outline: '2px solid #000',
                      outlineOffset: '2px',
                    },
                  }}
                />
              </FormControl>

              <FormControl>
                <FormLabel sx={{ fontFamily: 'serif', fontWeight: 700, color: '#000' }}>Payment Method</FormLabel>
                <Select
                  value={selectedPaymentMethod}
                  onChange={(_, value) => setSelectedPaymentMethod(value as string)}
                  sx={{
                    fontFamily: 'serif',
                    border: '2px solid #000',
                    borderRadius: 0,
                  }}
                >
                  <Option value="stripe_card">Credit/Debit Card</Option>
                  <Option value="stripe_ach">Bank Account (ACH)</Option>
                  <Option value="paypal">PayPal</Option>
                </Select>
              </FormControl>

              <Alert
                color="primary"
                startDecorator={<Info />}
                sx={{ border: '2px solid #000', borderRadius: 0 }}
              >
                <Typography level="body-sm" sx={{ fontFamily: 'serif', fontWeight: 'bold' }}>
                  Deposits are instant. A 2.9% + $0.30 processing fee applies.
                </Typography>
              </Alert>

              <Button
                size="lg"
                onClick={handleDeposit}
                disabled={!depositAmount || parseFloat(depositAmount) <= 0}
                sx={{
                  bgcolor: '#16A34A',
                  color: '#fff',
                  border: '3px solid #000',
                  borderRadius: 0,
                  fontFamily: 'serif',
                  fontWeight: 900,
                  fontSize: '1.1rem',
                  py: 1.5,
                  '&:hover': {
                    bgcolor: '#15803d',
                  },
                }}
              >
                Deposit ${depositAmount || '0.00'}
              </Button>
            </Stack>
          </Box>
        </ModalDialog>
      </Modal>

      {/* Withdraw Modal */}
      <Modal open={withdrawModalOpen} onClose={() => setWithdrawModalOpen(false)}>
        <ModalDialog
          sx={{
            maxWidth: 500,
            border: '3px solid #000',
            borderRadius: 0,
            boxShadow: '6px 6px 0px #000',
            p: 0,
          }}
        >
          <Box sx={{ bgcolor: '#000', color: '#fff', p: 2 }}>
            <Typography level="h4" sx={{ fontFamily: 'serif', fontWeight: 900 }}>
              Withdraw Funds
            </Typography>
          </Box>
          <ModalClose sx={{ top: 12, right: 12, bgcolor: '#fff', color: '#000', border: '2px solid #000', borderRadius: 0 }} />
          
          <Box sx={{ p: 3 }}>
            <Stack spacing={3}>
              <Box sx={{ p: 2, border: '2px solid #000', bgcolor: '#f0f0f0' }}>
                <Typography level="body-sm" sx={{ fontFamily: 'serif', fontWeight: 700, mb: 0.5 }}>
                  Available to Withdraw
                </Typography>
                <Typography level="h3" sx={{ fontFamily: 'serif', fontWeight: 900 }}>
                  ${wallet?.withdrawable_balance || '0.00'}
                </Typography>
              </Box>

              <FormControl>
                <FormLabel sx={{ fontFamily: 'serif', fontWeight: 700, color: '#000' }}>Amount</FormLabel>
                <Input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  startDecorator="$"
                  placeholder="0.00"
                  sx={{
                    fontFamily: 'serif',
                    fontWeight: 'bold',
                    fontSize: '1.5rem',
                    border: '2px solid #000',
                    borderRadius: 0,
                  }}
                />
              </FormControl>

              <Alert
                color="warning"
                startDecorator={<Warning />}
                sx={{ border: '2px solid #000', borderRadius: 0 }}
              >
                <Typography level="body-sm" sx={{ fontFamily: 'serif', fontWeight: 'bold' }}>
                  Withdrawals take 3-5 business days. Minimum withdrawal: $10.00
                </Typography>
              </Alert>

              <Button
                size="lg"
                onClick={handleWithdraw}
                disabled={!withdrawAmount || parseFloat(withdrawAmount) < 10}
                sx={{
                  bgcolor: '#000',
                  color: '#fff',
                  border: '3px solid #000',
                  borderRadius: 0,
                  fontFamily: 'serif',
                  fontWeight: 900,
                  fontSize: '1.1rem',
                  py: 1.5,
                  '&:hover': {
                    bgcolor: '#333',
                  },
                }}
              >
                Withdraw ${withdrawAmount || '0.00'}
              </Button>
            </Stack>
          </Box>
        </ModalDialog>
      </Modal>
    </Box>
  );
}

