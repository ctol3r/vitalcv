import { PrismaClient, UserRole } from '@prisma/client';
import {
  createUser,
  deleteUser,
  getUserByEmail,
  getUserById,
  listUsers,
  updateUser,
} from '../models/User';

const prisma = new PrismaClient();

describe('User model', () => {
  const email = `alice.${Date.now()}@example.com`;
  let userId: string;

  afterAll(async () => {
    if (userId) {
      await prisma.user.deleteMany({ where: { id: userId } });
    }
    await prisma.$disconnect();
  });

  it('creates a user with sanitized fields and default role', async () => {
    const user = await createUser({
      email,
      name: '  <b>Alice</b>  Clinician ',
    });

    userId = user.id;

    expect(user.role).toBe(UserRole.CLINICIAN);
    expect(user.name).toBe('Alice Clinician');
    expect(user.demoUser).toBe(false);

    const byEmail = await getUserByEmail(email);
    expect(byEmail?.id).toBe(user.id);
  });

  it('updates role and demo flag', async () => {
    const updated = await updateUser(userId, {
      role: UserRole.ORG_ADMIN,
      demoUser: true,
    });

    expect(updated.role).toBe(UserRole.ORG_ADMIN);
    expect(updated.demoUser).toBe(true);
  });

  it('lists users with filters', async () => {
    const users = await listUsers({ role: UserRole.ORG_ADMIN, take: 5 });

    expect(Array.isArray(users)).toBe(true);
    expect(users.length).toBeGreaterThan(0);
    expect(users[0].role).toBe(UserRole.ORG_ADMIN);
  });

  it('fetches user by id and deletes', async () => {
    const found = await getUserById(userId);
    expect(found?.id).toBe(userId);

    const deleted = await deleteUser(userId);
    expect(deleted.id).toBe(userId);
    userId = '';
  });
});

