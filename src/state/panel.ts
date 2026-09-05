/**
 * Which settings group the icon rail has open. This is UI chrome rather than
 * sound configuration, so it lives outside `Settings` and under its own key —
 * "Reset to defaults" spreads `DEFAULT_SETTINGS` wholesale, and a group stored
 * in there would make resetting the sound slam the panel shut as a side effect.
 */

export const PANEL_GROUPS = [
  'chords',
  'sound',
  'arp',
  'filter',
  'effects',
  'volume',
  'songs',
  'tracking',
  'help',
  'about',
] as const

export type PanelGroup = (typeof PANEL_GROUPS)[number]

/** The rail buttons are wordless, so these name each group to a screen reader. */
export const PANEL_GROUP_LABELS: Record<PanelGroup, string> = {
  chords: 'Chords',
  sound: 'Sound',
  arp: 'Arpeggiator',
  filter: 'Filter',
  effects: 'Effects',
  volume: 'Volume range',
  songs: 'Songs',
  tracking: 'Tracking',
  help: 'How to play',
  about: 'About',
}

const STORAGE_KEY = 'gesture-music.panel-group'

// A closed panel is a state someone chose, not the absence of a choice, so it
// is stored rather than left to fall through to the default.
const CLOSED = 'none'

export const DEFAULT_PANEL_GROUP: PanelGroup = 'chords'

export function loadPanelGroup(): PanelGroup | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === CLOSED) return null
    return isPanelGroup(stored) ? stored : DEFAULT_PANEL_GROUP
  } catch {
    return DEFAULT_PANEL_GROUP
  }
}

export function savePanelGroup(group: PanelGroup | null): void {
  try {
    localStorage.setItem(STORAGE_KEY, group ?? CLOSED)
  } catch {
    // Storage can be unavailable (private mode); the panel just won't persist.
  }
}

function isPanelGroup(value: unknown): value is PanelGroup {
  return PANEL_GROUPS.includes(value as PanelGroup)
}
