/**
 * Pins the Wave 10 replay-identity contract on the web validator:
 *   - `replay` is optional (passport responses from older backend
 *     versions remain valid)
 *   - if present, must have `lineageKey: string`, `runId: string`,
 *     `schemeVersion: 'v1'`
 *   - malformed `replay` payloads cause `normalizePassportData` to
 *     reject the whole response (so the proxy 502s instead of
 *     forwarding garbage to the UI)
 */
import { describe, expect, it } from 'vitest';
import {
  isPassportData,
  normalizePassportData,
} from '@/lib/trust/passport-contract';

function buildBasePayload(extra: Record<string, unknown> = {}) {
  return {
    entityId: 'entity-1',
    npi: '1234567890',
    identity: {
      displayName: 'Macie Miller',
      specialty: 'PA-C',
      entityType: 'PERSON',
      status: 'ACTIVE',
      npi: '1234567890',
    },
    authority: {
      credentials: [],
      summary: { active: 0, expired: 0, stale: 0, missing: [] as string[] },
    },
    training: {
      records: [],
      hasDegree: false,
      degreeVerified: false,
      hasResidency: false,
      fellowshipCount: 0,
    },
    standing: {
      exclusionClear: true,
      exclusionStatus: 'CLEAR',
      licensureStatus: 'verified',
      deaStatus: 'unknown',
      pecosStatus: 'unknown',
      pecosEnrollmentStatus: 'UNCHECKED',
      enrollmentSourceLabel: 'PECOS',
      enrollmentDataFreshness: 'unchecked',
      enrollmentNote: null,
      negativeFindings: [] as string[],
    },
    readiness: {
      status: 'PARTIAL',
      score: 25,
      level: 'L1',
      blockers: [] as string[],
      gaps: [] as string[],
      estimatedStartDays: null,
      nextActions: [] as unknown[],
    },
    sources: { checked: [] as string[], lastFetch: {} as Record<string, string> },
    sourceCoverage: { checks: [] as unknown[] },
    lastCheckedAt: '2026-04-01T15:00:00.000Z',
    trustPosture: {
      band: 'YELLOW',
      bandLabel: 'Partial',
      score: 25,
      dimensions: [] as unknown[],
      freshness: { state: 'partial' as const, label: 'partial', items: [] as unknown[] },
      safeToRelyOnNow: [] as string[],
      missingItems: [] as string[],
      gatedItems: [] as string[],
      reviewRequiredItems: [] as string[],
      staleItems: [] as string[],
      blockers: [] as string[],
    },
    ...extra,
  };
}

const VALID_REPLAY = {
  lineageKey: 'lin_v1_a1b2c3d4e5f60718',
  runId: 'run_v1_aaaabbbbccccdddd',
  schemeVersion: 'v1' as const,
};

describe('PassportData validator — replay identity (Wave 10)', () => {
  it('accepts payload with no replay field (backward compat)', () => {
    expect(isPassportData(buildBasePayload())).toBe(true);
  });

  it('accepts payload with a well-formed replay field', () => {
    expect(isPassportData(buildBasePayload({ replay: VALID_REPLAY }))).toBe(true);
  });

  it('rejects payload with replay missing lineageKey', () => {
    const bad = { ...VALID_REPLAY } as Record<string, unknown>;
    delete bad.lineageKey;
    expect(isPassportData(buildBasePayload({ replay: bad }))).toBe(false);
  });

  it('rejects payload with replay missing runId', () => {
    const bad = { ...VALID_REPLAY } as Record<string, unknown>;
    delete bad.runId;
    expect(isPassportData(buildBasePayload({ replay: bad }))).toBe(false);
  });

  it('rejects payload with schemeVersion that is not v1', () => {
    expect(isPassportData(buildBasePayload({ replay: { ...VALID_REPLAY, schemeVersion: 'v2' } }))).toBe(false);
  });

  it('rejects payload with replay not an object', () => {
    expect(isPassportData(buildBasePayload({ replay: 'oops' }))).toBe(false);
    expect(isPassportData(buildBasePayload({ replay: 42 }))).toBe(false);
    expect(isPassportData(buildBasePayload({ replay: null }))).toBe(false);
  });

  it('normalizePassportData preserves the replay field when present', () => {
    const normalized = normalizePassportData(buildBasePayload({ replay: VALID_REPLAY }));
    expect(normalized).not.toBeNull();
    expect(normalized?.replay).toEqual(VALID_REPLAY);
  });

  it('normalizePassportData yields undefined replay when absent', () => {
    const normalized = normalizePassportData(buildBasePayload());
    expect(normalized).not.toBeNull();
    expect(normalized?.replay).toBeUndefined();
  });
});
