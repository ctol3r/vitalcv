import { PrismaClient, UserRole } from '@prisma/client';
import { createUserFlow } from '../createUserFlow';

const prisma = new PrismaClient();

describe('createUserFlow', () => {
  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { contains: 'onboarding-flow' } },
    });
    await prisma.$disconnect();
  });

  it('creates user, clinician profile, and DID link', async () => {
    const did = `did:example:${Date.now()}`;

    const result = await createUserFlow({
      user: {
        email: `onboarding-flow+${Date.now()}@example.com`,
        name: 'Dr Flow',
        role: UserRole.CLINICIAN,
        demoUser: true,
      },
      clinicianProfile: {
        npi: '1098765432',
        specialty: '207Q00000X',
        state: 'wa',
      },
      did,
    });

    expect(result.user.id).toBeDefined();
    expect(result.clinicianProfile?.userId).toBe(result.user.id);

    const didLink = await prisma.didUserLink.findUnique({
      where: { did },
    });
    expect(didLink).not.toBeNull();
  });
});

