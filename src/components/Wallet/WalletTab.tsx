import { useState } from 'react';
import {
  Box,
  Typography,
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
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getTransactionTypeIcon = (type: string) => {
    switch (type) {
      case 'deposit':
        return <TrendingUp fontSize="small" />;
      case 'withdrawal':
        return <TrendingDown fontSize="small" />;
      case 'contest_win':
        return <TrendingUp fontSize="small" />;
      default:
        return <Info fontSize="small" />;
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
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography sx={{ color: '#666' }}>
          Please log in to view your wallet
        </Typography>
      </Box>
    );
  }

  if (walletLoading) {
    return (
      <Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress size="sm" />
      </Box>
    );
  }

  return (
    <Stack spacing={2}>
      {/* KYC Warning */}
      {!wallet?.kyc_verified && (
        <Alert
          color="warning"
          startDecorator={<Warning />}
          variant="soft"
          sx={{
            bgcolor: 'rgba(234, 179, 8, 0.2)',
            color: '#FFC72C',
            fontSize: '0.8rem',
          }}
        >
          <Box>
            <Typography level="title-sm" sx={{ fontWeight: 700, mb: 0.5 }}>
              Verify Your Identity
            </Typography>
            <Typography level="body-xs">
              Complete identity verification to enable withdrawals.
            </Typography>
            <Button
              size="sm"
              sx={{
                mt: 1,
                bgcolor: '#FFC72C',
                color: '#000',
                fontSize: '0.75rem',
                fontWeight: 600,
                '&:hover': {
                  bgcolor: '#FFD700',
                }
              }}
            >
              Verify Identity
            </Button>
          </Box>
        </Alert>
      )}

      {/* Balance Cards - Compact */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        <Box
          sx={{
            flex: 1,
            bgcolor: 'rgba(255, 199, 44, 0.1)',
            p: 1.5,
            borderRadius: '8px',
            border: '1px solid rgba(255, 199, 44, 0.3)',
          }}
        >
          <Typography level="body-xs" sx={{ color: '#FFC72C', fontWeight: 600, mb: 0.5 }}>
                  Total Balance
                </Typography>
          <Typography level="h3" sx={{ color: '#FFC72C', fontWeight: 700, fontSize: '1.5rem' }}>
                  ${wallet?.total_balance || '0.00'}
                </Typography>
              </Box>

        <Box
          sx={{
            flex: 1,
            bgcolor: 'rgba(34, 197, 94, 0.1)',
            p: 1.5,
            borderRadius: '8px',
            border: '1px solid rgba(34, 197, 94, 0.3)',
          }}
        >
          <Typography level="body-xs" sx={{ color: '#22c55e', fontWeight: 600, mb: 0.5 }}>
                  Withdrawable
                </Typography>
          <Typography level="h3" sx={{ color: '#22c55e', fontWeight: 700, fontSize: '1.5rem' }}>
                  ${wallet?.withdrawable_balance || '0.00'}
                </Typography>
              </Box>

        <Box
          sx={{
            flex: 1,
            bgcolor: 'rgba(59, 130, 246, 0.1)',
            p: 1.5,
            borderRadius: '8px',
            border: '1px solid rgba(59, 130, 246, 0.3)',
          }}
        >
          <Typography level="body-xs" sx={{ color: '#3b82f6', fontWeight: 600, mb: 0.5 }}>
                  Bonus
                </Typography>
          <Typography level="h3" sx={{ color: '#3b82f6', fontWeight: 700, fontSize: '1.5rem' }}>
                  ${wallet?.bonus_balance || '0.00'}
                </Typography>
              </Box>
      </Stack>

      {/* Action Buttons - Compact */}
      <Stack direction="row" spacing={1.5}>
        <Button
          size="sm"
          startDecorator={<Add />}
          onClick={() => setDepositModalOpen(true)}
          sx={{
            flex: 1,
            bgcolor: '#22c55e',
            color: '#fff',
            fontWeight: 600,
            borderRadius: '8px',
            '&:hover': {
              bgcolor: '#16a34a',
              transform: 'translateY(-1px)',
              boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)',
            },
          }}
        >
          Deposit
        </Button>
        <Button
          size="sm"
          startDecorator={<Remove />}
          onClick={() => setWithdrawModalOpen(true)}
          disabled={!wallet?.kyc_verified}
          sx={{
            flex: 1,
            bgcolor: '#ffffff',
            color: '#333',
            border: '1px solid #d0d0d0',
            fontWeight: 600,
            borderRadius: '8px',
            '&:hover': {
              bgcolor: '#f5f5f5',
              borderColor: '#b0b0b0',
            },
            '&:disabled': {
              bgcolor: '#f5f5f5',
              color: '#999',
              borderColor: '#e0e0e0',
            },
          }}
        >
          Withdraw
        </Button>
      </Stack>

      {/* Transaction History */}
      <Box>
        <Typography level="title-sm" sx={{ color: '#000', fontWeight: 700, mb: 1.5 }}>
          Recent Transactions
        </Typography>
        
        {transactionsLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress size="sm" />
          </Box>
        ) : transactions && transactions.length > 0 ? (
          <Sheet
            variant="plain"
            sx={{
              borderRadius: '8px',
              overflow: 'hidden',
              bgcolor: '#ffffff',
              border: '1px solid #e0e0e0',
            }}
          >
            <Table
              size="sm"
              sx={{
                '& thead th': {
                  bgcolor: '#f8f9fa',
                  color: '#000',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  py: 1.5,
                  borderBottom: '1px solid #e0e0e0',
                },
                '& tbody td': {
                  py: 1.5,
                  fontSize: '0.875rem',
                  color: '#000',
                },
                '& tbody tr:hover': {
                  bgcolor: '#f8f9fa',
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
                      <Typography level="body-xs" sx={{ color: '#666' }}>
                        {formatDate(transaction.created_at)}
                      </Typography>
                    </td>
                    <td>
                      <Chip
                        size="sm"
                        variant="soft"
                        startDecorator={getTransactionTypeIcon(transaction.type)}
                        sx={{
                          fontSize: '0.75rem',
                          bgcolor: transaction.type === 'deposit' || transaction.type === 'contest_win'
                            ? 'rgba(34, 197, 94, 0.15)'
                            : 'rgba(255, 199, 44, 0.15)',
                          color: transaction.type === 'deposit' || transaction.type === 'contest_win'
                            ? '#16a34a'
                            : '#d97706',
                          fontWeight: 600,
                        }}
                      >
                        {transaction.type.replace('_', ' ')}
                      </Chip>
                    </td>
                    <td>
                      <Typography level="body-sm" sx={{ color: '#000' }}>
                        {transaction.description}
                      </Typography>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Typography
                        level="body-sm"
                        sx={{
                          fontWeight: 600,
                          color: transaction.amount_cents > 0 ? '#16a34a' : '#ef4444',
                        }}
                      >
                        {transaction.amount_cents > 0 ? '+' : ''}
                        {formatCurrency(transaction.amount_cents)}
                      </Typography>
                      {transaction.fee_cents > 0 && (
                        <Typography level="body-xs" sx={{ color: '#666' }}>
                          Fee: {formatCurrency(transaction.fee_cents)}
                        </Typography>
                      )}
                    </td>
                    <td>
                      <Chip
                        size="sm"
                        variant="soft"
                        sx={{
                          fontSize: '0.75rem',
                          bgcolor: transaction.status === 'completed'
                            ? 'rgba(34, 197, 94, 0.15)'
                            : transaction.status === 'pending'
                            ? 'rgba(234, 179, 8, 0.15)'
                            : 'rgba(239, 68, 68, 0.15)',
                          color: transaction.status === 'completed'
                            ? '#16a34a'
                            : transaction.status === 'pending'
                            ? '#d97706'
                            : '#dc2626',
                          fontWeight: 600,
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
          <Box sx={{ textAlign: 'center', py: 3 }}>
            <Typography level="body-sm" sx={{ color: '#666' }}>
              No transactions yet
            </Typography>
          </Box>
        )}
      </Box>

      {/* Deposit Modal */}
      <Modal open={depositModalOpen} onClose={() => setDepositModalOpen(false)}>
        <ModalDialog
          sx={{
            maxWidth: 400,
            bgcolor: '#ffffff',
            border: '1px solid #e0e0e0',
            borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          }}
        >
          <Typography level="title-md" sx={{ color: '#000', fontWeight: 700, mb: 2 }}>
              Deposit Funds
            </Typography>
          <ModalClose sx={{ color: '#666' }} />
          
          <Stack spacing={2}>
            <FormControl size="sm">
              <FormLabel sx={{ color: '#000', fontSize: '0.875rem', fontWeight: 600 }}>
                Amount
              </FormLabel>
                <Input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  startDecorator="$"
                  placeholder="0.00"
                size="sm"
                  sx={{
                  bgcolor: '#ffffff !important',
                  color: '#000000 !important',
                  border: '1px solid #d0d0d0 !important',
                  borderRadius: '8px',
                  fontSize: '1.2rem',
                  '& input': {
                    color: '#000000 !important',
                  },
                  '& input::placeholder': {
                    color: '#666666 !important',
                  },
                  '&:focus-within': {
                    borderColor: '#6a59ff !important',
                    outline: '2px solid rgba(106, 89, 255, 0.2)',
                    bgcolor: '#ffffff !important',
                    '& input': {
                      color: '#000000 !important',
                    },
                  },
                  }}
                  className="force-light"
                />
              </FormControl>

            <FormControl size="sm">
              <FormLabel sx={{ color: '#000', fontSize: '0.875rem', fontWeight: 600 }}>
                Payment Method
              </FormLabel>
                <Select
                  value={selectedPaymentMethod}
                  onChange={(_, value) => setSelectedPaymentMethod(value as string)}
                size="sm"
                  sx={{
                  bgcolor: '#ffffff !important',
                  color: '#000000 !important',
                  border: '1px solid #d0d0d0 !important',
                  borderRadius: '8px',
                  '& select': {
                    color: '#000000 !important',
                  },
                  '&:focus-within': {
                    borderColor: '#6a59ff !important',
                    outline: '2px solid rgba(106, 89, 255, 0.2)',
                    bgcolor: '#ffffff !important',
                  },
                  }}
                  className="force-light"
                >
                  <Option value="stripe_card">Credit/Debit Card</Option>
                  <Option value="stripe_ach">Bank Account (ACH)</Option>
                  <Option value="paypal">PayPal</Option>
                </Select>
              </FormControl>

              <Alert
                color="primary"
              variant="soft"
                startDecorator={<Info />}
              sx={{
                bgcolor: 'rgba(59, 130, 246, 0.1)',
                fontSize: '0.75rem',
              }}
              >
                  Deposits are instant. A 2.9% + $0.30 processing fee applies.
              </Alert>

              <Button
              size="sm"
                onClick={handleDeposit}
                disabled={!depositAmount || parseFloat(depositAmount) <= 0}
                sx={{
                bgcolor: '#22c55e',
                  color: '#fff',
                fontWeight: 600,
                borderRadius: '8px',
                  '&:hover': {
                  bgcolor: '#16a34a',
                  transform: 'translateY(-1px)',
                  boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)',
                  },
                  '&:disabled': {
                    bgcolor: '#f5f5f5',
                    color: '#999',
                  },
                }}
              >
                Deposit ${depositAmount || '0.00'}
              </Button>
            </Stack>
        </ModalDialog>
      </Modal>

      {/* Withdraw Modal */}
      <Modal open={withdrawModalOpen} onClose={() => setWithdrawModalOpen(false)}>
        <ModalDialog
          sx={{
            maxWidth: 400,
            bgcolor: '#ffffff',
            border: '1px solid #e0e0e0',
            borderRadius: '12px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          }}
        >
          <Typography level="title-md" sx={{ color: '#000', fontWeight: 700, mb: 2 }}>
              Withdraw Funds
            </Typography>
          <ModalClose sx={{ color: '#666' }} />
          
          <Stack spacing={2}>
            <Box sx={{ 
              p: 1.5, 
              bgcolor: 'rgba(34, 197, 94, 0.1)', 
              borderRadius: '8px',
              border: '1px solid rgba(34, 197, 94, 0.3)',
            }}>
              <Typography level="body-xs" sx={{ color: '#16a34a', fontWeight: 600, mb: 0.5 }}>
                  Available to Withdraw
                </Typography>
              <Typography level="h3" sx={{ color: '#16a34a', fontWeight: 700 }}>
                  ${wallet?.withdrawable_balance || '0.00'}
                </Typography>
              </Box>

            <FormControl size="sm">
              <FormLabel sx={{ color: '#000', fontSize: '0.875rem', fontWeight: 600 }}>
                Amount
              </FormLabel>
                <Input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  startDecorator="$"
                  placeholder="0.00"
                size="sm"
                  sx={{
                  bgcolor: '#ffffff !important',
                  color: '#000000 !important',
                  border: '1px solid #d0d0d0 !important',
                  borderRadius: '8px',
                  fontSize: '1.2rem',
                  '& input': {
                    color: '#000000 !important',
                  },
                  '& input::placeholder': {
                    color: '#666666 !important',
                  },
                  '&:focus-within': {
                    borderColor: '#6a59ff !important',
                    outline: '2px solid rgba(106, 89, 255, 0.2)',
                    bgcolor: '#ffffff !important',
                    '& input': {
                      color: '#000000 !important',
                    },
                  },
                  }}
                  className="force-light"
                />
              </FormControl>

              <Alert
                color="warning"
              variant="soft"
                startDecorator={<Warning />}
              sx={{
                bgcolor: 'rgba(234, 179, 8, 0.1)',
                fontSize: '0.75rem',
              }}
              >
                  Withdrawals take 3-5 business days. Minimum withdrawal: $10.00
              </Alert>

              <Button
              size="sm"
                onClick={handleWithdraw}
                disabled={!withdrawAmount || parseFloat(withdrawAmount) < 10}
                sx={{
                bgcolor: '#FFC72C',
                color: '#000',
                fontWeight: 600,
                borderRadius: '8px',
                  '&:hover': {
                  bgcolor: '#FFD700',
                  transform: 'translateY(-1px)',
                  boxShadow: '0 4px 12px rgba(255, 199, 44, 0.3)',
                  },
                  '&:disabled': {
                    bgcolor: '#f5f5f5',
                    color: '#999',
                  },
                }}
              >
                Withdraw ${withdrawAmount || '0.00'}
              </Button>
            </Stack>
        </ModalDialog>
      </Modal>
    </Stack>
  );
}
