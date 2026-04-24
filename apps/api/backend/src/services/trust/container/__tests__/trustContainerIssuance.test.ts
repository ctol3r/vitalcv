/**
 * Wave 3 — end-to-end issuance helper test.
 *
 * Covers: envelope derivation from a TrustPassport fixture, manifest
 * entry construction via a real MockTrustContainer, partial-stays-
 * partial preservation, and safe handling when issuance throws.
 */

import {
  buildCredentialEnvelopeFromPassport,
  issueTrustContainerManifestEntry,
} from '../trustContainerIssuance';
import type { TrustPassport } from '../../../entity/passportService';

function minimalPassport(overrides: Partial<TrustPassport> = {}): TrustPassport {
  const base = {
    entityId: 'entity_test',
    npi: '1234567890',
    identity: {
      displayName: 'Dr. Test',
      npi: '1234567890',
      specialty: 'Family Medicine',
    },
    authority: { credentials: [], summary: { active: 0, missing: [] } },
    standing: {
      exclusionStatus: 'CLEAR',
      exclusionClear: true,
      exclusionCheckedAt: '2026-04-24T00:00:00.000Z',
      exclusionConfidenceLabel: 'HIGH',
      negativeFindings: [],
    },
    readiness: {
      status: 'READY',
      score: 90,
      readiness_score: 90,
      level: 'L3',
      estimatedStartDays: 3,
      blockers: [],
      nextActions: [],
    },
    truth: {},
    trustPosture: {
      freshness: { state: 'current', label: 'Current', items: [] },
    },
    sourceCoverage: {
      checks: [
        {
          sourceId: 'NPPES_API',
          state: 'checked',
          reason: 'ok',
          checkedAt: '2026-04-24T00:00:00.000Z',
          observedAt: null,
          expiresAt: null,
          freshness: null,
          provenance: null,
          proof: { artifactIds: ['a-1'], receiptIds: ['r-1'] },
          checksum: 'chk-1',
        },
      ],
      summary: {},
    },
    lastCheckedAt: '2026-04-24T00:00:00.000Z',
    decisionPosture: {
      status: 'READY',
      headline: '',
      blockers: [],
      freshness: { state: 'current', label: 'Current', items: [] },
      nextAction: '',
    },
  };
  return { ...(base as unknown as TrustPassport), ...overrides };
}

describe('buildCredentialEnvelopeFromPassport', () => {
  it('derives DECISION_GRADE envelope from a clean passport', () => {
    const envelope = buildCredentialEnvelopeFromPassport({ passport: minimalPassport() });
    expect(envelope.status).toBe('DECISION_GRADE');
    expect(envelope.proofTier).toBe('DECISION_GRADE');
    expect(envelope.sourceCoverage).toContain('NPPES_API');
    expect(envelope.psvReceiptRefs.length).toBe(1);
    expect(envelope.limitationNotes).toEqual([]);
  });

  it('preserves limitations and keeps a partial proof partial', () => {
    const envelope = buildCredentialEnvelopeFromPassport({
      passport: minimalPassport({
        readiness: {
          status: 'READY',
          score: 60,
          readiness_score: 60,
          level: 'L2',
          estimatedStartDays: 5,
          blockers: ['Identity not strictly verified'],
          nextActions: [],
        } as unknown as TrustPassport['readiness'],
      }),
    });
    expect(envelope.status).toBe('PARTIAL');
    expect(envelope.proofTier).toBe('PARTIAL');
    expect(envelope.limitationNotes).toEqual(['Identity not strictly verified']);
  });

  it('treats trust-posture gaps as limitations and prevents decision-grade metadata', () => {
    const envelope = buildCredentialEnvelopeFromPassport({
      passport: minimalPassport({
        readiness: {
          status: 'READY',
          score: 90,
          readiness_score: 90,
          level: 'L3',
          estimatedStartDays: 3,
          blockers: [],
          nextActions: [],
        } as unknown as TrustPassport['readiness'],
        trustPosture: {
          freshness: { state: 'current', label: 'Current', items: [] },
          blockers: [],
          missingItems: [],
          gatedItems: ['Institutional access required'],
          reviewRequiredItems: [],
          staleItems: [],
        } as unknown as TrustPassport['trustPosture'],
      }),
    });
    expect(envelope.status).toBe('PARTIAL');
    expect(envelope.proofTier).toBe('PARTIAL');
    expect(envelope.limitationNotes).toEqual(['Institutional access required']);
  });

  it('emits BLOCKED when posture is blocked or score is zero', () => {
    const envelope = buildCredentialEnvelopeFromPassport({
      passport: minimalPassport({
        readiness: {
          status: 'BLOCKED',
          score: 0,
          readiness_score: 0,
          level: 'L0',
          estimatedStartDays: null,
          blockers: ['Sanction on file'],
          nextActions: [],
        } as unknown as TrustPassport['readiness'],
      }),
    });
    expect(envelope.status).toBe('BLOCKED');
    expect(envelope.proofTier).toBe('NONE');
  });
});

describe('issueTrustContainerManifestEntry', () => {
  it('returns an issued manifest entry using the default mock provider', async () => {
    const entry = await issueTrustContainerManifestEntry({ passport: minimalPassport() });
    expect(entry.status).toBe('issued');
    expect(entry.provider).toBe('mock');
    expect(entry.mock).toBe(true);
    expect(entry.environment).toBe('mock-dev');
    expect(entry.trustContainerId).toMatch(/^mock_vc_/);
    expect(entry.proofTier).toBe('DECISION_GRADE');
    expect(entry.proofStatus).toBe('DECISION_GRADE');
    expect(entry.auditHash).toBeTruthy();
  });

  it('falls back to not_issued when the envelope invariant is violated', async () => {
    // Force a LIMITATION_CONFLICT by passing in an invalid pre-built envelope.
    const passport = minimalPassport();
    const baseline = buildCredentialEnvelopeFromPassport({ passport });
    const badEnvelope = {
      ...baseline,
      status: 'DECISION_GRADE' as const,
      proofTier: 'DECISION_GRADE' as const,
      limitationNotes: ['this should block decision-grade'],
    };
    const entry = await issueTrustContainerManifestEntry({ passport, envelope: badEnvelope });
    expect(entry.status).toBe('failed');
    expect(entry.trustContainerId).toBeNull();
    expect(entry.credentialEnvelopeId).toBeNull();
    expect(entry.provider).toBe('mock');
    expect(entry.environment).toBe('mock-dev');
    expect(entry.label).toBe('Credential container: issuance failed');
    expect(entry.skipReason).toMatch(/LIMITATION|limitation/i);
  });
});
