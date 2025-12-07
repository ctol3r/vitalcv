import { PrismaClient } from '@prisma/client';
import { upsertOrgProfile, getOrgProfile } from '../models/OrgProfile';

const prisma = new PrismaClient();

describe('OrgProfile model', () => {
  const orgId = `org-${Date.now()}`;

  afterAll(async () => {
    await prisma.orgProfile.deleteMany({ where: { orgId } });
    await prisma.$disconnect();
  });

  it('creates org profile with sanitized name', async () => {
    const profile = await upsertOrgProfile({
      orgId,
      name: '<b>Vital Health</b>',
      contactEmail: 'ADMIN@VITAL.HEALTH',
      address: {
        line1: '123 Demo St',
        city: 'San Francisco',
        state: 'CA',
        postalCode: '94105',
      },
    });

    expect(profile.name).toBe('Vital Health');
    expect(profile.contactEmail).toBe('admin@vital.health');
  });

  it('updates existing org profile', async () => {
    const updated = await upsertOrgProfile({
      orgId,
      name: 'Vital Health Org',
      contactEmail: 'ops@vital.health',
      address: {
        line1: '456 Mission St',
      },
    });

    expect(updated.name).toBe('Vital Health Org');

    const fetched = await getOrgProfile(orgId);
    expect(fetched?.contactEmail).toBe('ops@vital.health');
  });
});

