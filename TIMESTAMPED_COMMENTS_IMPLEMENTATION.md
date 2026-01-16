# SoundCloud-Style Timestamped Comments Implementation Plan

## Overview
Transform the existing comment system to support timestamped comments that appear as videos play, similar to SoundCloud.

## Difficulty Assessment: **Medium** (6-8 hours)

## Current State ✅
- Basic comments system exists (`feed_comments` table)
- Video player integrated with `useVideoTracking`
- Comments drawer component exists
- Video refs available in `GameCard` component

## Implementation Steps

### 1. Database Changes ✅ (DONE)
- Migration file created: `add_timestamped_comments.sql`
- Adds: `slide_index`, `timestamp_seconds`, `position_x`, `position_y`
- Indexes for performance

### 2. New Components Needed

#### A. `TimestampedCommentsOverlay.tsx` (Medium-High Difficulty)
**Purpose**: Overlay component that shows comments with avatars as video plays

**Features**:
- Tracks current video time
- Filters comments by timestamp range (±2 seconds)
- Displays user avatars with comment text
- Smooth fade in/out animations
- Handles comment clustering (multiple comments at same time)
- Click to seek to comment timestamp

**Props**:
```typescript
interface TimestampedCommentsOverlayProps {
  videoRef: React.RefObject<HTMLVideoElement>
  currentSlideIndex: number
  contentId: string
  comments: TimestampedComment[]
  userId?: string
}
```

#### B. `CommentTimeline.tsx` (Medium Difficulty)
**Purpose**: Timeline scrubber showing comment markers

**Features**:
- Visual markers on timeline for each comment
- Click marker to seek to timestamp
- Shows comment count per second
- Hover to preview comment

**Props**:
```typescript
interface CommentTimelineProps {
  duration: number // Video duration
  comments: TimestampedComment[]
  currentTime: number
  onSeek: (time: number) => void
}
```

#### C. `TimestampCommentInput.tsx` (Low-Medium Difficulty)
**Purpose**: Comment input with timestamp capture

**Features**:
- "Comment at current time" button
- Shows current timestamp when recording
- Preview of where comment will appear
- Supports replies to timestamped comments

### 3. Updated Components

#### A. `CommentsDrawer.tsx` (Medium Difficulty)
**Changes**:
- Load comments with timestamp data
- Sort by timestamp instead of created_at
- Show timestamp badges: "At 0:15"
- Click timestamp to seek video
- Filter by slide_index

#### B. `GameCard.tsx` (Medium Difficulty)
**Changes**:
- Track current video time state
- Pass timestamp to comment input
- Integrate `TimestampedCommentsOverlay`
- Add `CommentTimeline` below video
- Handle seeking from comments

### 4. Data Structure

```typescript
interface TimestampedComment {
  id: string
  content_id: string
  user_id: string
  username: string
  avatar_url?: string
  comment_text: string
  slide_index: number
  timestamp_seconds: number | null // null for non-video slides
  position_x?: number // For non-video slides
  position_y?: number // For non-video slides
  parent_comment_id: string | null
  created_at: string
  replies?: TimestampedComment[]
}
```

### 5. Key Implementation Details

#### Video Time Tracking
```typescript
const [currentVideoTime, setCurrentVideoTime] = useState(0)

useEffect(() => {
  const video = videoRef.current
  if (!video) return

  const handleTimeUpdate = () => {
    setCurrentVideoTime(video.currentTime)
  }

  video.addEventListener('timeupdate', handleTimeUpdate)
  return () => video.removeEventListener('timeupdate', handleTimeUpdate)
}, [videoRef])
```

#### Comment Filtering by Timestamp
```typescript
const visibleComments = useMemo(() => {
  return comments.filter(comment => {
    if (comment.slide_index !== currentSlideIndex) return false
    if (!comment.timestamp_seconds) return false
    
    const timeDiff = Math.abs(comment.timestamp_seconds - currentVideoTime)
    return timeDiff <= 2 // Show comments within 2 seconds
  })
}, [comments, currentSlideIndex, currentVideoTime])
```

#### Comment Clustering
```typescript
// Group comments by timestamp (within 1 second)
const clusteredComments = useMemo(() => {
  const clusters = new Map<number, TimestampedComment[]>()
  
  visibleComments.forEach(comment => {
    const key = Math.floor(comment.timestamp_seconds!)
    if (!clusters.has(key)) clusters.set(key, [])
    clusters.get(key)!.push(comment)
  })
  
  return Array.from(clusters.values())
}, [visibleComments])
```

### 6. Performance Considerations

1. **Debounce time updates**: Don't update on every frame
2. **Memoize filtered comments**: Only recalculate when time changes significantly
3. **Virtual scrolling**: For comment timeline if many comments
4. **Lazy load**: Load comments when video starts playing
5. **Comment limit**: Max 5-10 visible comments at once

### 7. UX Enhancements

1. **Comment Animation**: Fade in/out based on proximity to timestamp
2. **Avatar Positioning**: Stagger avatars to avoid overlap
3. **Comment Preview**: Show first few words on timeline hover
4. **Seek on Click**: Click comment timestamp to jump to that moment
5. **Visual Feedback**: Highlight active comment in drawer

### 8. Mobile Considerations

- **Touch-friendly**: Larger tap targets for comment markers
- **Simplified overlay**: Fewer comments visible at once
- **Bottom sheet**: Comments drawer from bottom
- **Swipe gestures**: Swipe comments away

## Estimated Time Breakdown

- Database migration: 30 min ✅
- `TimestampedCommentsOverlay`: 2-3 hours
- `CommentTimeline`: 1-2 hours
- `TimestampCommentInput`: 1 hour
- Update `CommentsDrawer`: 1 hour
- Update `GameCard` integration: 1-2 hours
- Testing & polish: 1-2 hours

**Total: 6-8 hours**

## Next Steps

1. Run database migration
2. Create `TimestampedCommentsOverlay` component
3. Update comment queries to include timestamp data
4. Integrate overlay into `GameCard`
5. Add timeline component
6. Test with multiple comments at different timestamps


