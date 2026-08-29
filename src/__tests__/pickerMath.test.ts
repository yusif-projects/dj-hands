import { describe, expect, it } from 'vitest'
import { wrapIndex } from '../components/pickerMath'

describe('wrapIndex', () => {
  it('steps forward and back', () => {
    expect(wrapIndex(0, 1, 4)).toBe(1)
    expect(wrapIndex(2, -1, 4)).toBe(1)
  })

  it('wraps at both ends', () => {
    expect(wrapIndex(3, 1, 4)).toBe(0)
    expect(wrapIndex(0, -1, 4)).toBe(3)
  })

  it('wraps a step longer than the list', () => {
    expect(wrapIndex(0, 6, 4)).toBe(2)
    expect(wrapIndex(0, -6, 4)).toBe(2)
  })

  // `findIndex` reports -1 for a value that is not in the options.
  it('lands somewhere real when it starts from a missing value', () => {
    expect(wrapIndex(-1, 1, 4)).toBe(0)
    expect(wrapIndex(-1, -1, 4)).toBe(2)
  })

  it('has nowhere to go in an empty list', () => {
    expect(wrapIndex(0, 1, 0)).toBe(0)
  })
})
