import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { render } from '../prerender'
import { ARP_PATTERNS } from '../audio/arp'
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
      ARP_PATTERNS.length,
    ]
    for (const n of counts) {
      expect(features, `featureList no longer mentions ${n}`).toMatch(
        new RegExp(`\\b${n}\\b|\\b${numberWord(n)}\\b`, 'i'),
      )
    }
  })
})

/**
 * The start card is the other place the instrument describes itself, and it is
 * the place the description rots: its effects line still read "reverb + delay"
 * a release after the rack grew to six, because that half of the sentence was
 * typed by hand while the two counts beside it were derived. `featureList`
 * above had a test and stayed right; the card did not and did not.
 *
 * Read off the prerendered markup rather than the component, because that
 * string is what actually ships to a reader with JavaScript off.
 */
describe('the prerendered start card', () => {
  it('quotes counts the audio modules still agree with', () => {
    const body = render().body
    const start = body.indexOf('class="start-card"')
    const end = body.indexOf('class="landing"')
    expect(start, 'no start card in the prerendered body').toBeGreaterThan(-1)
    expect(end, 'no landing section in the prerendered body').toBeGreaterThan(start)
    // Tags stripped, so the match is against what a reader sees. Left as markup
    // the check is very nearly vacuous: the gesture icons are inline SVG, and
    // coordinates like "6.6" in their path data satisfy a bare \b6\b — a card
    // still advertising two effects passed this test until the tags came out.
    const card = body.slice(start, end).replace(/<[^>]*>/g, ' ')

    const counts = [
      CHORDS.length,
      ROOTS.length,
      QUALITIES.length,
      SECTION_COUNT,
      DEFAULT_CHORD_SLOTS.length,
      WAVEFORMS.length,
      FILTER_TYPES.length,
      EFFECT_IDS.length,
      ARP_PATTERNS.length,
    ]
    for (const n of counts) {
      // The chord count is rounded down to a "480+" headline, so the card is
      // asked for the round number rather than the exact one.
      const shown = n === CHORDS.length ? Math.floor(n / 10) * 10 : n
      expect(card, `the start card no longer mentions ${shown}`).toMatch(
        new RegExp(`\\b${shown}\\b|\\b${numberWord(shown)}\\b`, 'i'),
      )
    }
  })

  /** The rack is named as well as counted, and the names drift the same way. */
  it('names every effect in the rack', () => {
    const body = render().body
    const card = body.slice(body.indexOf('class="start-card"'), body.indexOf('class="landing"'))
    for (const id of EFFECT_IDS) {
      expect(card, `the start card no longer names ${id}`).toContain(id)
    }
  })
})

/** The list spells small counts out, so both spellings have to be accepted. */
function numberWord(n: number): string {
  const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
  return words[n] ?? String(n)
}
