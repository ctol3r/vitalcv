import { describe, expect, it } from 'vitest'

import {
  PASS_REASONS,
  isPassReasonId,
  shouldPromptForReason,
} from '@/lib/matcha-deck/passReasons'

describe('MATCHA pass reasons — progressive prompting (J6b)', () => {
  it('never interrupts the first swipe', () => {
    expect(shouldPromptForReason(1, false)).toBe(false)
  })

  it('asks after the first few passes (2nd and 3rd)', () => {
    expect(shouldPromptForReason(2, false)).toBe(true)
    expect(shouldPromptForReason(3, false)).toBe(true)
  })

  it('then asks only occasionally — every 5th pass, not every swipe', () => {
    expect(shouldPromptForReason(4, false)).toBe(false)
    expect(shouldPromptForReason(5, false)).toBe(true)
    expect(shouldPromptForReason(6, false)).toBe(false)
    expect(shouldPromptForReason(7, false)).toBe(false)
    expect(shouldPromptForReason(10, false)).toBe(true)
  })

  it('never asks once the clinician has opted out', () => {
    for (const n of [2, 3, 5, 10, 25]) {
      expect(shouldPromptForReason(n, true)).toBe(false)
    }
  })

  it('the reason vocabulary is a fixed, non-empty set with a catch-all', () => {
    expect(PASS_REASONS.length).toBeGreaterThanOrEqual(8)
    expect(PASS_REASONS.some((r) => r.id === 'other')).toBe(true)
    for (const r of PASS_REASONS) {
      expect(isPassReasonId(r.id)).toBe(true)
      expect(r.label.length).toBeGreaterThan(0)
    }
  })

  it('rejects unknown reason ids', () => {
    expect(isPassReasonId('made_up')).toBe(false)
    expect(isPassReasonId(42)).toBe(false)
    expect(isPassReasonId(undefined)).toBe(false)
  })
})
