import { describe, it, expect, beforeEach } from '@jest/globals';
import { getAuditTrail, logTefcaAudit, resetAuditTrail } from '../auditLogger.js';

describe('TEFCA audit logger', () => {
  beforeEach(() => {
    resetAuditTrail();
  });

  it('anchors audit events with hashes', async () => {
    await logTefcaAudit({
      resourceType: 'Practitioner',
      subject: 'NPI-1234',
      pou: 'TREATMENT',
      requester: 'lakeview-qhin',
    });

    await logTefcaAudit({
      resourceType: 'PractitionerRole',
      subject: 'ROLE-55',
      pou: 'DIRECTORY',
      requester: 'aurora-participant',
    });

    const records = getAuditTrail();
    expect(records).toHaveLength(2);
    expect(records[0].hash).toHaveLength(64);
    expect(records[1].anchorId).toMatch(/^tefca-audit-/);
  });
});
import { getAuditTrail, logTefcaAudit, resetAuditTrail } from '../auditLogger';

describe('TEFCA audit logger', () => {
  beforeEach(() => {
    resetAuditTrail();
  });

  it('anchors entries with prevHash linkage', async () => {
    const first = await logTefcaAudit({
      resourceType: 'Practitioner',
      subject: 'identifier=1234567890',
      pou: 'TREATMENT',
      requester: 'OrgA',
    });

    const second = await logTefcaAudit({
      resourceType: 'Practitioner',
      subject: 'name=car',
      pou: 'DIRECTORY',
      requester: 'OrgA',
    });

    expect(first.hash).toBeDefined();
    expect(second.prevHash).toBe(first.hash);

    const auditTrail = getAuditTrail();
    expect(auditTrail).toHaveLength(2);
  });
});


