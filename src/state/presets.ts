/**
 * Saved songs. Each one holds everything musical — `Song` in settings.ts —
 * under a name the player wrote, and once a song is opened it behaves like an
 * open document: every later edit is folded straight into it, so there is
 * nothing to press and nothing to forget.
 *
 * Its own key rather than a field in `Settings`, for the reason `panel.ts`,
 * `camera.ts` and `firstRun.ts` each have their own: "Reset to defaults"
 * spreads `DEFAULT_SETTINGS` wholesale, and a song list stored in there would
 * be wiped by resetting the sound — the one loss here nobody would forgive.
 *
 * The key carries no version, unlike `gesture-music.settings.v5`. A bump there
 * orphans the old blob, which costs a returning player their preferences; songs
 * are content somebody wrote, so they may never be orphaned. The version rides
 * inside each song instead and old ones climb `migrateSong` to reach the
 * present. See docs/CONFIGURATION.md for when that number moves.
 */

import { normalizeSong, type Song } from './settings'

const STORAGE_KEY = 'gesture-music.songs'

/** A row is a full-width line beside an open, a copy and a delete control;
    24 characters is what fits in a 340px rack before it truncates. */
export const MAX_PRESET_NAME = 24

/**
 * A song is about 2.3 KB of JSON — the 25 chord slots dominate — and Safari and
 * Firefox count `localStorage` in UTF-16 units, so roughly 4.6 KB of a 5 MB
 * origin budget each. Twenty-four is about 2% of that: far more songs than
 * anyone builds in one browser, and few enough that the list stays a list
 * rather than becoming a search problem.
 */
export const MAX_PRESETS = 24

/** Identifies a song on the clipboard. Stable forever — it says what this is,
    not which version it is; `SONG_VERSION` is the part that moves. */
export const SONG_FORMAT = 'dj-hands.song'

/**
 * The top rung of the ladder below. Bump it only when the meaning of a field
 * that already exists changes — a rename, a unit change, a split, a removal.
 * Adding a field never needs a bump: `normalizeSettings` spreads the current
 * defaults under the stored blob, so an older song simply picks the new one up.
 */
export const SONG_VERSION = 1

export interface Preset {
  id: string
  /** May be empty; `presetLabel` falls back to the number, as sections do. */
  name: string
  savedAt: number
  /** What the song was written by, for the ladder to read on the way back in. */
  version: number
  song: Song
}

/** `activeId` is the open document. `null` means edits go to the live settings
    and nowhere else, which is what a player who never opens this group gets. */
export interface PresetStore {
  activeId: string | null
  items: Preset[]
}

/** What travels on the clipboard: an envelope, because a bare song has nowhere
    to carry its name or its version, and nothing to tell it apart from any
    other JSON somebody might paste in. */
export interface PresetPayload {
  format: typeof SONG_FORMAT
  version: number
  name: string
  song: Song
}

export const EMPTY_PRESETS: PresetStore = { activeId: null, items: [] }

/**
 * Each step reshapes one version into the next and validates nothing —
 * `normalizeSong` is still the only validator, and it runs after the ladder
 * however many rungs were climbed. Index 0 is v1 to v2.
 */
const MIGRATIONS: ((song: Record<string, unknown>) => Record<string, unknown>)[] = []

/** A song written before the field existed is version 1, which is what it is. */
function songVersion(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 1
}

/**
 * Climbs a song from the version it claims to the one this build speaks. A
 * version from the future has no rung to climb, so it passes straight through
 * to the normalizers and plays with whatever is understood — degrading beats
 * refusing, and the fields this build has no name for ride through untouched.
 */
export function migrateSong(raw: unknown, from: number): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw
  let song = raw as Record<string, unknown>
  for (let version = songVersion(from); version < SONG_VERSION; version++) {
    const step = MIGRATIONS[version - 1]
    // A gap in the ladder must not swallow the song: what is here is still
    // worth handing to the normalizers.
    if (!step) break
    song = step(song)
  }
  return song
}

/**
 * The one road a song takes to get in, whether it came from storage or off the
 * clipboard — so a migration can never be written for one path and forgotten
 * for the other.
 */
function adoptSong(raw: unknown, claimed: unknown): { song: Song; version: number } {
  const version = songVersion(claimed)
  return {
    song: normalizeSong(migrateSong(raw, version)),
    // A song from a newer build keeps its own stamp. Unknown fields survive the
    // normalizers, so re-saving one here must not claim it was written down to
    // what this build happens to understand.
    version: Math.max(version, SONG_VERSION),
  }
}

/**
 * `randomUUID` needs a secure context — so does `getUserMedia`, so it is there
 * wherever the instrument runs at all. The fallback covers the older browsers
 * that shipped `crypto` without it; an id only has to be unique across at most
 * `MAX_PRESETS` rows in one browser, which this comfortably is.
 */
function newId(): string {
  return (
    crypto.randomUUID?.() ??
    `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
  )
}

export function newPreset(name: string, song: Song, now = Date.now()): Preset {
  return {
    id: newId(),
    name: name.slice(0, MAX_PRESET_NAME),
    savedAt: now,
    version: SONG_VERSION,
    song,
  }
}

/** An unnamed song is numbered rather than refused, the way a section is. */
export function presetLabel(preset: Preset, index: number): string {
  return preset.name.trim() || `Song ${index + 1}`
}

export function loadPresets(): PresetStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY_PRESETS
    const parsed = JSON.parse(raw) as Partial<PresetStore>
    const seen = new Set<string>()
    const items = (Array.isArray(parsed.items) ? parsed.items : [])
      // Cut before normalizing: a hand-edited store of a thousand songs should
      // not mean a thousand runs of the settings normalizers on the way to the
      // cap that is about to discard most of them.
      .slice(0, MAX_PRESETS)
      .map((stored) => normalizePreset((stored ?? {}) as Partial<Preset>, seen))
    return {
      // An id naming nothing is a closed document rather than a dangling
      // pointer: every edit after it would otherwise sync into thin air.
      activeId: items.some((preset) => preset.id === parsed.activeId)
        ? (parsed.activeId as string)
        : null,
      items,
    }
  } catch {
    return EMPTY_PRESETS
  }
}

function normalizePreset(stored: Partial<Preset>, seen: Set<string>): Preset {
  // Two rows sharing an id would both answer the same lookup, so one could
  // never be opened and the other would quietly take its edits.
  const id =
    typeof stored.id === 'string' && stored.id && !seen.has(stored.id) ? stored.id : newId()
  seen.add(id)
  const { song, version } = adoptSong(stored.song, stored.version)
  return {
    id,
    // Truncated rather than rejected, the rule `normalizeSections` follows.
    name: typeof stored.name === 'string' ? stored.name.slice(0, MAX_PRESET_NAME) : '',
    savedAt: Number.isFinite(Number(stored.savedAt)) ? Number(stored.savedAt) : 0,
    version,
    song,
  }
}

/**
 * Reports whether the write landed, unlike every other save in this repo. That
 * is deliberate: a settings write that failed costs a preference the player
 * will re-set without noticing, where a song write that failed leaves a named
 * song sitting visibly in a list that will be gone on reload. Safari in private
 * mode throws on `setItem`, so this is not a hypothetical.
 */
export function savePresets(store: PresetStore): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
    return true
  } catch {
    return false
  }
}

/** Adds a song and opens it in one step: saving is how you start working on one. */
export function addPreset(store: PresetStore, preset: Preset): PresetStore {
  // The panel disables its buttons at the cap; this is what makes the cap true
  // rather than merely displayed.
  if (store.items.length >= MAX_PRESETS) return store
  return { activeId: preset.id, items: [...store.items, preset] }
}

/**
 * Folds what is being played into the open song. Nothing is open in the common
 * case — songs are opt-in — so the store comes back by identity and an edit
 * costs one null check. The clock is a parameter because a stamp read off the
 * wall makes the result untestable.
 */
export function syncActive(store: PresetStore, song: Song, now = Date.now()): PresetStore {
  if (!store.activeId) return store
  let found = false
  const items = store.items.map((preset) => {
    if (preset.id !== store.activeId) return preset
    found = true
    return { ...preset, song, savedAt: now }
  })
  // An `activeId` naming nothing would otherwise make every edit a wasted map.
  return found ? { ...store, items } : store
}

/**
 * Pretty-printed, because this goes into a chat message and the chord list is
 * worth being able to read before pasting it into an instrument. Carries no id
 * — one from another browser means nothing here — and no `savedAt`, which is a
 * fact about your save rather than about the song. So pasting your own copy
 * back gives you a second, independent song rather than overwriting the first.
 */
export function toPayload(preset: Preset): string {
  return JSON.stringify(
    { format: SONG_FORMAT, version: preset.version, name: preset.name, song: preset.song },
    null,
    2,
  )
}

/** Null rather than a throw: "that is not a song" is something the panel says. */
export function parsePayload(text: string): PresetPayload | null {
  try {
    const parsed = JSON.parse(text) as Partial<PresetPayload>
    // The tag is the only thing separating a song from whatever else was on the
    // clipboard, so it is checked rather than sniffed for.
    if (!parsed || typeof parsed !== 'object' || parsed.format !== SONG_FORMAT) return null
    const { song, version } = adoptSong(parsed.song, parsed.version)
    return {
      format: SONG_FORMAT,
      version,
      name: typeof parsed.name === 'string' ? parsed.name.slice(0, MAX_PRESET_NAME) : '',
      song,
    }
  } catch {
    return null
  }
}
