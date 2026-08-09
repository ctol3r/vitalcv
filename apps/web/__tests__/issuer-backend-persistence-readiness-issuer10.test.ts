import { describe, expect, it } from 'vitest';

import {
  assertBackendPersistenceSafe,
  buildBackendPersistenceDeferDecision,
  buildIssuer10PersistenceReadiness,
} from '../lib/issuer-verification/backendPersistenceDecision';

/**
 * ISSUER-10 — the readiness decision after contract alignment.
 *
 * The distinction these tests pin down is the one that matters: "safe to
 * implement" and "turned on" are different claims. The decision flipping to
 * implement_now says the schema and writer exist; it says nothing about
 * whether any deployment has opted in.
 */

const DECIDED_AT = '2026-08-09T12:00:00.000Z';

describe('ISSUER-10 readiness', () => {
  it('reports implement_now once every capability is satisfied', () => {
    const { decision, allCapabilitiesSatisfied } = buildIssuer10PersistenceReadiness({
      decidedAt: DECIDED_AT,
    });

    expect(allCapabilitiesSatisfied).toBe(true);
    expect(decision.status).toBe('implement_now');
    expect(decision.blockers).toEqual([]);
    expect(decision.impliedAdapterKind).toBe('repository_enabled');
  });

  it('names the artifact that closed each blocker rather than asserting it', () => {
    const { decision } = buildIssuer10PersistenceReadiness({ decidedAt: DECIDED_AT });

    const byCapability = new Map(decision.capabilityChecks.map((c) => [c.capability, c.notes]));
    expect(byCapability.get('has_test_coverage')).toContain('issuerPsvReceiptRepo.db.test.ts');
    expect(byCapability.get('exposes_server_only_writer')).toContain(
      'serverRepositoryPsvReceiptWriter.ts',
    );
    expect(byCapability.get('stores_scoped_psv_receipt')).toContain(
      '20260809120000_issuer10_psv_receipt_persistence',
    );
    for (const check of decision.capabilityChecks) {
      expect(check.mappedBlocker).toBeUndefined();
    }
  });

  it('says the decision is not the same as persistence being on', () => {
    const { decision } = buildIssuer10PersistenceReadiness({ decidedAt: DECIDED_AT });
    expect(decision.reason).toContain('off until both operator opt-ins');
  });

  it('still refuses writes for any caller holding the historical defer decision', () => {
    const stale = buildBackendPersistenceDeferDecision({ decidedAt: DECIDED_AT });
    expect(stale.status).toBe('defer_until_contract_aligned');
    expect(() => assertBackendPersistenceSafe(stale)).toThrow(/refused/);
  });

  it('permits writes only for the aligned decision', () => {
    const { decision } = buildIssuer10PersistenceReadiness({ decidedAt: DECIDED_AT });
    expect(() => assertBackendPersistenceSafe(decision)).not.toThrow();
  });
});
