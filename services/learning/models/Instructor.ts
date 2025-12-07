/**
 * B249A-LRN-004: Instructor Model
 *
 * Model for course instructors
 */

import { PrismaClient } from '@prisma/client';

export interface InstructorInput {
  name: string;
  slug: string;
  bio?: string; // Markdown
  email?: string;
  institution?: string;
  credentials?: Record<string, any>; // JSON
  imageUrl?: string;
}

export interface Instructor {
  id: string;
  name: string;
  slug: string;
  bio: string | null;
  email: string | null;
  institution: string | null;
  credentials: Record<string, any> | null;
  imageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Validate instructor input
 */
export function validateInstructorInput(input: InstructorInput): void {
  if (!input.name || input.name.trim().length === 0) {
    throw new Error('name is required');
  }
  if (!input.slug || input.slug.trim().length === 0) {
    throw new Error('slug is required');
  }
  if (!/^[a-z0-9-]+$/.test(input.slug)) {
    throw new Error('slug must contain only lowercase letters, numbers, and hyphens');
  }
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    throw new Error('email must be a valid email address');
  }
}

/**
 * Create instructor
 */
export async function createInstructor(
  prisma: PrismaClient,
  input: InstructorInput
): Promise<Instructor> {
  validateInstructorInput(input);

  // Check if slug already exists
  const existing = await prisma.instructor.findUnique({
    where: { slug: input.slug },
  });

  if (existing) {
    throw new Error(`Instructor with slug "${input.slug}" already exists`);
  }

  return prisma.instructor.create({
    data: {
      name: input.name,
      slug: input.slug,
      bio: input.bio ?? null,
      email: input.email ?? null,
      institution: input.institution ?? null,
      credentials: input.credentials ?? null,
      imageUrl: input.imageUrl ?? null,
    },
  });
}

/**
 * Get instructor by ID
 */
export async function getInstructor(
  prisma: PrismaClient,
  instructorId: string
): Promise<Instructor | null> {
  return prisma.instructor.findUnique({
    where: { id: instructorId },
  });
}

/**
 * Get instructor by slug
 */
export async function getInstructorBySlug(
  prisma: PrismaClient,
  slug: string
): Promise<Instructor | null> {
  return prisma.instructor.findUnique({
    where: { slug },
  });
}

/**
 * List instructors with optional filters
 */
export interface ListInstructorsOptions {
  institution?: string;
  limit?: number;
  offset?: number;
}

export async function listInstructors(
  prisma: PrismaClient,
  options?: ListInstructorsOptions
): Promise<{ instructors: Instructor[]; total: number }> {
  const where: any = {};

  if (options?.institution) {
    where.institution = options.institution;
  }

  const [instructors, total] = await Promise.all([
    prisma.instructor.findMany({
      where,
      take: options?.limit,
      skip: options?.offset,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.instructor.count({ where }),
  ]);

  return { instructors, total };
}

/**
 * Update instructor
 */
export async function updateInstructor(
  prisma: PrismaClient,
  instructorId: string,
  updates: Partial<InstructorInput>
): Promise<Instructor> {
  if (updates.slug) {
    if (!/^[a-z0-9-]+$/.test(updates.slug)) {
      throw new Error('slug must contain only lowercase letters, numbers, and hyphens');
    }
    // Check if slug is already taken by another instructor
    const existing = await prisma.instructor.findUnique({
      where: { slug: updates.slug },
    });
    if (existing && existing.id !== instructorId) {
      throw new Error(`Instructor with slug "${updates.slug}" already exists`);
    }
  }
  if (updates.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updates.email)) {
    throw new Error('email must be a valid email address');
  }

  return prisma.instructor.update({
    where: { id: instructorId },
    data: {
      ...(updates.name && { name: updates.name }),
      ...(updates.slug && { slug: updates.slug }),
      ...(updates.bio !== undefined && { bio: updates.bio ?? null }),
      ...(updates.email !== undefined && { email: updates.email ?? null }),
      ...(updates.institution !== undefined && { institution: updates.institution ?? null }),
      ...(updates.credentials !== undefined && { credentials: updates.credentials ?? null }),
      ...(updates.imageUrl !== undefined && { imageUrl: updates.imageUrl ?? null }),
    },
  });
}

/**
 * Delete instructor
 */
export async function deleteInstructor(
  prisma: PrismaClient,
  instructorId: string
): Promise<Instructor> {
  return prisma.instructor.delete({
    where: { id: instructorId },
  });
}

