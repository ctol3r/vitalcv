import { PrismaClient, UserRole } from '@prisma/client';
import { createUser } from 'services/users/models/User';
import {
  findUserIdByDid,
  linkDidToUser,
  listDidsForUser,
  unlinkDid,
} from '../models/DidUserLink';

const prisma = new PrismaClient();

describe('DidUserLink model', () => {
  let userId: string;
  const did = `did:example:${Date.now()}`;

  beforeAll(async () => {
    const user = await createUser({
      email: `did-user+${Date.now()}@example.com`,
      name: 'DID Demo User',
      role: UserRole.CLINICIAN,
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.didUserLink.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('links DID to user and retrieves it', async () => {
    const link = await linkDidToUser({ userId, did });
    expect(link.userId).toBe(userId);
    expect(link.did).toBe(did);

    const found = await findUserIdByDid(did);
    expect(found?.userId).toBe(userId);
  });

  it('lists DIDs for a user and unlinks', async () => {
    const list = await listDidsForUser(userId);
    expect(list.length).toBeGreaterThan(0);

    const removed = await unlinkDid(did);
    expect(removed.did).toBe(did);
  });
});

