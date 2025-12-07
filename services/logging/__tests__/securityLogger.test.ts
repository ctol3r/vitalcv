/**
 * Tests for Security Logger
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  SecurityLogger,
  SecurityEventType,
  EventOutcome,
  createSecurityLogger,
  createMockLogger
} from '../securityLogger.js';

describe('Security Logger', () => {
  let mockLogger: any;
  let securityLogger: SecurityLogger;

  beforeEach(() => {
    mockLogger = createMockLogger();
    securityLogger = createSecurityLogger(mockLogger, 'test-service');
  });

  it('should log authentication success', () => {
    securityLogger.authSuccess('user-123', 'org-456', { method: 'webauthn' });

    const logs = mockLogger.getLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].level).toBe('info');
    expect(logs[0].meta.eventType).toBe(SecurityEventType.AUTH_SUCCESS);
    expect(logs[0].meta.actorId).toBe('user-123');
    expect(logs[0].meta.orgId).toBe('org-456');
  });

  it('should log authentication failure', () => {
    securityLogger.authFailure('invalid_credentials', '192.168.1.1');

    const logs = mockLogger.getLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].level).toBe('warn');
    expect(logs[0].meta.eventType).toBe(SecurityEventType.AUTH_FAILURE);
    expect(logs[0].meta.reason).toBe('invalid_credentials');
  });

  it('should log DPoP verification events', () => {
    securityLogger.dpopSuccess('user-123', 'org-456');
    securityLogger.dpopFailure('invalid_proof', '192.168.1.1');

    const logs = mockLogger.getLogs();
    expect(logs.length).toBe(2);
    expect(logs[0].meta.eventType).toBe(SecurityEventType.DPOP_VERIFICATION_SUCCESS);
    expect(logs[1].meta.eventType).toBe(SecurityEventType.DPOP_VERIFICATION_FAILURE);
  });

  it('should log policy violations', () => {
    securityLogger.policyViolation('user-123', 'data_export', 'insufficient_permissions');

    const logs = mockLogger.getLogs();
    expect(logs[0].level).toBe('error');
    expect(logs[0].meta.eventType).toBe(SecurityEventType.POLICY_VIOLATION);
  });

  it('should log permission denied events', () => {
    securityLogger.permissionDenied('user-123', 'resource-789', 'delete');

    const logs = mockLogger.getLogs();
    expect(logs[0].meta.eventType).toBe(SecurityEventType.PERMISSION_DENIED);
    expect(logs[0].meta.statusCode).toBe(403);
  });

  it('should log suspicious activity', () => {
    securityLogger.suspiciousActivity('brute_force_attempt', '192.168.1.1', 85);

    const logs = mockLogger.getLogs();
    expect(logs[0].level).toBe('error');
    expect(logs[0].meta.eventType).toBe(SecurityEventType.SUSPICIOUS_ACTIVITY);
    expect(logs[0].meta.riskScore).toBe(85);
  });

  it('should log data export for compliance', () => {
    securityLogger.dataExport('user-123', 'org-456', 'credentials', 150);

    const logs = mockLogger.getLogs();
    expect(logs[0].meta.eventType).toBe(SecurityEventType.DATA_EXPORT);
    expect(logs[0].meta.metadata?.recordCount).toBe(150);
  });

  it('should reject PHI in security logs', () => {
    expect(() => {
      securityLogger.log({
        eventType: SecurityEventType.AUTH_SUCCESS,
        outcome: EventOutcome.SUCCESS,
        actorId: 'user-123',
        metadata: { name: 'John Doe' } as any
      });
    }).toThrow('Potential PHI field');
  });

  it('should reject direct PHI fields', () => {
    expect(() => {
      securityLogger.log({
        eventType: SecurityEventType.AUTH_SUCCESS,
        outcome: EventOutcome.SUCCESS,
        email: 'test@example.com' as any
      });
    }).toThrow('PHI field');
  });

  it('should include correlation IDs when available', () => {
    securityLogger.log({
      eventType: SecurityEventType.AUTH_SUCCESS,
      outcome: EventOutcome.SUCCESS,
      actorId: 'user-123',
      traceId: 'trace-123',
      spanId: 'span-456'
    });

    const logs = mockLogger.getLogs();
    expect(logs[0].meta.traceId).toBe('trace-123');
    expect(logs[0].meta.spanId).toBe('span-456');
  });

  it('should include service name in all events', () => {
    securityLogger.authSuccess('user-123');

    const logs = mockLogger.getLogs();
    expect(logs[0].meta.service).toBe('test-service');
  });

  it('should add timestamp to all events', () => {
    securityLogger.authSuccess('user-123');

    const logs = mockLogger.getLogs();
    expect(logs[0].meta.timestamp).toBeDefined();
    expect(new Date(logs[0].meta.timestamp)).toBeInstanceOf(Date);
  });

  it('should determine correct log levels', () => {
    securityLogger.authSuccess('user-123'); // info
    securityLogger.authFailure('invalid'); // warn
    securityLogger.suspiciousActivity('brute_force'); // error

    const logs = mockLogger.getLogs();
    expect(logs[0].level).toBe('info');
    expect(logs[1].level).toBe('warn');
    expect(logs[2].level).toBe('error');
  });

  it('should allow IDs in metadata but not names', () => {
    // This should work (IDs only)
    expect(() => {
      securityLogger.log({
        eventType: SecurityEventType.DATA_EXPORT,
        outcome: EventOutcome.SUCCESS,
        actorId: 'user-123',
        metadata: {
          resourceId: 'res-456',
          count: 10
        }
      });
    }).not.toThrow();

    // This should fail (contains 'email')
    expect(() => {
      securityLogger.log({
        eventType: SecurityEventType.DATA_EXPORT,
        outcome: EventOutcome.SUCCESS,
        actorId: 'user-123',
        metadata: {
          userEmail: 'test@example.com' as any
        }
      });
    }).toThrow();
  });
});

