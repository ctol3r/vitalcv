/**
 * B141D-FF-003: Tests for flag change audit events
 *
 * Tests that flag changes emit audit events with proper structure:
 * - flagKey, scope, oldValue, newValue, actorId
 * - Events are anchored
 * - Tests for structure
 */

import { PrismaClient } from '@prisma/client';
import { recordFlagChange, getFlagChangeHistory, getLatestFlagChange } from '../flagEvents';

const prisma = new PrismaClient();

describe('Flag Change Audit Events', () => {
  beforeAll(async () => {
    // Clean up test data
    await prisma.auditEvent.deleteMany({
      where: {
        type: 'FLAG_CHANGED',
      },
    });
    await prisma.settingsAuditEvent.deleteMany({
      where: {
        resourceType: 'FeatureFlag',
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('recordFlagChange', () => {
    it('should create audit event with correct structure', async () => {
      const event = {
        flagKey: 'test.flag',
        scope: 'GLOBAL' as const,
        oldValue: false,
        newValue: true,
        actorId: 'test-actor-123',
        actorName: 'Test Actor',
      };

      const auditEvent = await recordFlagChange(event);

      expect(auditEvent).toBeDefined();
      expect(auditEvent.type).toBe('FLAG_CHANGED');
      expect(auditEvent.userId).toBe('test-actor-123');

      const data = auditEvent.data as any;
      expect(data.flagKey).toBe('test.flag');
      expect(data.scope).toBe('GLOBAL');
      expect(data.oldValue).toBe(false);
      expect(data.newValue).toBe(true);
      expect(data.actorId).toBe('test-actor-123');
      expect(data.actorName).toBe('Test Actor');
      expect(data.anchoredHash).toBeDefined();
      expect(typeof data.anchoredHash).toBe('string');
      expect(data.anchoredHash.length).toBe(64); // SHA-256 hex length
      expect(data.anchoredTx).toBeDefined();
    });

    it('should create SettingsAuditEvent for consistency', async () => {
      const event = {
        flagKey: 'test.flag2',
        scope: 'ORG' as const,
        orgId: 'org-123',
        oldValue: null,
        newValue: true,
        actorId: 'test-actor-456',
        actorName: 'Test Actor 2',
      };

      await recordFlagChange(event);

      const settingsEvent = await prisma.settingsAuditEvent.findFirst({
        where: {
          resourceType: 'FeatureFlag',
          resourceId: 'test.flag2',
          orgId: 'org-123',
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      expect(settingsEvent).toBeDefined();
      expect(settingsEvent?.action).toBe('FLAG_OVERRIDE_CREATED');
      expect(settingsEvent?.actorId).toBe('test-actor-456');
      expect(settingsEvent?.before).toBeNull();
      expect((settingsEvent?.after as any)?.value).toBe(true);
      expect(settingsEvent?.anchoredHash).toBeDefined();
      expect(settingsEvent?.anchoredTx).toBeDefined();
    });

    it('should handle USER scope correctly', async () => {
      const event = {
        flagKey: 'test.flag3',
        scope: 'USER' as const,
        userId: 'user-789',
        oldValue: true,
        newValue: false,
        actorId: 'test-actor-789',
      };

      const auditEvent = await recordFlagChange(event);

      const data = auditEvent.data as any;
      expect(data.scope).toBe('USER');
      expect(data.userId).toBe('user-789');
      expect(data.orgId).toBeUndefined();
    });

    it('should generate unique anchored hash for each event', async () => {
      const event1 = {
        flagKey: 'test.flag4',
        scope: 'GLOBAL' as const,
        oldValue: false,
        newValue: true,
        actorId: 'test-actor-1',
      };

      const event2 = {
        flagKey: 'test.flag4',
        scope: 'GLOBAL' as const,
        oldValue: true,
        newValue: false,
        actorId: 'test-actor-2',
      };

      const auditEvent1 = await recordFlagChange(event1);
      const auditEvent2 = await recordFlagChange(event2);

      const hash1 = (auditEvent1.data as any).anchoredHash;
      const hash2 = (auditEvent2.data as any).anchoredHash;

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('getFlagChangeHistory', () => {
    beforeEach(async () => {
      // Create test audit events
      await recordFlagChange({
        flagKey: 'history.test',
        scope: 'GLOBAL',
        oldValue: false,
        newValue: true,
        actorId: 'actor-1',
      });

      await new Promise((resolve) => setTimeout(resolve, 10)); // Small delay to ensure different timestamps

      await recordFlagChange({
        flagKey: 'history.test',
        scope: 'GLOBAL',
        oldValue: true,
        newValue: false,
        actorId: 'actor-2',
      });
    });

    it('should return flag change history', async () => {
      const history = await getFlagChangeHistory('history.test');

      expect(history.length).toBeGreaterThanOrEqual(2);
      expect(history[0].type).toBe('FLAG_CHANGED');
      const data = history[0].data as any;
      expect(data.flagKey).toBe('history.test');
    });

    it('should filter by orgId when provided', async () => {
      await recordFlagChange({
        flagKey: 'history.test',
        scope: 'ORG',
        orgId: 'org-filter',
        oldValue: false,
        newValue: true,
        actorId: 'actor-org',
      });

      const history = await getFlagChangeHistory('history.test', {
        orgId: 'org-filter',
      });

      expect(history.length).toBeGreaterThan(0);
      const data = history[0].data as any;
      expect(data.scope).toBe('ORG');
      expect(data.orgId).toBe('org-filter');
    });
  });

  describe('getLatestFlagChange', () => {
    beforeEach(async () => {
      // Clean up
      await prisma.auditEvent.deleteMany({
        where: {
          type: 'FLAG_CHANGED',
          data: {
            path: ['flagKey'],
            equals: 'latest.test',
          },
        },
      });
    });

    it('should return latest change for a flag', async () => {
      await recordFlagChange({
        flagKey: 'latest.test',
        scope: 'GLOBAL',
        oldValue: false,
        newValue: true,
        actorId: 'actor-latest',
      });

      const latest = await getLatestFlagChange('latest.test', 'GLOBAL');

      expect(latest).toBeDefined();
      const data = latest!.data as any;
      expect(data.flagKey).toBe('latest.test');
      expect(data.scope).toBe('GLOBAL');
    });

    it('should return null if no changes exist', async () => {
      const latest = await getLatestFlagChange('nonexistent.flag', 'GLOBAL');

      expect(latest).toBeNull();
    });
  });
});

