/** Song structure: named banks of chord slots. Pure data, no audio. */

import { DEFAULT_CHORD_SLOTS, type ChordSlot } from './chords'

/** Sections the right hand can address, and the length the stored array is pinned to. */
export const SECTION_COUNT = 5

/** Longest name a tab can show before the strip starts truncating. */
export const MAX_SECTION_NAME = 18

/** One named bank of chord slots; the right hand picks which bank is live. */
export interface SongSection {
  /** Empty means unnamed, and `sectionLabel` falls back to the number. */
  name: string
  /** Off sections are dimmed in the panel and skipped by the gesture. */
  enabled: boolean
  /** One slot per left-hand gesture, same shape as any other chord bank. */
  slots: ChordSlot[]
}

/** A fresh copy of the default progression; slots are mutable per section. */
export function defaultSlots(): ChordSlot[] {
  return DEFAULT_CHORD_SLOTS.map((slot) => ({ ...slot }))
}

/**
 * Only the first section starts on. The other four exist in storage from the
 * start — the count is fixed — but stay dimmed and unreachable until the player
 * turns one on, so a stray finger count cannot drop them into an unwritten bank.
 */
export const DEFAULT_SECTIONS: SongSection[] = Array.from(
  { length: SECTION_COUNT },
  (_, i): SongSection => ({
    name: i === 0 ? 'Verse' : '',
    enabled: i === 0,
    slots: defaultSlots(),
  }),
)

/** How a section reads in a tab or the HUD; unnamed ones fall back to the number. */
export function sectionLabel(section: SongSection, index: number): string {
  return section.name.trim() || `Section ${index + 1}`
}

/** The lowest section that is on. There is always one: index 0 cannot be off. */
export function firstEnabled(sections: SongSection[]): number {
  const found = sections.findIndex((s) => s.enabled)
  return found === -1 ? 0 : found
}
