/**
 * stateBoardConnector.test.ts — Wave 127: State Board Connector Tests
 */

import { lookupStateBoard, listAvailableStates } from '../../src/services/providers/connectors/stateBoardConnector';
import { resetConnectorHealth, getConnectorHealth } from '../../src/services/providers/connectors/connectorHealthTracker';

beforeEach(() => {
  resetConnectorHealth();
});

describe('stateBoardConnector', () => {
  describe('sandbox mode', () => {
    it('returns ACTIVE for NPI ending 0-6', async () => {
      const result = await lookupStateBoard('1003000126', 'CA');
      expect(result.npi).toBe('1003000126');
      expect(result.state).toBe('CA');
      expect(result.licenseStatus).toBe('ACTIVE');
      expect(result.boardName).toBe('Medical Board of California');
      expect(result.licenseNumber).toBeTruthy();
      expect(result.lastVerifiedAt).toBeTruthy();
    });

    it('returns EXPIRED for NPI ending 7', async () => {
      const result = await lookupStateBoard('1003000127', 'NY');
      expect(result.licenseStatus).toBe('EXPIRED');
      expect(result.boardName).toBe('New York State Education Department');
    });

    it('returns SUSPENDED for NPI ending 8', async () => {
      const result = await lookupStateBoard('1003000128', 'TX');
      expect(result.licenseStatus).toBe('SUSPENDED');
      expect(result.expirationDate).toBeNull();
    });

    it('returns REVOKED for NPI ending 9', async () => {
      const result = await lookupStateBoard('1003000129', 'FL');
      expect(result.licenseStatus).toBe('REVOKED');
    });

    it('returns NOT_AVAILABLE for unsupported state', async () => {
      const result = await lookupStateBoard('1003000126', 'ZZ');
      expect(result.licenseStatus).toBe('NOT_AVAILABLE');
      expect(result.boardName).toContain('no adapter');
    });

    it('normalises state to uppercase', async () => {
      const result = await lookupStateBoard('1003000126', 'ca');
      expect(result.state).toBe('CA');
      expect(result.licenseStatus).toBe('ACTIVE');
    });

    it('is deterministic — same NPI+state gives same result shape', async () => {
      const a = await lookupStateBoard('1003000126', 'CA');
      const b = await lookupStateBoard('1003000126', 'CA');
      expect(a.licenseStatus).toBe(b.licenseStatus);
      expect(a.licenseNumber).toBe(b.licenseNumber);
    });
  });

  describe('adapter registry', () => {
    it('lists all supported states', () => {
      const states = listAvailableStates();
      expect(states).toContain('CA');
      expect(states).toContain('NY');
      expect(states).toContain('TX');
      expect(states).toContain('FL');
      expect(states).toContain('IL');
      expect(states.length).toBe(5);
    });
  });

  describe('health tracking', () => {
    it('records success after lookup', async () => {
      await lookupStateBoard('1003000126', 'CA');
      const health = getConnectorHealth();
      const entry = health.connectors.find((c) => c.connector === 'STATE_BOARD');
      expect(entry).toBeDefined();
      expect(entry!.successCount).toBeGreaterThanOrEqual(1);
      expect(entry!.status).toBe('HEALTHY');
    });
  });
});
