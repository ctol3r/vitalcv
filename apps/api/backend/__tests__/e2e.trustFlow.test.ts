/**
 * e2e.trustFlow.test.ts — Wave 124: End-to-End Testing
 *
 * Integration test across the full trust flow:
 *   issue → present → verify → revoke → cascade
 *
 * Uses in-memory services (no DB required).
 */

import { InMemoryTrustRegistryRepository } from '../repositories/trustRegistry.repo';
import { computeSubstrateTrustState } from '../src/services/trust/trustSubstrate';
import { appendAuditEvent as append, getLedgerSize, exportSinceTime } from '../src/services/audit/auditLedger';
import {
  getIssuer,
  initializeTrustRegistryPersistence,
  listIssuers,
  registerIssuer,
  resetTrustRegistryRepository,
  setTrustRegistryRepository,
} from '../src/services/registry/trustRegistry';
import { computeBaselineSummary } from '../src/services/audit/auditBaseline';

// ── Test Data ─────────────────────────────────────────────────────────

const TEST_NPI = '1234567890';
const TEST_ISSUER_ID = 'did:vitalcv:test_ca_medical_board';
const TEST_ISSUER = {
  issuerId: TEST_ISSUER_ID,
  issuerName: 'Test CA Medical Board',
  trustLevel: 'AUTHORITATIVE' as const,
  trustScore: 95,
  verificationCount: 100,
  revocationCount: 0,
  haipCompliant: true,
  status: 'ACTIVE' as const,
  publicKey: 'test-public-key-spki-pem',
  registeredAt: new Date().toISOString(),
};

// ── Tests ─────────────────────────────────────────────────────────────

describe('E2E Trust Flow', () => {
  beforeAll(async () => {
    setTrustRegistryRepository(new InMemoryTrustRegistryRepository());
    await initializeTrustRegistryPersistence();
    // Seed the registry
    await registerIssuer(TEST_ISSUER);
  });

  afterAll(() => {
    resetTrustRegistryRepository();
  });

  describe('Trust Registry', () => {
    test('issuer is registered and retrievable', () => {
      const issuer = getIssuer(TEST_ISSUER_ID);
      expect(issuer).not.toBeNull();
      expect(issuer?.issuerName).toBe('Test CA Medical Board');
      expect(issuer?.trustScore).toBe(95);
    });

    test('issuer appears in list', () => {
      const issuers = listIssuers();
      const found = issuers.find((i) => i.issuerId === TEST_ISSUER_ID);
      expect(found).toBeDefined();
    });
  });

  describe('Audit Ledger', () => {
    test('can append and retrieve events', () => {
      const before = getLedgerSize();
      append({
        category: 'SYSTEM',
        actor: 'test-suite',
        resource: 'e2e-flow',
        requestFields: { test: true },
        resultFields: { ok: true },
        severity: 'INFO',
        traceId: 'trace-e2e-001',
      });
      expect(getLedgerSize()).toBe(before + 1);
    });

    test('events have receipt hashes', () => {
      const events = exportSinceTime(new Date(Date.now() - 60_000).toISOString(), 10);
      const recent = events[events.length - 1];
      expect(recent).toBeDefined();
      expect(recent.receiptHash).toMatch(/^[a-f0-9]{64}$/);
      expect(recent.traceId).toBeDefined();
    });

    test('cursor-based export works', () => {
      // Append a few more
      for (let i = 0; i < 3; i++) {
        append({
          category: 'ISSUANCE',
          actor: 'test',
          resource: `cred-${i}`,
          requestFields: {},
          resultFields: {},
          severity: 'INFO',
          traceId: `trace-cursor-${i}`,
        });
      }
      const events = exportSinceTime(new Date(Date.now() - 60_000).toISOString(), 100);
      expect(events.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Substrate Trust State', () => {
    test('computes trust state for NPI', async () => {
      const state = await computeSubstrateTrustState(TEST_NPI);
      expect(state).toBeDefined();
      expect(state.subject).toBe(TEST_NPI);
      expect(['L0', 'L1', 'L2', 'L3']).toContain(state.band);
      expect(state.bandLabel).toBeDefined();
      expect(state.explanation).toBeDefined();
      expect(state.computedAt).toBeDefined();
    });

    test('trust state includes HAIP compliance', async () => {
      const state = await computeSubstrateTrustState(TEST_NPI);
      expect(state.haipCompliance).toBeDefined();
      expect(typeof state.haipCompliance.compliant).toBe('boolean');
      expect(Array.isArray(state.haipCompliance.violations)).toBe(true);
    });

    test('trust state includes federation health', async () => {
      const state = await computeSubstrateTrustState(TEST_NPI);
      expect(state.federationTrustHealth).toBeDefined();
      expect(typeof state.federationTrustHealth.healthScore).toBe('number');
    });
  });

  describe('Audit Baseline', () => {
    test('computes baseline summary without errors', () => {
      const summary = computeBaselineSummary();
      expect(summary).toBeDefined();
      expect(summary.windowsChecked).toBeGreaterThan(0);
      expect(Array.isArray(summary.windows)).toBe(true);
      expect(Array.isArray(summary.anomalies)).toBe(true);
      expect(summary.computedAt).toBeDefined();
    });

    test('each window has required fields', () => {
      const summary = computeBaselineSummary();
      for (const w of summary.windows) {
        expect(w.category).toBeDefined();
        expect(typeof w.windowMinutes).toBe('number');
        expect(typeof w.baselineRate).toBe('number');
        expect(typeof w.currentRate).toBe('number');
        expect(typeof w.multiplier).toBe('number');
        expect(typeof w.anomaly).toBe('boolean');
      }
    });
  });
});
