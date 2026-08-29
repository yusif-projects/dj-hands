/** Roving-selection arithmetic for the icon pickers. Pure, so the tests stay DOM-free. */

/** The index `steps` along a list of `count`, wrapping at both ends. */
export function wrapIndex(index: number, steps: number, count: number): number {
  if (count <= 0) return 0
  return (((index + steps) % count) + count) % count
}
