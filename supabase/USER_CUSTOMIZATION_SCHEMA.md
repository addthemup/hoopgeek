# User Customization System - Database Schema

This document describes the database schema for the HoopGeek user customization system, which powers personalized feeds, favorites, and notification preferences.

## 📋 Overview

The user customization system consists of 5 main tables:

1. **`user_profiles`** - Extended user profile information
2. **`user_favorite_players`** - User's favorite NBA players
3. **`user_favorite_teams`** - User's favorite NBA teams
4. **`user_notification_preferences`** - Notification settings
5. **`user_feed_preferences`** - Home feed customization settings

## 🗄️ Database Tables

### 1. user_profiles

Extended profile information for each user.

**Columns:**
- `id` (UUID, PK) - References `auth.users.id`
- `display_name` (TEXT) - User's display name
- `avatar_url` (TEXT) - URL to user's avatar image
- `bio` (TEXT) - User biography
- `theme` (TEXT) - UI theme preference (`light`/`dark`/`system`)
- `timezone` (TEXT) - User's timezone
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

**Auto-created on user signup** via trigger.

### 2. user_favorite_players

Stores user's favorite NBA players for personalized content.

**Columns:**
- `id` (UUID, PK)
- `user_id` (UUID, FK) - References `auth.users.id`
- `player_id` (BIGINT, FK) - References `nba_players.id`
- `notes` (TEXT) - Optional notes about the player
- `notify_on_games` (BOOLEAN) - Notify when player has games
- `notify_on_milestones` (BOOLEAN) - Notify on career milestones
- `created_at` (TIMESTAMPTZ)

**Constraint:** Unique on `(user_id, player_id)` - users can only favorite a player once.

### 3. user_favorite_teams

Stores user's favorite NBA teams for personalized content.

**Columns:**
- `id` (UUID, PK)
- `user_id` (UUID, FK) - References `auth.users.id`
- `team_id` (BIGINT, FK) - References `nba_teams.id`
- `notes` (TEXT) - Optional notes about the team
- `notify_on_games` (BOOLEAN) - Notify when team has games
- `notify_on_trades` (BOOLEAN) - Notify on team roster changes
- `created_at` (TIMESTAMPTZ)

**Constraint:** Unique on `(user_id, team_id)` - users can only favorite a team once.

### 4. user_notification_preferences

Controls which notifications the user receives.

**Columns:**
- `user_id` (UUID, PK) - References `auth.users.id`
- `notifications_enabled` (BOOLEAN) - Master toggle
- `email_notifications` (BOOLEAN) - Enable email notifications
- `push_notifications` (BOOLEAN) - Enable push notifications

**Content notifications:**
- `new_highlights` (BOOLEAN) - New game highlights
- `featured_games` (BOOLEAN) - Featured/high fun score games

**Fantasy league notifications:**
- `league_results` (BOOLEAN) - Matchup results
- `draft_reminders` (BOOLEAN) - Draft reminders
- `trade_proposals` (BOOLEAN) - Trade proposals/offers
- `waiver_wire_results` (BOOLEAN) - Waiver wire results
- `lineup_reminders` (BOOLEAN) - Lineup reminders

**Player notifications:**
- `player_injury_reports` (BOOLEAN) - Player injuries
- `player_milestones` (BOOLEAN) - Career milestones
- `favorite_player_games` (BOOLEAN) - Favorite player games

**Team notifications:**
- `favorite_team_games` (BOOLEAN) - Favorite team games
- `favorite_team_trades` (BOOLEAN) - Favorite team roster changes

**Social notifications:**
- `league_chat_messages` (BOOLEAN) - League chat
- `comments_on_posts` (BOOLEAN) - Comments/replies
- `mentions` (BOOLEAN) - User mentions

**Auto-created on user signup** via trigger.

### 5. user_feed_preferences

Customizes the home page game feed algorithm.

**Columns:**
- `user_id` (UUID, PK) - References `auth.users.id`

**Feed algorithm:**
- `prioritize_favorite_teams` (BOOLEAN) - Boost favorite team games
- `prioritize_favorite_players` (BOOLEAN) - Boost favorite player games
- `show_low_fun_score_games` (BOOLEAN) - Show low fun score games
- `min_fun_score_threshold` (NUMERIC 3,1) - Min fun score to show (0-10)

**Content type preferences:**
- `show_highlights` (BOOLEAN)
- `show_buzzer_beaters` (BOOLEAN)
- `show_close_games` (BOOLEAN)
- `show_high_scoring` (BOOLEAN)
- `show_overtime_games` (BOOLEAN)
- `show_playoff_games` (BOOLEAN)
- `show_rivalry_games` (BOOLEAN)

**Time & view preferences:**
- `days_back_to_show` (INTEGER) - Days back to show (1-365)
- `default_feed_view` (TEXT) - View mode (`grid`/`list`/`compact`)
- `games_per_page` (INTEGER) - Games per page (3-50)

**Auto-created on user signup** via trigger.

## 🔒 Security

All tables have **Row Level Security (RLS)** enabled with policies that:
- Allow users to view their own data
- Allow users to insert/update/delete their own data
- Prevent users from accessing other users' data (except basic profile info)

## 🔧 Helper Functions

### User Profiles

```sql
-- Get user profile
SELECT * FROM public.get_user_profile(user_id);

-- Update user profile
SELECT public.update_user_profile(
    user_id,
    display_name := 'New Name',
    avatar_url := 'https://...',
    bio := 'My bio'
);
```

### Favorite Players

```sql
-- Get user's favorite players (with player details)
SELECT * FROM public.get_user_favorite_players(user_id);

-- Add player to favorites
SELECT public.add_favorite_player(user_id, player_id, 'Optional note');

-- Remove player from favorites
SELECT public.remove_favorite_player(user_id, player_id);

-- Check if player is favorited
SELECT public.is_player_favorited(user_id, player_id);

-- Get favorite player count
SELECT public.get_favorite_player_count(user_id);

-- Toggle favorite (add if not exists, remove if exists)
SELECT public.toggle_favorite_player(user_id, player_id);
```

### Favorite Teams

```sql
-- Get user's favorite teams (with team details)
SELECT * FROM public.get_user_favorite_teams(user_id);

-- Add team to favorites
SELECT public.add_favorite_team(user_id, team_id, 'Optional note');

-- Remove team from favorites
SELECT public.remove_favorite_team(user_id, team_id);

-- Check if team is favorited
SELECT public.is_team_favorited(user_id, team_id);

-- Get favorite team count
SELECT public.get_favorite_team_count(user_id);

-- Toggle favorite (add if not exists, remove if exists)
SELECT public.toggle_favorite_team(user_id, team_id);
```

### Notification Preferences

```sql
-- Get notification preferences
SELECT * FROM public.get_user_notification_preferences(user_id);

-- Update specific notification preferences
SELECT public.update_user_notification_preferences(
    user_id,
    new_highlights := true,
    trade_proposals := false
);

-- Disable all notifications
SELECT public.disable_all_notifications(user_id);

-- Enable all notifications
SELECT public.enable_all_notifications(user_id);
```

### Feed Preferences

```sql
-- Get feed preferences
SELECT * FROM public.get_user_feed_preferences(user_id);

-- Update feed preferences
SELECT public.update_user_feed_preferences(
    user_id,
    min_fun_score_threshold := 8.0,
    days_back_to_show := 60,
    games_per_page := 20
);

-- Reset to defaults
SELECT public.reset_user_feed_preferences(user_id);
```

### Complete User Settings

```sql
-- Get all user settings in one query
SELECT * FROM public.get_complete_user_settings(user_id);

-- Or use the view
SELECT * FROM public.user_settings_complete WHERE user_id = '...';
```

## 📦 Installation

### Option 1: Run individual files

```bash
# From your Supabase project directory
psql $DATABASE_URL -f supabase/build/user_profiles.sql
psql $DATABASE_URL -f supabase/build/user_favorite_players.sql
psql $DATABASE_URL -f supabase/build/user_favorite_teams.sql
psql $DATABASE_URL -f supabase/build/user_notification_preferences.sql
psql $DATABASE_URL -f supabase/build/user_feed_preferences.sql
```

### Option 2: Run master migration (recommended)

```bash
cd supabase/build
psql $DATABASE_URL -f user_customization_system.sql
```

### Option 3: Using Supabase CLI

```bash
# Create a new migration
supabase migration new user_customization_system

# Copy the SQL files into the migration
cat supabase/build/user_customization_system.sql > supabase/migrations/<timestamp>_user_customization_system.sql

# Apply the migration
supabase db push
```

## 🎯 Integration with Frontend

### TypeScript Types

Create types in your frontend that match the database schema:

```typescript
// src/types/userSettings.ts
export interface UserProfile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  theme: 'light' | 'dark' | 'system';
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface FavoritePlayer {
  id: string;
  player_id: number;
  player_name: string;
  player_position: string;
  player_team: string;
  player_jersey_number: number | null;
  nba_player_id: number;
  notes: string | null;
  notify_on_games: boolean;
  notify_on_milestones: boolean;
  created_at: string;
}

export interface FavoriteTeam {
  id: string;
  team_id: number;
  team_name: string;
  team_abbreviation: string;
  team_city: string;
  team_conference: string;
  team_division: string;
  notes: string | null;
  notify_on_games: boolean;
  notify_on_trades: boolean;
  created_at: string;
}

export interface NotificationPreferences {
  user_id: string;
  notifications_enabled: boolean;
  email_notifications: boolean;
  push_notifications: boolean;
  new_highlights: boolean;
  featured_games: boolean;
  league_results: boolean;
  draft_reminders: boolean;
  trade_proposals: boolean;
  waiver_wire_results: boolean;
  lineup_reminders: boolean;
  player_injury_reports: boolean;
  player_milestones: boolean;
  favorite_player_games: boolean;
  favorite_team_games: boolean;
  favorite_team_trades: boolean;
  league_chat_messages: boolean;
  comments_on_posts: boolean;
  mentions: boolean;
}

export interface FeedPreferences {
  user_id: string;
  prioritize_favorite_teams: boolean;
  prioritize_favorite_players: boolean;
  show_low_fun_score_games: boolean;
  min_fun_score_threshold: number;
  show_highlights: boolean;
  show_buzzer_beaters: boolean;
  show_close_games: boolean;
  show_high_scoring: boolean;
  show_overtime_games: boolean;
  show_playoff_games: boolean;
  show_rivalry_games: boolean;
  days_back_to_show: number;
  default_feed_view: 'grid' | 'list' | 'compact';
  games_per_page: number;
}
```

### React Hooks

Example hooks for using the customization system:

```typescript
// src/hooks/useFavoritePlayers.ts
export function useFavoritePlayers(userId: string) {
  return useQuery({
    queryKey: ['favorite-players', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_user_favorite_players', { p_user_id: userId });
      if (error) throw error;
      return data as FavoritePlayer[];
    },
    enabled: !!userId
  });
}

// src/hooks/useToggleFavoritePlayer.ts
export function useToggleFavoritePlayer() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ userId, playerId }: { userId: string; playerId: number }) => {
      const { data, error } = await supabase
        .rpc('toggle_favorite_player', { 
          p_user_id: userId, 
          p_player_id: playerId 
        });
      if (error) throw error;
      return data; // Returns true if added, false if removed
    },
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries(['favorite-players', userId]);
    }
  });
}
```

## 🚀 Next Steps

1. **Run the migrations** to create the tables in your database
2. **Create TypeScript types** that match the schema
3. **Build React hooks** for interacting with the data
4. **Create the UserSettings.tsx page** using MUI Joy components
5. **Update the TopNavigation** to link to the settings page
6. **Integrate favorites** into the PlayerPage component
7. **Update the Home feed algorithm** to use user preferences

## 📝 Notes

- All tables automatically create default records when a new user signs up
- All timestamps use `TIMESTAMPTZ` for proper timezone handling
- All foreign keys have `ON DELETE CASCADE` to clean up user data
- Helper functions use `SECURITY DEFINER` to bypass RLS when needed
- Functions include authentication checks to prevent unauthorized access

