import { PrismaClient } from '@prisma/client';
import {
  computeBundleHash,
  listRecentPassportBundles,
  recordPassportBundle,
} from '../models/PassportBundle';

const prisma = new PrismaClient();

describe('PassportBundle model', () => {
  const clinicianUserEmail = `passport-${Date.now()}@example.com`;
  let clinicianProfileId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: clinicianUserEmail,
        name: 'Passport Demo Clinician',
        roles: ['CLINICIAN'],
      },
    });

    const profile = await prisma.clinicianProfile.create({
      data: {
        userId: user.id,
        npi: '1999999999',
        specialty: 'Family Medicine',
        state: 'CA',
      },
    });

    clinicianProfileId = profile.id;
  });

  afterAll(async () => {
    await prisma.passportBundle.deleteMany({ where: { clinicianId: clinicianProfileId } });
    await prisma.clinicianProfile.deleteMany({ where: { id: clinicianProfileId } });
    await prisma.user.deleteMany({ where: { email: clinicianUserEmail } });
    await prisma.$disconnect();
  });

  it('computes a stable SHA-256 hash and persists bundle metadata', async () => {
    const samplePayload = Buffer.from('demo-passport-payload');
    const bundleHash = computeBundleHash(samplePayload);

    expect(bundleHash).toMatch(/^[a-f0-9]{64}$/);

    const record = await recordPassportBundle({
      clinicianId: clinicianProfileId,
      bundleHash,
    });

    expect(record.clinicianId).toBe(clinicianProfileId);
    expect(record.bundleHash).toBe(bundleHash);

    const recent = await listRecentPassportBundles(clinicianProfileId, 1);
    expect(recent).toHaveLength(1);
    expect(recent[0].id).toBe(record.id);
  });
});

