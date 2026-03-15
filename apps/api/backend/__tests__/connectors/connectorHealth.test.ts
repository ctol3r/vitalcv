/**
 * connectorHealth.test.ts — Wave 127: Connector Health Tracker Tests
 */

import {
  getConnectorAlerts,
  getConnectorDiagnostics,
  quarantineConnector,
  recordConnectorSuccess,
  recordConnectorFailure,
  getConnectorHealth,
  resetConnectorHealth,
} from '../../src/services/providers/connectors/connectorHealthTracker';

beforeEach(() => {
  resetConnectorHealth();
});

describe('connectorHealthTracker', () => {
  describe('recordConnectorSuccess', () => {
    it('increments success count', () => {
      recordConnectorSuccess('STATE_BOARD');
      recordConnectorSuccess('STATE_BOARD');
      const health = getConnectorHealth();
      const entry = health.connectors.find((c) => c.connector === 'STATE_BOARD');
      expect(entry!.successCount).toBe(2);
    });

    it('resets consecutive errors on success', () => {
      recordConnectorFailure('OIG', 'timeout');
      recordConnectorFailure('OIG', 'timeout');
      recordConnectorSuccess('OIG');
      const health = getConnectorHealth();
      const entry = health.connectors.find((c) => c.connector === 'OIG');
      expect(entry!.consecutiveErrors).toBe(0);
      expect(entry!.status).toBe('HEALTHY');
    });

    it('sets lastSuccessAt timestamp', () => {
      recordConnectorSuccess('ABMS');
      const health = getConnectorHealth();
      const entry = health.connectors.find((c) => c.connector === 'ABMS');
      expect(entry!.lastSuccessAt).toBeTruthy();
    });
  });

  describe('recordConnectorFailure', () => {
    it('increments error count and consecutive errors', () => {
      recordConnectorFailure('CAQH', 'network error');
      recordConnectorFailure('CAQH', 'timeout');
      const health = getConnectorHealth();
      const entry = health.connectors.find((c) => c.connector === 'CAQH');
      expect(entry!.errorCount).toBe(2);
      expect(entry!.consecutiveErrors).toBe(2);
      expect(entry!.lastError).toBe('timeout');
    });

    it('sets lastErrorAt timestamp', () => {
      recordConnectorFailure('NPDB', 'test error');
      const health = getConnectorHealth();
      const entry = health.connectors.find((c) => c.connector === 'NPDB');
      expect(entry!.lastErrorAt).toBeTruthy();
    });
  });

  describe('status determination', () => {
    it('reports HEALTHY with 0-1 consecutive errors', () => {
      recordConnectorFailure('STATE_BOARD', 'err');
      const health = getConnectorHealth();
      const entry = health.connectors.find((c) => c.connector === 'STATE_BOARD');
      expect(entry!.status).toBe('HEALTHY');
    });

    it('reports DEGRADED with 2-4 consecutive errors', () => {
      recordConnectorFailure('OIG', 'err');
      recordConnectorFailure('OIG', 'err');
      const health = getConnectorHealth();
      const entry = health.connectors.find((c) => c.connector === 'OIG');
      expect(entry!.status).toBe('DEGRADED');
    });

    it('reports UNREACHABLE with 5+ consecutive errors', () => {
      for (let i = 0; i < 5; i++) {
        recordConnectorFailure('ABMS', 'err');
      }
      const health = getConnectorHealth();
      const entry = health.connectors.find((c) => c.connector === 'ABMS');
      expect(entry!.status).toBe('UNREACHABLE');
    });
  });

  describe('overall report', () => {
    it('returns all 6 connectors', () => {
      const health = getConnectorHealth();
      expect(health.connectors.length).toBe(6);
      const names = health.connectors.map((c) => c.connector);
      expect(names).toContain('NPPES');
      expect(names).toContain('STATE_BOARD');
      expect(names).toContain('OIG');
      expect(names).toContain('ABMS');
      expect(names).toContain('CAQH');
      expect(names).toContain('NPDB');
    });

    it('reports overall HEALTHY when no errors', () => {
      const health = getConnectorHealth();
      expect(health.overall).toBe('HEALTHY');
    });

    it('reports overall DEGRADED when 1 connector is UNREACHABLE', () => {
      for (let i = 0; i < 5; i++) {
        recordConnectorFailure('STATE_BOARD', 'err');
      }
      const health = getConnectorHealth();
      expect(health.overall).toBe('DEGRADED');
    });

    it('reports overall CRITICAL when 3+ connectors are UNREACHABLE', () => {
      for (const name of ['STATE_BOARD', 'OIG', 'ABMS'] as const) {
        for (let i = 0; i < 5; i++) {
          recordConnectorFailure(name, 'err');
        }
      }
      const health = getConnectorHealth();
      expect(health.overall).toBe('CRITICAL');
    });

    it('includes reportedAt timestamp', () => {
      const health = getConnectorHealth();
      expect(health.reportedAt).toBeTruthy();
    });
  });

  describe('resetConnectorHealth', () => {
    it('clears all tracking state', () => {
      recordConnectorSuccess('STATE_BOARD');
      recordConnectorFailure('OIG', 'err');
      resetConnectorHealth();
      const health = getConnectorHealth();
      for (const entry of health.connectors) {
        expect(entry.successCount).toBe(0);
        expect(entry.errorCount).toBe(0);
        expect(entry.consecutiveErrors).toBe(0);
      }
    });
  });

  describe('alerts and diagnostics', () => {
    it('emits alerts for failures', () => {
      recordConnectorFailure('STATE_BOARD', 'upstream timeout');
      const alerts = getConnectorAlerts(10);
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].connector).toBe('STATE_BOARD');
      expect(alerts[0].message).toContain('timeout');
    });

    it('reports quarantine in diagnostics', () => {
      quarantineConnector('OIG', 'Manual quarantine for investigation', 60_000);
      const diagnostics = getConnectorDiagnostics();
      const entry = diagnostics.connectors.find((connector) => connector.connector === 'OIG');
      expect(entry).toBeDefined();
      expect(entry!.status).toBe('CRITICAL');
      expect(entry!.recentAlerts.some((alert) => alert.type === 'QUARANTINE')).toBe(true);
    });
  });
});
