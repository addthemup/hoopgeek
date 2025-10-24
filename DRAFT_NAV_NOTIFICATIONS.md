# Draft Navigation Notifications

## ✅ Features Implemented

### 1. **Chat Mentions Notification** 🔔

Shows a badge on the **Chat tab** when the logged-in user is mentioned in chat.

**How it works:**
- Automatically checks for `@YourTeamName` mentions every 5 seconds
- Shows count of unread mentions since you last viewed chat
- Badge disappears when you open the chat tab
- Uses localStorage to track when you last viewed chat
- Badge color: **Red (danger)**

**Example:**
```
Chat (3)  ← Red badge shows 3 unread mentions
```

### 2. **Your Pick Notification** 🎯

Shows a pulsing badge on the **Picks tab** when it's your turn to draft.

**How it works:**
- Checks current draft pick every 2 seconds
- Compares current pick's team ID with your team ID
- Shows **"!"** badge when it's your turn
- Badge pulses with animation to grab attention
- Badge color: **Green (success)** to indicate action needed

**Example:**
```
Picks (!)  ← Green pulsing badge when it's your turn
```

**Animation:**
- Subtle pulse effect (scale 1.0 → 1.1 → 1.0)
- 2-second cycle
- Opacity fades slightly during pulse

## 🎨 Visual Design

### Chat Badge (Mentions)
- **Color**: Red (danger)
- **Content**: Number of unread mentions
- **Behavior**: Static display, updates every 5 seconds
- **Clears**: When user opens Chat tab

### Picks Badge (Your Turn)
- **Color**: Green (success) 
- **Content**: Exclamation mark "!"
- **Behavior**: Pulsing animation
- **Animation**: 2s pulse cycle
- **Visibility**: Only shows when it's your turn

### Trade Badge (Pending Offers)
- **Color**: Red (danger)
- **Content**: Number of pending trade offers
- **Behavior**: Static display
- **Visibility**: Only shows when count > 0

## 🔧 Technical Implementation

### Chat Mentions Hook
```typescript
useChatMentions(leagueId)
- Queries fantasy_draft_chat_messages
- Filters for messages containing @YourTeamName
- Excludes your own messages
- Counts mentions since last viewed
- Refetches every 5 seconds
```

### Your Pick Detection
```typescript
useCurrentPick() from draftStore
- Gets current draft pick from Zustand store
- Compares fantasy_team_id with userTeamId
- Refetches every 2 seconds via React Query
- Returns boolean: isUserOnClock
```

### Badge Rendering Logic
```typescript
// Chat: Show mention count if > 0
badge: mentionCount > 0 ? mentionCount : undefined

// Picks: Show "!" if user is on clock
badge: isUserOnClock ? '!' : undefined

// Trade: Show pending count if > 0
badge: pendingCount > 0 ? pendingCount : undefined
```

## 📊 Performance

- **Chat mentions**: Refetches every 5 seconds
- **Your pick status**: Refetches every 2 seconds
- **Trade count**: Refetches every 30 seconds
- **Minimal overhead**: Uses React Query caching
- **Smart updates**: Only refetches when component is mounted

## 🧪 Testing

### Test Chat Mentions
1. Open draft in two browser windows
2. In Window 1: Send a message mentioning Window 2's team
   - Example: "Hey @Team Name, your turn!"
3. In Window 2: Check Chat tab for badge with count
4. In Window 2: Click Chat tab
5. Badge should disappear after viewing

### Test Your Pick Notification
1. Join a draft as a team
2. Watch the Picks tab
3. When it becomes your turn:
   - Badge should appear: **(!)**
   - Badge should pulse (green)
   - Badge should disappear after you make a pick

### Test Trade Notifications
1. Send yourself a trade offer
2. Check Trade tab for badge with count
3. Badge should show number of pending offers

## 🐛 Troubleshooting

### Chat mentions not showing?

**Check browser console for:**
```
Error fetching chat mentions: [error]
```

**Verify:**
1. You have a team in the league
2. Someone actually mentioned your team name with `@`
3. localStorage isn't blocked
4. Check RLS policies on `fantasy_draft_chat_messages`

**Debug query:**
```sql
SELECT * FROM fantasy_draft_chat_messages
WHERE league_id = 'YOUR_LEAGUE_ID'
AND message ILIKE '%@YOUR_TEAM_NAME%'
ORDER BY created_at DESC;
```

### Your Pick badge not showing?

**Check browser console for:**
```
🎯 Draft Store: Current pick updated
```

**Verify:**
1. Draft is active (not scheduled/completed)
2. You have a team in the league
3. Current pick is in the database
4. `useCurrentPick()` is returning data

**Debug query:**
```sql
-- Check current pick
SELECT * FROM fantasy_draft_current_state
WHERE league_id = 'YOUR_LEAGUE_ID';

-- Check if it's your team's turn
SELECT 
  fdo.fantasy_team_id,
  ft.team_name,
  fdo.pick_number,
  fdo.round
FROM fantasy_draft_order fdo
JOIN fantasy_teams ft ON ft.id = fdo.fantasy_team_id
JOIN fantasy_draft_current_state fdcs ON fdcs.current_pick_id = fdo.id
WHERE fdcs.league_id = 'YOUR_LEAGUE_ID';
```

### Badges showing wrong count?

**Solutions:**
1. **Hard refresh**: Cmd/Ctrl + Shift + R
2. **Clear localStorage**: 
   ```javascript
   localStorage.removeItem('chat-last-viewed-YOUR_LEAGUE_ID-YOUR_TEAM_ID');
   ```
3. **Check data in database** using queries above

## 💡 Future Enhancements

Potential additions:
- Sound effects when mentioned or on clock
- Browser notifications when mentioned
- Toast notifications for picks
- Customizable notification preferences
- Mention history view
- Mute specific users
- Different badge colors for different message types
- Desktop notifications via Notification API

## 🎯 User Experience

### Visual Hierarchy
1. **Green pulsing badge** = Urgent action (Your Pick)
2. **Red static badge** = Attention needed (Mentions, Trades)
3. **No badge** = No action required

### Attention Grabbing
- Pulsing animation only for "Your Pick"
- Static badges for informational notifications
- Color coding for priority (green > red)

### Badge Behavior
- **Appears**: When condition is met
- **Updates**: Automatically via polling
- **Disappears**: When action is taken or condition resolves
- **Persists**: Across page refreshes (localStorage)

---

The notification system enhances the draft experience by keeping users informed of important events without being intrusive! 🏀

