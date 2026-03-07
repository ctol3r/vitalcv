/**
 * abmsConnector.test.ts — Wave 127: ABMS Certification Connector Tests
 */

import { checkABMSCertification } from '../../src/services/providers/connectors/abmsConnector';
import { resetConnectorHealth, getConnectorHealth } from '../../src/services/providers/connectors/connectorHealthTracker';

beforeEach(() => {
  resetConnectorHealth();
});

describe('abmsConnector', () => {
  describe('sandbox mode', () => {
    it('returns CERTIFIED for NPI ending 0-6', async () => {
      const result = await checkABMSCertification('1003000126');
      expect(result.npi).toBe('1003000126');
      expect(result.certificationStatus).toBe('CERTIFIED');
      expect(result.certified).toBe(true);
      expect(result.boardName).toBeTruthy();
      expect(result.specialtyName).toBeTruthy();
      expect(result.initialCertDate).toBeTruthy();
      expect(result.expirationDate).toBeTruthy();
    });

    it('returns EXPIRED for NPI ending 7', async () => {
      const result = await checkABMSCertification('1003000127');
      expect(result.certificationStatus).toBe('EXPIRED');
      expect(result.certified).toBe(false);
      expect(result.boardName).toBeTruthy();
    });

    it('returns NOT_CERTIFIED for NPI ending 8-9', async () => {
      const r8 = await checkABMSCertification('1003000128');
      expect(r8.certificationStatus).toBe('NOT_CERTIFIED');
      expect(r8.certified).toBe(false);
      expect(r8.boardName).toBeNull();
      expect(r8.specialtyName).toBeNull();

      const r9 = await checkABMSCertification('1003000129');
      expect(r9.certificationStatus).toBe('NOT_CERTIFIED');
    });

    it('includes sourceUrl and lastVerifiedAt', async () => {
      const result = await checkABMSCertification('1003000126');
      expect(result.sourceUrl).toContain('certificationmatters.org');
      expect(result.lastVerifiedAt).toBeTruthy();
    });

    it('is deterministic across calls', async () => {
      const a = await checkABMSCertification('1003000126');
      const b = await checkABMSCertification('1003000126');
      expect(a.certificationStatus).toBe(b.certificationStatus);
      expect(a.boardName).toBe(b.boardName);
    });
  });

  describe('health tracking', () => {
    it('records success after lookup', async () => {
      await checkABMSCertification('1003000126');
      const health = getConnectorHealth();
      const entry = health.connectors.find((c) => c.connector === 'ABMS');
      expect(entry).toBeDefined();
      expect(entry!.successCount).toBeGreaterThanOrEqual(1);
    });
  });
});
