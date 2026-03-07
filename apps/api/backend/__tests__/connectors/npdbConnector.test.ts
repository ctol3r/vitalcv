/**
 * npdbConnector.test.ts — Wave 127: NPDB Connector Tests
 */

import { queryNPDB } from '../../src/services/providers/connectors/npdbConnector';
import { resetConnectorHealth, getConnectorHealth } from '../../src/services/providers/connectors/connectorHealthTracker';

beforeEach(() => {
  resetConnectorHealth();
});

describe('npdbConnector', () => {
  describe('sandbox mode', () => {
    it('returns CLEAR or FLAGGED for any NPI', async () => {
      const result = await queryNPDB('1003000126');
      expect(result.npi).toBe('1003000126');
      expect(['CLEAR', 'FLAGGED']).toContain(result.status);
    });

    it('returns numeric counts for all fields', async () => {
      const result = await queryNPDB('1003000126');
      expect(typeof result.adverseActionCount).toBe('number');
      expect(typeof result.malpracticePayments).toBe('number');
      expect(typeof result.licenseActions).toBe('number');
    });

    it('CLEAR results have zero counts', async () => {
      // Use an NPI known to hash to CLEAR
      const result = await queryNPDB('1003000126');
      if (result.status === 'CLEAR') {
        expect(result.adverseActionCount).toBe(0);
        expect(result.malpracticePayments).toBe(0);
        expect(result.licenseActions).toBe(0);
      }
    });

    it('includes sourceUrl and lastCheckedAt', async () => {
      const result = await queryNPDB('1003000126');
      expect(result.sourceUrl).toContain('npdb.hrsa.gov');
      expect(result.lastCheckedAt).toBeTruthy();
    });

    it('is deterministic across calls', async () => {
      const a = await queryNPDB('1003000126');
      const b = await queryNPDB('1003000126');
      expect(a.status).toBe(b.status);
      expect(a.adverseActionCount).toBe(b.adverseActionCount);
    });

    it('produces mostly CLEAR results', async () => {
      const results = await Promise.all(
        Array.from({ length: 50 }, (_, i) => queryNPDB(`100300${String(i).padStart(4, '0')}`)),
      );
      const clearCount = results.filter((r) => r.status === 'CLEAR').length;
      // ~95% should be CLEAR, allow wide margin
      expect(clearCount).toBeGreaterThan(35);
    });
  });

  describe('health tracking', () => {
    it('records success after query', async () => {
      await queryNPDB('1003000126');
      const health = getConnectorHealth();
      const entry = health.connectors.find((c) => c.connector === 'NPDB');
      expect(entry).toBeDefined();
      expect(entry!.successCount).toBeGreaterThanOrEqual(1);
      expect(entry!.status).toBe('HEALTHY');
    });
  });
});
