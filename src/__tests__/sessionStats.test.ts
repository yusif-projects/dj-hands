import { describe, expect, it } from 'vitest'
import { createSessionStats, summarizeSession } from '../sessionStats'

describe('createSessionStats', () => {
  it('starts a session with nothing counted', () => {
    const summary = summarizeSession(createSessionStats(), 0, false)
    expect(summary).toMatchObject({
      seconds: 0,
      chords_played: 0,
      distinct_chords: 0,
      section_switches: 0,
      sections_used: 0,
      coach_done: false,
    })
  })

  // The inverted bounds must not leak out as a full-range sweep on a session
  // where no hand ever moved.
  it('reports no sweep for gestures that never happened', () => {
    const summary = summarizeSession(createSessionStats(), 10, false)
    expect(summary.filter_swept).toBe(0)
    expect(summary.volume_used).toBe(0)
  })

  it('reports zeroed rates rather than dividing by no frames', () => {
    const summary = summarizeSession(createSessionStats(), 5, true)
    expect(summary.hands_pct).toBe(0)
    expect(summary.avg_fps).toBe(0)
  })
})

describe('summarizeSession', () => {
  it('separates chords struck from chords reached', () => {
    const stats = createSessionStats()
    // The same two chords, back and forth: five strikes, two of the five slots.
    for (const chord of [1, 2, 1, 2, 1]) {
      stats.chordsPlayed++
      stats.chords.add(chord)
    }
    const summary = summarizeSession(stats, 30, true)
    expect(summary.chords_played).toBe(5)
    expect(summary.distinct_chords).toBe(2)
  })

  it('measures the span a sweep covered, not where it ended', () => {
    const stats = createSessionStats()
    for (const v of [0.5, 0.2, 0.9, 0.4]) {
      stats.cutoffMin = Math.min(stats.cutoffMin, v)
      stats.cutoffMax = Math.max(stats.cutoffMax, v)
    }
    expect(summarizeSession(stats, 1, false).filter_swept).toBe(0.7)
  })

  it('rounds a span to two places', () => {
    const stats = createSessionStats()
    stats.volumeMin = 0.1234
    stats.volumeMax = 0.8888
    expect(summarizeSession(stats, 1, false).volume_used).toBe(0.77)
  })

  it('reports hand detection as a percentage of frames drawn', () => {
    const stats = createSessionStats()
    stats.frames = 200
    stats.framesWithHand = 150
    stats.fpsSum = 200 * 29.6
    const summary = summarizeSession(stats, 1, false)
    expect(summary.hands_pct).toBe(75)
    expect(summary.avg_fps).toBe(30)
  })

  it('rounds the duration to whole seconds', () => {
    expect(summarizeSession(createSessionStats(), 42.6, false).seconds).toBe(43)
  })

  it('counts a section reached twice only once', () => {
    const stats = createSessionStats()
    stats.sections.add(0)
    for (const section of [1, 2, 1]) {
      stats.sectionSwitches++
      stats.sections.add(section)
    }
    const summary = summarizeSession(stats, 1, false)
    expect(summary.section_switches).toBe(3)
    expect(summary.sections_used).toBe(3)
  })
})
