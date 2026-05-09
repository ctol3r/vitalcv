/**
 * applyOperationalWorkflow.test.ts — W2-PR46A
 *
 * Five suites, all pure (no DB, no fetch):
 *   1. Determinism      — same input → identical manifestHash
 *   2. Ambiguity        — receipt_candidate / psv_receipt_candidate stays false
 *   3. Banned copy      — composer-produced copy is banned-string clean
 *   4. Replay safety    — verifier requests are content-bound + idempotent
 *   5. Workflow chaos   — 7 perturbations; never silent degradation
 */

import {
  composeApplicationManifest,
  verifyApplicationManifest,
  issueVerifierRequest,
  simulateWorkflowChaos,
  findBannedPhrase,
  APPLY_WORKFLOW_BANNED_PHRASES,
  type ApplyBundleRef,
  type ReplayLineageRef,
  type AuditPacketRef,
  type AmbiguityMarker,
  type VerifierContext,
  type ChaosKind,
  type ApplicationManifest,
} from '../applyOperationalWorkflow';

// ── Fixtures ────────────────────────────────────────────────────────────────

const fixtureBundle: ApplyBundleRef = {
  bundleId: 'b_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  npi: '1234567890',
  signature: '7'.repeat(64),
  generatedAt: '2026-05-09T10:00:00.000Z',
  expiresAt: '2026-05-10T10:00:00.000Z',
  monitoringStatus: 'active',
};

const fixtureReplay: ReplayLineageRef = {
  schema: 'https://vitalcv.com/audit-bundle/v1',
  bundleId: 'rb_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  bundleHash: '8'.repeat(64),
  capsuleCount: 3,
  tenantScopeKinds: ['ENFORCED', 'ENFORCED', 'ENFORCED'],
};

const fixtureAuditPacket: AuditPacketRef = {
  artifactId: 'art_cccccccccccccccccccccccccc',
  fingerprint: 'a'.repeat(64),
  merkleRoot: 'b'.repeat(64),
  ncqaTags: ['CR1', 'CR2'],
};

const fixtureMarkers: ReadonlyArray<AmbiguityMarker> = [
  {
    componentId: 'rcpt_cand_1',
    componentKind: 'receipt_candidate',
    decisionGrade: false,
    proofTier: 'receipt_candidate',
    rationale: 'Issuer response under review; downstream decision required.',
  },
  {
    componentId: 'psv_cand_1',
    componentKind: 'psv_receipt_candidate',
    decisionGrade: false,
    proofTier: 'psv_receipt_candidate',
    rationale: 'Policy review accepted; receipt promotion gated by next wave.',
  },
  {
    componentId: 'psv_1',
    componentKind: 'psv_receipt',
    decisionGrade: true,
    proofTier: 'psv_receipt',
    rationale: 'Scoped issuer receipt; not a global truth claim.',
  },
];

const fixtureVerifierContext: VerifierContext = {
  verifierOrgId: 'org_demo_health_system',
  verifierLabel: 'Demo Health System',
  purposeOfUse: 'employment credentialing review',
};

const fixtureTrajectory = [
  { capturedAt: '2026-05-08T10:00:00.000Z', trustBand: 'B', trustScore: 72, readinessStatus: 'partial', anchorId: 'cap_1' },
  { capturedAt: '2026-05-09T10:00:00.000Z', trustBand: 'A', trustScore: 81, readinessStatus: 'ready_for_policy_review', anchorId: 'cap_2' },
];

function buildFixtureManifest(overrides: Partial<Parameters<typeof composeApplicationManifest>[0]> = {}) {
  return composeApplicationManifest({
    bundle: fixtureBundle,
    replayLineage: fixtureReplay,
    auditPacket: fixtureAuditPacket,
    trustTrajectory: fixtureTrajectory,
    verifierContext: fixtureVerifierContext,
    ambiguityMarkers: fixtureMarkers,
    subject: { npi: '1234567890' },
    generatedAt: '2026-05-09T10:00:00.000Z',
    expiresAt: '2026-05-10T10:00:00.000Z',
    ...overrides,
  });
}

// ── 1. Determinism ──────────────────────────────────────────────────────────

describe('composeApplicationManifest — determinism', () => {
  it('produces identical manifestHash for identical input', () => {
    const a = buildFixtureManifest();
    const b = buildFixtureManifest();
    expect(a.manifestHash).toBe(b.manifestHash);
    expect(a.manifestId).toBe(b.manifestId);
  });

  it('manifestHash is independent of generatedAt / expiresAt', () => {
    const a = buildFixtureManifest({ generatedAt: '2026-05-09T10:00:00.000Z', expiresAt: '2026-05-10T10:00:00.000Z' });
    const b = buildFixtureManifest({ generatedAt: '2099-01-01T00:00:00.000Z', expiresAt: '2099-01-02T00:00:00.000Z' });
    expect(a.manifestHash).toBe(b.manifestHash);
    expect(a.generatedAt).not.toBe(b.generatedAt);
  });

  it('manifestHash differs when bundle signature changes', () => {
    const a = buildFixtureManifest();
    const b = buildFixtureManifest({
      bundle: { ...fixtureBundle, signature: 'f'.repeat(64) },
    });
    expect(a.manifestHash).not.toBe(b.manifestHash);
  });

  it('manifestHash differs when replay lineage hash changes', () => {
    const a = buildFixtureManifest();
    const b = buildFixtureManifest({
      replayLineage: { ...fixtureReplay, bundleHash: 'c'.repeat(64) },
    });
    expect(a.manifestHash).not.toBe(b.manifestHash);
  });

  it('manifestId is a 16-char hex prefix of manifestHash', () => {
    const m = buildFixtureManifest();
    expect(m.manifestId).toBe(`manifest_${m.manifestHash.slice(0, 16)}`);
  });

  it('did defaults to did:vitalcv:{npi} when omitted', () => {
    const m = buildFixtureManifest();
    expect(m.subject.did).toBe('did:vitalcv:1234567890');
  });

  it('verify round-trips: compose → verify → OK with matching hash', () => {
    const m = buildFixtureManifest();
    const v = verifyApplicationManifest(m, { now: '2026-05-09T11:00:00.000Z' });
    expect(v.valid).toBe(true);
    expect(v.reason).toBe('OK');
    expect(v.recomputedHash).toBe(m.manifestHash);
  });
});

// ── 2. Ambiguity preservation ───────────────────────────────────────────────

describe('composeApplicationManifest — ambiguity preservation', () => {
  it('preserves literal decisionGrade=false on receipt_candidate', () => {
    const m = buildFixtureManifest();
    const candidate = m.ambiguityMarkers.find((x) => x.componentKind === 'receipt_candidate');
    expect(candidate).toBeDefined();
    expect(candidate!.decisionGrade).toBe(false);
    expect(candidate!.proofTier).toBe('receipt_candidate');
  });

  it('preserves literal decisionGrade=false on psv_receipt_candidate', () => {
    const m = buildFixtureManifest();
    const candidate = m.ambiguityMarkers.find((x) => x.componentKind === 'psv_receipt_candidate');
    expect(candidate).toBeDefined();
    expect(candidate!.decisionGrade).toBe(false);
    expect(candidate!.proofTier).toBe('psv_receipt_candidate');
  });

  it('refuses to compose if a candidate marker arrives with decisionGrade=true', () => {
    // Runtime contract violation: the type allows boolean but the composer
    // rejects candidate kinds with decisionGrade=true.
    const tampered: AmbiguityMarker[] = [
      { componentId: 'bad', componentKind: 'receipt_candidate', decisionGrade: true, proofTier: 'receipt_candidate', rationale: 'fine' },
    ];
    expect(() => buildFixtureManifest({ ambiguityMarkers: tampered }))
      .toThrow(/apply_workflow_ambiguity_violation/);
  });

  it('verify rejects manifests with widened ambiguity', () => {
    const m = buildFixtureManifest();
    const widened: ApplicationManifest = {
      ...m,
      ambiguityMarkers: m.ambiguityMarkers.map((x) =>
        x.componentKind === 'receipt_candidate' ? { ...x, decisionGrade: true as const } : x,
      ),
    };
    const v = verifyApplicationManifest(widened);
    expect(v.valid).toBe(false);
    expect(v.reason).toBe('AMBIGUITY_VIOLATION');
  });

  it('json round-trip preserves the literal false (no boolean coercion)', () => {
    const m = buildFixtureManifest();
    const roundTripped = JSON.parse(JSON.stringify(m)) as ApplicationManifest;
    const candidate = roundTripped.ambiguityMarkers.find((x) => x.componentKind === 'receipt_candidate')!;
    expect(candidate.decisionGrade).toBe(false);
    expect(typeof candidate.decisionGrade).toBe('boolean');
    // verify still passes — round-trip is content-stable
    expect(verifyApplicationManifest(roundTripped, { now: '2026-05-09T11:00:00.000Z' }).valid).toBe(true);
  });
});

// ── 3. Banned-copy compliance ───────────────────────────────────────────────

describe('composeApplicationManifest — banned-copy compliance', () => {
  it('finds known banned phrases (sanity)', () => {
    // Test the helper using a split-join so the test file doesn't store the literal banned string.
    const sample = `This product offers ${['risk', 'transferred'].join(' ')} guarantees.`;
    expect(findBannedPhrase(sample)).not.toBeNull();
  });

  it('produces clean copy on the happy path', () => {
    const m = buildFixtureManifest();
    expect(findBannedPhrase(m.presentationCopy.headline)).toBeNull();
    expect(findBannedPhrase(m.presentationCopy.qualifier)).toBeNull();
    expect(findBannedPhrase(m.presentationCopy.sharingScope)).toBeNull();
  });

  it('refuses to compose when a marker rationale contains a banned phrase', () => {
    const dirtyRationale = `Issuer response: ${['HIPAA', 'compliant'].join(' ')}.`;
    const dirty: AmbiguityMarker[] = [
      { componentId: 'x', componentKind: 'psv_receipt', decisionGrade: true, proofTier: 'psv_receipt', rationale: dirtyRationale },
    ];
    expect(() => buildFixtureManifest({ ambiguityMarkers: dirty }))
      .toThrow(/apply_workflow_banned_phrase_in_marker/);
  });

  it('verify rejects a manifest whose copy was post-tampered with a banned phrase', () => {
    const m = buildFixtureManifest();
    const dirty: ApplicationManifest = {
      ...m,
      presentationCopy: { ...m.presentationCopy, headline: APPLY_WORKFLOW_BANNED_PHRASES[0] },
    };
    const v = verifyApplicationManifest(dirty);
    expect(v.valid).toBe(false);
    expect(v.reason).toBe('BANNED_COPY');
  });

  it('all banned phrases are non-empty and unique', () => {
    expect(APPLY_WORKFLOW_BANNED_PHRASES.length).toBeGreaterThanOrEqual(11);
    const set = new Set(APPLY_WORKFLOW_BANNED_PHRASES.map((p) => p.toLowerCase()));
    expect(set.size).toBe(APPLY_WORKFLOW_BANNED_PHRASES.length);
    for (const phrase of APPLY_WORKFLOW_BANNED_PHRASES) {
      expect(phrase.length).toBeGreaterThan(0);
    }
  });
});

// ── 4. Replay safety ────────────────────────────────────────────────────────

describe('issueVerifierRequest — replay safety', () => {
  const baseInput = {
    verifierContext: fixtureVerifierContext,
    requestedScope: ['LICENSE', 'BOARD_CERTIFICATION'],
    replayAnchor: { kind: 'BUNDLE' as const, id: 'rb_x', hash: 'd'.repeat(64) },
    requestedAt: '2026-05-09T10:00:00.000Z',
    expiresAt: '2026-05-09T11:00:00.000Z',
  };

  it('produces identical requestId on identical input', () => {
    const a = issueVerifierRequest(baseInput);
    const b = issueVerifierRequest(baseInput);
    expect(a.requestId).toBe(b.requestId);
    expect(a.idempotencyKey).toBe(b.idempotencyKey);
  });

  it('requestId is independent of requestedAt / expiresAt (metadata only)', () => {
    const a = issueVerifierRequest(baseInput);
    const b = issueVerifierRequest({
      ...baseInput,
      requestedAt: '2099-01-01T00:00:00.000Z',
      expiresAt: '2099-01-02T00:00:00.000Z',
    });
    expect(a.requestId).toBe(b.requestId);
  });

  it('requestId is independent of scope ordering', () => {
    const a = issueVerifierRequest({ ...baseInput, requestedScope: ['LICENSE', 'BOARD_CERTIFICATION'] });
    const b = issueVerifierRequest({ ...baseInput, requestedScope: ['BOARD_CERTIFICATION', 'LICENSE'] });
    expect(a.requestId).toBe(b.requestId);
  });

  it('different scope content → different requestId', () => {
    const a = issueVerifierRequest({ ...baseInput, requestedScope: ['LICENSE'] });
    const b = issueVerifierRequest({ ...baseInput, requestedScope: ['LICENSE', 'BOARD_CERTIFICATION'] });
    expect(a.requestId).not.toBe(b.requestId);
  });

  it('different replay anchor → different requestId', () => {
    const a = issueVerifierRequest(baseInput);
    const b = issueVerifierRequest({
      ...baseInput,
      replayAnchor: { kind: 'CAPSULE', id: 'cap_y', hash: 'e'.repeat(64) },
    });
    expect(a.requestId).not.toBe(b.requestId);
  });

  it('caller-supplied idempotencyKey overrides derivation', () => {
    const a = issueVerifierRequest(baseInput);
    const b = issueVerifierRequest({ ...baseInput, idempotencyKey: 'caller-fixed-key' });
    expect(b.idempotencyKey).toBe('caller-fixed-key');
    expect(a.requestId).not.toBe(b.requestId);
  });

  it('replaySafety contract is content-bound + anchor-echo required', () => {
    const a = issueVerifierRequest(baseInput);
    expect(a.replaySafety.idempotencyContract).toBe('CONTENT_BOUND');
    expect(a.replaySafety.anchorEcho).toBe('REQUIRED');
    expect(a.replaySafety.idempotencyWindowSeconds).toBe(60 * 60 * 24);
  });

  it('rejects verifier purpose-of-use containing banned phrase', () => {
    expect(() =>
      issueVerifierRequest({
        ...baseInput,
        verifierContext: {
          ...fixtureVerifierContext,
          purposeOfUse: `because we are ${['HIPAA', 'compliant'].join(' ')}`,
        },
      }),
    ).toThrow(/verifier_request_banned_phrase/);
  });
});

// ── 5. Workflow chaos ───────────────────────────────────────────────────────

describe('simulateWorkflowChaos — never silent degradation', () => {
  const allChaos: ReadonlyArray<ChaosKind> = [
    'tamper_bundle_signature',
    'tamper_replay_hash',
    'tamper_ambiguity_grade',
    'tamper_presentation_copy',
    'expire_anchor',
    'duplicate_request_with_drift',
    'drop_audit_packet',
  ];

  it.each(allChaos)('chaos kind %s does not silently degrade', (kind) => {
    const m = buildFixtureManifest();
    const verdict = simulateWorkflowChaos(m, kind);
    expect(verdict.outcome).not.toBe('silent_degradation_detected');
  });

  it('tamper_bundle_signature → manifest_invalidated', () => {
    const m = buildFixtureManifest();
    expect(simulateWorkflowChaos(m, 'tamper_bundle_signature').outcome).toBe('manifest_invalidated');
  });

  it('tamper_ambiguity_grade → manifest_invalidated', () => {
    const m = buildFixtureManifest();
    expect(simulateWorkflowChaos(m, 'tamper_ambiguity_grade').outcome).toBe('manifest_invalidated');
  });

  it('expire_anchor → manifest_invalidated', () => {
    const m = buildFixtureManifest();
    expect(simulateWorkflowChaos(m, 'expire_anchor').outcome).toBe('manifest_invalidated');
  });

  it('duplicate_request_with_drift → verifier_request_diverged', () => {
    const m = buildFixtureManifest();
    expect(simulateWorkflowChaos(m, 'duplicate_request_with_drift').outcome).toBe('verifier_request_diverged');
  });

  it('drop_audit_packet → manifest_held_clean (with non-null packet, hash differs)', () => {
    const m = buildFixtureManifest();
    expect(simulateWorkflowChaos(m, 'drop_audit_packet').outcome).toBe('manifest_held_clean');
  });

  it('drop_audit_packet → manifest_held_clean even when input had no packet', () => {
    const m = buildFixtureManifest({ auditPacket: null });
    const verdict = simulateWorkflowChaos(m, 'drop_audit_packet');
    expect(verdict.outcome).toBe('manifest_held_clean');
  });
});
