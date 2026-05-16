import {
  buildRuntimeMutationMetadata,
  buildRuntimeReplayMetadata,
  normalizeMutationClassification,
  resolveReplayCategory,
} from '../runtimeTrustCohesion';

describe('runtimeTrustCohesion', () => {
  it('preserves correlationId while deriving replay-stable payloadHash and mutationFingerprint', () => {
    const first = buildRuntimeMutationMetadata({
      action: 'accept',
      actorId: 'user-1',
      entityId: 'entity-1',
      clinicianNpi: '1234567890',
      correlationId: 'corr-a',
      payload: {
        clinicianNpi: '1234567890',
        acceptanceScope: 'pilot',
        notes: 'Do not leak this note into hash payload.',
      },
      outcome: 'allowed',
    });
    const second = buildRuntimeMutationMetadata({
      action: 'accept',
      actorId: 'user-1',
      entityId: 'entity-1',
      clinicianNpi: '1234567890',
      correlationId: 'corr-b',
      payload: {
        clinicianNpi: '1234567890',
        acceptanceScope: 'pilot',
        notes: 'Do not leak this note into hash payload.',
      },
      outcome: 'allowed',
    });

    expect(first.correlationId).toBe('corr-a');
    expect(second.correlationId).toBe('corr-b');
    expect(first.payloadHash).toMatch(/^[a-f0-9]{64}$/);
    expect(first.payloadHash).toBe(second.payloadHash);
    expect(first.mutationFingerprint).toBe(second.mutationFingerprint);
  });

  it('normalizes replay categories for all runtime mutation families', () => {
    expect(resolveReplayCategory('accept')).toBe('R-CAT-1');
    expect(resolveReplayCategory('request-refresh')).toBe('R-CAT-2');
    expect(resolveReplayCategory('route-to-review')).toBe('R-CAT-2');
    expect(resolveReplayCategory('packet-export')).toBe('R-CAT-3');
    expect(resolveReplayCategory('share-packet')).toBe('R-CAT-3');
    expect(resolveReplayCategory('confirm-start')).toBe('R-CAT-4');
    expect(resolveReplayCategory('denied-mutation')).toBe('R-CAT-5');
    expect(resolveReplayCategory('dossier-replay')).toBe('R-CAT-6');
  });

  it('normalizes route, audit, telemetry, and dossier classifications through one taxonomy', () => {
    expect(normalizeMutationClassification('accept')).toBe('TRUST_ACCEPTANCE');
    expect(normalizeMutationClassification('request-refresh')).toBe('TRUST_REFRESH_REQUEST');
    expect(normalizeMutationClassification('route-to-review')).toBe('TRUST_REVIEW_ROUTING');
    expect(normalizeMutationClassification('packet-export')).toBe('TRUST_PACKET_EXPORT');
    expect(normalizeMutationClassification('share-packet')).toBe('TRUST_PACKET_SHARE');
    expect(normalizeMutationClassification('confirm-start')).toBe('TRUST_START_ATTESTATION');
    expect(normalizeMutationClassification('denied-mutation')).toBe('DENIED_MUTATION');
    expect(normalizeMutationClassification('dossier-replay')).toBe('DOSSIER_REPLAY');
  });

  it('marks denied mutations with readonly indicators and R-CAT-5 replay metadata', () => {
    const denied = buildRuntimeMutationMetadata({
      action: 'denied-mutation',
      actorId: 'user-1',
      entityId: 'entity-1',
      clinicianNpi: '1234567890',
      correlationId: 'corr-denied',
      payload: { reason: 'readonly_blocks_mutation' },
      outcome: 'denied',
      denialReason: 'readonly_blocks_mutation',
      readonly: {
        attemptedByReadonly: true,
        source: 'x-verifier-team-role',
      },
    });

    expect(denied.outcome).toBe('denied');
    expect(denied.replayCategory).toBe('R-CAT-5');
    expect(denied.mutationClassification).toBe('DENIED_MUTATION');
    expect(denied.readonly).toEqual({
      attemptedByReadonly: true,
      source: 'x-verifier-team-role',
    });
    expect(denied.denialReason).toBe('readonly_blocks_mutation');
  });

  it('builds dossier replay metadata with R-CAT-6 and surviving upstream correlation fields', () => {
    const replay = buildRuntimeReplayMetadata({
      capsuleId: 'capsule-1',
      correlationId: 'corr-1',
      payloadHash: 'a'.repeat(64),
      mutationFingerprint: 'b'.repeat(64),
    });

    expect(replay.replayCategory).toBe('R-CAT-6');
    expect(replay.mutationClassification).toBe('DOSSIER_REPLAY');
    expect(replay.correlationId).toBe('corr-1');
    expect(replay.payloadHash).toBe('a'.repeat(64));
    expect(replay.mutationFingerprint).toBe('b'.repeat(64));
  });
});
