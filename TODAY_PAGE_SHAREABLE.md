# Today Page - Shareable Links Implementation

## Overview

The `/today` page is now shareable via URL query parameters. Each day and week can be shared with a unique URL, making it perfect for microcontent sharing.

## How It Works

### URL Format

- **Today (default)**: `/today` or `/today?gameId=xxx`
- **Specific Date**: `/today?date=2025-12-15`
- **Date with Game**: `/today?date=2025-12-15&gameId=0022501224`

### Features

1. **Date Parameter**: The `?date=YYYY-MM-DD` parameter sets the selected date
2. **Automatic URL Sync**: When navigating dates, the URL updates automatically
3. **Today Detection**: If viewing today, the `date` parameter is removed (cleaner URLs)
4. **Browser Navigation**: Back/forward buttons work correctly
5. **Week Summaries**: Week navigation automatically updates the URL

## Implementation Details

### Changes Made

1. **Initial State**: `selectedDate` now initializes from URL parameter if present
2. **URL Sync Effect**: Automatically updates URL when `selectedDate` changes
3. **URL Change Handler**: Responds to URL changes (browser navigation, direct links)
4. **Auto-Update Logic**: Only auto-updates to "today" if no date is in URL (preserves shared links)

### Key Logic

- **URL → State**: On load, if `?date` exists, use it to set `selectedDate`
- **State → URL**: When `selectedDate` changes, update URL (unless it's "today")
- **Today Handling**: Today doesn't need `?date` param (cleaner default URLs)
- **Loop Prevention**: Uses `isUpdatingFromUrlRef` to prevent update loops

## Usage Examples

### Share a Specific Day
```
https://hoopgeek.com/today?date=2025-12-15
```

### Share a Week
Navigate to any day in the week, then share:
```
https://hoopgeek.com/today?date=2025-12-15
```

### Share Today's Games
```
https://hoopgeek.com/today
```

### Share with Specific Game Selected
```
https://hoopgeek.com/today?date=2025-12-15&gameId=0022501224
```

## Benefits for Microcontent

1. **Shareable Moments**: Share specific game days with friends
2. **Week Highlights**: Share entire weeks for discussion
3. **Social Media**: Perfect for Twitter/X, Discord, etc.
4. **Bookmarkable**: Users can bookmark specific dates
5. **Deep Linking**: Link directly to specific dates from other pages

## Technical Notes

- Date format: `YYYY-MM-DD` (ISO 8601)
- Timezone: All dates are in EST (Eastern Standard Time)
- Validation: Invalid dates fall back to today
- Persistence: URL state persists across page refreshes
- Navigation: Works with browser back/forward buttons

## Future Enhancements

- [ ] Add week parameter: `?week=9` for direct week access
- [ ] Add date range: `?start=2025-12-15&end=2025-12-21` for multi-day views
- [ ] Add share button component
- [ ] Add copy link functionality
- [ ] Add social media preview cards (OG tags) for shared links
