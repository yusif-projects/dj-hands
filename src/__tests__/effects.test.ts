import { describe, expect, it } from 'vitest'
import { SEND_TARGETS, isSendTarget, sendWet } from '../audio/effects'

describe('sendWet', () => {
  it('feeds only the assigned effect', () => {
    expect(sendWet(1, 'reverb', 'reverb')).toBe(1)
    expect(sendWet(1, 'reverb', 'delay')).toBe(0)
    expect(sendWet(1, 'delay', 'delay')).toBe(1)
    expect(sendWet(1, 'delay', 'reverb')).toBe(0)
  })

  it('feeds both when both are assigned', () => {
    expect(sendWet(1, 'both', 'reverb')).toBe(1)
    expect(sendWet(1, 'both', 'delay')).toBe(1)
  })

  it('passes the amount straight through to the assigned effect', () => {
    expect(sendWet(0.25, 'reverb', 'reverb')).toBeCloseTo(0.25, 6)
    expect(sendWet(0.6, 'both', 'delay')).toBeCloseTo(0.6, 6)
  })

  it('an amount of zero is fully dry', () => {
    expect(sendWet(0, 'both', 'reverb')).toBe(0)
    expect(sendWet(0, 'both', 'delay')).toBe(0)
  })

  it('never asks Tone for a wet mix outside 0-1', () => {
    expect(sendWet(2, 'both', 'reverb')).toBe(1)
    expect(sendWet(-1, 'both', 'reverb')).toBe(0)
  })
})

describe('isSendTarget', () => {
  it('accepts every target', () => {
    for (const t of SEND_TARGETS) expect(isSendTarget(t)).toBe(true)
  })

  it('rejects anything else a stored blob might hold', () => {
    for (const junk of ['chorus', '', null, undefined, 0, {}, ['reverb']]) {
      expect(isSendTarget(junk)).toBe(false)
    }
  })
})
