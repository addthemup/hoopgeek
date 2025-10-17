# User Customization System - Quick Reference

## 🚀 Deploy in 3 Steps

### Step 1: Deploy Database Schema
```bash
./scripts/deploy_user_customization.sh
```
Or manually run SQL files in Supabase dashboard (see Implementation guide)

### Step 2: Start Dev Server
```bash
npm run dev
```

### Step 3: Test It Out
1. Sign in to your app
2. Click your **email address** in the top navigation
3. You'll see the User Settings page! 🎉

---

## 📁 Files Created (14 total)

### Database Schema (6 files)
- `supabase/build/user_profiles.sql`
- `supabase/build/user_favorite_players.sql`
- `supabase/build/user_favorite_teams.sql`
- `supabase/build/user_notification_preferences.sql`
- `supabase/build/user_feed_preferences.sql`
- `supabase/build/user_customization_system.sql` (master)

### Frontend (3 files)
- `src/pages/UserSettings.tsx` - Settings page with 4 tabs
- `src/types/userSettings.ts` - TypeScript types
- `src/hooks/useUserSettings.ts` - 15+ React Query hooks

### Documentation (4 files)
- `supabase/USER_CUSTOMIZATION_SCHEMA.md` - Complete schema docs
- `USER_CUSTOMIZATION_IMPLEMENTATION.md` - Deployment guide
- `USER_CUSTOMIZATION_SUMMARY.md` - Overview of everything
- `QUICK_REFERENCE_USER_CUSTOMIZATION.md` (this file)

### Scripts (1 file)
- `scripts/deploy_user_customization.sh` - Auto-deployment script

---

## 🔧 Files Modified (2 total)

1. **`src/components/TopNavigation.tsx`**
   - Made email clickable → navigates to `/settings`

2. **`src/App.tsx`**
   - Added route: `<Route path="settings" element={<UserSettings />} />`

---

## ⚡ Quick Integration Examples

### Add "Favorite" Button to Player Page

```typescript
// In PlayerPage.tsx
import { useToggleFavoritePlayer, useIsPlayerFavorited } from '../hooks/useUserSettings';

const { data: isFavorited } = useIsPlayerFavorited(user?.id, playerId);
const toggleFavorite = useToggleFavoritePlayer();

<Button
  startDecorator={<Star />}
  variant={isFavorited ? 'solid' : 'outlined'}
  onClick={() => toggleFavorite.mutateAsync({ userId: user.id, playerId })}
>
  {isFavorited ? 'Favorited ⭐' : 'Add to Favorites'}
</Button>
```

### Use Feed Preferences in Home Page

```typescript
// In Home.tsx
import { useFeedPreferences } from '../hooks/useUserSettings';

const { data: feedPrefs } = useFeedPreferences(user?.id);

// Filter games based on user preferences
const filteredGames = games.filter(game => {
  const funScore = game.fun_score / 10;
  return funScore >= (feedPrefs?.min_fun_score_threshold || 0);
});
```

### Check Notification Preferences

```typescript
// Before sending a notification
import { useNotificationPreferences } from '../hooks/useUserSettings';

const { data: notifPrefs } = useNotificationPreferences(user?.id);

if (notifPrefs?.trade_proposals) {
  // Send trade proposal notification
  sendNotification(...)
}
```

---

## 📊 Database Quick Reference

### Tables Created
| Table | Purpose | Auto-created? |
|-------|---------|---------------|
| `user_profiles` | Display name, avatar, bio, theme | ✅ Yes |
| `user_favorite_players` | Favorite NBA players | ❌ No |
| `user_favorite_teams` | Favorite NBA teams | ❌ No |
| `user_notification_preferences` | 18 notification settings | ✅ Yes |
| `user_feed_preferences` | Feed algorithm settings | ✅ Yes |

### Most Useful Functions

```sql
-- Toggle favorite player (add if not exists, remove if exists)
SELECT toggle_favorite_player('user-uuid', player_id);

-- Toggle favorite team
SELECT toggle_favorite_team('user-uuid', team_id);

-- Get all favorites with details
SELECT * FROM get_user_favorite_players('user-uuid');
SELECT * FROM get_user_favorite_teams('user-uuid');

-- Check if favorited
SELECT is_player_favorited('user-uuid', player_id);
SELECT is_team_favorited('user-uuid', team_id);

-- Update preferences
SELECT update_user_notification_preferences('user-uuid', p_new_highlights := true);
SELECT update_user_feed_preferences('user-uuid', p_min_fun_score_threshold := 8.0);
```

---

## 🎨 User Settings Page Features

### Tab 1: Profile
- Edit display name
- Write bio
- Choose theme (light/dark/system)

### Tab 2: Favorites
- View favorite players with avatars
- View favorite teams with logos
- Remove favorites
- Browse to add more

### Tab 3: Notifications (18 settings)
- **General**: Master toggle, email, push
- **Content**: Highlights, featured games
- **Fantasy**: League results, trades, lineups
- **Players**: Injuries, games, milestones
- **Teams**: Games, trades

### Tab 4: Feed Customization
- Prioritize favorite teams/players
- Min fun score threshold (0-10)
- Days back to show (7-365)
- Content filters (buzzer beaters, OT, etc.)
- View mode (grid/list/compact)
- Games per page (6-36)

---

## 🔐 Security Features

✅ Row Level Security (RLS) on all tables  
✅ Users can only access their own data  
✅ Authentication checks in all functions  
✅ Foreign key constraints  
✅ Unique constraints  
✅ Input validation  

---

## 🐛 Troubleshooting

### "Not authenticated" error
→ User must be logged in. Check `auth.uid()` returns valid UUID.

### Tables not showing in Supabase
→ Verify you ran migrations as superuser or service role.

### Hook errors in frontend
→ Ensure hooks are used inside React components, not outside.

### TypeScript errors
→ Check all types are imported from `src/types/userSettings.ts`

---

## 📚 Full Documentation

For complete details, see:
- **Deployment**: `USER_CUSTOMIZATION_IMPLEMENTATION.md`
- **Schema**: `supabase/USER_CUSTOMIZATION_SCHEMA.md`
- **Summary**: `USER_CUSTOMIZATION_SUMMARY.md`

---

## ✅ Checklist

- [ ] Run deployment script or manually execute SQL files
- [ ] Verify 5 tables created in Supabase dashboard
- [ ] Test settings page in browser
- [ ] Integrate favorites into PlayerPage
- [ ] Update Home feed algorithm
- [ ] Set up notification checking (optional)
- [ ] Apply user theme preference (optional)

---

**Status: ✅ Complete and ready for deployment**

**Questions?** Check the full documentation or review the code comments.

