/**
 * What a play session amounted to, accumulated by the render loop and sent once
 * when the session ends.
 *
 * The loop in `useHandTracking` runs at display rate, so it must not call
 * `track()` — a chord change is an event worth having, but sixty of them a
 * second is not. Instead the loop writes counters here, and `summarizeSession`
 * turns them into one `session_ended` payload at the end.
 */
export interface SessionStats {
  /** Left-hand transitions onto a chord; the count of chords actually struck. */
  chordsPlayed: number
  /** Which of the five slots were reached, so repeats do not inflate the reach. */
  chords: Set<number>
  /** Section changes made by gesture, and which sections those landed on. */
  sectionSwitches: number
  sections: Set<number>
  /** Extremes of the two continuous gestures, for the span each explored. */
  cutoffMin: number
  cutoffMax: number
  volumeMin: number
  volumeMax: number
  /** Frames drawn, and how many of those had a hand in them. */
  frames: number
  framesWithHand: number
  /** Running sum of per-frame fps, averaged at the end. */
  fpsSum: number
}

export function createSessionStats(): SessionStats {
  return {
    chordsPlayed: 0,
    chords: new Set(),
    sectionSwitches: 0,
    sections: new Set(),
    // Inverted bounds so the first observation sets both ends; a session that
    // never moves a hand reports a span of zero rather than the full range.
    cutoffMin: Infinity,
    cutoffMax: -Infinity,
    volumeMin: Infinity,
    volumeMax: -Infinity,
    frames: 0,
    framesWithHand: 0,
    fpsSum: 0,
  }
}

/**
 * The `session_ended` params. Pure, so the arithmetic is testable without a
 * camera: everything it needs is in the accumulator and the two arguments.
 */
export function summarizeSession(
  stats: SessionStats,
  seconds: number,
  coachDone: boolean,
): Record<string, number | boolean> {
  return {
    seconds: Math.round(seconds),
    chords_played: stats.chordsPlayed,
    distinct_chords: stats.chords.size,
    section_switches: stats.sectionSwitches,
    sections_used: stats.sections.size,
    filter_swept: round2(span(stats.cutoffMin, stats.cutoffMax)),
    volume_used: round2(span(stats.volumeMin, stats.volumeMax)),
    hands_pct: stats.frames ? Math.round((stats.framesWithHand / stats.frames) * 100) : 0,
    avg_fps: stats.frames ? Math.round(stats.fpsSum / stats.frames) : 0,
    coach_done: coachDone,
  }
}

/** Zero until both ends have been observed, so an untouched gesture reads as unused. */
function span(min: number, max: number): number {
  return Number.isFinite(min) && Number.isFinite(max) ? Math.max(0, max - min) : 0
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}
