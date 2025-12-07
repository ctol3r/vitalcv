/**
 * B146C-SEC-002: Unit tests for demo audit logging with identifier masking
 */

import { demoAuditEvent, containsRawIdentifiers } from '../demoAudit';

describe('Demo Audit Logging', () => {
  const originalConsole = { ...console };
  let logOutput: string[] = [];

  beforeEach(() => {
    logOutput = [];
    console.info = jest.fn((...args) => {
      logOutput.push(args.join(' '));
    });
  });

  afterEach(() => {
    Object.assign(console, originalConsole);
  });

  it('should mask clinicianId in audit logs', () => {
    const event = demoAuditEvent('DEMO_ACTION', 'view_profile', {
      clinicianId: 'clinician_12345',
      otherData: 'value',
    });

    expect(event.clinicianIdHash).toBeDefined();
    expect(event.payload.clinicianId).toMatch(/^demo_[a-f0-9]{16}$/);
    expect(event.payload.clinicianId).not.toBe('clinician_12345');
    expect(event.payload.otherData).toBe('value');
  });

  it('should mask orgId in audit logs', () => {
    const event = demoAuditEvent('DEMO_ACTION', 'access_resource', {
      orgId: 'org_67890',
      resource: 'dashboard',
    });

    expect(event.orgIdHash).toBeDefined();
    expect(event.payload.orgId).toMatch(/^demo_[a-f0-9]{16}$/);
    expect(event.payload.orgId).not.toBe('org_67890');
    expect(event.payload.resource).toBe('dashboard');
  });

  it('should mask both clinicianId and orgId', () => {
    const event = demoAuditEvent('DEMO_ACTION', 'submit_form', {
      clinicianId: 'clinician_abc123',
      orgId: 'org_xyz789',
      formData: { field: 'value' },
    });

    expect(event.clinicianIdHash).toBeDefined();
    expect(event.orgIdHash).toBeDefined();
    expect(event.payload.clinicianId).toMatch(/^demo_[a-f0-9]{16}$/);
    expect(event.payload.orgId).toMatch(/^demo_[a-f0-9]{16}$/);
    expect(event.payload.clinicianId).not.toBe('clinician_abc123');
    expect(event.payload.orgId).not.toBe('org_xyz789');
  });

  it('should handle clinician_id (snake_case) variant', () => {
    const event = demoAuditEvent('DEMO_ACTION', 'action', {
      clinician_id: 'clinician_999',
    });

    expect(event.clinicianIdHash).toBeDefined();
    expect(event.payload.clinician_id).toMatch(/^demo_[a-f0-9]{16}$/);
    expect(event.payload.clinician_id).not.toBe('clinician_999');
  });

  it('should handle org_id (snake_case) variant', () => {
    const event = demoAuditEvent('DEMO_ACTION', 'action', {
      org_id: 'org_888',
    });

    expect(event.orgIdHash).toBeDefined();
    expect(event.payload.org_id).toMatch(/^demo_[a-f0-9]{16}$/);
    expect(event.payload.org_id).not.toBe('org_888');
  });

  it('should produce consistent pseudonyms for same ID', () => {
    const event1 = demoAuditEvent('DEMO_ACTION', 'action1', {
      clinicianId: 'clinician_same',
    });
    const event2 = demoAuditEvent('DEMO_ACTION', 'action2', {
      clinicianId: 'clinician_same',
    });

    // Same ID should produce same pseudonym
    expect(event1.payload.clinicianId).toBe(event2.payload.clinicianId);
    expect(event1.clinicianIdHash).toBe(event2.clinicianIdHash);
  });

  it('should not contain raw IDs in log output', () => {
    demoAuditEvent('DEMO_ACTION', 'test_action', {
      clinicianId: 'clinician_raw_12345',
      orgId: 'org_raw_67890',
    });

    const logText = logOutput.join(' ');

    // Verify raw IDs are not present
    expect(logText).not.toContain('clinician_raw_12345');
    expect(logText).not.toContain('org_raw_67890');

    // Verify pseudonyms are present
    expect(logText).toMatch(/demo_[a-f0-9]{16}/);
  });

  it('should detect raw identifiers in text (for testing)', () => {
    expect(containsRawIdentifiers('clinician_abc123def456')).toBe(true);
    expect(containsRawIdentifiers('org_xyz789uvw012')).toBe(true);
    expect(containsRawIdentifiers('demo_1234567890abcdef')).toBe(false);
    expect(containsRawIdentifiers('normal text')).toBe(false);
  });

  it('should preserve non-identifier fields', () => {
    const event = demoAuditEvent('DEMO_ACTION', 'action', {
      clinicianId: 'clinician_123',
      orgId: 'org_456',
      timestamp: '2025-01-01',
      action: 'login',
      metadata: { key: 'value' },
    });

    expect(event.payload.timestamp).toBe('2025-01-01');
    expect(event.payload.action).toBe('login');
    expect(event.payload.metadata.key).toBe('value');
  });
});

