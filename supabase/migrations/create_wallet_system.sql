-- ============================================================================
-- WALLET SYSTEM
-- ============================================================================
-- Comprehensive wallet and transaction management system
-- Supports deposits, withdrawals, contest entries, winnings, and more
-- ============================================================================

-- ============================================================================
-- 1. USER WALLETS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User Reference
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Balances (in cents to avoid floating point issues)
  balance_cents BIGINT DEFAULT 0 NOT NULL,
  bonus_balance_cents BIGINT DEFAULT 0 NOT NULL, -- Promotional/bonus money
  withdrawable_balance_cents BIGINT DEFAULT 0 NOT NULL, -- Real money that can be withdrawn
  pending_balance_cents BIGINT DEFAULT 0 NOT NULL, -- Money in active contests
  
  -- Lifetime Stats
  total_deposited_cents BIGINT DEFAULT 0 NOT NULL,
  total_withdrawn_cents BIGINT DEFAULT 0 NOT NULL,
  total_won_cents BIGINT DEFAULT 0 NOT NULL,
  total_lost_cents BIGINT DEFAULT 0 NOT NULL,
  total_bonus_received_cents BIGINT DEFAULT 0 NOT NULL,
  
  -- Account Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed')),
  kyc_verified BOOLEAN DEFAULT false,
  kyc_verified_at TIMESTAMPTZ,
  kyc_documents_submitted BOOLEAN DEFAULT false,
  
  -- Payment Methods
  has_payment_method BOOLEAN DEFAULT false,
  stripe_customer_id TEXT, -- Stripe Customer ID
  paypal_email TEXT, -- PayPal email for payouts
  
  -- Limits and Restrictions
  daily_deposit_limit_cents BIGINT DEFAULT 50000, -- $500 default
  weekly_deposit_limit_cents BIGINT DEFAULT 200000, -- $2000 default
  monthly_deposit_limit_cents BIGINT DEFAULT 500000, -- $5000 default
  withdrawal_pending BOOLEAN DEFAULT false,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  notes TEXT, -- Admin notes
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  last_deposit_at TIMESTAMPTZ,
  last_withdrawal_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT positive_balance CHECK (balance_cents >= 0),
  CONSTRAINT positive_bonus_balance CHECK (bonus_balance_cents >= 0),
  CONSTRAINT positive_withdrawable CHECK (withdrawable_balance_cents >= 0),
  CONSTRAINT positive_pending CHECK (pending_balance_cents >= 0),
  CONSTRAINT valid_status CHECK (status IN ('active', 'suspended', 'closed'))
);

-- Indexes
CREATE INDEX idx_user_wallets_user_id ON user_wallets(user_id);
CREATE INDEX idx_user_wallets_status ON user_wallets(status);
CREATE INDEX idx_user_wallets_kyc_verified ON user_wallets(kyc_verified);
CREATE INDEX idx_user_wallets_balance ON user_wallets(balance_cents DESC);
CREATE INDEX idx_user_wallets_stripe_customer ON user_wallets(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- ============================================================================
-- 2. WALLET TRANSACTIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User & Wallet
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES user_wallets(id) ON DELETE CASCADE,
  
  -- Transaction Details
  type TEXT NOT NULL CHECK (type IN (
    'deposit',
    'withdrawal',
    'contest_entry',
    'contest_refund',
    'contest_win',
    'bonus',
    'bonus_expiration',
    'admin_adjustment',
    'referral_bonus',
    'promotional_credit'
  )),
  
  -- Amounts (in cents)
  amount_cents BIGINT NOT NULL,
  bonus_amount_cents BIGINT DEFAULT 0,
  fee_cents BIGINT DEFAULT 0,
  net_amount_cents BIGINT GENERATED ALWAYS AS (amount_cents - fee_cents) STORED,
  
  -- Balances After Transaction (snapshot)
  balance_after_cents BIGINT NOT NULL,
  withdrawable_balance_after_cents BIGINT NOT NULL,
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',
    'processing',
    'completed',
    'failed',
    'cancelled',
    'refunded'
  )),
  
  -- Payment Method
  payment_method TEXT CHECK (payment_method IN (
    'stripe_card',
    'stripe_ach',
    'paypal',
    'bank_transfer',
    'crypto',
    'admin',
    'system'
  )),
  
  -- External References
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  paypal_transaction_id TEXT,
  bank_transaction_id TEXT,
  related_contest_id UUID REFERENCES dfs_pools(id) ON DELETE SET NULL,
  related_entry_id UUID REFERENCES dfs_entries(id) ON DELETE SET NULL,
  
  -- Description
  description TEXT NOT NULL,
  admin_note TEXT,
  
  -- Error Handling
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT valid_amount CHECK (amount_cents != 0)
);

-- Indexes
CREATE INDEX idx_wallet_transactions_user_id ON wallet_transactions(user_id);
CREATE INDEX idx_wallet_transactions_wallet_id ON wallet_transactions(wallet_id);
CREATE INDEX idx_wallet_transactions_type ON wallet_transactions(type);
CREATE INDEX idx_wallet_transactions_status ON wallet_transactions(status);
CREATE INDEX idx_wallet_transactions_created_at ON wallet_transactions(created_at DESC);
CREATE INDEX idx_wallet_transactions_stripe_payment ON wallet_transactions(stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;
CREATE INDEX idx_wallet_transactions_contest ON wallet_transactions(related_contest_id) WHERE related_contest_id IS NOT NULL;
CREATE INDEX idx_wallet_transactions_entry ON wallet_transactions(related_entry_id) WHERE related_entry_id IS NOT NULL;

-- ============================================================================
-- 3. WITHDRAWAL REQUESTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- User & Wallet
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES user_wallets(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES wallet_transactions(id) ON DELETE SET NULL,
  
  -- Request Details
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  fee_cents BIGINT DEFAULT 0,
  net_amount_cents BIGINT GENERATED ALWAYS AS (amount_cents - fee_cents) STORED,
  
  -- Method
  method TEXT NOT NULL CHECK (method IN (
    'stripe_transfer',
    'paypal',
    'bank_transfer',
    'check'
  )),
  
  -- Payout Details
  stripe_account_id TEXT,
  paypal_email TEXT,
  bank_account_last4 TEXT,
  bank_routing_number TEXT, -- Encrypted
  bank_account_number TEXT, -- Encrypted
  mailing_address TEXT,
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',
    'approved',
    'processing',
    'completed',
    'rejected',
    'cancelled'
  )),
  
  -- Review
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  admin_note TEXT,
  
  -- External References
  stripe_payout_id TEXT,
  paypal_payout_id TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  approved_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT minimum_withdrawal CHECK (amount_cents >= 1000) -- $10 minimum
);

-- Indexes
CREATE INDEX idx_withdrawal_requests_user_id ON withdrawal_requests(user_id);
CREATE INDEX idx_withdrawal_requests_wallet_id ON withdrawal_requests(wallet_id);
CREATE INDEX idx_withdrawal_requests_status ON withdrawal_requests(status);
CREATE INDEX idx_withdrawal_requests_created_at ON withdrawal_requests(created_at DESC);
CREATE INDEX idx_withdrawal_requests_pending ON withdrawal_requests(status) WHERE status = 'pending';

-- ============================================================================
-- 4. DEPOSIT LIMITS TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.deposit_limit_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_id UUID NOT NULL REFERENCES user_wallets(id) ON DELETE CASCADE,
  
  -- Tracking Period
  period_type TEXT NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly')),
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  
  -- Amounts
  total_deposited_cents BIGINT DEFAULT 0 NOT NULL,
  limit_cents BIGINT NOT NULL,
  
  -- Status
  limit_reached BOOLEAN DEFAULT false,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_deposit_limit_tracking_user_id ON deposit_limit_tracking(user_id);
CREATE INDEX idx_deposit_limit_tracking_period ON deposit_limit_tracking(period_type, period_start, period_end);
CREATE UNIQUE INDEX idx_deposit_limit_tracking_unique ON deposit_limit_tracking(user_id, period_type, period_start);

-- ============================================================================
-- 5. AUTO-CREATE WALLET TRIGGER
-- ============================================================================

CREATE OR REPLACE FUNCTION create_wallet_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_wallets (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created_create_wallet
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_wallet_for_new_user();

-- ============================================================================
-- 6. UPDATE TIMESTAMP TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_wallet_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_wallet_updated_at
  BEFORE UPDATE ON user_wallets
  FOR EACH ROW
  EXECUTE FUNCTION update_wallet_updated_at();

CREATE TRIGGER set_wallet_transaction_updated_at
  BEFORE UPDATE ON wallet_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_wallet_updated_at();

CREATE TRIGGER set_withdrawal_request_updated_at
  BEFORE UPDATE ON withdrawal_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_wallet_updated_at();

-- ============================================================================
-- 7. HELPER FUNCTIONS
-- ============================================================================

-- Get user wallet balance
CREATE OR REPLACE FUNCTION get_user_wallet_balance(p_user_id UUID)
RETURNS TABLE (
  total_balance DECIMAL(12,2),
  withdrawable_balance DECIMAL(12,2),
  bonus_balance DECIMAL(12,2),
  pending_balance DECIMAL(12,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (balance_cents::DECIMAL / 100) as total_balance,
    (withdrawable_balance_cents::DECIMAL / 100) as withdrawable_balance,
    (bonus_balance_cents::DECIMAL / 100) as bonus_balance,
    (pending_balance_cents::DECIMAL / 100) as pending_balance
  FROM user_wallets
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user can deposit
CREATE OR REPLACE FUNCTION can_user_deposit(
  p_user_id UUID,
  p_amount_cents BIGINT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_wallet_status TEXT;
  v_daily_total BIGINT;
  v_daily_limit BIGINT;
BEGIN
  -- Check wallet status
  SELECT status, daily_deposit_limit_cents
  INTO v_wallet_status, v_daily_limit
  FROM user_wallets
  WHERE user_id = p_user_id;
  
  IF v_wallet_status != 'active' THEN
    RETURN false;
  END IF;
  
  -- Check daily limit
  SELECT COALESCE(SUM(amount_cents), 0)
  INTO v_daily_total
  FROM wallet_transactions
  WHERE user_id = p_user_id
    AND type = 'deposit'
    AND status = 'completed'
    AND created_at >= NOW() - INTERVAL '24 hours';
  
  IF (v_daily_total + p_amount_cents) > v_daily_limit THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user can withdraw
CREATE OR REPLACE FUNCTION can_user_withdraw(
  p_user_id UUID,
  p_amount_cents BIGINT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_withdrawable_balance BIGINT;
  v_wallet_status TEXT;
  v_kyc_verified BOOLEAN;
  v_pending_withdrawal BOOLEAN;
BEGIN
  SELECT 
    withdrawable_balance_cents,
    status,
    kyc_verified,
    withdrawal_pending
  INTO 
    v_withdrawable_balance,
    v_wallet_status,
    v_kyc_verified,
    v_pending_withdrawal
  FROM user_wallets
  WHERE user_id = p_user_id;
  
  -- Check all conditions
  IF v_wallet_status != 'active' THEN
    RETURN false;
  END IF;
  
  IF NOT v_kyc_verified THEN
    RETURN false;
  END IF;
  
  IF v_pending_withdrawal THEN
    RETURN false;
  END IF;
  
  IF v_withdrawable_balance < p_amount_cents THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Process contest entry (deduct from balance, add to pending)
CREATE OR REPLACE FUNCTION process_contest_entry(
  p_user_id UUID,
  p_entry_fee_cents BIGINT,
  p_contest_id UUID,
  p_entry_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_wallet_id UUID;
  v_withdrawable_balance BIGINT;
  v_bonus_balance BIGINT;
  v_bonus_used BIGINT := 0;
  v_real_money_used BIGINT := 0;
  v_transaction_id UUID;
BEGIN
  -- Get wallet and balances
  SELECT id, withdrawable_balance_cents, bonus_balance_cents
  INTO v_wallet_id, v_withdrawable_balance, v_bonus_balance
  FROM user_wallets
  WHERE user_id = p_user_id
  FOR UPDATE;
  
  -- Check if user has enough funds
  IF (v_withdrawable_balance + v_bonus_balance) < p_entry_fee_cents THEN
    RAISE EXCEPTION 'Insufficient funds';
  END IF;
  
  -- Use bonus money first, then real money
  IF v_bonus_balance >= p_entry_fee_cents THEN
    v_bonus_used := p_entry_fee_cents;
  ELSE
    v_bonus_used := v_bonus_balance;
    v_real_money_used := p_entry_fee_cents - v_bonus_balance;
  END IF;
  
  -- Update wallet
  UPDATE user_wallets
  SET 
    balance_cents = balance_cents - p_entry_fee_cents,
    withdrawable_balance_cents = withdrawable_balance_cents - v_real_money_used,
    bonus_balance_cents = bonus_balance_cents - v_bonus_used,
    pending_balance_cents = pending_balance_cents + p_entry_fee_cents,
    updated_at = now()
  WHERE id = v_wallet_id;
  
  -- Create transaction record
  INSERT INTO wallet_transactions (
    user_id,
    wallet_id,
    type,
    amount_cents,
    bonus_amount_cents,
    status,
    balance_after_cents,
    withdrawable_balance_after_cents,
    description,
    related_contest_id,
    related_entry_id
  ) VALUES (
    p_user_id,
    v_wallet_id,
    'contest_entry',
    -p_entry_fee_cents,
    -v_bonus_used,
    'completed',
    (SELECT balance_cents FROM user_wallets WHERE id = v_wallet_id),
    (SELECT withdrawable_balance_cents FROM user_wallets WHERE id = v_wallet_id),
    'Contest entry fee',
    p_contest_id,
    p_entry_id
  )
  RETURNING id INTO v_transaction_id;
  
  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Process contest win (move from pending, add to withdrawable)
CREATE OR REPLACE FUNCTION process_contest_win(
  p_user_id UUID,
  p_prize_amount_cents BIGINT,
  p_entry_fee_cents BIGINT,
  p_contest_id UUID,
  p_entry_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_wallet_id UUID;
  v_transaction_id UUID;
BEGIN
  -- Get wallet
  SELECT id INTO v_wallet_id
  FROM user_wallets
  WHERE user_id = p_user_id
  FOR UPDATE;
  
  -- Update wallet (remove from pending, add prize to withdrawable)
  UPDATE user_wallets
  SET 
    balance_cents = balance_cents - p_entry_fee_cents + p_prize_amount_cents,
    withdrawable_balance_cents = withdrawable_balance_cents + p_prize_amount_cents,
    pending_balance_cents = pending_balance_cents - p_entry_fee_cents,
    total_won_cents = total_won_cents + p_prize_amount_cents,
    updated_at = now()
  WHERE id = v_wallet_id;
  
  -- Create transaction record
  INSERT INTO wallet_transactions (
    user_id,
    wallet_id,
    type,
    amount_cents,
    status,
    balance_after_cents,
    withdrawable_balance_after_cents,
    description,
    related_contest_id,
    related_entry_id
  ) VALUES (
    p_user_id,
    v_wallet_id,
    'contest_win',
    p_prize_amount_cents,
    'completed',
    (SELECT balance_cents FROM user_wallets WHERE id = v_wallet_id),
    (SELECT withdrawable_balance_cents FROM user_wallets WHERE id = v_wallet_id),
    'Contest prize winnings',
    p_contest_id,
    p_entry_id
  )
  RETURNING id INTO v_transaction_id;
  
  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Process contest completion (no win - remove from pending, track loss)
CREATE OR REPLACE FUNCTION process_contest_loss(
  p_user_id UUID,
  p_entry_fee_cents BIGINT,
  p_contest_id UUID,
  p_entry_id UUID
)
RETURNS VOID AS $$
DECLARE
  v_wallet_id UUID;
BEGIN
  -- Get wallet
  SELECT id INTO v_wallet_id
  FROM user_wallets
  WHERE user_id = p_user_id
  FOR UPDATE;
  
  -- Update wallet (just remove from pending, already deducted from balance)
  UPDATE user_wallets
  SET 
    pending_balance_cents = pending_balance_cents - p_entry_fee_cents,
    total_lost_cents = total_lost_cents + p_entry_fee_cents,
    updated_at = now()
  WHERE id = v_wallet_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Refund contest entry (cancelled contest)
CREATE OR REPLACE FUNCTION refund_contest_entry(
  p_user_id UUID,
  p_entry_fee_cents BIGINT,
  p_bonus_amount_cents BIGINT,
  p_contest_id UUID,
  p_entry_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_wallet_id UUID;
  v_real_money_refund BIGINT;
  v_transaction_id UUID;
BEGIN
  v_real_money_refund := p_entry_fee_cents - p_bonus_amount_cents;
  
  -- Get wallet
  SELECT id INTO v_wallet_id
  FROM user_wallets
  WHERE user_id = p_user_id
  FOR UPDATE;
  
  -- Update wallet (return funds from pending)
  UPDATE user_wallets
  SET 
    balance_cents = balance_cents + p_entry_fee_cents,
    withdrawable_balance_cents = withdrawable_balance_cents + v_real_money_refund,
    bonus_balance_cents = bonus_balance_cents + p_bonus_amount_cents,
    pending_balance_cents = pending_balance_cents - p_entry_fee_cents,
    updated_at = now()
  WHERE id = v_wallet_id;
  
  -- Create transaction record
  INSERT INTO wallet_transactions (
    user_id,
    wallet_id,
    type,
    amount_cents,
    bonus_amount_cents,
    status,
    balance_after_cents,
    withdrawable_balance_after_cents,
    description,
    related_contest_id,
    related_entry_id
  ) VALUES (
    p_user_id,
    v_wallet_id,
    'contest_refund',
    p_entry_fee_cents,
    p_bonus_amount_cents,
    'completed',
    (SELECT balance_cents FROM user_wallets WHERE id = v_wallet_id),
    (SELECT withdrawable_balance_cents FROM user_wallets WHERE id = v_wallet_id),
    'Contest cancelled - refund',
    p_contest_id,
    p_entry_id
  )
  RETURNING id INTO v_transaction_id;
  
  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add bonus/promotional credit
CREATE OR REPLACE FUNCTION add_bonus_credit(
  p_user_id UUID,
  p_amount_cents BIGINT,
  p_description TEXT,
  p_promo_code TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_wallet_id UUID;
  v_transaction_id UUID;
BEGIN
  -- Get wallet
  SELECT id INTO v_wallet_id
  FROM user_wallets
  WHERE user_id = p_user_id
  FOR UPDATE;
  
  -- Update wallet
  UPDATE user_wallets
  SET 
    balance_cents = balance_cents + p_amount_cents,
    bonus_balance_cents = bonus_balance_cents + p_amount_cents,
    total_bonus_received_cents = total_bonus_received_cents + p_amount_cents,
    updated_at = now()
  WHERE id = v_wallet_id;
  
  -- Create transaction record
  INSERT INTO wallet_transactions (
    user_id,
    wallet_id,
    type,
    amount_cents,
    bonus_amount_cents,
    status,
    balance_after_cents,
    withdrawable_balance_after_cents,
    description,
    metadata
  ) VALUES (
    p_user_id,
    v_wallet_id,
    'bonus',
    p_amount_cents,
    p_amount_cents,
    'completed',
    (SELECT balance_cents FROM user_wallets WHERE id = v_wallet_id),
    (SELECT withdrawable_balance_cents FROM user_wallets WHERE id = v_wallet_id),
    p_description,
    CASE WHEN p_promo_code IS NOT NULL 
      THEN jsonb_build_object('promo_code', p_promo_code)
      ELSE '{}'::jsonb
    END
  )
  RETURNING id INTO v_transaction_id;
  
  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Process successful deposit
CREATE OR REPLACE FUNCTION process_deposit(
  p_user_id UUID,
  p_amount_cents BIGINT,
  p_stripe_payment_intent_id TEXT,
  p_payment_method TEXT DEFAULT 'stripe_card'
)
RETURNS UUID AS $$
DECLARE
  v_wallet_id UUID;
  v_transaction_id UUID;
BEGIN
  -- Get wallet
  SELECT id INTO v_wallet_id
  FROM user_wallets
  WHERE user_id = p_user_id
  FOR UPDATE;
  
  -- Update wallet
  UPDATE user_wallets
  SET 
    balance_cents = balance_cents + p_amount_cents,
    withdrawable_balance_cents = withdrawable_balance_cents + p_amount_cents,
    total_deposited_cents = total_deposited_cents + p_amount_cents,
    last_deposit_at = now(),
    updated_at = now()
  WHERE id = v_wallet_id;
  
  -- Create transaction record
  INSERT INTO wallet_transactions (
    user_id,
    wallet_id,
    type,
    amount_cents,
    status,
    payment_method,
    stripe_payment_intent_id,
    balance_after_cents,
    withdrawable_balance_after_cents,
    description,
    completed_at
  ) VALUES (
    p_user_id,
    v_wallet_id,
    'deposit',
    p_amount_cents,
    'completed',
    p_payment_method,
    p_stripe_payment_intent_id,
    (SELECT balance_cents FROM user_wallets WHERE id = v_wallet_id),
    (SELECT withdrawable_balance_cents FROM user_wallets WHERE id = v_wallet_id),
    'Deposit via ' || p_payment_method,
    now()
  )
  RETURNING id INTO v_transaction_id;
  
  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Process withdrawal (after approval)
CREATE OR REPLACE FUNCTION process_withdrawal(
  p_user_id UUID,
  p_amount_cents BIGINT,
  p_withdrawal_request_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_wallet_id UUID;
  v_transaction_id UUID;
BEGIN
  -- Get wallet
  SELECT id INTO v_wallet_id
  FROM user_wallets
  WHERE user_id = p_user_id
  FOR UPDATE;
  
  -- Update wallet
  UPDATE user_wallets
  SET 
    balance_cents = balance_cents - p_amount_cents,
    withdrawable_balance_cents = withdrawable_balance_cents - p_amount_cents,
    total_withdrawn_cents = total_withdrawn_cents + p_amount_cents,
    last_withdrawal_at = now(),
    withdrawal_pending = false,
    updated_at = now()
  WHERE id = v_wallet_id;
  
  -- Create transaction record
  INSERT INTO wallet_transactions (
    user_id,
    wallet_id,
    type,
    amount_cents,
    status,
    balance_after_cents,
    withdrawable_balance_after_cents,
    description,
    completed_at,
    metadata
  ) VALUES (
    p_user_id,
    v_wallet_id,
    'withdrawal',
    -p_amount_cents,
    'completed',
    (SELECT balance_cents FROM user_wallets WHERE id = v_wallet_id),
    (SELECT withdrawable_balance_cents FROM user_wallets WHERE id = v_wallet_id),
    'Withdrawal',
    now(),
    jsonb_build_object('withdrawal_request_id', p_withdrawal_request_id)
  )
  RETURNING id INTO v_transaction_id;
  
  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 8. RLS POLICIES
-- ============================================================================

ALTER TABLE user_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposit_limit_tracking ENABLE ROW LEVEL SECURITY;

-- Users can view their own wallet
CREATE POLICY "Users can view own wallet"
ON user_wallets FOR SELECT
USING (auth.uid() = user_id);

-- Users can view their own transactions
CREATE POLICY "Users can view own transactions"
ON wallet_transactions FOR SELECT
USING (auth.uid() = user_id);

-- Users can view their own withdrawal requests
CREATE POLICY "Users can view own withdrawal requests"
ON withdrawal_requests FOR SELECT
USING (auth.uid() = user_id);

-- Users can create withdrawal requests
CREATE POLICY "Users can create withdrawal requests"
ON withdrawal_requests FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Service role can do everything
CREATE POLICY "Service role full access to wallets"
ON user_wallets FOR ALL
USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role full access to transactions"
ON wallet_transactions FOR ALL
USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "Service role full access to withdrawals"
ON withdrawal_requests FOR ALL
USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- 9. GRANTS
-- ============================================================================

GRANT SELECT ON user_wallets TO authenticated;
GRANT SELECT ON wallet_transactions TO authenticated;
GRANT SELECT, INSERT ON withdrawal_requests TO authenticated;
GRANT SELECT ON deposit_limit_tracking TO authenticated;

GRANT ALL ON user_wallets TO service_role;
GRANT ALL ON wallet_transactions TO service_role;
GRANT ALL ON withdrawal_requests TO service_role;
GRANT ALL ON deposit_limit_tracking TO service_role;

GRANT EXECUTE ON FUNCTION get_user_wallet_balance TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION can_user_deposit TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION can_user_withdraw TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION process_contest_entry TO service_role;
GRANT EXECUTE ON FUNCTION process_contest_win TO service_role;
GRANT EXECUTE ON FUNCTION process_contest_loss TO service_role;
GRANT EXECUTE ON FUNCTION refund_contest_entry TO service_role;
GRANT EXECUTE ON FUNCTION add_bonus_credit TO service_role;
GRANT EXECUTE ON FUNCTION process_deposit TO service_role;
GRANT EXECUTE ON FUNCTION process_withdrawal TO service_role;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Wallet system created successfully!';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Tables Created:';
  RAISE NOTICE '   - user_wallets: User wallet balances and limits';
  RAISE NOTICE '   - wallet_transactions: All transaction history';
  RAISE NOTICE '   - withdrawal_requests: Withdrawal request management';
  RAISE NOTICE '   - deposit_limit_tracking: Deposit limit enforcement';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 Functions Created:';
  RAISE NOTICE '   - get_user_wallet_balance()';
  RAISE NOTICE '   - can_user_deposit()';
  RAISE NOTICE '   - can_user_withdraw()';
  RAISE NOTICE '';
  RAISE NOTICE '🔐 RLS Policies: Enabled';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  IMPORTANT NEXT STEPS:';
  RAISE NOTICE '   1. Set up Stripe/PayPal webhooks';
  RAISE NOTICE '   2. Implement KYC verification flow';
  RAISE NOTICE '   3. Configure deposit/withdrawal limits';
  RAISE NOTICE '   4. Set up fraud detection';
  RAISE NOTICE '   5. Implement tax reporting (1099-MISC for $600+)';
  RAISE NOTICE '   6. Create admin dashboard for approvals';
  RAISE NOTICE '   7. Set up email notifications';
  RAISE NOTICE '';
END $$;

