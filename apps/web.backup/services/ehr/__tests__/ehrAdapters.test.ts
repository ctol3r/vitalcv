import { describe, expect, it } from '@jest/globals';
import { EpicAdapter } from '../adapters/epicAdapter.js';
import { CernerAdapter } from '../adapters/cernerAdapter.js';
import { MeditechAdapter } from '../adapters/meditechAdapter.js';
import { EhrSynchronizationStatus } from '../models/EHRSynchronization.js';

jest.mock('../../logging/serviceLogger.js', () => ({
  getServiceLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

describe('EHR adapters stubs', () => {
  it('EpicAdapter returns mock success unless simulateFailure flag set', async () => {
    const adapter = new EpicAdapter();
    const success = await adapter.assignPrivilege({
      clinicianId: 'clinician-1',
      privilegeCode: 'SURG-ADMIN',
    });

    expect(success.success).toBe(true);
    expect(success.status).toBe(EhrSynchronizationStatus.SYNCED);

    const failure = await adapter.assignPrivilege({
      clinicianId: 'clinician-1',
      privilegeCode: 'SURG-ADMIN',
      metadata: { simulateFailure: true },
    });

    expect(failure.success).toBe(false);
    expect(failure.status).toBe(EhrSynchronizationStatus.FAILED);
    expect(failure.error).toContain('Simulated');
  });

  it('CernerAdapter supports audit-only role assignment', async () => {
    const adapter = new CernerAdapter();
    const auditOnly = await adapter.assignPrivilege({
      clinicianId: 'clinician-2',
      privilegeCode: 'ER-ROLE',
      metadata: { auditOnly: true, simulateWarning: true },
    });

    expect(auditOnly.success).toBe(true);
    expect(auditOnly.rawResponse.auditOnly).toBe(true);
    expect(auditOnly.rawResponse.warnings).toHaveLength(1);

    const withRole = await adapter.assignPrivilege({
      clinicianId: 'clinician-2',
      privilegeCode: 'ER-ROLE',
      metadata: { role: 'ED-SUPERVISOR' },
    });

    expect(withRole.rawResponse.assignedRole).toBe('ED-SUPERVISOR');
  });

  it('MeditechAdapter falls back to BASIC-ACCESS for unmapped privileges', async () => {
    const adapter = new MeditechAdapter();
    const mapped = await adapter.assignPrivilege({
      clinicianId: 'clinician-3',
      privilegeCode: 'MED-LAB',
    });

    expect(mapped.rawResponse.mappedPrivilege).toBe('LAB-READ');
    expect(mapped.rawResponse.fallbackApplied).toBe(false);

    const fallback = await adapter.assignPrivilege({
      clinicianId: 'clinician-3',
      privilegeCode: 'UNKNOWN',
    });

    expect(fallback.rawResponse.mappedPrivilege).toBe('BASIC-ACCESS');
    expect(fallback.rawResponse.fallbackApplied).toBe(true);
  });
});


