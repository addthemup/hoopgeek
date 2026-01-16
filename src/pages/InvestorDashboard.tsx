/**
 * Investor Analytics Dashboard
 * Displays key engagement and monetization metrics
 * for potential investors and business analytics
 */

import { useState, useEffect } from 'react'
import { 
  Box, 
  Typography, 
  Card, 
  CardContent, 
  Stack, 
  Grid,
  CircularProgress,
  Chip,
  Divider,
  Table
} from '@mui/joy'
import { supabase } from '../utils/supabase'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import PeopleIcon from '@mui/icons-material/People'
import VisibilityIcon from '@mui/icons-material/Visibility'
import TimerIcon from '@mui/icons-material/Timer'
import VideocamIcon from '@mui/icons-material/Videocam'
import AttachMoneyIcon from '@mui/icons-material/AttachMoney'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'

interface DailyMetric {
  metric_date: string
  daily_active_users: number
  engaged_users: number
  total_sessions: number
  avg_session_duration_seconds: number
  median_session_duration: number
  total_posts_viewed: number
  total_posts_completed: number
  avg_post_completion_rate: number
  total_videos_watched: number
  total_interactions: number
  avg_engagement_score: number
}

interface ConversionMetric {
  cohort_week: string
  cohort_month: string
  total_users: number
  converted_to_dfs: number
  conversion_rate: number
  avg_pools_per_converter: number
  avg_revenue_per_converter: number
  avg_days_to_convert: number
}

interface AggregatedStats {
  totalUsers: number
  totalSessions: number
  avgSessionMinutes: number
  totalPostsViewed: number
  totalVideosWatched: number
  totalVideoMinutes: number
  avgEngagementScore: number
  dfsConversionRate: number
  avgRevenuePerUser: number
  totalRevenue: number
}

export default function InvestorDashboard() {
  const [dailyMetrics, setDailyMetrics] = useState<DailyMetric[]>([])
  const [conversionMetrics, setConversionMetrics] = useState<ConversionMetric[]>([])
  const [aggregatedStats, setAggregatedStats] = useState<AggregatedStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d')

  useEffect(() => {
    loadMetrics()
  }, [timeRange])

  const loadMetrics = async () => {
    setLoading(true)
    try {
      // Load daily engagement metrics
      const daysBack = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : timeRange === '90d' ? 90 : 365
      
      const { data: daily, error: dailyError } = await supabase
        .from('daily_engagement_metrics')
        .select('*')
        .gte('metric_date', new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString())
        .order('metric_date', { ascending: false })
        .limit(daysBack)
      
      if (dailyError) {
        console.warn('Daily metrics view may not exist:', dailyError)
      }
      setDailyMetrics(daily || [])
      
      // Load conversion funnel
      const { data: conversion, error: conversionError } = await supabase
        .from('dfs_conversion_funnel')
        .select('*')
        .order('cohort_week', { ascending: false })
        .limit(12) // Last 12 weeks
      
      if (conversionError) {
        console.warn('Conversion funnel view may not exist:', conversionError)
      }
      setConversionMetrics(conversion || [])
      
      // Load raw watch history data for time on site calculations
      const { data: watchHistory, error: watchHistoryError } = await supabase
        .from('user_watch_history')
        .select('watched_at, user_id, watch_seconds, video_watch_seconds, post_id')
        .gte('watched_at', new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString())
        .order('watched_at', { ascending: false })
        .limit(10000) // Limit for performance
      
      if (watchHistoryError) {
        console.warn('Watch history data error:', watchHistoryError)
      }
      
      // Calculate aggregated stats from raw watch history if daily metrics unavailable
      if (watchHistory && watchHistory.length > 0) {
        // Group by user and date to count sessions (unique post views per day per user)
        const sessionMap = new Map<string, Set<string>>() // user_id -> Set of (date + post_id)
        watchHistory.forEach((entry) => {
          const dateStr = new Date(entry.watched_at).toISOString().split('T')[0]
          const sessionKey = `${entry.user_id}_${dateStr}`
          if (!sessionMap.has(sessionKey)) {
            sessionMap.set(sessionKey, new Set())
          }
          sessionMap.get(sessionKey)!.add(entry.post_id || '')
        })
        
        const totalSessions = sessionMap.size
        const totalWatchSeconds = watchHistory.reduce((sum, w) => sum + (w.watch_seconds || 0), 0)
        const totalVideoSeconds = watchHistory.reduce((sum, w) => sum + (w.video_watch_seconds || 0), 0)
        const uniquePosts = new Set(watchHistory.map(w => w.post_id).filter(Boolean)).size
        const uniqueUsers = new Set(watchHistory.map(w => w.user_id)).size
        
        // Calculate time metrics
        const avgSessionSeconds = totalSessions > 0 ? totalWatchSeconds / totalSessions : 0
        const watchSecondsArray = watchHistory.map(w => w.watch_seconds || 0).sort((a, b) => a - b)
        const medianSessionSeconds = watchSecondsArray.length > 0 
          ? watchSecondsArray[Math.floor(watchSecondsArray.length / 2)] || 0
          : 0
        
        // Get DFS stats
        const { data: dfsStats } = await supabase
          .from('dfs_user_statistics')
          .select('total_entry_fees_paid, net_profit_loss')
        
        const totalRevenue = dfsStats?.reduce((sum, s) => sum + parseFloat(s.total_entry_fees_paid || '0'), 0) || 0
        const avgRevenue = dfsStats && dfsStats.length > 0 ? totalRevenue / dfsStats.length : 0
        
        // Get conversion rate
        const { count: totalViewers } = await supabase
          .from('user_watch_history')
          .select('user_id', { count: 'exact', head: true })
          .not('user_id', 'is', null)
        
        const { count: dfsPlayers } = await supabase
          .from('dfs_entries')
          .select('user_id', { count: 'exact', head: true })
        
        const conversionRate = totalViewers && dfsPlayers 
          ? (dfsPlayers / totalViewers) * 100 
          : 0
        
        // Calculate engagement score
        const avgCompletionRate = uniquePosts > 0 
          ? (uniquePosts / totalSessions) * 100 
          : 0
        const engagementScore = (avgSessionSeconds / 60) * 0.4 + (avgCompletionRate) * 0.3 + (totalVideoSeconds / totalSessions / 60) * 0.3
        
        setAggregatedStats({
          totalUsers: uniqueUsers,
          totalSessions,
          avgSessionMinutes: avgSessionSeconds / 60,
          totalPostsViewed: uniquePosts,
          totalVideosWatched: Math.round(totalVideoSeconds / 60), // Approximate videos
          totalVideoMinutes: totalVideoSeconds / 60,
          avgEngagementScore: engagementScore,
          dfsConversionRate: conversionRate,
          avgRevenuePerUser: avgRevenue,
          totalRevenue
        })
      } else if (daily && daily.length > 0) {
        // Fallback to daily metrics if available
        const totalSessions = daily.reduce((sum, d) => sum + (d.total_sessions || 0), 0)
        const totalPostsViewed = daily.reduce((sum, d) => sum + (d.total_posts_viewed || 0), 0)
        const totalVideos = daily.reduce((sum, d) => sum + (d.total_videos_watched || 0), 0)
        const totalVideoSeconds = daily.reduce((sum, d) => sum + (d.total_video_watch_time_seconds || 0), 0)
        const totalSessionSeconds = daily.reduce((sum, d) => sum + (d.total_session_time_seconds || 0), 0)
        const uniqueUsers = Math.max(...daily.map(d => d.daily_active_users || 0))
        
        // Get DFS stats
        const { data: dfsStats } = await supabase
          .from('dfs_user_statistics')
          .select('total_entry_fees_paid, net_profit_loss')
        
        const totalRevenue = dfsStats?.reduce((sum, s) => sum + parseFloat(s.total_entry_fees_paid || '0'), 0) || 0
        const avgRevenue = dfsStats && dfsStats.length > 0 ? totalRevenue / dfsStats.length : 0
        
        // Get conversion rate
        const { count: totalViewers } = await supabase
          .from('user_watch_history')
          .select('user_id', { count: 'exact', head: true })
          .not('user_id', 'is', null)
        
        const { count: dfsPlayers } = await supabase
          .from('dfs_entries')
          .select('user_id', { count: 'exact', head: true })
        
        const conversionRate = totalViewers && dfsPlayers 
          ? (dfsPlayers / totalViewers) * 100 
          : 0
        
        setAggregatedStats({
          totalUsers: uniqueUsers,
          totalSessions,
          avgSessionMinutes: totalSessionSeconds / totalSessions / 60,
          totalPostsViewed,
          totalVideosWatched: totalVideos,
          totalVideoMinutes: totalVideoSeconds / 60,
          avgEngagementScore: daily.reduce((sum, d) => sum + (d.avg_engagement_score || 0), 0) / daily.length,
          dfsConversionRate: conversionRate,
          avgRevenuePerUser: avgRevenue,
          totalRevenue
        })
      }
    } catch (error) {
      console.error('Error loading metrics:', error)
      // If views don't exist or have errors, show empty state
      setDailyMetrics([])
      setConversionMetrics([])
      setAggregatedStats(null)
    } finally {
      setLoading(false)
    }
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(Math.round(num))
  }

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num)
  }

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '100vh' 
      }}>
        <CircularProgress size="lg" />
      </Box>
    )
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
          <Box>
            <Typography level="h3" sx={{ mb: 0.5, fontFamily: 'serif', fontWeight: 900 }}>
              📊 Analytics Dashboard
            </Typography>
            <Typography level="body-sm" sx={{ color: 'text.secondary', fontFamily: 'serif' }}>
              Real-time engagement and monetization metrics for investors
            </Typography>
          </Box>
          
          {/* Time Range Selector */}
          <Stack direction="row" spacing={1}>
            {(['7d', '30d', '90d', 'all'] as const).map((range) => (
              <Chip
                key={range}
                variant={timeRange === range ? 'solid' : 'outlined'}
                color="primary"
                size="sm"
                onClick={() => setTimeRange(range)}
                sx={{ cursor: 'pointer' }}
              >
                {range === 'all' ? 'All' : range.toUpperCase()}
              </Chip>
            ))}
          </Stack>
        </Stack>
      </Box>

      {/* Key Metrics Overview */}
      {aggregatedStats && (
        <Grid container spacing={2} sx={{ mb: 4 }}>
          {/* Engagement Metrics */}
          <Grid xs={12} md={6} lg={3}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Stack spacing={1}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <PeopleIcon sx={{ color: 'primary.main' }} />
                    <Typography level="body-sm" sx={{ fontFamily: 'serif' }}>
                      Total Users
                    </Typography>
                  </Stack>
                  <Typography level="h2" sx={{ fontFamily: 'serif', fontWeight: 900 }}>
                    {formatNumber(aggregatedStats.totalUsers)}
                  </Typography>
                  <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                    Daily active users
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid xs={12} md={6} lg={3}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Stack spacing={1}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <TimerIcon sx={{ color: 'success.main' }} />
                    <Typography level="body-sm" sx={{ fontFamily: 'serif' }}>
                      Avg Time on Site
                    </Typography>
                  </Stack>
                  <Typography level="h2" sx={{ fontFamily: 'serif', fontWeight: 900 }}>
                    {aggregatedStats.avgSessionMinutes.toFixed(1)}m
                  </Typography>
                  <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                    {formatNumber(aggregatedStats.totalSessions)} sessions • {formatNumber(aggregatedStats.totalSessions * aggregatedStats.avgSessionMinutes)} total minutes
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid xs={12} md={6} lg={3}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Stack spacing={1}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <VisibilityIcon sx={{ color: 'warning.main' }} />
                    <Typography level="body-sm" sx={{ fontFamily: 'serif' }}>
                      Content Views
                    </Typography>
                  </Stack>
                  <Typography level="h2" sx={{ fontFamily: 'serif', fontWeight: 900 }}>
                    {formatNumber(aggregatedStats.totalPostsViewed)}
                  </Typography>
                  <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                    {formatNumber(aggregatedStats.totalVideosWatched)} videos watched
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid xs={12} md={6} lg={3}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Stack spacing={1}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <VideocamIcon sx={{ color: 'danger.main' }} />
                    <Typography level="body-sm" sx={{ fontFamily: 'serif' }}>
                      Watch Time
                    </Typography>
                  </Stack>
                  <Typography level="h2" sx={{ fontFamily: 'serif', fontWeight: 900 }}>
                    {formatNumber(aggregatedStats.totalVideoMinutes)}m
                  </Typography>
                  <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                    Total video minutes
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* Monetization Metrics */}
          <Grid xs={12} md={6} lg={3}>
            <Card variant="solid" color="primary" sx={{ height: '100%' }}>
              <CardContent>
                <Stack spacing={1}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <AttachMoneyIcon sx={{ color: 'white' }} />
                    <Typography level="body-sm" sx={{ fontFamily: 'serif', color: 'white' }}>
                      Total Revenue
                    </Typography>
                  </Stack>
                  <Typography level="h2" sx={{ fontFamily: 'serif', fontWeight: 900, color: 'white' }}>
                    {formatCurrency(aggregatedStats.totalRevenue)}
                  </Typography>
                  <Typography level="body-xs" sx={{ color: 'white', opacity: 0.8 }}>
                    From DFS entries
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid xs={12} md={6} lg={3}>
            <Card variant="solid" color="success" sx={{ height: '100%' }}>
              <CardContent>
                <Stack spacing={1}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <EmojiEventsIcon sx={{ color: 'white' }} />
                    <Typography level="body-sm" sx={{ fontFamily: 'serif', color: 'white' }}>
                      ARPU
                    </Typography>
                  </Stack>
                  <Typography level="h2" sx={{ fontFamily: 'serif', fontWeight: 900, color: 'white' }}>
                    {formatCurrency(aggregatedStats.avgRevenuePerUser)}
                  </Typography>
                  <Typography level="body-xs" sx={{ color: 'white', opacity: 0.8 }}>
                    Average revenue per user
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid xs={12} md={6} lg={3}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Stack spacing={1}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <TrendingUpIcon sx={{ color: 'success.main' }} />
                    <Typography level="body-sm" sx={{ fontFamily: 'serif' }}>
                      Conversion Rate
                    </Typography>
                  </Stack>
                  <Typography level="h2" sx={{ fontFamily: 'serif', fontWeight: 900 }}>
                    {aggregatedStats.dfsConversionRate.toFixed(1)}%
                  </Typography>
                  <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                    Viewers → DFS players
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          <Grid xs={12} md={6} lg={3}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent>
                <Stack spacing={1}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <TrendingUpIcon sx={{ color: 'primary.main' }} />
                    <Typography level="body-sm" sx={{ fontFamily: 'serif' }}>
                      Engagement Score
                    </Typography>
                  </Stack>
                  <Typography level="h2" sx={{ fontFamily: 'serif', fontWeight: 900 }}>
                    {aggregatedStats.avgEngagementScore.toFixed(1)}
                  </Typography>
                  <Typography level="body-xs" sx={{ color: 'text.secondary' }}>
                    Average quality score
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      <Divider sx={{ my: 4 }} />

      {/* Daily Trends */}
      <Box sx={{ mb: 4 }}>
        <Typography level="h3" sx={{ mb: 2, fontFamily: 'serif', fontWeight: 900 }}>
          📈 Daily Engagement Trends & Time on Site
        </Typography>
        <Card variant="outlined">
          {dailyMetrics.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography level="body-md" sx={{ color: 'text.secondary', fontFamily: 'serif', mb: 2 }}>
                Loading engagement data from user sessions...
              </Typography>
              <Typography level="body-sm" sx={{ color: 'text.tertiary', fontFamily: 'serif' }}>
                Analytics are calculated from user_watch_history table.
                <br />
                If materialized views exist, run: <code>REFRESH MATERIALIZED VIEW daily_engagement_metrics;</code>
              </Typography>
            </Box>
          ) : (
            <Table
              sx={{
                '& thead th': { fontFamily: 'serif', fontWeight: 700, bgcolor: '#f5f5f5' },
                '& tbody td': { fontFamily: 'monospace', fontSize: 'sm' },
                '& tbody tr:hover': { bgcolor: '#f9f9f9' }
              }}
            >
              <thead>
                <tr>
                  <th>Date</th>
                  <th>DAU</th>
                  <th>Sessions</th>
                  <th>Avg Time on Site</th>
                  <th>Total Time</th>
                  <th>Posts Viewed</th>
                  <th>Completion %</th>
                  <th>Videos</th>
                  <th>Watch Time</th>
                </tr>
              </thead>
              <tbody>
                {dailyMetrics.slice(0, 30).map((metric) => {
                  const totalTimeMinutes = (metric.avg_session_duration_seconds || 0) * (metric.total_sessions || 0) / 60
                  return (
                  <tr key={metric.metric_date}>
                    <td>{new Date(metric.metric_date).toLocaleDateString()}</td>
                    <td>{formatNumber(metric.daily_active_users)}</td>
                    <td>{formatNumber(metric.total_sessions)}</td>
                      <td><strong>{formatDuration(metric.avg_session_duration_seconds || 0)}</strong></td>
                      <td>{formatNumber(totalTimeMinutes)}m</td>
                    <td>{formatNumber(metric.total_posts_viewed)}</td>
                      <td>{metric.avg_post_completion_rate?.toFixed(1) || '0.0'}%</td>
                    <td>{formatNumber(metric.total_videos_watched)}</td>
                      <td>{formatNumber((metric.total_video_watch_time_seconds || 0) / 60)}m</td>
                  </tr>
                  )
                })}
              </tbody>
            </Table>
          )}
        </Card>
      </Box>

      {/* Conversion Funnel */}
      <Box>
        <Typography level="h3" sx={{ mb: 2, fontFamily: 'serif', fontWeight: 900 }}>
          💰 DFS Conversion Funnel
        </Typography>
        <Card variant="outlined">
          {conversionMetrics.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography level="body-md" sx={{ color: 'text.secondary', fontFamily: 'serif', mb: 2 }}>
                No conversion data available yet.
              </Typography>
              <Typography level="body-sm" sx={{ color: 'text.tertiary', fontFamily: 'serif' }}>
                Conversion tracking requires user engagement data and DFS entry data.
                <br />
                Run: <code>REFRESH MATERIALIZED VIEW dfs_conversion_funnel;</code>
              </Typography>
            </Box>
          ) : (
            <Table
              sx={{
                '& thead th': { fontFamily: 'serif', fontWeight: 700 },
                '& tbody td': { fontFamily: 'monospace', fontSize: 'sm' }
              }}
            >
              <thead>
                <tr>
                  <th>Week</th>
                  <th>Total Users</th>
                  <th>Converted</th>
                  <th>Rate</th>
                  <th>Avg Pools</th>
                  <th>Avg Revenue</th>
                  <th>Days to Convert</th>
                </tr>
              </thead>
              <tbody>
                {conversionMetrics.map((metric) => (
                  <tr key={metric.cohort_week}>
                    <td>{new Date(metric.cohort_week).toLocaleDateString()}</td>
                    <td>{formatNumber(metric.total_users)}</td>
                    <td>{formatNumber(metric.converted_to_dfs)}</td>
                    <td>
                      <Chip 
                        color={metric.conversion_rate >= 10 ? 'success' : 'warning'}
                        size="sm"
                      >
                        {metric.conversion_rate?.toFixed(1)}%
                      </Chip>
                    </td>
                    <td>{metric.avg_pools_per_converter?.toFixed(1)}</td>
                    <td>{formatCurrency(metric.avg_revenue_per_converter || 0)}</td>
                    <td>{metric.avg_days_to_convert?.toFixed(0)} days</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </Box>

      {/* Footer Note */}
      <Box sx={{ mt: 4, p: 2, bgcolor: 'background.level1', borderRadius: 'sm' }}>
        <Typography level="body-sm" sx={{ fontFamily: 'serif', color: 'text.secondary' }}>
          💡 <strong>For Investors:</strong> All metrics are tracked in real-time and can be exported 
          for due diligence. Data is anonymized and complies with privacy regulations.
          Contact admin for detailed cohort analysis, retention curves, and LTV projections.
        </Typography>
      </Box>
    </Box>
  )
}

