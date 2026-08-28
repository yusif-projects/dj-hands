import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_PANEL_GROUP,
  PANEL_GROUPS,
  PANEL_GROUP_LABELS,
  loadPanelGroup,
  savePanelGroup,
} from '../state/panel'

const KEY = 'gesture-music.panel-group'

// Tests run in node, with no DOM: the persistence layer needs a store to talk to.
const store = new Map<string, string>()
beforeEach(() => {
  store.clear()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  })
})

describe('loadPanelGroup', () => {
  it('opens the default group when nothing is stored', () => {
    expect(loadPanelGroup()).toBe(DEFAULT_PANEL_GROUP)
  })

  it('round-trips every group through savePanelGroup', () => {
    for (const group of PANEL_GROUPS) {
      savePanelGroup(group)
      expect(loadPanelGroup()).toBe(group)
    }
  })

  // A closed panel is a choice, so it has to survive rather than fall back to
  // the default the way an empty store does.
  it('keeps a closed panel closed', () => {
    savePanelGroup(null)
    expect(loadPanelGroup()).toBeNull()
  })

  it('falls back to the default on a group name it does not know', () => {
    store.set(KEY, 'reverbs')
    expect(loadPanelGroup()).toBe(DEFAULT_PANEL_GROUP)
  })
})

describe('PANEL_GROUP_LABELS', () => {
  it('names every group', () => {
    for (const group of PANEL_GROUPS) {
      expect(PANEL_GROUP_LABELS[group]).toBeTruthy()
    }
  })
})
