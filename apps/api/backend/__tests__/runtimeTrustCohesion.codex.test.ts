/**
 * runtimeTrustCohesion.codex.test.ts — Codex remediation regression tests
 *
 * Covers PR #421 P2 finding: `buildRuntimeReplayMetadata` previously reused
 * caller-supplied `payloadHash` / `mutationFingerprint` verbatim even when
 * the caller also supplied a `tenantId`. Stored hashes from capsules created
 * before tenant binding existed do NOT include the tenant in their preimage,
 * so the emitted record could advertise `tenantBound: true` while the actual
 * hash had no tenant binding. The fix is: when `tenantId` is supplied, always
 * recompute. Caller-supplied hashes are only honored in the back-compat
 * un-anchored path.
 */

import {
  buildRuntimeReplayMetadata,
  buildRuntimeMutationMetadata,
} from '../src/services/runtimeTrustCohesion';

const CAPSULE = 'cap-runtime-trust-1';
const TENANT_A = 'org_tenant_a';
const TENANT_B = 'org_tenant_b';

describe('buildRuntimeReplayMetadata — Codex P2 tenant-hash binding', () => {
  it('recomputes payloadHash + mutationFingerprint when tenantId is supplied (ignores caller hashes)', () => {
    const stored = {
      payloadHash: 'a'.repeat(64),               // pre-tenant stored hash, no tenant binding
      mutationFingerprint: 'b'.repeat(64),       // same
    };
    const result = buildRuntimeReplayMetadata({
      capsuleId: CAPSULE,
      payloadHash: stored.payloadHash,
      mutationFingerprint: stored.mutationFingerprint,
      tenantId: TENANT_A,
    });
    expect(result.tenantBound).toBe(true);
    expect(result.tenantId).toBe(TENANT_A);
    expect(result.payloadHash).not.toBe(stored.payloadHash);
    expect(result.mutationFingerprint).not.toBe(stored.mutationFingerprint);
    // Recomputed hashes are SHA-256 hex digests (64 chars)
    expect(result.payloadHash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.mutationFingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces different hashes for two tenants replaying the same capsule', () => {
    const a = buildRuntimeReplayMetadata({ capsuleId: CAPSULE, tenantId: TENANT_A });
    const b = buildRuntimeReplayMetadata({ capsuleId: CAPSULE, tenantId: TENANT_B });
    expect(a.payloadHash).not.toBe(b.payloadHash);
    expect(a.mutationFingerprint).not.toBe(b.mutationFingerprint);
    expect(a.tenantBound).toBe(true);
    expect(b.tenantBound).toBe(true);
  });

  it('honors caller-supplied hashes only in the un-anchored back-compat path', () => {
    const stored = {
      payloadHash: 'c'.repeat(64),
      mutationFingerprint: 'd'.repeat(64),
    };
    const result = buildRuntimeReplayMetadata({
      capsuleId: CAPSULE,
      payloadHash: stored.payloadHash,
      mutationFingerprint: stored.mutationFingerprint,
      tenantId: null,
    });
    expect(result.tenantBound).toBe(false);
    expect(result.tenantId).toBeUndefined();
    expect(result.payloadHash).toBe(stored.payloadHash);
    expect(result.mutationFingerprint).toBe(stored.mutationFingerprint);
  });

  it('produces identical hashes across calls for the same tenant/capsule (deterministic)', () => {
    const a = buildRuntimeReplayMetadata({ capsuleId: CAPSULE, tenantId: TENANT_A });
    const b = buildRuntimeReplayMetadata({ capsuleId: CAPSULE, tenantId: TENANT_A });
    expect(a.payloadHash).toBe(b.payloadHash);
    expect(a.mutationFingerprint).toBe(b.mutationFingerprint);
  });
});

describe('buildRuntimeMutationMetadata — back-compat sanity', () => {
  it('still marks tenantBound=false when no tenantId is passed', () => {
    const result = buildRuntimeMutationMetadata({
      action: 'accept',
      entityId: 'entity-1',
      payload: { foo: 'bar' },
      outcome: 'allowed',
    });
    expect(result.tenantBound).toBe(false);
    expect(result.tenantId).toBeUndefined();
  });

  it('marks tenantBound=true and includes tenantId when supplied', () => {
    const result = buildRuntimeMutationMetadata({
      action: 'accept',
      entityId: 'entity-1',
      payload: { foo: 'bar' },
      outcome: 'allowed',
      tenantId: TENANT_A,
    });
    expect(result.tenantBound).toBe(true);
    expect(result.tenantId).toBe(TENANT_A);
  });
});
