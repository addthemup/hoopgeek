# Predictor roadmap: 38 endpoints → props UI → engagement → paid tier

## Context

- **Source:** `nba_stats` table (one row per `date` + `endpoint_name`, `data` JSON). No bucket.
- **Content:** 38 NBA.com-style endpoints (last 10 games), one row per team; keyed by full team name (e.g. `"New York Knicks"`, `"LA Clippers"`).
- **App:** Games and props use **tricodes** (NYK, LAC) and **team_id** from `nba_teams`. No team IDs in the JSON.

## Phase 1: Team name ↔ app IDs (done)

- **`src/utils/predictorTeamNameToTricode.ts`**  
  - Map: predictor `TEAM` string → app tricode (e.g. `"Philadelphia 76ers"` → `PHI`).
  - Helpers: `predictorTeamNameToTricode(teamName)`, `predictorTeamNameToTricodeOrThrow(teamName)`.
- Use this whenever we read predictor JSON and need to match to `game.home_team_tricode` / `game.away_team_tricode`.

## Phase 2: Load predictor JSON and filter for the two teams

- For a given **game** (and **date**):
  - Query `nba_stats` table for that date; parse `data` per endpoint.
  - Resolve home/away tricodes (already on game).
  - For each of the **38 endpoints**, from `endpoints[name].data` take the two rows where `TEAM` maps to home tricode and away tricode (via `predictorTeamNameToTricode`).
- Expose a small **predictor data shape** (e.g. `PredictorTeamStats` per team, keyed by endpoint name) for the UI and for /today.

## Phase 3: One cohesive prediction component (Game page + /today)

- **Game page:** Use the filtered 38-endpoint data for the two teams in the existing “Team Analytics Comparison” / predictor section. Present last-10-games stats in a clear, “romantic” way for fans (not just raw tables).
- **Today:** Integrate the same predictor data with the existing predictor module so we have **one** prediction experience for **individual props** (e.g. “how this matchup + last 10 games trend toward points/rebounds/assists”).
- Goal: predictive signal + hard-to-get data in one place so fans can make clearer bets.

## Phase 4: Engagement and paid tier (later)

- **Daily posts:** Use predictor + matchup insights to drive daily content and run up engagement.
- **Paid feature:** e.g. week free, then ~$2.99/month; gate the best predictor/analytics behind paywall and charge card monthly.

## File reference

| What | Where |
|------|--------|
| Team name → tricode | `src/utils/predictorTeamNameToTricode.ts` |
| Predictor data (sample shape) | `scripts/predictor/nba_stats_2026-02-10.json` (table has same structure in `data` column) |
| Game page predictor UI | `src/pages/GamePage.tsx` (`usePredictorStats` from `nba_stats` table, Team Analytics Comparison) |
| Today predictor | `src/pages/Today.tsx` (predictor module) |
