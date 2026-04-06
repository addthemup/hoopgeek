import { estimateTeamRotationMinutes } from '../minutesEstimator';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

export function runMinutesEstimatorSmokeTests() {
  const roster = [
    { nba_player_id: 1, player_name: 'Starter A', position: 'G' },
    { nba_player_id: 2, player_name: 'Starter B', position: 'F' },
    { nba_player_id: 3, player_name: 'Bench A', position: 'G' },
  ];

  const recentMinutes = [
    { nba_player_id: 1, player_name: 'Starter A', min: 36 },
    { nba_player_id: 1, player_name: 'Starter A', min: 35 },
    { nba_player_id: 1, player_name: 'Starter A', min: 34 },
    { nba_player_id: 2, player_name: 'Starter B', min: 33 },
    { nba_player_id: 2, player_name: 'Starter B', min: 32 },
    { nba_player_id: 3, player_name: 'Bench A', min: 20 },
    { nba_player_id: 3, player_name: 'Bench A', min: 22 },
  ];

  const noInjury = estimateTeamRotationMinutes({ roster, recentMinutes, injuries: [] });
  assert(noInjury.length === 3, 'Expected all roster players in output');
  assert(noInjury[0].estimated_minutes >= noInjury[1].estimated_minutes, 'Expected minute ordering by estimate');
  const noInjuryTotal = noInjury.reduce((sum, row) => sum + row.estimated_minutes, 0);
  assert(Math.abs(noInjuryTotal - 240) < 0.2, 'Expected 240 team-minute normalization');

  const withOut = estimateTeamRotationMinutes({
    roster,
    recentMinutes,
    injuries: [{ nba_player_id: 1, injury_status: 'Out' }],
  });
  const starterA = withOut.find((p) => p.nba_player_id === 1);
  const benchA = withOut.find((p) => p.nba_player_id === 3);
  assert(!!starterA && starterA.estimated_minutes < 5, 'Out player should lose projected minutes');
  assert(!!benchA && benchA.injury_delta_minutes > 0, 'Bench player should receive injury boost');
  const withOutTotal = withOut.reduce((sum, row) => sum + row.estimated_minutes, 0);
  assert(Math.abs(withOutTotal - 240) < 0.2, 'Expected normalized total after injury redistribution');

  const spreadRoster = [
    { nba_player_id: 11, player_name: 'Core A', position: 'G' },
    { nba_player_id: 12, player_name: 'Core B', position: 'G' },
    { nba_player_id: 13, player_name: 'Core C', position: 'F' },
    { nba_player_id: 14, player_name: 'Core D', position: 'F' },
    { nba_player_id: 15, player_name: 'Core E', position: 'C' },
    { nba_player_id: 16, player_name: 'Bench A', position: 'G' },
    { nba_player_id: 17, player_name: 'Bench B', position: 'F' },
    { nba_player_id: 18, player_name: 'Bench C', position: 'C' },
  ];
  const spreadMinutes = [
    { nba_player_id: 11, player_name: 'Core A', min: 38 },
    { nba_player_id: 11, player_name: 'Core A', min: 37 },
    { nba_player_id: 11, player_name: 'Core A', min: 36 },
    { nba_player_id: 12, player_name: 'Core B', min: 37 },
    { nba_player_id: 12, player_name: 'Core B', min: 36 },
    { nba_player_id: 12, player_name: 'Core B', min: 35 },
    { nba_player_id: 13, player_name: 'Core C', min: 36 },
    { nba_player_id: 13, player_name: 'Core C', min: 35 },
    { nba_player_id: 13, player_name: 'Core C', min: 34 },
    { nba_player_id: 14, player_name: 'Core D', min: 34 },
    { nba_player_id: 14, player_name: 'Core D', min: 33 },
    { nba_player_id: 14, player_name: 'Core D', min: 32 },
    { nba_player_id: 15, player_name: 'Core E', min: 33 },
    { nba_player_id: 15, player_name: 'Core E', min: 32 },
    { nba_player_id: 15, player_name: 'Core E', min: 31 },
    { nba_player_id: 16, player_name: 'Bench A', min: 17 },
    { nba_player_id: 16, player_name: 'Bench A', min: 16 },
    { nba_player_id: 16, player_name: 'Bench A', min: 15 },
    { nba_player_id: 17, player_name: 'Bench B', min: 16 },
    { nba_player_id: 17, player_name: 'Bench B', min: 15 },
    { nba_player_id: 17, player_name: 'Bench B', min: 14 },
    { nba_player_id: 18, player_name: 'Bench C', min: 14 },
    { nba_player_id: 18, player_name: 'Bench C', min: 13 },
    { nba_player_id: 18, player_name: 'Bench C', min: 12 },
  ];

  const noSpread = estimateTeamRotationMinutes({
    roster: spreadRoster,
    recentMinutes: spreadMinutes,
    injuries: [],
    options: { spread: 6, spreadThreshold: 12, benchShiftPct: 0.04 },
  });
  const withSpread = estimateTeamRotationMinutes({
    roster: spreadRoster,
    recentMinutes: spreadMinutes,
    injuries: [],
    options: { spread: 14, spreadThreshold: 12, benchShiftPct: 0.04 },
  });

  const getMinutes = (rows: ReturnType<typeof estimateTeamRotationMinutes>, id: number) =>
    rows.find((p) => p.nba_player_id === id)?.estimated_minutes ?? 0;
  const noSpreadBench = getMinutes(noSpread, 16) + getMinutes(noSpread, 17) + getMinutes(noSpread, 18);
  const withSpreadBench = getMinutes(withSpread, 16) + getMinutes(withSpread, 17) + getMinutes(withSpread, 18);
  assert(withSpreadBench > noSpreadBench, 'Expected bench minutes to increase when spread threshold is met');
  assert(
    withSpread.some((p) => p.signals.some((signal) => signal.toLowerCase().includes('spread'))),
    'Expected spread signal when spread threshold is met'
  );
  const withSpreadTotal = withSpread.reduce((sum, row) => sum + row.estimated_minutes, 0);
  assert(Math.abs(withSpreadTotal - 240) < 0.2, 'Expected 240 normalization with spread bump');

  return true;
}
