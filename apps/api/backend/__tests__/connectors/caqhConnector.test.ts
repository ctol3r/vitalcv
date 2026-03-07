/**
 * caqhConnector.test.ts — Wave 127: CAQH ProView Connector Tests
 */

import { checkCAQHProfile } from '../../src/services/providers/connectors/caqhConnector';
import { resetConnectorHealth, getConnectorHealth } from '../../src/services/providers/connectors/connectorHealthTracker';

beforeEach(() => {
  resetConnectorHealth();
});

describe('caqhConnector', () => {
  describe('sandbox mode', () => {
    it('returns COMPLETE for NPI ending 0-5', async () => {
      const result = await checkCAQHProfile('1003000125');
      expect(result.npi).toBe('1003000125');
      expect(result.profileStatus).toBe('COMPLETE');
      expect(result.caqhProviderId).toBeTruthy();
      expect(result.attestationDate).toBe('2025-09-01');
      expect(result.reattestationDueDate).toBe('2026-09-01');
    });

    it('returns INCOMPLETE for NPI ending 6-7', async () => {
      const r6 = await checkCAQHProfile('1003000126');
      expect(r6.profileStatus).toBe('INCOMPLETE');
      expect(r6.caqhProviderId).toBeTruthy();
      expect(r6.attestationDate).toBeNull();

      const r7 = await checkCAQHProfile('1003000127');
      expect(r7.profileStatus).toBe('INCOMPLETE');
    });

    it('returns EXPIRED for NPI ending 8', async () => {
      const result = await checkCAQHProfile('1003000128');
      expect(result.profileStatus).toBe('EXPIRED');
      expect(result.caqhProviderId).toBeTruthy();
      expect(result.attestationDate).toBe('2023-03-15');
      expect(result.reattestationDueDate).toBe('2024-03-15');
    });

    it('returns NOT_FOUND for NPI ending 9', async () => {
      const result = await checkCAQHProfile('1003000129');
      expect(result.profileStatus).toBe('NOT_FOUND');
      expect(result.caqhProviderId).toBeNull();
      expect(result.attestationDate).toBeNull();
    });

    it('includes sourceUrl and lastVerifiedAt', async () => {
      const result = await checkCAQHProfile('1003000125');
      expect(result.sourceUrl).toContain('proview.caqh.org');
      expect(result.lastVerifiedAt).toBeTruthy();
    });

    it('is deterministic across calls', async () => {
      const a = await checkCAQHProfile('1003000125');
      const b = await checkCAQHProfile('1003000125');
      expect(a.profileStatus).toBe(b.profileStatus);
      expect(a.caqhProviderId).toBe(b.caqhProviderId);
    });
  });

  describe('health tracking', () => {
    it('records success after lookup', async () => {
      await checkCAQHProfile('1003000125');
      const health = getConnectorHealth();
      const entry = health.connectors.find((c) => c.connector === 'CAQH');
      expect(entry).toBeDefined();
      expect(entry!.successCount).toBeGreaterThanOrEqual(1);
    });
  });
});
