import { PrismaClient, UserRole } from '@prisma/client';
import { createUser } from '../models/User';
import {
  getClinicianProfileByUserId,
  upsertClinicianProfile,
} from '../models/ClinicianProfile';

const prisma = new PrismaClient();

describe('ClinicianProfile model', () => {
  let userId: string;

  beforeAll(async () => {
    const user = await createUser({
      email: `clinician+${Date.now()}@test.example`,
      name: 'Dr. Demo Clinician',
      role: UserRole.CLINICIAN,
      demoUser: true,
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.clinicianProfile.deleteMany({
      where: { userId },
    });
    await prisma.user.deleteMany({
      where: { id: userId },
    });
    await prisma.$disconnect();
  });

  it('creates and retrieves clinician profile via upsert', async () => {
    const profile = await upsertClinicianProfile({
      userId,
      npi: ' 1234567890 ',
      specialty: '207Q00000X',
      state: 'ca',
      bio: '<script>hack()</script> Board-certified',
    });

    expect(profile.userId).toBe(userId);
    expect(profile.npi).toBe('1234567890');
    expect(profile.state).toBe('CA');
    expect(profile.bio).toBe('Board-certified');

    const fetched = await getClinicianProfileByUserId(userId);
    expect(fetched?.id).toBe(profile.id);
  });

  it('updates existing profile via upsert', async () => {
    const profile = await upsertClinicianProfile({
      userId,
      npi: '1234567890',
      specialty: '207P00000X',
      state: 'ny',
    });

    expect(profile.specialty).toBe('207P00000X');
    expect(profile.state).toBe('NY');
  });
});

