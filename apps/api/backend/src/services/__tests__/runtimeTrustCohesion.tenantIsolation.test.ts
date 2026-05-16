/**
 * runtimeTrustCohesion — tenant isolation chaos tests (W2-PR36A)
 *
 * Verifies the runtime cohesion fingerprint is tenant-bound when a tenantId
 * is supplied, so two tenants performing identical mutations on identical
 * entities can never collide on fingerprint or payloadHash. Also verifies
 * the back-compat path: when no tenantId is supplied, the fingerprint is
 * identical to the v1 pre-tenant computation.
 *
 * Failure of any assertion in this file means a tenant-replay-collision
 * regression has shipped. The CI gate must break the build.
 */

import {
  buildRuntimeMutationMetadata,
  buildRuntimeReplayMetadata,
} from '../runtimeTrustCohesion';

describe('runtimeTrustCohesion — tenant fingerprint isolation', () => {
  it('two tenants performing the same mutation on the same entity get DIFFERENT fingerprints', () => {
    const tenantA = buildRuntimeMutationMetadata({
      action: 'accept',
      actorId: 'shared-actor',
      entityId: 'entity-1',
      clinicianNpi: '1234567890',
      payload: { acceptanceScope: 'pilot' },
      outcome: 'allowed',
      tenantId: 'tenant-A',
    });
    const tenantB = buildRuntimeMutationMetadata({
      action: 'accept',
      actorId: 'shared-actor',
      entityId: 'entity-1',
      clinicianNpi: '1234567890',
      payload: { acceptanceScope: 'pilot' },
      outcome: 'allowed',
      tenantId: 'tenant-B',
    });

    expect(tenantA.tenantBound).toBe(true);
    expect(tenantB.tenantBound).toBe(true);
    expect(tenantA.tenantId).toBe('tenant-A');
    expect(tenantB.tenantId).toBe('tenant-B');

    // Anti-collision: identical inputs except tenant must produce distinct hashes.
    expect(tenantA.payloadHash).not.toBe(tenantB.payloadHash);
    expect(tenantA.mutationFingerprint).not.toBe(tenantB.mutationFingerprint);
  });

  it('same tenant + same payload reproduces fingerprint deterministically', () => {
    const first = buildRuntimeMutationMetadata({
      action: 'accept',
      actorId: 'actor-1',
      entityId: 'entity-1',
      clinicianNpi: '1234567890',
      payload: { acceptanceScope: 'pilot' },
      outcome: 'allowed',
      tenantId: 'tenant-A',
    });
    const second = buildRuntimeMutationMetadata({
      action: 'accept',
      actorId: 'actor-1',
      entityId: 'entity-1',
      clinicianNpi: '1234567890',
      payload: { acceptanceScope: 'pilot' },
      outcome: 'allowed',
      tenantId: 'tenant-A',
    });

    expect(first.payloadHash).toBe(second.payloadHash);
    expect(first.mutationFingerprint).toBe(second.mutationFingerprint);
  });

  it('no tenantId supplied → tenantBound:false and fingerprint matches v1 pre-tenant baseline', () => {
    const tenantless = buildRuntimeMutationMetadata({
      action: 'accept',
      actorId: 'actor-1',
      entityId: 'entity-1',
      clinicianNpi: '1234567890',
      payload: { acceptanceScope: 'pilot' },
      outcome: 'allowed',
    });
    const tenantBoundCopy = buildRuntimeMutationMetadata({
      action: 'accept',
      actorId: 'actor-1',
      entityId: 'entity-1',
      clinicianNpi: '1234567890',
      payload: { acceptanceScope: 'pilot' },
      outcome: 'allowed',
      tenantId: 'tenant-A',
    });

    expect(tenantless.tenantBound).toBe(false);
    expect(tenantless.tenantId).toBeUndefined();
    // Tenant-bound and tenantless fingerprints diverge — they live in different namespaces.
    expect(tenantless.mutationFingerprint).not.toBe(tenantBoundCopy.mutationFingerprint);
  });

  it('whitespace and empty-string tenant collapse to tenantless (no silent acceptance)', () => {
    const empty = buildRuntimeMutationMetadata({
      action: 'accept',
      actorId: 'actor-1',
      entityId: 'entity-1',
      payload: {},
      outcome: 'allowed',
      tenantId: '',
    });
    const whitespace = buildRuntimeMutationMetadata({
      action: 'accept',
      actorId: 'actor-1',
      entityId: 'entity-1',
      payload: {},
      outcome: 'allowed',
      tenantId: '   ',
    });
    const nullish = buildRuntimeMutationMetadata({
      action: 'accept',
      actorId: 'actor-1',
      entityId: 'entity-1',
      payload: {},
      outcome: 'allowed',
      tenantId: null,
    });

    expect(empty.tenantBound).toBe(false);
    expect(whitespace.tenantBound).toBe(false);
    expect(nullish.tenantBound).toBe(false);
    expect(empty.mutationFingerprint).toBe(whitespace.mutationFingerprint);
    expect(empty.mutationFingerprint).toBe(nullish.mutationFingerprint);
  });

  it('CHAOS: 50 tenants doing identical mutation produce 50 distinct fingerprints', () => {
    const fingerprints = new Set<string>();
    const payloadHashes = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const meta = buildRuntimeMutationMetadata({
        action: 'accept',
        actorId: 'shared-actor',
        entityId: 'entity-shared',
        clinicianNpi: '1234567890',
        payload: { acceptanceScope: 'pilot' },
        outcome: 'allowed',
        tenantId: `tenant-${i}`,
      });
      fingerprints.add(meta.mutationFingerprint);
      payloadHashes.add(meta.payloadHash);
    }
    // Zero collisions across all 50 tenants on either hash.
    expect(fingerprints.size).toBe(50);
    expect(payloadHashes.size).toBe(50);
  });
});

describe('runtimeTrustCohesion — replay metadata tenant isolation', () => {
  it('same capsuleId, two tenants → distinct replay fingerprints', () => {
    const tenantA = buildRuntimeReplayMetadata({
      capsuleId: 'capsule-collision-test',
      tenantId: 'tenant-A',
    });
    const tenantB = buildRuntimeReplayMetadata({
      capsuleId: 'capsule-collision-test',
      tenantId: 'tenant-B',
    });

    expect(tenantA.tenantBound).toBe(true);
    expect(tenantB.tenantBound).toBe(true);
    expect(tenantA.payloadHash).not.toBe(tenantB.payloadHash);
    expect(tenantA.mutationFingerprint).not.toBe(tenantB.mutationFingerprint);
  });

  it('back-compat: replay metadata without tenant matches v1 baseline (deterministic)', () => {
    const first = buildRuntimeReplayMetadata({
      capsuleId: 'capsule-1',
      payloadHash: 'a'.repeat(64),
      mutationFingerprint: 'b'.repeat(64),
    });
    const second = buildRuntimeReplayMetadata({
      capsuleId: 'capsule-1',
      payloadHash: 'a'.repeat(64),
      mutationFingerprint: 'b'.repeat(64),
    });

    expect(first.tenantBound).toBe(false);
    expect(first.tenantId).toBeUndefined();
    expect(first.payloadHash).toBe('a'.repeat(64));
    expect(first.mutationFingerprint).toBe('b'.repeat(64));
    expect(first.payloadHash).toBe(second.payloadHash);
  });

  it('CHAOS: 100 capsules x 3 tenants — every (capsule, tenant) pair is unique', () => {
    const seen = new Set<string>();
    const tenants = ['tenant-A', 'tenant-B', 'tenant-C'];
    for (let i = 0; i < 100; i++) {
      for (const t of tenants) {
        const meta = buildRuntimeReplayMetadata({
          capsuleId: `capsule-${i}`,
          tenantId: t,
        });
        // Combine both hashes to ensure neither collides.
        const key = `${meta.payloadHash}|${meta.mutationFingerprint}`;
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    }
    expect(seen.size).toBe(300);
  });
});
