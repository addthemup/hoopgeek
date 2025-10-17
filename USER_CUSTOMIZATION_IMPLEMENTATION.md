# User Customization System - Implementation Guide

🎉 **Complete Database Schema & Frontend Implementation**

This guide will help you deploy and use the new user customization system for HoopGeek.

## 📋 What's Been Built

### 1. Database Schema (5 tables)
✅ `user_profiles` - User profile information  
✅ `user_favorite_players` - Favorite NBA players  
✅ `user_favorite_teams` - Favorite NBA teams  
✅ `user_notification_preferences` - Notification settings  
✅ `user_feed_preferences` - Home feed customization  

### 2. TypeScript Types
✅ `src/types/userSettings.ts` - Complete type definitions

### 3. React Hooks
✅ `src/hooks/useUserSettings.ts` - 15+ hooks for data management

### 4. Frontend Components
✅ `src/pages/UserSettings.tsx` - Beautiful settings page with 4 tabs  
✅ Updated `TopNavigation.tsx` - Email is now clickable → `/settings`

### 5. Documentation
✅ `supabase/USER_CUSTOMIZATION_SCHEMA.md` - Complete schema docs  
✅ SQL migration files in `supabase/build/`

## 🚀 Deployment Steps

### Step 1: Deploy Database Schema

You have two options:

#### Option A: Using Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Run each file in this order:

```sql
-- Run these in order:
1. user_profiles.sql
2. user_favorite_players.sql
3. user_favorite_teams.sql
4. user_notification_preferences.sql
5. user_feed_preferences.sql
```

#### Option B: Using Supabase CLI

```bash
cd /Users/adam/Desktop/hoopgeek

# Create a new migration
supabase migration new user_customization_system

# Copy the master SQL file
cat supabase/build/user_customization_system.sql > supabase/migrations/$(ls -t supabase/migrations | head -1)

# Push to database
supabase db push
```

#### Option C: Using psql

```bash
# Set your database URL
export DATABASE_URL="your_supabase_connection_string"

# Run the migrations
cd /Users/adam/Desktop/hoopgeek/supabase/build
psql $DATABASE_URL -f user_profiles.sql
psql $DATABASE_URL -f user_favorite_players.sql
psql $DATABASE_URL -f user_favorite_teams.sql
psql $DATABASE_URL -f user_notification_preferences.sql
psql $DATABASE_URL -f user_feed_preferences.sql
```

### Step 2: Verify Installation

Run this query in your SQL editor to verify all tables were created:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name LIKE 'user_%'
ORDER BY table_name;
```

You should see:
- `user_favorite_players`
- `user_favorite_teams`
- `user_feed_preferences`
- `user_notification_preferences`
- `user_profiles`

### Step 3: Test the Frontend

1. Start your development server:
```bash
npm run dev
```

2. Sign in to your app

3. Click on your email address in the top navigation

4. You should see the User Settings page with 4 tabs:
   - **Profile** - Edit display name, bio, theme
   - **Favorites** - Manage favorite players & teams
   - **Notifications** - Configure notification preferences
   - **Feed** - Customize home page algorithm

## 🎯 Features Overview

### Profile Tab
- Edit display name
- Write a bio
- Choose theme (light/dark/system)
- View email (read-only)

### Favorites Tab

#### Favorite Players
- View all favorited players with avatars
- Click to navigate to player page
- Remove from favorites
- Browse player database to add more

#### Favorite Teams
- View all favorited teams with logos
- Remove from favorites
- Team conference & division info

### Notifications Tab

Granular control over:
- **General**: Master toggle, email, push
- **Content**: New highlights, featured games
- **Fantasy**: League results, trade proposals, lineup reminders
- **Players**: Injury reports, favorite player games
- **Teams**: Favorite team games & trades
- **Social**: Chat messages, comments, mentions

### Feed Tab

Customize the home page algorithm:
- **Algorithm**: Prioritize favorites, set fun score threshold, days back
- **Content Filters**: Buzzer beaters, close games, high scoring, overtime
- **View Settings**: Grid/list/compact, games per page

## 🔗 Integration Points

### Adding Favorite Players

In your `PlayerPage.tsx` component, you can add a "Add to Favorites" button:

```typescript
import { useToggleFavoritePlayer, useIsPlayerFavorited } from '../hooks/useUserSettings';

// In your component:
const { user } = useAuth();
const { data: isFavorited } = useIsPlayerFavorited(user?.id, playerId);
const toggleFavorite = useToggleFavoritePlayer();

const handleToggleFavorite = async () => {
  if (!user?.id) return;
  await toggleFavorite.mutateAsync({ 
    userId: user.id, 
    playerId: playerId 
  });
};

// In your JSX:
<Button
  startDecorator={<Star />}
  variant={isFavorited ? 'solid' : 'outlined'}
  color={isFavorited ? 'warning' : 'neutral'}
  onClick={handleToggleFavorite}
>
  {isFavorited ? 'Favorited' : 'Add to Favorites'}
</Button>
```

### Updating Home Feed Algorithm

In your `Home.tsx`, you can integrate user preferences:

```typescript
import { useFeedPreferences, useFavoritePlayers, useFavoriteTeams } from '../hooks/useUserSettings';

const { user } = useAuth();
const { data: feedPrefs } = useFeedPreferences(user?.id);
const { data: favPlayers } = useFavoritePlayers(user?.id);
const { data: favTeams } = useFavoriteTeams(user?.id);

// Use these in your feed algorithm:
const calculateFeedScore = (game: GameData) => {
  let score = game.fun_score;
  
  // Boost if game has favorite teams
  if (feedPrefs?.prioritize_favorite_teams && favTeams) {
    const hasF avTeam = favTeams.some(t => 
      game.story.teams.winner.tricode === t.team_abbreviation ||
      game.story.teams.loser.tricode === t.team_abbreviation
    );
    if (hasFavTeam) score *= 1.5;
  }
  
  // Filter by minimum fun score
  if (game.fun_score / 10 < (feedPrefs?.min_fun_score_threshold || 0)) {
    return 0; // Exclude from feed
  }
  
  return score;
};
```

### Checking Notification Preferences

Before sending notifications:

```typescript
import { useNotificationPreferences } from '../hooks/useUserSettings';

const { data: notifPrefs } = useNotificationPreferences(user?.id);

// Check before sending:
if (notifPrefs?.trade_proposals) {
  // Send trade proposal notification
}
```

## 📊 Database Functions

All tables come with helper functions. Here are the most useful:

### Favorite Players
```sql
-- Toggle favorite (add/remove)
SELECT toggle_favorite_player('user-id', 123);

-- Check if favorited
SELECT is_player_favorited('user-id', 123);

-- Get all with details
SELECT * FROM get_user_favorite_players('user-id');
```

### Favorite Teams
```sql
-- Toggle favorite (add/remove)
SELECT toggle_favorite_team('user-id', 1);

-- Get all with details
SELECT * FROM get_user_favorite_teams('user-id');
```

### Notification Preferences
```sql
-- Get preferences
SELECT * FROM get_user_notification_preferences('user-id');

-- Update specific settings
SELECT update_user_notification_preferences(
  'user-id',
  p_new_highlights := true,
  p_trade_proposals := false
);
```

### Feed Preferences
```sql
-- Get preferences
SELECT * FROM get_user_feed_preferences('user-id');

-- Update settings
SELECT update_user_feed_preferences(
  'user-id',
  p_min_fun_score_threshold := 8.0,
  p_days_back_to_show := 60
);
```

## 🔒 Security

All tables have Row Level Security (RLS) enabled:
- Users can only view/edit their own data
- All functions include authentication checks
- Foreign keys ensure data integrity

## 🐛 Troubleshooting

### "Not authenticated" error
Make sure the user is logged in and `auth.uid()` returns a valid UUID.

### Tables not showing up
Verify you're connected to the right database and ran migrations as a superuser.

### Frontend errors
Check that:
1. Supabase client is configured correctly
2. All hooks are used within React components
3. TypeScript types match database schema

## 📝 Next Steps

1. **Deploy the migrations** to your Supabase database
2. **Test the settings page** in your local environment
3. **Integrate favorites** into PlayerPage component
4. **Update home feed** to use user preferences
5. **Add notification system** (future enhancement)

## 🎨 Customization

The `UserSettings.tsx` component uses MUI Joy components. You can easily customize:
- Colors and themes
- Layout and spacing
- Add more tabs/sections
- Change form controls

## 📞 Support

If you encounter any issues:
1. Check the SQL error logs in Supabase dashboard
2. Verify all dependencies are installed (`@tanstack/react-query`)
3. Ensure `useAuth` hook is properly implemented
4. Review the schema documentation in `supabase/USER_CUSTOMIZATION_SCHEMA.md`

---

**Built with ❤️ for HoopGeek**

