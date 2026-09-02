import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { CHORDS, DEFAULT_CHORD_SLOTS, QUALITIES, ROOTS } from '../audio/chords'
import { EFFECT_IDS } from '../audio/effects'
import { FILTER_TYPES } from '../audio/filter'
import { SECTION_COUNT } from '../audio/sections'
import { WAVEFORMS } from '../audio/voice'

const html = readFileSync(fileURLToPath(new URL('../../index.html', import.meta.url)), 'utf8')

function jsonLd(type: string): Record<string, never> {
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
  const found = blocks.map((m) => JSON.parse(m[1])).find((doc) => doc['@type'] === type)
  if (!found) throw new Error(`no ${type} block in index.html`)
  return found
}

describe('index.html structured data', () => {
  it('describes a free WebApplication at the canonical URL', () => {
    const app = jsonLd('WebApplication')
    expect(app).toMatchObject({
      name: 'DJ Hands',
      url: 'https://www.dj-hands.com/',
      isAccessibleForFree: true,
      offers: { price: '0' },
    })
    expect(app.featureList).toBeInstanceOf(Array)
  })

  /**
   * The feature list is the one place a claim about the instrument is written
   * out by hand — everything the app renders counts itself from these same
   * constants (`STATS` in StartScreen, `CAPABILITIES` in Landing). Adding a
   * chord quality would otherwise leave the structured data telling search
   * engines a number the site no longer backs up.
   */
  it('quotes counts the audio modules still agree with', () => {
    const features = (jsonLd('WebApplication').featureList as unknown as string[]).join(' ')
    const counts = [
      CHORDS.length,
      ROOTS.length,
      QUALITIES.length,
      SECTION_COUNT,
      DEFAULT_CHORD_SLOTS.length,
      WAVEFORMS.length,
      FILTER_TYPES.length,
      EFFECT_IDS.length,
    ]
    for (const n of counts) {
      expect(features, `featureList no longer mentions ${n}`).toMatch(
        new RegExp(`\\b${n}\\b|\\b${numberWord(n)}\\b`, 'i'),
      )
    }
  })
})

/** The list spells small counts out, so both spellings have to be accepted. */
function numberWord(n: number): string {
  const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
  return words[n] ?? String(n)
}
