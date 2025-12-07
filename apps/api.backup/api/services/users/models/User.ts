import { Prisma, PrismaClient, User, UserRole } from '@prisma/client';
import { sanitizeUserFields } from '../../security/sanitizeUserFields';

const prisma = new PrismaClient();

export interface CreateUserInput {
  email: string;
  name: string;
  role?: UserRole;
  demoUser?: boolean;
}

export interface UpdateUserInput {
  name?: string;
  role?: UserRole;
  demoUser?: boolean;
}

export interface ListUsersFilters {
  role?: UserRole;
  demoUser?: boolean;
  take?: number;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function buildUpdatePayload(updates: UpdateUserInput): Prisma.UserUpdateInput {
  const payload: Prisma.UserUpdateInput = {};

  if (typeof updates.name === 'string') {
    const { name } = sanitizeUserFields({ name: updates.name });
    if (!name) {
      throw new Error('Name cannot be empty');
    }
    payload.name = name;
  }

  if (updates.role) {
    payload.role = updates.role;
    payload.roles = [updates.role];
  }

  if (typeof updates.demoUser === 'boolean') {
    payload.demoUser = updates.demoUser;
  }

  return payload;
}

export async function createUser(input: CreateUserInput): Promise<User> {
  const email = normalizeEmail(input.email);
  const { name } = sanitizeUserFields({ name: input.name });

  if (!name) {
    throw new Error('Name cannot be empty');
  }

  return prisma.user.create({
    data: {
      email,
      name,
      role: input.role ?? UserRole.CLINICIAN,
      roles: [input.role ?? UserRole.CLINICIAN],
      demoUser: input.demoUser ?? false,
    },
  });
}

export async function getUserById(id: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id } });
}

export async function getUserByEmail(email: string): Promise<User | null> {
  return prisma.user.findUnique({
    where: { email: normalizeEmail(email) },
  });
}

export async function listUsers(filters: ListUsersFilters = {}): Promise<User[]> {
  const { role, demoUser, take = 50 } = filters;
  const where: Prisma.UserWhereInput = {};

  if (role) {
    where.role = role;
  }
  if (typeof demoUser === 'boolean') {
    where.demoUser = demoUser;
  }

  return prisma.user.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: Math.min(take, 200),
  });
}

export async function updateUser(
  id: string,
  updates: UpdateUserInput
): Promise<User> {
  const data = buildUpdatePayload(updates);

  if (Object.keys(data).length === 0) {
    throw new Error('No updates provided');
  }

  return prisma.user.update({
    where: { id },
    data,
  });
}

export async function deleteUser(id: string): Promise<User> {
  return prisma.user.delete({ where: { id } });
}

