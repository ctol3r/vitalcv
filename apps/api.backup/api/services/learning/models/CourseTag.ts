/**
 * B249A-LRN-006: CourseTag Model
 *
 * Model for course tags with many-to-many relationship
 */

import { PrismaClient } from '@prisma/client';

export interface CourseTagInput {
  name: string;
  slug: string;
  description?: string;
}

export interface CourseTag {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Validate course tag input
 */
export function validateCourseTagInput(input: CourseTagInput): void {
  if (!input.name || input.name.trim().length === 0) {
    throw new Error('name is required');
  }
  if (!input.slug || input.slug.trim().length === 0) {
    throw new Error('slug is required');
  }
  if (!/^[a-z0-9-]+$/.test(input.slug)) {
    throw new Error('slug must contain only lowercase letters, numbers, and hyphens');
  }
}

/**
 * Create course tag
 */
export async function createCourseTag(
  prisma: PrismaClient,
  input: CourseTagInput
): Promise<CourseTag> {
  validateCourseTagInput(input);

  // Check if slug already exists
  const existing = await prisma.courseTag.findUnique({
    where: { slug: input.slug },
  });

  if (existing) {
    throw new Error(`Course tag with slug "${input.slug}" already exists`);
  }

  return prisma.courseTag.create({
    data: {
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
    },
  });
}

/**
 * Get course tag by ID
 */
export async function getCourseTag(
  prisma: PrismaClient,
  tagId: string
): Promise<CourseTag | null> {
  return prisma.courseTag.findUnique({
    where: { id: tagId },
  });
}

/**
 * Get course tag by slug
 */
export async function getCourseTagBySlug(
  prisma: PrismaClient,
  slug: string
): Promise<CourseTag | null> {
  return prisma.courseTag.findUnique({
    where: { slug },
  });
}

/**
 * List course tags
 */
export interface ListCourseTagsOptions {
  limit?: number;
  offset?: number;
}

export async function listCourseTags(
  prisma: PrismaClient,
  options?: ListCourseTagsOptions
): Promise<{ tags: CourseTag[]; total: number }> {
  const [tags, total] = await Promise.all([
    prisma.courseTag.findMany({
      take: options?.limit,
      skip: options?.offset,
      orderBy: { name: 'asc' },
    }),
    prisma.courseTag.count(),
  ]);

  return { tags, total };
}

/**
 * Update course tag
 */
export async function updateCourseTag(
  prisma: PrismaClient,
  tagId: string,
  updates: Partial<CourseTagInput>
): Promise<CourseTag> {
  if (updates.slug) {
    if (!/^[a-z0-9-]+$/.test(updates.slug)) {
      throw new Error('slug must contain only lowercase letters, numbers, and hyphens');
    }
    // Check if slug is already taken by another tag
    const existing = await prisma.courseTag.findUnique({
      where: { slug: updates.slug },
    });
    if (existing && existing.id !== tagId) {
      throw new Error(`Course tag with slug "${updates.slug}" already exists`);
    }
  }

  return prisma.courseTag.update({
    where: { id: tagId },
    data: {
      ...(updates.name && { name: updates.name }),
      ...(updates.slug && { slug: updates.slug }),
      ...(updates.description !== undefined && { description: updates.description ?? null }),
    },
  });
}

/**
 * Delete course tag
 */
export async function deleteCourseTag(
  prisma: PrismaClient,
  tagId: string
): Promise<CourseTag> {
  // Remove all tag mappings first
  await prisma.courseTagMap.deleteMany({
    where: { tagId },
  });

  return prisma.courseTag.delete({
    where: { id: tagId },
  });
}

/**
 * Add tag to course (many-to-many)
 */
export async function addTagToCourse(
  prisma: PrismaClient,
  courseId: string,
  tagId: string
): Promise<void> {
  // Verify course and tag exist
  const [course, tag] = await Promise.all([
    prisma.course.findUnique({ where: { id: courseId } }),
    prisma.courseTag.findUnique({ where: { id: tagId } }),
  ]);

  if (!course) {
    throw new Error(`Course with id "${courseId}" does not exist`);
  }
  if (!tag) {
    throw new Error(`Tag with id "${tagId}" does not exist`);
  }

  // Check if mapping already exists
  const existing = await prisma.courseTagMap.findUnique({
    where: {
      courseId_tagId: {
        courseId,
        tagId,
      },
    },
  });

  if (existing) {
    return; // Already mapped
  }

  await prisma.courseTagMap.create({
    data: {
      courseId,
      tagId,
    },
  });
}

/**
 * Remove tag from course
 */
export async function removeTagFromCourse(
  prisma: PrismaClient,
  courseId: string,
  tagId: string
): Promise<void> {
  await prisma.courseTagMap.deleteMany({
    where: {
      courseId,
      tagId,
    },
  });
}

/**
 * Get tags for a course
 */
export async function getCourseTags(
  prisma: PrismaClient,
  courseId: string
): Promise<CourseTag[]> {
  const mappings = await prisma.courseTagMap.findMany({
    where: { courseId },
    include: {
      tag: true,
    },
  });

  return mappings.map((m) => m.tag);
}

