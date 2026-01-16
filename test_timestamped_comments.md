# Testing Timestamped Comments

## Migration Applied ✅
- `add_timestamped_comments.sql` adds columns: `slide_index`, `timestamp_seconds`, `position_x`, `position_y`
- Indexes created for performance

## How to Test

### 1. Run the Migration
```bash
psql $DATABASE_URL -f supabase/migrations/add_timestamped_comments.sql
```

### 2. Test Comment at Current Time
1. Navigate to Highlights page
2. Play a video
3. Open comments drawer (click comment icon)
4. Watch for "Comment at X:XX" button to appear (shows current video time)
5. Toggle it ON (pink highlight)
6. Type a comment and submit
7. Comment should be saved with `timestamp_seconds` set

### 3. Test Timestamped Comments Overlay
1. Create a few timestamped comments at different times (e.g., 5s, 10s, 15s)
2. Play the video
3. Comments should appear on the right side as video reaches those timestamps
4. Comments fade in/out based on proximity to timestamp
5. Click a comment to seek to that timestamp

### 4. Test Comments Drawer
1. Open comments drawer
2. Comments with timestamps show "@ 0:05" etc. (clickable)
3. Click timestamp to seek video to that time
4. Comments sorted by timestamp first, then by created_at

### 5. Test Comment Loading
- Comments load with avatar URLs (if user has avatar)
- Timestamped comments load separately for overlay
- Regular comments still work (no timestamp)

## Expected Behavior

- **Comment at current time button**: Shows when video is playing, toggles pink when ON
- **Timestamped comments overlay**: Appears on right side of video during playback
- **Clickable timestamps**: In drawer, timestamps are clickable and seek video
- **Comment clustering**: Multiple comments at same time show "+X more"
- **Fade animations**: Comments fade based on how close video time is to comment timestamp


