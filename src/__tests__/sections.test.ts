import { describe, expect, it } from 'vitest'
import { DEFAULT_CHORDS } from '../audio/chords'
import {
  DEFAULT_SECTIONS,
  MAX_SECTION_NAME,
  SECTION_COUNT,
  defaultSlots,
  firstEnabled,
  sectionLabel,
} from '../audio/sections'

describe('DEFAULT_SECTIONS', () => {
  it('has one section per addressable finger count', () => {
    expect(DEFAULT_SECTIONS).toHaveLength(SECTION_COUNT)
  })

  it('starts with only the first section on', () => {
    expect(DEFAULT_SECTIONS.map((s) => s.enabled)).toEqual([true, false, false, false, false])
  })

  it('gives every section its own copy of the default progression', () => {
    for (const section of DEFAULT_SECTIONS) {
      expect(section.slots.map((s) => s.chord)).toEqual(DEFAULT_CHORDS)
    }
    // Shared slot objects would make an edit in one section show up in another.
    expect(DEFAULT_SECTIONS[0].slots[0]).not.toBe(DEFAULT_SECTIONS[1].slots[0])
    expect(defaultSlots()[0]).not.toBe(DEFAULT_SECTIONS[0].slots[0])
  })

  it('names only the first section, and within the name limit', () => {
    expect(DEFAULT_SECTIONS[0].name).toBe('Verse')
    for (const section of DEFAULT_SECTIONS) {
      expect(section.name.length).toBeLessThanOrEqual(MAX_SECTION_NAME)
    }
  })
})

describe('sectionLabel', () => {
  it('uses the name when there is one', () => {
    expect(sectionLabel({ name: 'Chorus', enabled: true, slots: [] }, 1)).toBe('Chorus')
  })

  it('falls back to the one-based number when there is not', () => {
    expect(sectionLabel({ name: '', enabled: false, slots: [] }, 2)).toBe('Section 3')
    // Whitespace is not a name; it would render as an empty tab.
    expect(sectionLabel({ name: '   ', enabled: true, slots: [] }, 0)).toBe('Section 1')
  })
})

describe('firstEnabled', () => {
  it('finds the lowest section that is on', () => {
    const off = { name: '', enabled: false, slots: [] }
    const on = { name: '', enabled: true, slots: [] }
    expect(firstEnabled([off, on, on])).toBe(1)
    expect(firstEnabled([on, off, on])).toBe(0)
  })

  it('falls back to the first section when nothing is on', () => {
    // Cannot happen through the panel, but it is the index everything else
    // treats as always present.
    expect(firstEnabled([{ name: '', enabled: false, slots: [] }])).toBe(0)
  })
})
