/** Same as src/utils/playerPropsFilter.ts */
export type PropWithRaw = { raw_odd_data?: { periodID?: string } | null }

export function isFullGameProp(prop: PropWithRaw): boolean {
  const period = prop.raw_odd_data?.periodID
  return period == null || period === '' || period === 'game'
}

export function filterFullGameProps<T extends PropWithRaw>(props: T[]): T[] {
  return props.filter(isFullGameProp)
}
