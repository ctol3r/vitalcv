import { logHIPAABAAAcceptance, exportSOC2AuditLog } from '../complianceEngine';
import prisma from '../../../graphql/prisma_client';

jest.mock('../../../graphql/prisma_client', () => {
  return {
    __esModule: true,
    default: {
      auditEvent: {
        create: jest.fn().mockResolvedValue({ id: 'audit1' }),
        findMany: jest.fn().mockResolvedValue([
          { id: 'ev1', type: 'HIPAA_BAA_ACCEPTED', createdAt: new Date() }
        ])
      }
    }
  };
});

describe('Compliance Readiness Engine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('logHIPAABAAAcceptance logs BAA signature', async () => {
    const result = await logHIPAABAAAcceptance('org1', 'user1');
    expect(result.status).toBe('ACCEPTED');
    expect(prisma.auditEvent.create).toHaveBeenCalled();
  });

  test('exportSOC2AuditLog exports correctly', async () => {
    const start = new Date('2026-01-01');
    const end = new Date('2026-12-31');
    const exportData = await exportSOC2AuditLog(start, end);
    
    expect(exportData.complianceFramework).toBe('SOC2');
    expect(exportData.recordCount).toBe(1);
    expect(prisma.auditEvent.findMany).toHaveBeenCalled();
  });
});
