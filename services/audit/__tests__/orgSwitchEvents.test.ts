import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { PrismaClient } from '@prisma/client';
import { getOrgSwitchEvents, logOrgSwitchEvent } from '../orgSwitchEvents';

const prisma = new PrismaClient();

describe('Org Switch Audit Events', () => {
  const testUserId = 'org-switch-user-123';

  beforeAll(async () => {
    await prisma.auditEvent.deleteMany({
      where: {
        type: 'ORG_SWITCH',
        userId: testUserId,
      },
    });
  });

  afterAll(async () => {
    await prisma.auditEvent.deleteMany({
      where: {
        type: 'ORG_SWITCH',
        userId: testUserId,
      },
    });
    await prisma.$disconnect();
  });

  it('logs an org switch with anchored hash and tx id', async () => {
    const event = await logOrgSwitchEvent({
      userId: testUserId,
      oldOrgId: 'org-old',
      newOrgId: 'org-new',
      metadata: { source: 'test' },
    });

    expect(event.type).toBe('ORG_SWITCH');
    const data = event.data as any;
    expect(data.oldOrgId).toBe('org-old');
    expect(data.newOrgId).toBe('org-new');
    expect(data.metadata).toEqual({ source: 'test' });
    expect(typeof data.anchoredHash).toBe('string');
    expect(data.anchoredHash).toHaveLength(64);
    expect(data.anchoredTx).toMatch(/^0x/);
  });

  it('retrieves recent switch history for a user', async () => {
    await logOrgSwitchEvent({
      userId: testUserId,
      oldOrgId: 'org-new',
      newOrgId: 'org-other',
    });

    const history = await getOrgSwitchEvents(testUserId, 10);
    expect(history.length).toBeGreaterThanOrEqual(2);
    expect(history[0].type).toBe('ORG_SWITCH');
  });
});
