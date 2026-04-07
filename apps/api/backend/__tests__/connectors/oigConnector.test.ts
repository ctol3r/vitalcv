/**
 * oigConnector.test.ts — Wave 127: OIG LEIE Connector Tests
 */

import {
  checkOIGExclusion,
  loadLeieData,
  getLeieIndexStatus,
} from '../../src/services/providers/connectors/oigConnector';
import { resetLeieCacheForTests } from '../../src/services/identity/leieCache';
import { resetConnectorHealth, getConnectorHealth } from '../../src/services/providers/connectors/connectorHealthTracker';

beforeEach(() => {
  resetConnectorHealth();
});

describe('oigConnector', () => {
  const originalOigMode = process.env.OIG_MODE;
  const originalFetch = global.fetch;

  afterEach(() => {
    process.env.OIG_MODE = originalOigMode;
    global.fetch = originalFetch;
    resetLeieCacheForTests();
  });

  describe('LEIE index', () => {
    it('auto-loads sandbox data on first call', async () => {
      const result = await checkOIGExclusion('1003000126');
      const status = getLeieIndexStatus();
      expect(status.loaded).toBe(true);
      expect(status.recordCount).toBe(10);
      expect(status.mode).toBe('sandbox');
    });

    it('can load sandbox data explicitly', async () => {
      await loadLeieData();
      const status = getLeieIndexStatus();
      expect(status.loaded).toBe(true);
      expect(status.recordCount).toBe(10);
      expect(status.lastLoadedAt).toBeTruthy();
    });

    it('uses the canonical LEIE cache in live mode instead of silently falling back to sandbox fixtures', async () => {
      process.env.OIG_MODE = 'live';
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({
          'last-modified': 'Mon, 16 Mar 2026 00:00:00 GMT',
        }),
        text: async () => [
          'LASTNAME,FIRSTNAME,MIDNAME,BUSNAME,SPECIALTY,NPI,STATE,EXCLTYPE,EXCLDATE,REINDATE,WVRSTATE',
          'DOE,JANE,A,,INTERNAL MEDICINE,1234567890,CA,EXCLUSION,2024-01-01,,',
        ].join('\n'),
      }) as typeof fetch;

      await loadLeieData();
      const status = getLeieIndexStatus();
      const result = await checkOIGExclusion('1234567890');

      expect(status.mode).toBe('live');
      expect(status.recordCount).toBe(1);
      expect(result.excluded).toBe(true);
      expect(result.verdict).toBe('EXCLUDED');
    });
  });

  describe('exclusion lookup', () => {
    it('returns excluded=true for known excluded NPI', async () => {
      const result = await checkOIGExclusion('1234567890');
      expect(result.excluded).toBe(true);
      expect(result.verdict).toBe('EXCLUDED');
      expect(result.exclusionType).toBeTruthy();
      expect(result.exclusionDate).toBeTruthy();
      expect(result.npi).toBe('1234567890');
    });

    it('returns excluded=false for non-excluded NPI', async () => {
      const result = await checkOIGExclusion('1003000126');
      expect(result.excluded).toBe(false);
      expect(result.verdict).toBe('CLEAR');
      expect(result.exclusionType).toBeNull();
      expect(result.exclusionDate).toBeNull();
    });

    it('includes sourceUrl and lastCheckedAt', async () => {
      const result = await checkOIGExclusion('1003000126');
      expect(result.sourceUrl).toContain('oig.hhs.gov');
      expect(result.lastCheckedAt).toBeTruthy();
    });

    it('returns waiverState for applicable exclusions', async () => {
      const result = await checkOIGExclusion('3333333333');
      expect(result.excluded).toBe(true);
      expect(result.verdict).toBe('EXCLUDED');
      expect(result.waiverState).toBe('CA');
    });

    it('returns reinstatementDate when applicable', async () => {
      const result = await checkOIGExclusion('4444444444');
      expect(result.excluded).toBe(true);
      expect(result.verdict).toBe('EXCLUDED');
      expect(result.reinstatementDate).toBe('2025-11-20');
    });
  });

  describe('health tracking', () => {
    it('records success after lookup', async () => {
      await checkOIGExclusion('1003000126');
      const health = getConnectorHealth();
      const entry = health.connectors.find((c) => c.connector === 'OIG');
      expect(entry).toBeDefined();
      expect(entry!.successCount).toBeGreaterThanOrEqual(1);
      expect(entry!.status).toBe('HEALTHY');
    });
  });
});
