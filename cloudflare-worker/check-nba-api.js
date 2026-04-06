#!/usr/bin/env node
/**
 * Diagnostic script: verify NBA scoreboard and boxscore APIs return data.
 * Run from this directory: node check-nba-api.js
 * No secrets required; only hits public NBA CDN.
 */

const SCOREBOARD_URL = 'https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function main() {
  console.log('🏀 Checking NBA live data APIs...\n');

  const scoreRes = await fetch(SCOREBOARD_URL, { headers: { 'User-Agent': UA } });
  console.log('1. Scoreboard:', scoreRes.status, scoreRes.statusText);
  if (!scoreRes.ok) {
    console.error(await scoreRes.text());
    process.exit(1);
  }

  const scoreboard = await scoreRes.json();
  const games = scoreboard?.scoreboard?.games ?? scoreboard?.games ?? [];
  console.log('   Games today:', games.length);
  if (games.length === 0) {
    console.log('   (No games today is normal on off-days.)');
  }

  const live = games.filter((g) => g.gameStatus === 2);
  console.log('   Live games (gameStatus=2):', live.length);

  if (live.length > 0) {
    const gameId = live[0].gameId;
    const boxUrl = `https://cdn.nba.com/static/json/liveData/boxscore/boxscore_${gameId}.json`;
    const boxRes = await fetch(boxUrl, { headers: { 'User-Agent': UA } });
    console.log('\n2. Box score', gameId + ':', boxRes.status, boxRes.statusText);
    if (!boxRes.ok) {
      console.error(await boxRes.text());
      process.exit(1);
    }
    const box = await boxRes.json();
    const home = box?.game?.homeTeam?.players ?? [];
    const away = box?.game?.awayTeam?.players ?? [];
    console.log('   Home players:', home.length, '| Away players:', away.length);
    const first = home[0] || away[0];
    if (first) {
      const hasId = 'personId' in first || 'person_id' in first || 'id' in first;
      const hasStats = 'statistics' in first;
      console.log('   Sample player keys: personId/id', hasId, '| statistics', hasStats);
    }
  } else if (games.length > 0) {
    const g = games[0];
    console.log('\n2. No live games; sample game:', g.gameId, 'status', g.gameStatus, g.gameStatusText || '');
  }

  console.log('\n✅ NBA API check done. If both 1 and 2 are 200, the worker can use these URLs.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
