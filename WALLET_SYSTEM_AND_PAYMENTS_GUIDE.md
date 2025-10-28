# Wallet System & Payment Processing Guide

## 🎯 Overview
Complete wallet system for managing deposits, withdrawals, contest entries, and winnings in your DFS platform.

---

## 📊 **Database Schema**

### **1. `user_wallets` Table**
Main wallet for each user.

```sql
- balance_cents (BIGINT): Total balance
- withdrawable_balance_cents (BIGINT): Real money that can be withdrawn
- bonus_balance_cents (BIGINT): Promotional credits
- pending_balance_cents (BIGINT): Money in active contests
- total_deposited_cents (BIGINT): Lifetime deposits
- total_withdrawn_cents (BIGINT): Lifetime withdrawals
- kyc_verified (BOOLEAN): Identity verification status
- status: 'active' | 'suspended' | 'closed'
- daily_deposit_limit_cents (BIGINT): Default $500
```

### **2. `wallet_transactions` Table**
Complete transaction history.

```sql
Types:
- 'deposit': User adds funds
- 'withdrawal': User withdraws funds
- 'contest_entry': Entering a contest
- 'contest_refund': Contest cancelled
- 'contest_win': Won a contest
- 'bonus': Promotional credit
- 'admin_adjustment': Manual adjustment
```

### **3. `withdrawal_requests` Table**
Withdrawal approval queue.

```sql
Methods:
- 'stripe_transfer': Bank transfer via Stripe
- 'paypal': PayPal payout
- 'bank_transfer': Direct ACH
- 'check': Mailed check

Status:
- 'pending': Awaiting review
- 'approved': Approved, processing
- 'completed': Funds sent
- 'rejected': Denied
```

---

## 💳 **Payment Processing Recommendations**

### **Option 1: Stripe (RECOMMENDED) ⭐**

**Why Stripe?**
- ✅ **Industry standard** for DFS/gaming
- ✅ **Handles both deposits AND payouts**
- ✅ **Built-in fraud protection**
- ✅ **ACH, cards, Apple Pay, Google Pay**
- ✅ **Excellent documentation**
- ✅ **Stripe Connect** for instant payouts
- ✅ **Webhooks** for automatic reconciliation

**Pricing:**
- **Cards:** 2.9% + $0.30 per transaction
- **ACH:** 0.8% (capped at $5)
- **Instant Payouts:** 1.5% (min $0.50)
- **Standard Payouts:** $0.25 per payout

**Implementation:**
```typescript
// Install
npm install @stripe/stripe-js

// Frontend: Create Payment Intent
const response = await fetch('/api/create-deposit-intent', {
  method: 'POST',
  body: JSON.stringify({ amount: 5000 }) // $50.00 in cents
});
const { clientSecret } = await response.json();

// Confirm payment
const stripe = await loadStripe('pk_live_...');
const result = await stripe.confirmCardPayment(clientSecret);

// Backend: Webhook handler
stripe.webhooks.constructEvent(
  request.body,
  signature,
  webhookSecret
);
// Update wallet on 'payment_intent.succeeded'
```

**For Payouts:**
```typescript
// Create Connected Account for user
const account = await stripe.accounts.create({
  type: 'express',
  capabilities: {
    transfers: { requested: true }
  }
});

// Payout to user
await stripe.transfers.create({
  amount: 10000, // $100
  currency: 'usd',
  destination: userAccount.stripe_account_id
});
```

---

### **Option 2: Stripe + PayPal (Hybrid)**

**Why Add PayPal?**
- ✅ Some users prefer PayPal
- ✅ Good for payouts
- ✅ No bank account needed

**Pricing:**
- **Deposits:** 3.49% + $0.49
- **Payouts:** $0.25 per payout

**Implementation:**
```typescript
// PayPal SDK
npm install @paypal/checkout-server-sdk

// Create payout
const paypalClient = new paypal.PayoutsApi(environment);
const batch = {
  sender_batch_header: {
    email_subject: 'You have a payout!'
  },
  items: [{
    recipient_type: 'EMAIL',
    amount: {
      value: '100.00',
      currency: 'USD'
    },
    receiver: 'user@email.com'
  }]
};
await paypalClient.createPayout(batch);
```

---

### **Option 3: Dwolla (For High Volume)**

**Why Dwolla?**
- ✅ **Best for ACH transfers**
- ✅ Lower fees than Stripe for ACH
- ✅ Same-day ACH available
- ✅ White-label solution

**Pricing:**
- **ACH:** $0.50 per transaction
- **Instant:** 1% (min $0.50, max $10)
- **Monthly fee:** $0-$250 depending on volume

---

### **Option 4: Plaid + Stripe (Best UX)**

**Why Plaid?**
- ✅ **Bank account linking** (instant verification)
- ✅ Better UX than micro-deposits
- ✅ Works with Stripe ACH

**How It Works:**
1. User links bank with Plaid
2. Get bank account token
3. Pass to Stripe for ACH deposits
4. Instant verification (no 2-day wait)

**Pricing:**
- **Plaid:** $0.60 per linked account
- **Stripe ACH:** 0.8% (capped at $5)

```typescript
// Plaid Link
import { usePlaidLink } from 'react-plaid-link';

const { open } = usePlaidLink({
  token: linkToken,
  onSuccess: async (public_token, metadata) => {
    // Exchange for access token
    const response = await fetch('/api/exchange-plaid-token', {
      method: 'POST',
      body: JSON.stringify({ public_token })
    });
    // Use with Stripe
  }
});
```

---

## 🏆 **Recommended Stack**

### **For Most DFS Platforms:**
```
Deposits:
  - Stripe (cards, Apple Pay, Google Pay)
  - Plaid + Stripe (ACH with instant verification)

Withdrawals:
  - Stripe Connect (instant payouts to bank)
  - PayPal (as secondary option)
```

### **Cost Comparison (Example):**

**User deposits $100:**
- Stripe (card): $100 × 2.9% + $0.30 = **$3.20 fee**
- Stripe (ACH): $100 × 0.8% = **$0.80 fee**
- Plaid+ACH: $0.60 + $0.80 = **$1.40 fee (one-time link)**

**User withdraws $100:**
- Stripe instant: $100 × 1.5% = **$1.50 fee**
- Stripe standard: **$0.25 fee** (2-3 days)
- PayPal: **$0.25 fee**

---

## 🛡️ **Compliance Requirements**

### **1. Know Your Customer (KYC)**

**When Required:**
- ✅ **Deposits over $1,000** (cumulative)
- ✅ **Any withdrawal request**
- ✅ **State/country regulations**

**Information Needed:**
```
- Full legal name
- Date of birth
- Social Security Number (US) or Tax ID
- Address
- Photo ID (driver's license, passport)
```

**KYC Providers:**
- **Stripe Identity** (integrated with Stripe): $1.50/verification
- **Persona**: $2-$4/verification
- **Onfido**: $2-$5/verification
- **Jumio**: $2-$4/verification

**Implementation:**
```typescript
// Stripe Identity
const verificationSession = await stripe.identity.verificationSessions.create({
  type: 'document',
  metadata: {
    user_id: user.id
  }
});

// User completes verification via Stripe's hosted flow
// Webhook: 'identity.verification_session.verified'
```

---

### **2. Tax Reporting (1099-MISC)**

**When Required:**
- ✅ User wins **$600 or more** in a calendar year

**Implementation:**
- Track winnings per user per year
- Generate 1099-MISC forms in January
- Submit to IRS by January 31
- Provide copy to user

**Services:**
- **Tax1099** (API): $1-$2 per form
- **Stripe Tax**: Built-in reporting
- **TaxBandits**: $1.25 per form

---

### **3. State Regulations**

**DFS is legal in most states, but check:**
- ✅ **Age requirements** (18+ or 21+)
- ✅ **Geolocation verification** (block certain states)
- ✅ **Responsible gaming** (deposit limits, self-exclusion)
- ✅ **License requirements** (some states require DFS license)

**Geolocation Services:**
- **GeoComply**: $0.05-$0.10 per check
- **IP2Location**: Flat monthly fee
- **MaxMind GeoIP2**: Flat monthly fee

---

### **4. Responsible Gaming**

**Required Features:**
- ✅ **Deposit limits** (daily, weekly, monthly)
- ✅ **Self-exclusion** (temporary or permanent)
- ✅ **Timeout/cool-off periods**
- ✅ **Spending alerts**
- ✅ **Problem gambling resources**

**Already Implemented:**
```sql
daily_deposit_limit_cents BIGINT DEFAULT 50000,  -- $500
weekly_deposit_limit_cents BIGINT DEFAULT 200000, -- $2000
monthly_deposit_limit_cents BIGINT DEFAULT 500000 -- $5000
```

---

## 🔐 **Security Best Practices**

### **1. Store Payment Info Securely**
- ✅ **Never store card numbers** (use Stripe tokens)
- ✅ **Encrypt bank account numbers**
- ✅ **PCI DSS compliance** (Stripe handles this)

### **2. Fraud Prevention**
- ✅ **Velocity checks** (limit deposits per hour)
- ✅ **Device fingerprinting** (track suspicious devices)
- ✅ **Email/phone verification**
- ✅ **Stripe Radar** (automatic fraud detection)

### **3. Transaction Integrity**
- ✅ **Atomic transactions** (database)
- ✅ **Idempotency keys** (prevent duplicate charges)
- ✅ **Balance locks** (prevent race conditions)
- ✅ **Audit logs** (track every balance change)

---

## 📱 **Implementation Steps**

### **Phase 1: Stripe Basics (Week 1)**
1. ✅ Set up Stripe account
2. ✅ Create Supabase Edge Function for deposits
3. ✅ Implement card deposits
4. ✅ Set up webhooks
5. ✅ Test in sandbox

### **Phase 2: Withdrawals (Week 2)**
1. ✅ Implement KYC verification (Stripe Identity)
2. ✅ Create withdrawal request flow
3. ✅ Manual admin approval dashboard
4. ✅ Stripe Connect for payouts
5. ✅ Test payout flow

### **Phase 3: Enhanced Deposits (Week 3)**
1. ✅ Add Plaid for bank linking
2. ✅ Implement ACH deposits
3. ✅ Add deposit limits enforcement
4. ✅ Add fraud checks

### **Phase 4: Compliance (Week 4)**
1. ✅ Geolocation verification
2. ✅ Responsible gaming features
3. ✅ Tax reporting system
4. ✅ Legal review

---

## 📄 **Sample Supabase Edge Function**

### **Deposit Handler**

```typescript
// supabase/functions/create-deposit/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import Stripe from 'https://esm.sh/stripe@12.0.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2022-11-15',
});

serve(async (req) => {
  try {
    const { amount, user_id } = await req.json();
    
    // Check if user can deposit
    const { data: wallet } = await supabaseClient
      .from('user_wallets')
      .select('*')
      .eq('user_id', user_id)
      .single();
    
    if (wallet.status !== 'active') {
      return new Response(
        JSON.stringify({ error: 'Wallet not active' }),
        { status: 400 }
      );
    }
    
    // Check deposit limits
    const canDeposit = await checkDepositLimits(user_id, amount);
    if (!canDeposit) {
      return new Response(
        JSON.stringify({ error: 'Deposit limit exceeded' }),
        { status: 400 }
      );
    }
    
    // Create Stripe PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount, // In cents
      currency: 'usd',
      metadata: {
        user_id,
        type: 'deposit'
      }
    });
    
    // Create pending transaction
    await supabaseClient.from('wallet_transactions').insert({
      user_id,
      wallet_id: wallet.id,
      type: 'deposit',
      amount_cents: amount,
      status: 'pending',
      stripe_payment_intent_id: paymentIntent.id,
      description: `Deposit $${(amount / 100).toFixed(2)}`
    });
    
    return new Response(
      JSON.stringify({ clientSecret: paymentIntent.client_secret }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500 }
    );
  }
});
```

---

### **Webhook Handler**

```typescript
// supabase/functions/stripe-webhook/index.ts
serve(async (req) => {
  const sig = req.headers.get('stripe-signature')!;
  const body = await req.text();
  
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!
    );
  } catch (err) {
    return new Response('Webhook signature verification failed', { status: 400 });
  }
  
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    const { user_id } = paymentIntent.metadata;
    
    // Update transaction status
    await supabaseClient
      .from('wallet_transactions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('stripe_payment_intent_id', paymentIntent.id);
    
    // Update wallet balance
    await supabaseClient.rpc('add_to_wallet', {
      p_user_id: user_id,
      p_amount_cents: paymentIntent.amount
    });
  }
  
  return new Response(JSON.stringify({ received: true }));
});
```

---

## 💰 **Fee Structure Recommendations**

### **Option 1: Platform Absorbs Fees**
- Users deposit $100, get $100 in wallet
- Platform pays $3.20 fee
- **Pro:** Better UX, more deposits
- **Con:** Expensive at scale

### **Option 2: Pass Fees to Users**
- Users deposit $100, pay $3.20 fee, get $100
- Platform pays nothing
- **Pro:** Zero cost to platform
- **Con:** May discourage deposits

### **Option 3: Hybrid (RECOMMENDED)**
- Cards: User pays fee
- ACH: Platform absorbs fee (cheaper)
- Free deposits over $50
- **Pro:** Balanced, encourages ACH
- **Con:** Moderate cost

---

## 📊 **Transaction Flow Diagram**

```
DEPOSIT FLOW:
User clicks "Deposit" 
    ↓
Selects amount + payment method
    ↓
Frontend: Stripe.js creates PaymentIntent
    ↓
Backend: Creates pending transaction in DB
    ↓
User confirms payment
    ↓
Stripe webhook: payment_intent.succeeded
    ↓
Backend: Updates transaction status
    ↓
Backend: Adds funds to wallet balance
    ↓
User receives confirmation


WITHDRAWAL FLOW:
User clicks "Withdraw"
    ↓
Enters amount (must have KYC)
    ↓
Backend: Creates withdrawal_request (pending)
    ↓
Backend: Holds funds (deduct from withdrawable_balance)
    ↓
Admin reviews request (fraud check)
    ↓
Admin approves → Stripe Connect payout
    ↓
Payout succeeds → Update transaction
    ↓
User receives confirmation
```

---

## ✅ **Next Steps**

1. **Sign up for Stripe** (https://dashboard.stripe.com/register)
2. **Get API keys** (test mode first)
3. **Create Supabase Edge Functions** (above templates)
4. **Test deposit flow** (use test cards)
5. **Implement KYC** (Stripe Identity)
6. **Test withdrawal flow**
7. **Set up webhooks** (critical!)
8. **Add fraud checks**
9. **Launch in test mode**
10. **Legal review** (terms of service, privacy policy)
11. **Go live** (switch to live keys)

---

## 🚨 **Common Pitfalls to Avoid**

1. ❌ **Not handling webhooks** → Balances out of sync
2. ❌ **No idempotency** → Duplicate charges
3. ❌ **No fraud detection** → Chargebacks
4. ❌ **Weak KYC** → Regulatory issues
5. ❌ **No deposit limits** → Problem gambling liability
6. ❌ **Poor error handling** → Stuck transactions
7. ❌ **No audit logs** → Can't debug issues
8. ❌ **Storing card numbers** → PCI violations ($$$$ fines)

---

## 📞 **Support & Resources**

**Stripe:**
- Docs: https://stripe.com/docs
- Support: support@stripe.com
- Discord: https://stripe.com/discord

**Supabase:**
- Docs: https://supabase.com/docs
- Discord: https://discord.supabase.com

**DFS Legal:**
- Fantasy Sports & Gaming Association: https://thefsga.org
- State regulations: https://thefsga.org/industry/state-regulations

---

## 🎉 **You're Ready!**

Your wallet system is built and ready to integrate with payment processing. Choose your provider (Stripe recommended), implement the Edge Functions, and you're good to go!

**Total setup time:** 2-4 weeks
**Total cost:** <$5k for initial setup (mostly legal review)
**Ongoing costs:** 2-3% per transaction + KYC fees

Good luck! 🏀💰

