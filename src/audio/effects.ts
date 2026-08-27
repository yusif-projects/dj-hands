/** The effect send, set once in the panel rather than played. */

export type SendTarget = 'reverb' | 'delay' | 'both'

export const SEND_TARGETS: SendTarget[] = ['reverb', 'delay', 'both']

/** Slider bounds for the send; also the clamp stored settings are normalized to. */
export const SEND_AMOUNT_RANGE = { min: 0, max: 1, step: 0.05 }

export const DEFAULT_SEND_TARGET: SendTarget = 'reverb'
export const DEFAULT_SEND_AMOUNT = 0.25

export function isSendTarget(value: unknown): value is SendTarget {
  return typeof value === 'string' && (SEND_TARGETS as string[]).includes(value)
}

/**
 * Wet mix for one effect: 0 when the send is not routed to it, otherwise the
 * configured amount. Whatever is unassigned sits fully dry rather than at some
 * baseline, so switching target silences the effect you switched away from.
 */
export function sendWet(amount: number, target: SendTarget, effect: 'reverb' | 'delay'): number {
  if (target !== 'both' && target !== effect) return 0
  return clamp01(amount)
}

function clamp01(v: number) {
  return Math.min(1, Math.max(0, v))
}
