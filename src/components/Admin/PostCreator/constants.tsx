/**
 * PostCreator constants — post type options, section type options, tags.
 *
 * Separated from the monolith so generators and other modules can import
 * the registry without pulling in 2,700 lines of React component code.
 */

import {
  SportsSoccer,
  Person,
  EmojiEvents,
  TrendingUp,
  LocalHospital,
  Groups,
  CalendarMonth,
  Star,
  Casino,
  Schedule,
  Article,
  Image as ImageIcon,
  VideoLibrary,
  TextFields,
  BarChart,
  FormatQuote,
  Collections,
  TableChart,
  Link as LinkIcon,
  MonetizationOn,
} from '@mui/icons-material'
import type { SectionType, FeedTag } from '../../../types/feed'
import type { PostTypeOption } from './types'

// ─── Post type options (step 0) ────────────────────────────

// Order: row 1 Upcoming | Game Recap | Blog; row 2 Injury | Prop Prediction | Prop Results;
// row 3 Team of the Week | TOTN | Draft; row 4 POW | POM | Player Spotlight
export const POST_TYPE_OPTIONS: PostTypeOption[] = [
  { value: 'upcoming', label: 'Upcoming', description: 'Game preview — matchup stats, injuries, props, key players, and related posts.', icon: <Schedule />, color: '#8B5CF6', tags: ['recap'], dataSourceMode: 'matchup' },
  { value: 'game_recap', label: 'Game Recap', description: 'Full story for a completed NBA game — score, highlights, advantages, play-by-play.', icon: <SportsSoccer />, color: '#FFC72C', tags: ['recap', 'highlights'], dataSourceMode: 'game' },
  { value: 'blog', label: 'Blog', description: 'Editorial or long-form article with rich text and media.', icon: <Article />, color: '#0EA5E9', tags: ['analysis'], dataSourceMode: 'manual' },
  { value: 'injury_report', label: 'Injury Report', description: 'Daily injury updates — who\'s out, questionable, or returning.', icon: <LocalHospital />, color: '#EF4444', tags: ['injuries'], dataSourceMode: 'matchup' },
  { value: 'prop_prediction', label: 'Prop Prediction', description: 'Pre-game prop predictions with confidence levels and trends.', icon: <Casino />, color: '#FB923C', tags: ['props'], dataSourceMode: 'matchup' },
  { value: 'prop_results', label: 'Prop Results', description: 'Post-game results for prop predictions — overs, unders, pushes.', icon: <TrendingUp />, color: '#10B981', tags: ['props'], dataSourceMode: 'matchup' },
  { value: 'team_of_week', label: 'Team of the Week', description: 'Weekly best lineup — same model as TOTN but across 7 days.', icon: <CalendarMonth />, color: '#A78BFA', tags: ['awards', 'highlights'], dataSourceMode: 'totw' },
  { value: 'team_of_night', label: 'Team of the Night', description: 'Daily best-performing lineup with player highlights and data overlays.', icon: <Groups />, color: '#F59E0B', tags: ['awards', 'highlights'], dataSourceMode: 'totn' },
  { value: 'draft', label: 'Draft', description: 'Tank race snapshot — standings (worst-first) + draft prospect rankings. Frozen aggregate from daily maintenance.', icon: <TrendingUp />, color: '#6366F1', tags: ['analysis'], dataSourceMode: 'manual' },
  { value: 'player_of_week', label: 'Player of the Week', description: 'Weekly MVP spotlight with cumulative stats and key moments.', icon: <Star />, color: '#34D399', tags: ['awards', 'highlights'], dataSourceMode: 'pow' },
  { value: 'player_of_month', label: 'Player of the Month', description: 'Monthly MVP spotlight with in-depth analysis.', icon: <EmojiEvents />, color: '#F472B6', tags: ['awards', 'analysis'], dataSourceMode: 'pom' },
  { value: 'player_spotlight', label: 'Player Spotlight', description: 'Standout performance from a single player with stats, highlights, and analysis.', icon: <Person />, color: '#60A5FA', tags: ['highlights'], dataSourceMode: 'game' },
  { value: 'dfs', label: 'DFS', description: 'DFS pools, entries, leaderboards — snapshot from dfs backend. Auto-generate from dfs_* tables.', icon: <MonetizationOn />, color: '#22C55E', tags: ['analysis'], dataSourceMode: 'manual' },
]

// ─── Section type options (step 3 add modal) ───────────────

export const SECTION_TYPE_OPTIONS: { value: SectionType; label: string; icon: React.ReactNode; description: string }[] = [
  { value: 'hero', label: 'Hero Image', icon: <ImageIcon />, description: 'Full-width hero banner with optional badge' },
  { value: 'headline', label: 'Headline', icon: <TextFields />, description: 'Section heading with optional subtitle' },
  { value: 'rich_text', label: 'Rich Text', icon: <TextFields />, description: 'Markdown text block with inline post links' },
  { value: 'player_highlight', label: 'Player Highlight', icon: <Person />, description: 'Player card with stats, headshot, and data overlays' },
  { value: 'lineup_card', label: 'Lineup Card', icon: <Groups />, description: 'Starting lineup with fantasy points and stats' },
  { value: 'stat_comparison', label: 'Stat Comparison', icon: <BarChart />, description: 'Side-by-side team stat comparison' },
  { value: 'video_clip', label: 'Video Clip', icon: <VideoLibrary />, description: 'Embedded video with caption and timestamp' },
  { value: 'video_carousel', label: 'Video Carousel', icon: <Collections />, description: 'Instagram-style carousel of MP4 clips with play metadata' },
  { value: 'chart', label: 'Chart', icon: <BarChart />, description: 'Data visualization — radar, scatter, shot chart, etc.' },
  { value: 'prop_card', label: 'Prop Card', icon: <Casino />, description: 'Player prop prediction or result card' },
  { value: 'injury_card', label: 'Injury Card', icon: <LocalHospital />, description: 'Player injury status card' },
  { value: 'pull_quote', label: 'Pull Quote', icon: <FormatQuote />, description: 'Highlighted quote or stat callout' },
  { value: 'gallery', label: 'Gallery', icon: <Collections />, description: 'Multi-image gallery with captions' },
  { value: 'box_score', label: 'Box Score', icon: <TableChart />, description: 'Full box score table for both teams' },
  { value: 'post_link', label: 'Post Link', icon: <LinkIcon />, description: 'Card linking to another HoopGeek post (related content, cross-reference)' },
  { value: 'tweet_embed', label: 'Tweet Embed', icon: <Article />, description: 'Embed an X (Twitter) post — paste a tweet URL as a source or reference' },
]

// ─── Tag options ────────────────────────────────────────────

export const TAG_OPTIONS: FeedTag[] = ['highlights', 'awards', 'props', 'injuries', 'recap', 'analysis']

// ─── TOTN/TOTW slot order ──────────────────────────────────

export const LINEUP_SLOTS = ['s1', 's2', 's3', 's4', 's5', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7'] as const

// ─── Default section content by type ───────────────────────

export function getDefaultSectionContent(type: SectionType): any {
  switch (type) {
    case 'hero': return { image_url: '', gradient_overlay: true, badge: '', team_tricode: '' }
    case 'headline': return { text: '', subtitle: '' }
    case 'rich_text': return { markdown: '' }
    case 'player_highlight': return { player_id: 0, name: '', team_tricode: '', stats: {} }
    case 'lineup_card': return { starters: [], bench: [], total_fantasy_points: 0 }
    case 'stat_comparison': return { title: '', teams: [{ tricode: '', value: 0 }, { tricode: '', value: 0 }] }
    case 'video_clip': return { video_url: '', caption: '' }
    case 'video_carousel': return { clips: [] }
    case 'chart': return { chart_type: 'radar', chart_props: {} }
    case 'prop_card': return { player_id: 0, player_name: '', bet_type: 'points', line: 0, result: 'pending' }
    case 'injury_card': return { player_id: 0, player_name: '', team_tricode: '', status: 'QUESTIONABLE', injury: '' }
    case 'pull_quote': return { text: '', icon: 'chart' }
    case 'gallery': return { images: [] }
    case 'box_score': return { home: { tricode: '', players: [] }, away: { tricode: '', players: [] } }
    case 'post_link': return { post_id: '', slug: '', title: '', post_type: 'game_recap', context: '', preview_text: '' }
    case 'tweet_embed': return { tweet_url: '', caption: '', fallback_text: '' }
    default: return {}
  }
}
