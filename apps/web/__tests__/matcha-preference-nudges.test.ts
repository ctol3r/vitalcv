import { describe, expect, it } from 'vitest'

import {
  REMOTE_NUDGE_THRESHOLD,
  detectPreferenceNudge,
  type SessionPass,
} from '@/lib/matcha-deck/preferenceNudges'
import { ENGINE_BACKED_FIELDS } from '@/lib/matcha/preferences'

const onsite = (n: number): SessionPass[] => Array.from({ length: n }, () => ({ workArrangement: 'onsite' }))

describe('MATCHA preference nudges — honest, engine-backed offers (J6c)', () => {
  it('does not nudge below the onsite-pass threshold', () => {
    expect(detectPreferenceNudge(onsite(REMOTE_NUDGE_THRESHOLD - 1), new Set())).toBeNull()
  })

  it('offers the remote nudge once the pattern is clear', () => {
    const nudge = detectPreferenceNudge(onsite(REMOTE_NUDGE_THRESHOLD), new Set())
    expect(nudge).not.toBeNull()
    expect(nudge!.field).toBe('remoteInterest')
    expect(nudge!.value).toBe('high')
    // It is phrased as a QUESTION the clinician answers, not an assertion.
    expect(nudge!.message).toMatch(/\?$/)
  })

  it('only ever offers to change a field the engine actually ranks on', () => {
    const nudge = detectPreferenceNudge(onsite(5), new Set())
    expect(ENGINE_BACKED_FIELDS).toContain(nudge!.field)
  })

  it('never re-offers a nudge the clinician already dismissed or applied', () => {
    expect(detectPreferenceNudge(onsite(5), new Set(['prefer_remote']))).toBeNull()
  })

  it('remote and hybrid passes do not count toward the onsite pattern', () => {
    const mixed: SessionPass[] = [
      { workArrangement: 'remote' },
      { workArrangement: 'hybrid' },
      { workArrangement: 'onsite' },
    ]
    expect(detectPreferenceNudge(mixed, new Set())).toBeNull()
  })
})
