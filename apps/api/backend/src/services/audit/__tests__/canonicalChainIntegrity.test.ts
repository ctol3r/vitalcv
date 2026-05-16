/**
 * canonicalChainIntegrity — unit tests
 *
 * Pure-transform module — no mocks. Verifies each of the six integrity axes
 * passes on a clean chain, fails on a tampered chain, and produces stable
 * digests across re-runs.
 */

import {
  CANONICAL_CHAIN_INTEGRITY_SENTINELS,
  KNOWN_CHAIN_INTEGRITY_AXES,
  KNOWN_CHAIN_INTEGRITY_VIOLATIONS,
  validateCanonicalAuditChain,
  type ChainIntegrityAuditEvent,
  type ChainIntegrityReplayInput,
  type PreDegradationSnapshot,
} from '../canonicalChainIntegrity';
import {
  quarantineReplay,
  type ReplayQuarantineRecord,
} from '../replayCorruptionContainment';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function cleanQuarantine(capsuleId: string, opts: {
  subjectNpi?: string | null;
  credentialIds?: string[];
  sourceReferenceId?: string | null;
} = {}): ReplayQuarantineRecord {
  return quarantineReplay({
    capsuleId,
    integrity: {
      hashMatch: true,
      storedHash: 'a'.repeat(64),
      recomputedHash: 'a'.repeat(64),
      tamperEvidence: null,
    },
    lineageHints: {
      subjectNpi: opts.subjectNpi ?? '1234567890',
      credentialIds: opts.credentialIds ?? ['cred-a'],
      sourceReferenceId: opts.sourceReferenceId ?? 'ref-x',
    },
  });
}

function corruptQuarantine(capsuleId: string, opts: {
  subjectNpi?: string | null;
  credentialIds?: string[];
  sourceReferenceId?: string | null;
} = {}): ReplayQuarantineRecord {
  return quarantineReplay({
    capsuleId,
    integrity: {
      hashMatch: false,
      storedHash: 'a'.repeat(64),
      recomputedHash: 'b'.repeat(64),
      tamperEvidence: 'Hash mismatch — stored: aaaa… computed: bbbb…',
    },
    lineageHints: {
      subjectNpi: opts.subjectNpi ?? '1234567890',
      credentialIds: opts.credentialIds ?? ['cred-a'],
      sourceReferenceId: opts.sourceReferenceId ?? 'ref-x',
    },
  });
}

function replay(
  capsuleId: string,
  overrides: Partial<ChainIntegrityReplayInput> = {},
): ChainIntegrityReplayInput {
  return {
    capsuleId,
    subjectNpi: '1234567890',
    decisionType: 'HIRING',
    decisionTimestamp: '2026-05-12T12:00:00.000Z',
    issuerIds: ['issuer-1'],
    credentialIds: ['cred-a'],
    verifierIdentity: {
      type: 'ORGANIZATION',
      systemId: 'vitalcv-engine-v1',
      orgId: 'org-acme',
      userId: null,
    },
    integrity: {
      storedHash: 'a'.repeat(64),
      recomputedHash: 'a'.repeat(64),
      hashMatch: true,
    },
    containment: cleanQuarantine(capsuleId),
    authorityChain: [
      { position: 0, nodeType: 'CLINICIAN', id: 'npi-1234567890' },
      { position: 1, nodeType: 'CREDENTIAL', id: 'cred-a' },
      { position: 2, nodeType: 'ISSUER', id: 'issuer-1' },
      { position: 3, nodeType: 'VERIFIER', id: 'org-acme' },
      { position: 4, nodeType: 'DECISION', id: capsuleId },
    ],
    ...overrides,
  };
}

function auditEvent(
  overrides: Partial<ChainIntegrityAuditEvent> = {},
): ChainIntegrityAuditEvent {
  return {
    eventId: 'evt-1',
    time: '2026-05-12T12:00:00.000Z',
    traceId: 'trace-1',
    actor: 'org-acme',
    resource: 'cap-1',
    receiptHash: 'r'.repeat(64),
    ...overrides,
  };
}

// ── Smoke tests ───────────────────────────────────────────────────────────────

describe('validateCanonicalAuditChain — clean chain', () => {
  it('produces INTACT verdict when every axis passes', () => {
    const cap1 = replay('cap-1');
    const cap2 = replay('cap-2', { decisionTimestamp: '2026-05-12T13:00:00.000Z' });
    const report = validateCanonicalAuditChain({
      replays: [cap1, cap2],
      auditEvents: [
        auditEvent({ eventId: 'evt-1', resource: 'cap-1', time: '2026-05-12T12:00:00.000Z' }),
        auditEvent({ eventId: 'evt-2', resource: 'cap-2', time: '2026-05-12T13:00:00.000Z' }),
      ],
      // Pin cap-1 to its own current containment digest so the
      // degraded-restoration axis has evidence and votes PASS.
      preDegradationSnapshots: [{
        capsuleId: 'cap-1',
        verdict: cap1.containment.verdict,
        containmentDigest: cap1.containment.containmentDigest,
        restorationRecorded: false,
      }],
    });

    expect(report.schema).toBe(CANONICAL_CHAIN_INTEGRITY_SENTINELS.SCHEMA);
    expect(report.verdict).toBe('INTACT');
    expect(report.violations).toHaveLength(0);
    for (const axis of KNOWN_CHAIN_INTEGRITY_AXES) {
      expect(report.axes[axis].status).toBe('PASS');
    }
  });

  it('produces a deterministic integrity digest across re-runs', () => {
    const input = {
      replays: [replay('cap-1')],
      auditEvents: [auditEvent()],
    };
    const a = validateCanonicalAuditChain(input);
    const b = validateCanonicalAuditChain(input);
    expect(a.integrityDigest).toBe(b.integrityDigest);
    expect(a.integrityDigest).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('validateCanonicalAuditChain — INCONCLUSIVE roll-up', () => {
  it('reports INCONCLUSIVE when no evidence is supplied', () => {
    const report = validateCanonicalAuditChain({ replays: [] });
    expect(report.verdict).toBe('INCONCLUSIVE');
    for (const axis of KNOWN_CHAIN_INTEGRITY_AXES) {
      expect(report.axes[axis].status).toBe('INSUFFICIENT_EVIDENCE');
    }
  });
});

// ── Axis 1: replay lineage continuity ─────────────────────────────────────────

describe('validateCanonicalAuditChain — replay lineage continuity', () => {
  it('passes vacuously when there are no corrupt roots', () => {
    const report = validateCanonicalAuditChain({
      replays: [replay('cap-1'), replay('cap-2')],
    });
    expect(report.axes.REPLAY_LINEAGE.status).toBe('PASS');
    expect(report.axes.REPLAY_LINEAGE.evidenceCount).toBe(2);
  });

  it('traces lineage deterministically from a corrupt root', () => {
    const report = validateCanonicalAuditChain({
      replays: [
        replay('cap-corrupt', { containment: corruptQuarantine('cap-corrupt') }),
        replay('cap-downstream'),
      ],
    });
    expect(report.axes.REPLAY_LINEAGE.status).toBe('PASS');
    expect(report.axes.REPLAY_LINEAGE.evidenceCount).toBe(1);
  });
});

// ── Axis 2: chronology determinism ────────────────────────────────────────────

describe('validateCanonicalAuditChain — chronology', () => {
  it('flags timestamp regression on a traceId', () => {
    const report = validateCanonicalAuditChain({
      replays: [replay('cap-1')],
      auditEvents: [
        auditEvent({ eventId: 'evt-1', time: '2026-05-12T12:00:00.000Z' }),
        auditEvent({ eventId: 'evt-2', time: '2026-05-12T11:59:00.000Z' }),
      ],
    });
    expect(report.axes.CHRONOLOGY.status).toBe('FAIL');
    expect(report.violations.some(v => v.kind === 'TRACE_TIMESTAMP_REGRESSION')).toBe(true);
    expect(report.verdict).toBe('BROKEN');
  });

  it('flags capsule timestamp collision for the same (npi, decisionType)', () => {
    const report = validateCanonicalAuditChain({
      replays: [
        replay('cap-1', { decisionTimestamp: '2026-05-12T12:00:00.000Z' }),
        replay('cap-2', { decisionTimestamp: '2026-05-12T12:00:00.000Z' }),
      ],
    });
    expect(report.violations.some(v => v.kind === 'CAPSULE_TIMESTAMP_COLLISION')).toBe(true);
    // No event stream → DEGRADED, not FAIL.
    expect(report.axes.CHRONOLOGY.status).toBe('DEGRADED');
    expect(report.verdict).toBe('DEGRADED');
  });

  it('does not flag collision when decisionType differs', () => {
    const report = validateCanonicalAuditChain({
      replays: [
        replay('cap-1', { decisionTimestamp: '2026-05-12T12:00:00.000Z', decisionType: 'HIRING' }),
        replay('cap-2', { decisionTimestamp: '2026-05-12T12:00:00.000Z', decisionType: 'PRIVILEGING' }),
      ],
    });
    expect(report.violations.some(v => v.kind === 'CAPSULE_TIMESTAMP_COLLISION')).toBe(false);
  });
});

// ── Axis 3: issuer continuity ─────────────────────────────────────────────────

describe('validateCanonicalAuditChain — issuer continuity', () => {
  it('flags conflicting issuer bindings for the same credential', () => {
    const report = validateCanonicalAuditChain({
      replays: [
        replay('cap-1', { issuerIds: ['issuer-1'], credentialIds: ['cred-shared'] }),
        replay('cap-2', { issuerIds: ['issuer-2'], credentialIds: ['cred-shared'],
          decisionTimestamp: '2026-05-12T13:00:00.000Z' }),
      ],
    });
    expect(report.axes.ISSUER_CONTINUITY.status).toBe('FAIL');
    expect(report.violations.some(v => v.kind === 'ISSUER_BINDING_CONFLICT')).toBe(true);
    expect(report.verdict).toBe('BROKEN');
  });

  it('accepts stable bindings across capsules', () => {
    const report = validateCanonicalAuditChain({
      replays: [
        replay('cap-1', { issuerIds: ['issuer-1'], credentialIds: ['cred-a'] }),
        replay('cap-2', { issuerIds: ['issuer-1'], credentialIds: ['cred-a'],
          decisionTimestamp: '2026-05-12T13:00:00.000Z' }),
      ],
    });
    expect(report.axes.ISSUER_CONTINUITY.status).toBe('PASS');
  });

  it('reports INSUFFICIENT_EVIDENCE when no capsule binds an issuer set', () => {
    const report = validateCanonicalAuditChain({
      replays: [replay('cap-1', { issuerIds: [] })],
    });
    expect(report.axes.ISSUER_CONTINUITY.status).toBe('INSUFFICIENT_EVIDENCE');
  });
});

// ── Axis 4: attribution continuity ────────────────────────────────────────────

describe('validateCanonicalAuditChain — attribution continuity', () => {
  it('flags verifier/actor mismatch on capsule-resource events', () => {
    const report = validateCanonicalAuditChain({
      replays: [replay('cap-1')],
      auditEvents: [
        auditEvent({ eventId: 'evt-1', resource: 'cap-1', actor: 'org-someone-else' }),
      ],
    });
    expect(report.axes.ATTRIBUTION_CONTINUITY.status).toBe('FAIL');
    expect(report.violations.some(v => v.kind === 'ATTRIBUTION_VERIFIER_MISMATCH')).toBe(true);
  });

  it('flags actor drift within a single traceId', () => {
    const report = validateCanonicalAuditChain({
      replays: [replay('cap-1')],
      auditEvents: [
        auditEvent({ eventId: 'evt-1', traceId: 'trace-X', actor: 'org-acme', resource: 'cap-1' }),
        auditEvent({ eventId: 'evt-2', traceId: 'trace-X', actor: 'org-other', resource: 'other' }),
      ],
    });
    expect(report.violations.some(v => v.kind === 'ATTRIBUTION_ACTOR_DRIFT')).toBe(true);
  });

  it('passes when no audit events are supplied (insufficient evidence)', () => {
    const report = validateCanonicalAuditChain({ replays: [replay('cap-1')] });
    expect(report.axes.ATTRIBUTION_CONTINUITY.status).toBe('INSUFFICIENT_EVIDENCE');
  });
});

// ── Axis 5: degraded restoration continuity ───────────────────────────────────

describe('validateCanonicalAuditChain — degraded restoration', () => {
  it('flags silent restoration from QUARANTINED → CLEAN', () => {
    const snap: PreDegradationSnapshot = {
      capsuleId: 'cap-1',
      verdict: 'QUARANTINED',
      containmentDigest: 'f'.repeat(64),
      restorationRecorded: false,
    };
    const report = validateCanonicalAuditChain({
      replays: [replay('cap-1')], // current verdict is CLEAN
      preDegradationSnapshots: [snap],
    });
    expect(report.axes.DEGRADED_RESTORATION.status).toBe('FAIL');
    expect(report.violations.some(v => v.kind === 'RESTORATION_FORCED_CLEAN')).toBe(true);
  });

  it('allows QUARANTINED → CLEAN when restorationRecorded=true', () => {
    const snap: PreDegradationSnapshot = {
      capsuleId: 'cap-1',
      verdict: 'QUARANTINED',
      containmentDigest: 'f'.repeat(64),
      restorationRecorded: true,
    };
    const report = validateCanonicalAuditChain({
      replays: [replay('cap-1')],
      preDegradationSnapshots: [snap],
    });
    expect(report.axes.DEGRADED_RESTORATION.status).toBe('PASS');
  });

  it('flags containment digest drift when verdict is unchanged', () => {
    const current = replay('cap-1', { containment: corruptQuarantine('cap-1') });
    const snap: PreDegradationSnapshot = {
      capsuleId: 'cap-1',
      verdict: current.containment.verdict, // same verdict
      containmentDigest: 'beef'.repeat(16),  // different digest
      restorationRecorded: false,
    };
    const report = validateCanonicalAuditChain({
      replays: [current],
      preDegradationSnapshots: [snap],
    });
    expect(report.violations.some(v => v.kind === 'RESTORATION_DIGEST_DIVERGENCE')).toBe(true);
  });

  it('reports INSUFFICIENT_EVIDENCE without snapshots', () => {
    const report = validateCanonicalAuditChain({ replays: [replay('cap-1')] });
    expect(report.axes.DEGRADED_RESTORATION.status).toBe('INSUFFICIENT_EVIDENCE');
  });
});

// ── Axis 6: replay chain inspectability ───────────────────────────────────────

describe('validateCanonicalAuditChain — inspectability', () => {
  it('flags a replay missing the CLINICIAN authority node', () => {
    const broken = replay('cap-1', {
      authorityChain: [
        { position: 0, nodeType: 'DECISION', id: 'cap-1' },
      ],
    });
    const report = validateCanonicalAuditChain({ replays: [broken] });
    expect(report.violations.some(v =>
      v.kind === 'INSPECTABILITY_FIELD_MISSING'
      && v.message.includes('authorityChain.CLINICIAN'),
    )).toBe(true);
  });

  it('flags a replay missing systemId', () => {
    const broken = replay('cap-1', {
      verifierIdentity: { type: 'SYSTEM', systemId: '', orgId: null, userId: null },
    });
    const report = validateCanonicalAuditChain({ replays: [broken] });
    expect(report.violations.some(v =>
      v.message.includes('verifierIdentity.systemId'),
    )).toBe(true);
  });
});

// ── Schema completeness ───────────────────────────────────────────────────────

describe('canonicalChainIntegrity — schema completeness', () => {
  it('exposes all six axes', () => {
    expect(KNOWN_CHAIN_INTEGRITY_AXES).toHaveLength(6);
    expect(KNOWN_CHAIN_INTEGRITY_AXES).toEqual(
      expect.arrayContaining([
        'REPLAY_LINEAGE',
        'CHRONOLOGY',
        'ISSUER_CONTINUITY',
        'ATTRIBUTION_CONTINUITY',
        'DEGRADED_RESTORATION',
        'INSPECTABILITY',
      ]),
    );
  });

  it('exposes all nine violation kinds', () => {
    expect(KNOWN_CHAIN_INTEGRITY_VIOLATIONS).toHaveLength(9);
  });

  it('every axis returns a verdict on every input', () => {
    const report = validateCanonicalAuditChain({ replays: [replay('cap-1')] });
    for (const axis of KNOWN_CHAIN_INTEGRITY_AXES) {
      expect(report.axes[axis]).toBeDefined();
      expect(report.axes[axis].axis).toBe(axis);
    }
  });
});
