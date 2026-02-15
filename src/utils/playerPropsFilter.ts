/**
 * Helpers to filter player_props to full-game only.
 * Raw props can include 1q, 1h, 2h, etc.; we only want periodID === 'game' when
 * comparing to full-game boxscore stats.
 */

export type PropWithRaw = { raw_odd_data?: { periodID?: string } | null };

/** True when the prop is for the full game (periodID is 'game' or missing). */
export function isFullGameProp(prop: PropWithRaw): boolean {
  const period = prop.raw_odd_data?.periodID;
  return period == null || period === '' || period === 'game';
}

/** Keep only full-game props. Use after fetching player_props when comparing to full-game stats. */
export function filterFullGameProps<T extends PropWithRaw>(props: T[]): T[] {
  return props.filter(isFullGameProp);
}
