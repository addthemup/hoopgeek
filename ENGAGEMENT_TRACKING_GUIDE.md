# 📊 Engagement & Analytics Tracking System

## Overview

This is a comprehensive engagement tracking system designed to provide **real investor-grade metrics** for your HoopGeek app. It tracks user behavior, content engagement, and DFS monetization in real-time.

---

## 🎯 Why This Matters for Investors

Investors care about **3 key things**:

1. **User Engagement** - Are people actually using your app?
2. **Content Performance** - Is your content sticky?
3. **Monetization** - Are users converting to paying customers?

This system tracks all three with industry-standard metrics.

---

## 📈 Key Metrics Tracked

### Engagement Metrics

| Metric | Definition | Why It Matters |
|--------|-----------|----------------|
| **DAU/MAU** | Daily/Monthly Active Users | Growth trajectory |
| **Session Duration** | Time spent per visit | Content stickiness |
| **Posts Viewed** | Number of highlights watched | Content consumption |
| **Completion Rate** | % of videos watched fully | Content quality indicator |
| **Return Rate** | % of users coming back | Product-market fit |

### Monetization Metrics

| Metric | Definition | Why It Matters |
|--------|-----------|----------------|
| **Conversion Rate** | Viewers → DFS players | Monetization funnel health |
| **ARPU** | Average Revenue Per User | Unit economics |
| **LTV** | Lifetime Value | Long-term profitability |
| **Cash Rate** | % of contests won | User satisfaction |
| **ROI %** | User profitability | Retention driver |

---

## 🏗️ Architecture

### Database Tables

#### 1. `user_engagement_sessions`
Tracks each user session with duration, content consumed, and quality metrics.

```sql
CREATE TABLE user_engagement_sessions (
  id UUID PRIMARY KEY,
  user_id UUID,
  session_start TIMESTAMPTZ,
  session_end TIMESTAMPTZ,
  session_duration_seconds INTEGER,
  posts_viewed INTEGER,
  posts_completed INTEGER,
  videos_watched INTEGER,
  total_video_watch_seconds INTEGER,
  engagement_score DECIMAL(10, 2)
);
```

**What it tracks:**
- How long users spend in the app
- How many posts they view
- How many posts they complete (watch all slides)
- Total video watch time
- Calculated engagement quality score

#### 2. `user_post_views`
Detailed tracking of individual post views with completion metrics.

```sql
CREATE TABLE user_post_views (
  id UUID PRIMARY KEY,
  user_id UUID,
  post_id UUID,
  session_id UUID,
  view_started_at TIMESTAMPTZ,
  view_ended_at TIMESTAMPTZ,
  slides_viewed INTEGER,
  total_slides INTEGER,
  completion_percentage DECIMAL(5, 2),
  videos_started INTEGER,
  videos_completed INTEGER,
  total_video_watch_seconds INTEGER
);
```

**What it tracks:**
- Per-post engagement
- Which slides users view
- Video completion rates
- Time spent per post
- Exit behavior

#### 3. `engagement_events`
Granular event tracking for deep analytics.

```sql
CREATE TABLE engagement_events (
  id UUID PRIMARY KEY,
  user_id UUID,
  session_id UUID,
  event_type engagement_event_type,
  post_id UUID,
  event_data JSONB,
  event_timestamp TIMESTAMPTZ
);
```

**Event types tracked:**
- `page_view` - User visits a page
- `post_view` - User starts viewing a post
- `video_start` - Video playback begins
- `video_progress` - Video watch progress (every 5 seconds)
- `video_complete` - Video finishes
- `slide_change` - User navigates between slides
- `post_interaction` - Like, comment, share
- `post_complete` - User finishes all slides

#### 4. `dfs_user_statistics`
Aggregated DFS performance stats per user.

```sql
CREATE TABLE dfs_user_statistics (
  id UUID PRIMARY KEY,
  user_id UUID UNIQUE,
  total_contests_entered INTEGER,
  completed_contests INTEGER,
  total_entry_fees_paid DECIMAL(12, 2),
  total_winnings DECIMAL(12, 2),
  net_profit_loss DECIMAL(12, 2),
  roi_percentage DECIMAL(10, 2),
  contests_won INTEGER,
  cash_rate DECIMAL(5, 2),
  avg_final_score DECIMAL(10, 2)
);
```

**What it tracks:**
- Contest participation
- Financial performance (fees, winnings, profit/loss)
- Win rates and cash rates
- Scoring performance
- Ranking history

### Materialized Views (Fast Queries)

#### `daily_engagement_metrics`
Pre-calculated daily metrics for dashboards.

```sql
CREATE MATERIALIZED VIEW daily_engagement_metrics AS
SELECT
  date_trunc('day', session_start) AS metric_date,
  COUNT(DISTINCT user_id) AS daily_active_users,
  AVG(session_duration_seconds) AS avg_session_duration,
  SUM(posts_viewed) AS total_posts_viewed,
  AVG(posts_completed::DECIMAL / posts_viewed) AS avg_post_completion_rate
FROM user_engagement_sessions
GROUP BY date_trunc('day', session_start);
```

**Refreshed:** Daily at 1 AM via cron job

#### `dfs_conversion_funnel`
Cohort-based conversion tracking from viewers to DFS players.

```sql
CREATE MATERIALIZED VIEW dfs_conversion_funnel AS
SELECT
  cohort_week,
  COUNT(DISTINCT user_id) AS total_users,
  COUNT(DISTINCT dfs_user_id) AS converted_to_dfs,
  (converted_to_dfs::DECIMAL / total_users) * 100 AS conversion_rate,
  AVG(days_to_convert) AS avg_days_to_convert
FROM user_cohorts
GROUP BY cohort_week;
```

**Refreshed:** Daily at 1 AM via cron job

---

## 🔧 Frontend Integration

### React Hook: `useEngagementTracking`

Located in `/src/hooks/useEngagementTracking.ts`

```typescript
const {
  startSession,
  endSession,
  startPostView,
  updatePostView,
  endPostView,
  trackEvent,
  sessionMetrics,
  isTracking
} = useEngagementTracking(user?.id)
```

#### Usage Example

```typescript
// Start session when page loads
useEffect(() => {
  if (user?.id) {
    startSession('/highlights')
  }
  return () => {
    endSession('/highlights', 'navigation_away')
  }
}, [user?.id])

// Track post view
const handleSlideChange = (postId, slideIndex, totalSlides) => {
  if (slideIndex === 0) {
    startPostView(postId, totalSlides, false)
  } else {
    updatePostView(slideIndex + 1)
  }
}

// Track video progress
useVideoTracking(videoRef, (seconds) => {
  updatePostView(currentSlide, seconds)
})
```

### Video Tracking Hook: `useVideoTracking`

Automatically tracks video watch time in 5-second intervals.

```typescript
useVideoTracking(videoRef, (watchedSeconds) => {
  // Called every 5 seconds with cumulative watch time
  updatePostView(currentSlide, watchedSeconds)
})
```

**Features:**
- Tracks only unique 5-second intervals (no double-counting rewinds)
- Resets on video end
- Non-blocking (doesn't affect playback)

---

## 🎨 Investor Dashboard

Located in `/src/pages/InvestorDashboard.tsx`

### Features

1. **Real-time Metrics Overview**
   - Total users, DAU/MAU
   - Average session duration
   - Content views and completion rates
   - Total revenue and ARPU

2. **Daily Engagement Trends**
   - 14-day view of key metrics
   - Session duration trends
   - Content consumption patterns

3. **DFS Conversion Funnel**
   - Weekly cohort analysis
   - Conversion rates
   - Days to convert
   - Revenue per converter

4. **Time Range Filters**
   - 7 days, 30 days, 90 days, All Time
   - Dynamic recalculation

### Access

```
/investor-dashboard
```

**Note:** Add auth protection for production use

---

## 🚀 Deployment

### Step 1: Apply Database Migrations

```bash
./deploy_engagement_tracking.sh
```

This script will:
1. Create all tracking tables
2. Set up DFS statistics triggers
3. Create materialized views
4. Backfill existing user data
5. Set up RLS policies

### Step 2: Set Up Cron Job

In Supabase SQL Editor:

```sql
-- Refresh metrics daily at 1 AM UTC
SELECT cron.schedule(
  'refresh-engagement-metrics',
  '0 1 * * *',
  $$ SELECT refresh_daily_engagement_metrics(); $$
);
```

### Step 3: Deploy Frontend

The tracking hooks are already integrated into `Highlights.tsx`. Just deploy:

```bash
npm run build
# Deploy to your hosting provider
```

### Step 4: Verify Tracking

1. Visit `/highlights` in your app
2. Open browser console - you should see:
   - `📊 Engagement tracking started for user: [user_id]`
   - `👁️ Starting post view: [post_id]`
   - `📈 Session Metrics: { ... }`

3. Check Supabase dashboard:
   - Query `user_engagement_sessions` - should see new rows
   - Query `engagement_events` - should see events

---

## 📊 Investor Pitch Metrics

Here's what you can confidently tell investors:

### Product-Market Fit
- **Session Duration:** [X] minutes average
- **Return Rate:** [X]% of users come back
- **Completion Rate:** [X]% of videos watched fully
- **DAU/MAU Ratio:** [X]% (>20% = excellent engagement)

### Content Performance
- **Posts Viewed Per Session:** [X]
- **Video Watch Time:** [X] hours total
- **Engagement Score:** [X]/100 quality metric

### Monetization
- **Conversion Rate:** [X]% (viewers → DFS players)
- **ARPU:** $[X] per user
- **Cash Rate:** [X]% of users win prizes
- **ROI:** [X]% average return for players

### Growth Trajectory
- **Weekly Growth:** [X]% increase in DAU
- **Cohort Retention:** [X]% retain after 30 days
- **Viral Coefficient:** [X] (shares per user)

---

## 🔐 Privacy & Compliance

### What We Track
- ✅ Session duration and timing
- ✅ Content engagement (what posts viewed)
- ✅ Video watch time
- ✅ DFS performance (scores, winnings)

### What We DON'T Track
- ❌ Personal identifying information (beyond user_id)
- ❌ Device fingerprinting
- ❌ Third-party tracking cookies
- ❌ Off-platform behavior

### Compliance
- **GDPR:** User data is anonymized, can be deleted on request
- **CCPA:** Users can opt-out via account settings
- **Data Retention:** 24 months, then anonymized
- **Export:** Users can export their data anytime

---

## 🧪 Testing & Validation

### Manual Testing

1. **Session Tracking**
   ```bash
   # Visit /highlights
   # Stay for 2 minutes
   # Check database:
   SELECT * FROM user_engagement_sessions 
   WHERE user_id = '[your_user_id]' 
   ORDER BY session_start DESC LIMIT 1;
   ```

2. **Post View Tracking**
   ```bash
   # Watch a post with multiple slides
   # Navigate through slides
   # Check database:
   SELECT * FROM user_post_views 
   WHERE user_id = '[your_user_id]' 
   ORDER BY view_started_at DESC LIMIT 1;
   ```

3. **Video Tracking**
   ```bash
   # Watch a video for 30 seconds
   # Check database:
   SELECT event_data->'watch_seconds' as seconds
   FROM engagement_events 
   WHERE event_type = 'video_progress'
   AND user_id = '[your_user_id]'
   ORDER BY event_timestamp DESC LIMIT 5;
   ```

### Automated Testing

```typescript
// Test engagement tracking
describe('Engagement Tracking', () => {
  it('starts session on mount', async () => {
    const { result } = renderHook(() => useEngagementTracking(userId))
    await act(async () => {
      await result.current.startSession('/highlights')
    })
    expect(result.current.isTracking).toBe(true)
  })
  
  it('tracks post views', async () => {
    const { result } = renderHook(() => useEngagementTracking(userId))
    await act(async () => {
      await result.current.startPostView(postId, 5, false)
    })
    expect(result.current.sessionMetrics.postsViewed).toBe(1)
  })
})
```

---

## 🐛 Troubleshooting

### Sessions Not Recording

**Problem:** No rows in `user_engagement_sessions`

**Solutions:**
1. Check RLS policies: `SELECT * FROM user_engagement_sessions` (as admin)
2. Verify user is authenticated: `SELECT auth.uid()`
3. Check browser console for errors
4. Verify Supabase function exists: `SELECT * FROM pg_proc WHERE proname = 'start_user_session'`

### Video Time Not Tracking

**Problem:** `total_video_watch_seconds` is always 0

**Solutions:**
1. Check video ref is attached: `console.log(videoRef.current)`
2. Verify `useVideoTracking` hook is called
3. Check `onVideoProgress` callback is passed to GameCard
4. Look for event errors in console

### DFS Stats Not Updating

**Problem:** `dfs_user_statistics` shows old data

**Solutions:**
1. Manually trigger: `SELECT recalculate_dfs_user_stats('[user_id]')`
2. Check trigger is active: `SELECT * FROM pg_trigger WHERE tgname = 'trigger_dfs_entry_stats_update'`
3. Verify entries exist: `SELECT * FROM dfs_entries WHERE user_id = '[user_id]'`

### Materialized Views Empty

**Problem:** `daily_engagement_metrics` has no rows

**Solutions:**
1. Manually refresh: `REFRESH MATERIALIZED VIEW daily_engagement_metrics`
2. Check source data exists: `SELECT COUNT(*) FROM user_engagement_sessions`
3. Verify cron job is running: `SELECT * FROM cron.job WHERE jobname = 'refresh-engagement-metrics'`

---

## 📚 Additional Resources

### SQL Queries for Common Analytics

#### Top Engaged Users (Last 30 Days)
```sql
SELECT 
  user_id,
  COUNT(*) as sessions,
  AVG(session_duration_seconds) as avg_duration,
  SUM(posts_viewed) as total_posts_viewed,
  AVG(engagement_score) as avg_engagement
FROM user_engagement_sessions
WHERE session_start >= NOW() - INTERVAL '30 days'
GROUP BY user_id
ORDER BY avg_engagement DESC
LIMIT 100;
```

#### Content Performance
```sql
SELECT 
  post_id,
  COUNT(*) as total_views,
  AVG(completion_percentage) as avg_completion_rate,
  AVG(view_duration_seconds) as avg_watch_time
FROM user_post_views
WHERE view_started_at >= NOW() - INTERVAL '7 days'
GROUP BY post_id
ORDER BY avg_completion_rate DESC
LIMIT 50;
```

#### Conversion Funnel Analysis
```sql
WITH cohort AS (
  SELECT user_id, MIN(session_start)::date as first_session
  FROM user_engagement_sessions
  GROUP BY user_id
)
SELECT 
  first_session,
  COUNT(DISTINCT c.user_id) as total_users,
  COUNT(DISTINCT d.user_id) as converted_users,
  (COUNT(DISTINCT d.user_id)::DECIMAL / COUNT(DISTINCT c.user_id)) * 100 as conversion_rate
FROM cohort c
LEFT JOIN dfs_entries d ON c.user_id = d.user_id
WHERE first_session >= NOW() - INTERVAL '90 days'
GROUP BY first_session
ORDER BY first_session DESC;
```

---

## 🎯 Next Steps

1. **Deploy the system** using `./deploy_engagement_tracking.sh`
2. **Set up monitoring** in Supabase dashboard
3. **Add the investor dashboard** to your main navigation
4. **Configure cron jobs** for daily refreshes
5. **Run for 30 days** to collect baseline metrics
6. **Export data** for investor presentations

---

## 💡 Tips for Investors

When presenting these metrics:

1. **Show Trends, Not Absolutes**
   - "DAU grew 150% in 30 days" > "We have 1,000 DAU"

2. **Compare to Benchmarks**
   - Mobile app avg session: 4-5 minutes
   - Social media completion rate: 25-40%
   - SaaS trial → paid conversion: 2-5%

3. **Tell a Story**
   - "Users who watch 3+ videos have 5x higher DFS conversion"
   - "Top 10% of engaged users generate 60% of revenue"

4. **Be Honest About Limitations**
   - Small sample size? Say so and show trajectory
   - Early stage? Show engagement quality over quantity

---

## 📞 Support

Questions? Issues? Need help presenting to investors?

- **Technical:** Check the troubleshooting section above
- **Business:** Review the investor pitch metrics section
- **Custom Analytics:** SQL queries can be customized for specific needs

---

**Built with ❤️ for HoopGeek**

Track everything. Optimize relentlessly. Scale confidently. 🚀

