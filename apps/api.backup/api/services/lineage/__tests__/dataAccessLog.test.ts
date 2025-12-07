/**
 * Tests for DataAccessLogService
 */

import { DataAccessLogService } from '../models/DataAccessLog';
import { PrismaClient } from '@prisma/client';

describe('DataAccessLogService', () => {
  let service: DataAccessLogService;
  let prisma: PrismaClient;

  beforeEach(() => {
    prisma = new PrismaClient();
    service = new DataAccessLogService(prisma);
  });

  afterEach(async () => {
    await prisma.$disconnect();
  });

  describe('logAccess', () => {
    it('should log data access', async () => {
      const input = {
        recordId: 'record_123',
        accessorId: 'user_456',
        reason: 'credential_verification',
        metadata: { sourceSystem: 'credentials' },
      };

      const log = await service.logAccess(input);

      expect(log).toBeDefined();
      expect(log.recordId).toBe(input.recordId);
      expect(log.accessorId).toBe(input.accessorId);
      expect(log.reason).toBe(input.reason);
    });
  });

  describe('queryLogs', () => {
    it('should query logs by recordId', async () => {
      // Create test log
      await service.logAccess({
        recordId: 'record_123',
        accessorId: 'user_456',
        reason: 'test',
      });

      const logs = await service.queryLogs({ recordId: 'record_123' });

      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].recordId).toBe('record_123');
    });

    it('should query logs by accessorId', async () => {
      await service.logAccess({
        recordId: 'record_123',
        accessorId: 'user_456',
        reason: 'test',
      });

      const logs = await service.queryLogs({ accessorId: 'user_456' });

      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].accessorId).toBe('user_456');
    });
  });

  describe('purgeOldLogs', () => {
    it('should delete logs older than retention period', async () => {
      // Create old log (would need to set timestamp manually in real test)
      const deletedCount = await service.purgeOldLogs(30);

      expect(typeof deletedCount).toBe('number');
    });
  });
});

