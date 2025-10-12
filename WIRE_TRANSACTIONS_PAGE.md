# How to Wire Up the Transactions Page

## Quick Setup Guide

The Transactions page has been created, but it needs to be connected to the League routing system. Here's what to add:

### Step 1: Import the Transactions Component
In `/src/pages/League.tsx`, add this import:

```typescript
import Transactions from './Transactions';
```

### Step 2: Add the Transactions Route Case
Find the switch/case or if/else that handles different tabs (where 'home', 'my-team', 'players', etc. are handled).

Add this case:

```typescript
case 'transactions':
  return <Transactions leagueId={leagueId} />;
```

### Step 3: Pass Navigation Handler to LeagueHome
When rendering `<LeagueHome>`, pass the `onNavigateToTransactions` prop:

```typescript
case 'home':
  return (
    <LeagueHome 
      leagueId={leagueId} 
      onTeamClick={handleTeamClick}
      onNavigateToTransactions={() => {
        // Whatever method you use to change tabs
        // Example: setActiveTab(tabIndexForTransactions)
        // Or: navigate(`/league/${leagueId}/transactions`)
      }}
    />
  );
```

### Step 4: Verify LeagueNavigation Tab ID
The LeagueNavigation component now has a tab with `id: 'transactions'`. Make sure your routing logic uses this ID.

## Example Implementation

If League.tsx looks like this:

```typescript
const renderContent = (tabId: string) => {
  switch (tabId) {
    case 'home':
      return <LeagueHome leagueId={leagueId} onTeamClick={handleTeamClick} />;
    case 'players':
      return <Players leagueId={leagueId} />;
    // ... other cases
  }
};
```

Update it to:

```typescript
const renderContent = (tabId: string) => {
  switch (tabId) {
    case 'home':
      return (
        <LeagueHome 
          leagueId={leagueId} 
          onTeamClick={handleTeamClick}
          onNavigateToTransactions={() => setActiveTab('transactions')} // or your tab-switching method
        />
      );
    case 'players':
      return <Players leagueId={leagueId} />;
    case 'transactions':  // NEW
      return <Transactions leagueId={leagueId} />;
    // ... other cases
  }
};
```

## Testing

After wiring everything up:

1. ✅ Navigate to a league
2. ✅ Click the "Transactions" tab in the top navigation
3. ✅ Verify the Transactions page loads with:
   - Full transactions table on the left
   - Trending modules on the right
4. ✅ On the League Home page, click "View All Transactions"
5. ✅ Verify it navigates to the Transactions tab

## Troubleshooting

### "View All Transactions" button does nothing
- Check that `onNavigateToTransactions` prop is being passed to LeagueHome
- Check that the handler function actually changes the active tab

### Transactions tab shows blank or error
- Verify the import: `import Transactions from './Transactions';`
- Check the case statement matches: `case 'transactions':`
- Check LeagueNavigation has `id: 'transactions'` (not 'activity')

### Charts not rendering
- Verify `@mui/x-charts` is installed: `npm list @mui/x-charts`
- If not: `npm install @mui/x-charts`

## What's Included

✅ Full transactions table with player details  
✅ Clickable player links  
✅ Trending players module  
✅ Weekly activity chart (Line chart)  
✅ Position trends chart (Bar chart)  
✅ League insights cards  
✅ Responsive layout  
✅ Auto-refresh every 30 seconds  
✅ Mock data for trending analytics  

## Next Steps

After wiring is complete:
- Replace mock trending data with real API data
- Add filters (date range, transaction type)
- Add search functionality
- Add more analytics modules

