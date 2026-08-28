/** SVG outlines of the four oscillator shapes. Pure, so the tests can stay DOM-free. */

import { WAVEFORMS } from '../audio/voice'
import type { WaveformName } from '../audio/voice'

// Two cycles read as a repeating wave; one reads as a squiggle.
export const WAVE_CYCLES = 2

// Enough points that the sine has no visible corners at button size.
export const SINE_SAMPLES = 24

/** Unit points, x and y both 0→1, y measured downward. One cycle's worth. */
type UnitPoint = { x: number; y: number }

/**
 * One cycle of each shape as unit points. The steep edges of square and
 * sawtooth are a repeated x with two y values, which keeps them vertical
 * instead of leaning by however wide a sample happens to be. Every cycle ends
 * on the level it started at, so cycles can be strung together end to end.
 */
const CYCLES: Record<WaveformName, UnitPoint[]> = {
  sine: sineCycle(),
  triangle: [
    { x: 0, y: 0.5 },
    { x: 0.25, y: 0 },
    { x: 0.75, y: 1 },
    { x: 1, y: 0.5 },
  ],
  square: [
    { x: 0, y: 1 },
    { x: 0, y: 0 },
    { x: 0.5, y: 0 },
    { x: 0.5, y: 1 },
    { x: 1, y: 1 },
  ],
  sawtooth: [
    { x: 0, y: 1 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
  ],
}

/**
 * The wave drawn across a `w` × `h` box, inset by `pad` so a thick stroke does
 * not clip on the peaks.
 */
export function waveformPath(name: WaveformName, w: number, h: number, pad = 0): string {
  const cycle = CYCLES[name]
  const left = pad
  const width = w - pad * 2
  const cycleW = width / WAVE_CYCLES
  const top = pad
  const height = h - pad * 2
  const points: string[] = []

  for (let c = 0; c < WAVE_CYCLES; c++) {
    cycle.forEach((point, i) => {
      // Every cycle after the first opens on the point the last one closed on.
      if (c > 0 && i === 0) return
      points.push(`${round(left + (c + point.x) * cycleW)} ${round(top + point.y * height)}`)
    })
  }

  return `M ${points.join(' L ')}`
}

/** The waveform `steps` along the list from this one, wrapping at both ends. */
export function nextWaveform(current: WaveformName, steps: number): WaveformName {
  const from = WAVEFORMS.indexOf(current)
  const count = WAVEFORMS.length
  return WAVEFORMS[(((from + steps) % count) + count) % count]
}

function sineCycle(): UnitPoint[] {
  const points: UnitPoint[] = []
  for (let i = 0; i <= SINE_SAMPLES; i++) {
    const phase = i / SINE_SAMPLES
    points.push({ x: phase, y: 0.5 - Math.sin(phase * 2 * Math.PI) / 2 })
  }
  return points
}

function round(value: number): number {
  return Number(value.toFixed(4))
}
