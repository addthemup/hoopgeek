# 📊 Investor Metrics Cheat Sheet

Quick reference for the metrics investors care about most.

---

## 🎯 The Big 5 Metrics

| Metric | Formula | Good Benchmark | Where to Find |
|--------|---------|----------------|---------------|
| **DAU/MAU** | Daily Users ÷ Monthly Users | 20%+ | `daily_engagement_metrics` |
| **Session Duration** | Avg time per visit | 5+ minutes | `user_engagement_sessions.avg_duration` |
| **Conversion Rate** | DFS Players ÷ Viewers | 5%+ | `dfs_conversion_funnel.conversion_rate` |
| **ARPU** | Revenue ÷ Total Users | $10+ | `dfs_user_statistics.avg_revenue` |
| **Retention** | Return after 30 days | 30%+ | Custom query |

---

## 📈 Engagement Hierarchy

### Tier 1: Visiting
- **Metric:** Page Views
- **Tracked:** `engagement_events` (event_type = 'page_view')
- **Good:** 1000+ daily

### Tier 2: Viewing
- **Metric:** Posts Viewed
- **Tracked:** `user_post_views`
- **Good:** 3+ per session

### Tier 3: Engaging
- **Metric:** Completion Rate
- **Tracked:** `user_post_views.completion_percentage`
- **Good:** 60%+

### Tier 4: Interacting
- **Metric:** Likes/Comments/Shares
- **Tracked:** `engagement_events` (event_type = 'post_interaction')
- **Good:** 10% of viewers

### Tier 5: Converting
- **Metric:** DFS Sign-ups
- **Tracked:** `dfs_entries`
- **Good:** 5%+ of engaged users

---

## 💰 Monetization Funnel

```
100 Highlight Viewers
    ↓ (5% conversion rate)
5 DFS Sign-ups
    ↓ (80% entry rate)
4 Contest Entries
    ↓ ($10 entry fee)
$40 Revenue
    ↓ (10% platform fee)
$4 Profit
```

**Your Numbers:**
- Conversion: ____%
- Entry Rate: ____%
- Avg Entry Fee: $____
- Platform Fee: ____%
- Revenue: $____
- Profit Margin: ____%

---

## 🎯 Content Performance Metrics

### Video Engagement
```sql
-- Get top performing videos
SELECT 
  post_id,
  COUNT(*) as views,
  AVG(completion_percentage) as completion_rate,
  AVG(view_duration_seconds) as avg_watch_time
FROM user_post_views
WHERE view_started_at >= NOW() - INTERVAL '7 days'
GROUP BY post_id
ORDER BY completion_rate DESC
LIMIT 10;
```

**What to look for:**
- Completion Rate: 60%+ = Great content
- Avg Watch Time: 30+ seconds = Engaging
- Views: 500+ = Viral potential

### Session Quality
```sql
-- Get power users
SELECT 
  user_id,
  COUNT(*) as sessions,
  AVG(session_duration_seconds) as avg_duration,
  SUM(posts_viewed) as total_posts
FROM user_engagement_sessions
WHERE session_start >= NOW() - INTERVAL '30 days'
GROUP BY user_id
HAVING COUNT(*) >= 5
ORDER BY total_posts DESC;
```

**What to look for:**
- 5+ sessions = Loyal user
- 10+ posts viewed = Power user
- 5+ min avg duration = Engaged

---

## 🚀 Growth Metrics

### Week-over-Week Growth
```sql
WITH weekly_stats AS (
  SELECT 
    date_trunc('week', session_start) as week,
    COUNT(DISTINCT user_id) as weekly_users
  FROM user_engagement_sessions
  GROUP BY date_trunc('week', session_start)
)
SELECT 
  week,
  weekly_users,
  LAG(weekly_users) OVER (ORDER BY week) as prev_week,
  ROUND(
    (weekly_users - LAG(weekly_users) OVER (ORDER BY week))::DECIMAL 
    / LAG(weekly_users) OVER (ORDER BY week) * 100, 
    2
  ) as growth_rate
FROM weekly_stats
ORDER BY week DESC;
```

**What to look for:**
- 10%+ weekly growth = Strong traction
- 20%+ weekly growth = Viral growth
- Consistent growth = Sustainable

### Cohort Retention
```sql
WITH first_session AS (
  SELECT user_id, MIN(session_start)::date as first_date
  FROM user_engagement_sessions
  GROUP BY user_id
)
SELECT 
  first_date,
  COUNT(DISTINCT f.user_id) as cohort_size,
  COUNT(DISTINCT CASE 
    WHEN s.session_start >= f.first_date + INTERVAL '7 days' 
    THEN f.user_id 
  END) as retained_7d,
  COUNT(DISTINCT CASE 
    WHEN s.session_start >= f.first_date + INTERVAL '30 days' 
    THEN f.user_id 
  END) as retained_30d
FROM first_session f
LEFT JOIN user_engagement_sessions s ON f.user_id = s.user_id
GROUP BY first_date
ORDER BY first_date DESC;
```

**What to look for:**
- 40%+ 7-day retention = Good
- 30%+ 30-day retention = Excellent
- Improving over time = Product-market fit

---

## 💵 Unit Economics

### Cost Per Acquisition (CPA)
```
CPA = Marketing Spend ÷ New Users
```

**Your numbers:**
- Marketing Spend: $____
- New Users: ____
- CPA: $____

### Lifetime Value (LTV)
```
LTV = ARPU × Avg Lifetime (months)
```

**Your numbers:**
- ARPU: $____/month
- Avg Lifetime: ____ months
- LTV: $____

### LTV:CAC Ratio
```
LTV:CAC = LTV ÷ CPA
```

**Benchmarks:**
- 1:1 = Breaking even
- 3:1 = Healthy
- 5:1+ = Excellent

**Your ratio:** ____:1

---

## 📊 Dashboard Queries

### Today's Snapshot
```sql
SELECT 
  COUNT(DISTINCT user_id) as dau,
  COUNT(*) as sessions,
  AVG(session_duration_seconds) / 60 as avg_minutes,
  SUM(posts_viewed) as posts_viewed,
  SUM(videos_watched) as videos_watched
FROM user_engagement_sessions
WHERE session_start >= CURRENT_DATE;
```

### This Week's Performance
```sql
SELECT 
  COUNT(DISTINCT user_id) as wau,
  COUNT(*) as sessions,
  AVG(session_duration_seconds) / 60 as avg_minutes,
  SUM(posts_viewed) as posts_viewed,
  AVG(posts_completed::DECIMAL / NULLIF(posts_viewed, 0)) * 100 as completion_rate
FROM user_engagement_sessions
WHERE session_start >= date_trunc('week', CURRENT_DATE);
```

### DFS Performance
```sql
SELECT 
  COUNT(DISTINCT user_id) as total_players,
  COUNT(*) as total_entries,
  SUM(entry_fee_paid) as total_revenue,
  SUM(prize_amount) as total_payouts,
  SUM(entry_fee_paid) - SUM(prize_amount) as net_revenue,
  AVG(entry_fee_paid) as avg_entry_fee,
  COUNT(*) FILTER (WHERE prize_amount > 0)::DECIMAL / COUNT(*) * 100 as cash_rate
FROM dfs_entries
WHERE created_at >= date_trunc('month', CURRENT_DATE);
```

---

## 🎤 Investor Talking Points

### Engagement Story
> "Our users spend an average of **[X] minutes** per session, viewing **[Y] highlights** each visit. With a **[Z]% completion rate**, we're seeing significantly higher engagement than industry benchmarks."

### Monetization Story
> "We're converting **[X]%** of highlight viewers to DFS players, generating **$[Y]** ARPU. Our top **[Z]%** of users drive **[A]%** of revenue, showing strong monetization potential."

### Growth Story
> "DAU has grown **[X]%** week-over-week for the past **[Y] weeks**. With **[Z]% 30-day retention**, we're proving product-market fit while maintaining **[A]-minute** session duration."

### Scalability Story
> "Our LTV:CAC ratio is **[X]:1** with unit economics improving each month. Total watch time is **[Y] hours** daily, proving we have content that scales and users that engage."

---

## 🎯 Red Flags to Avoid

| Red Flag | Threshold | Fix |
|----------|-----------|-----|
| Low session duration | <2 min | Improve content quality |
| Low completion rate | <30% | Better video curation |
| High bounce rate | >70% | Improve onboarding |
| Low return rate | <20% | Add notifications/emails |
| Declining DAU | Negative growth | Marketing + retention |
| Low conversion | <2% | Improve DFS visibility |
| High churn | >50% monthly | Fix user experience |

---

## 📱 Quick Access

### Investor Dashboard
```
/investor-dashboard
```

### Key Database Tables
```
user_engagement_sessions     - Session tracking
user_post_views             - Content performance
dfs_user_statistics         - Monetization metrics
daily_engagement_metrics    - Daily aggregates
dfs_conversion_funnel       - Conversion tracking
```

### Materialized View Refresh
```sql
SELECT refresh_daily_engagement_metrics();
```

### User Stats Recalculation
```sql
SELECT recalculate_all_dfs_user_stats();
```

---

## 🏆 Success Milestones

- [ ] 1,000 DAU
- [ ] 5 minute avg session
- [ ] 60% completion rate
- [ ] 5% conversion rate
- [ ] $10 ARPU
- [ ] 30% 30-day retention
- [ ] 3:1 LTV:CAC ratio
- [ ] 10 hours daily watch time
- [ ] $1K monthly revenue
- [ ] 100 DFS players

---

**Print this page and fill in your numbers weekly! 📊**

