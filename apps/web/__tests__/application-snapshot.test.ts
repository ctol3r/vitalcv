import { describe, expect, it } from 'vitest';
import {
  computeApplicationSnapshotHash,
  createApplicationSnapshot,
  isTransitionAllowed,
  refreshApplicationSnapshot,
  requestApplicationAction,
  submitApplicationSnapshot,
  transitionApplicationStatus,
  verifySnapshotIntegrity,
  type ApplicationStatus,
} from '@/lib/apply/application-snapshot';

// Base fixture — a minimal partial-tier snapshot the tests reuse.
function baseDraft() {
  return createApplicationSnapshot({
    applicationId: 'app_1',
    subjectId: 'subject_1',
    employerId: 'employer_1',
    roleId: 'role_1',
    includedLanes: ['nppes', 'oig', 'pecos'],
    includedClaims: [
      { claimId: 'c_nppes_identity', sourceId: 'NPPES', kind: 'identity', verifiedAt: '2026-04-01T00:00:00Z' },
      { claimId: 'c_oig_exclusion', sourceId: 'OIG_LEIE', kind: 'safety', verifiedAt: '2026-04-01T00:00:00Z' },
    ],
    proofTier: 'partial_proof_pack',
    completeness: 72,
    createdAt: '2026-04-10T12:00:00Z',
  });
}

describe('computeApplicationSnapshotHash', () => {
  it('is deterministic for identical evidence', () => {
    const input = {
      subjectId: 's1',
      employerId: 'e1',
      roleId: 'r1',
      includedLanes: ['nppes', 'oig'] as const,
      includedClaims: [
        { claimId: 'c1', sourceId: 'NPPES', kind: 'identity', verifiedAt: null },
      ],
      proofTier: 'partial_proof_pack' as const,
      createdAt: '2026-04-10T00:00:00Z',
    };
    expect(computeApplicationSnapshotHash(input)).toBe(
      computeApplicationSnapshotHash(input),
    );
  });

  it('changes when proof tier changes', () => {
    const partial = computeApplicationSnapshotHash({
      subjectId: 's1',
      employerId: 'e1',
      roleId: 'r1',
      includedLanes: ['nppes'],
      includedClaims: [],
      proofTier: 'partial_proof_pack',
      createdAt: '2026-04-10T00:00:00Z',
    });
    const decisionGrade = computeApplicationSnapshotHash({
      subjectId: 's1',
      employerId: 'e1',
      roleId: 'r1',
      includedLanes: ['nppes'],
      includedClaims: [],
      proofTier: 'decision_grade_proof_pack',
      createdAt: '2026-04-10T00:00:00Z',
    });
    expect(partial).not.toBe(decisionGrade);
  });

  it('is stable under lane reordering (sorted internally)', () => {
    const ordered = computeApplicationSnapshotHash({
      subjectId: 's1',
      employerId: 'e1',
      roleId: 'r1',
      includedLanes: ['nppes', 'oig', 'pecos'],
      includedClaims: [],
      proofTier: 'partial_proof_pack',
      createdAt: '2026-04-10T00:00:00Z',
    });
    const reordered = computeApplicationSnapshotHash({
      subjectId: 's1',
      employerId: 'e1',
      roleId: 'r1',
      includedLanes: ['pecos', 'nppes', 'oig'],
      includedClaims: [],
      proofTier: 'partial_proof_pack',
      createdAt: '2026-04-10T00:00:00Z',
    });
    expect(ordered).toBe(reordered);
  });
});

describe('createApplicationSnapshot', () => {
  it('initializes in draft status with an empty audit log', () => {
    const snap = baseDraft();
    expect(snap.status).toBe('draft');
    expect(snap.auditLog).toEqual([]);
  });

  it('sorts lanes and claims deterministically before hashing', () => {
    const snap = createApplicationSnapshot({
      applicationId: 'app_1',
      subjectId: 's1',
      employerId: 'e1',
      roleId: 'r1',
      includedLanes: ['pecos', 'nppes', 'oig'],
      includedClaims: [
        { claimId: 'c_b', sourceId: 'OIG', kind: 'safety', verifiedAt: null },
        { claimId: 'c_a', sourceId: 'NPPES', kind: 'identity', verifiedAt: null },
      ],
      proofTier: 'partial_proof_pack',
      completeness: 50,
      createdAt: '2026-04-10T00:00:00Z',
    });
    expect(snap.includedLanes).toEqual(['nppes', 'oig', 'pecos']);
    expect(snap.includedClaims.map((c) => c.claimId)).toEqual(['c_a', 'c_b']);
  });

  it('clamps completeness into the 0-100 range', () => {
    const over = createApplicationSnapshot({
      applicationId: 'app_1',
      subjectId: 's',
      employerId: 'e',
      roleId: 'r',
      includedLanes: [],
      includedClaims: [],
      proofTier: 'partial_proof_pack',
      completeness: 150,
      createdAt: '2026-04-10T00:00:00Z',
    });
    expect(over.completeness).toBe(100);
    const under = createApplicationSnapshot({
      applicationId: 'app_1',
      subjectId: 's',
      employerId: 'e',
      roleId: 'r',
      includedLanes: [],
      includedClaims: [],
      proofTier: 'partial_proof_pack',
      completeness: -5,
      createdAt: '2026-04-10T00:00:00Z',
    });
    expect(under.completeness).toBe(0);
  });

  it('produces a hash that verifies via verifySnapshotIntegrity', () => {
    const snap = baseDraft();
    expect(verifySnapshotIntegrity(snap)).toBe(true);
  });
});

describe('submitApplicationSnapshot', () => {
  it('transitions draft -> submitted and appends an audit entry', () => {
    const snap = baseDraft();
    const submitted = submitApplicationSnapshot(snap, '2026-04-11T00:00:00Z');
    expect(submitted.status).toBe('submitted');
    expect(submitted.auditLog).toHaveLength(1);
    expect(submitted.auditLog[0].action).toBe('submitted');
    expect(submitted.auditLog[0].actor).toBe('clinician');
    expect(submitted.auditLog[0].from).toBe('draft');
    expect(submitted.auditLog[0].to).toBe('submitted');
  });

  it('preserves proof tier and snapshotHash exactly on submit', () => {
    const snap = baseDraft();
    const submitted = submitApplicationSnapshot(snap);
    expect(submitted.proofTier).toBe(snap.proofTier);
    expect(submitted.snapshotHash).toBe(snap.snapshotHash);
    expect(submitted.includedLanes).toEqual(snap.includedLanes);
    expect(submitted.includedClaims).toEqual(snap.includedClaims);
  });

  it('refuses to submit a non-draft snapshot', () => {
    const submitted = submitApplicationSnapshot(baseDraft());
    expect(() => submitApplicationSnapshot(submitted)).toThrow();
  });
});

describe('transitionApplicationStatus', () => {
  it('allows every legal transition in the continuity chain', () => {
    const legal: Array<[ApplicationStatus, ApplicationStatus]> = [
      ['draft', 'submitted'],
      ['submitted', 'viewed'],
      ['submitted', 'waiting_on_refresh'],
      ['submitted', 'waiting_on_manual_review'],
      ['viewed', 'in_review'],
      ['in_review', 'advanced'],
      ['advanced', 'credentialing'],
      ['credentialing', 'approved'],
      ['approved', 'start_ready'],
      ['start_ready', 'started'],
    ];
    for (const [from, to] of legal) {
      expect(isTransitionAllowed(from, to)).toBe(true);
    }
  });

  it('rejects submitted -> approved (cannot skip review + credentialing)', () => {
    expect(isTransitionAllowed('submitted', 'approved')).toBe(false);
  });

  it('rejects draft -> viewed (must go through submitted)', () => {
    expect(isTransitionAllowed('draft', 'viewed')).toBe(false);
  });

  it('started is terminal — no outgoing transitions', () => {
    const statuses: ApplicationStatus[] = [
      'draft', 'submitted', 'viewed', 'in_review',
      'waiting_on_refresh', 'waiting_on_manual_review',
      'advanced', 'credentialing', 'approved', 'start_ready', 'started',
    ];
    for (const status of statuses) {
      expect(isTransitionAllowed('started', status)).toBe(false);
    }
  });

  it('throws on a disallowed transition at runtime', () => {
    const snap = submitApplicationSnapshot(baseDraft());
    expect(() =>
      transitionApplicationStatus(snap, 'approved', { actor: 'employer' }),
    ).toThrow();
  });

  it('appends audit entry with actor + note on allowed transition', () => {
    const submitted = submitApplicationSnapshot(baseDraft());
    const viewed = transitionApplicationStatus(submitted, 'viewed', {
      actor: 'employer',
      at: '2026-04-12T00:00:00Z',
      note: 'Employer opened the review surface',
    });
    expect(viewed.status).toBe('viewed');
    expect(viewed.auditLog).toHaveLength(2);
    expect(viewed.auditLog[1].actor).toBe('employer');
    expect(viewed.auditLog[1].note).toContain('Employer');
  });
});

describe('requestApplicationAction', () => {
  it('request_refresh moves the application into waiting_on_refresh', () => {
    const submitted = submitApplicationSnapshot(baseDraft());
    const waiting = requestApplicationAction(submitted, 'request_refresh', {
      actor: 'employer',
      note: 'Need fresh PECOS',
    });
    expect(waiting.status).toBe('waiting_on_refresh');
  });

  it('route_to_review moves the application into waiting_on_manual_review', () => {
    const submitted = submitApplicationSnapshot(baseDraft());
    const routed = requestApplicationAction(submitted, 'route_to_review', {
      actor: 'employer',
    });
    expect(routed.status).toBe('waiting_on_manual_review');
  });

  it('audit entry names the requesting employer and the action kind', () => {
    const submitted = submitApplicationSnapshot(baseDraft());
    const waiting = requestApplicationAction(submitted, 'request_refresh', {
      actor: 'employer',
      note: 'stale PECOS',
    });
    const last = waiting.auditLog[waiting.auditLog.length - 1];
    expect(last.actor).toBe('employer');
    expect(last.action).toBe('request_refresh');
    expect(last.note).toBe('stale PECOS');
  });
});

describe('refreshApplicationSnapshot', () => {
  it('produces a NEW snapshotHash when evidence changes', () => {
    const submitted = submitApplicationSnapshot(baseDraft());
    const waiting = requestApplicationAction(submitted, 'request_refresh', { actor: 'employer' });
    const refreshed = refreshApplicationSnapshot(
      waiting,
      {
        proofTier: 'decision_grade_proof_pack',
        completeness: 100,
      },
      { at: '2026-04-15T00:00:00Z' },
    );
    expect(refreshed.snapshotHash).not.toBe(waiting.snapshotHash);
  });

  it('carries forward the full audit log plus a refresh_landed entry', () => {
    const submitted = submitApplicationSnapshot(baseDraft());
    const waiting = requestApplicationAction(submitted, 'request_refresh', { actor: 'employer' });
    const refreshed = refreshApplicationSnapshot(waiting, {
      proofTier: 'decision_grade_proof_pack',
    });
    expect(refreshed.auditLog).toHaveLength(waiting.auditLog.length + 1);
    const last = refreshed.auditLog[refreshed.auditLog.length - 1];
    expect(last.action).toBe('refresh_landed');
    expect(last.actor).toBe('vitalcv');
  });

  it('moves into in_review after a refresh lands', () => {
    const submitted = submitApplicationSnapshot(baseDraft());
    const waiting = requestApplicationAction(submitted, 'request_refresh', { actor: 'employer' });
    const refreshed = refreshApplicationSnapshot(waiting, {});
    expect(refreshed.status).toBe('in_review');
  });

  it('refuses to refresh an application not in waiting_on_refresh', () => {
    const submitted = submitApplicationSnapshot(baseDraft());
    expect(() => refreshApplicationSnapshot(submitted, {})).toThrow();
  });

  it('PARTIAL STAYS PARTIAL: a submitted snapshot never silently upgrades to decision_grade without a refresh', () => {
    const submitted = submitApplicationSnapshot(baseDraft());
    // Try to transition the submitted snapshot forward without writing
    // a new hash. The proof tier never changes on the original hash.
    const viewed = transitionApplicationStatus(submitted, 'viewed', { actor: 'employer' });
    expect(viewed.proofTier).toBe('partial_proof_pack');
    expect(viewed.snapshotHash).toBe(submitted.snapshotHash);
  });
});

describe('verifySnapshotIntegrity', () => {
  it('returns true for a freshly created snapshot', () => {
    expect(verifySnapshotIntegrity(baseDraft())).toBe(true);
  });

  it('returns true after a legal status transition (hash is over evidence, not status)', () => {
    const submitted = submitApplicationSnapshot(baseDraft());
    expect(verifySnapshotIntegrity(submitted)).toBe(true);
  });

  it('returns false if proof tier is mutated post-hoc (detects silent upgrade)', () => {
    const submitted = submitApplicationSnapshot(baseDraft());
    const tampered = { ...submitted, proofTier: 'decision_grade_proof_pack' as const };
    expect(verifySnapshotIntegrity(tampered)).toBe(false);
  });

  it('returns false if an included lane is added without rehashing', () => {
    const submitted = submitApplicationSnapshot(baseDraft());
    const tampered = {
      ...submitted,
      includedLanes: [...submitted.includedLanes, 'dea' as const],
    };
    expect(verifySnapshotIntegrity(tampered)).toBe(false);
  });
});
