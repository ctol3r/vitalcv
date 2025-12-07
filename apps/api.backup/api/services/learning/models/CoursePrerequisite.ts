/**
 * B249A-LRN-008: CoursePrerequisite Model
 *
 * Model for course prerequisites with cycle prevention
 */

import { PrismaClient } from '@prisma/client';

export interface CoursePrerequisiteInput {
  courseId: string;
  prerequisiteCourseId: string;
}

export interface CoursePrerequisite {
  id: string;
  courseId: string;
  prerequisiteCourseId: string;
  createdAt: Date;
}

/**
 * Validate prerequisite input
 */
export function validatePrerequisiteInput(input: CoursePrerequisiteInput): void {
  if (!input.courseId || input.courseId.trim().length === 0) {
    throw new Error('courseId is required');
  }
  if (!input.prerequisiteCourseId || input.prerequisiteCourseId.trim().length === 0) {
    throw new Error('prerequisiteCourseId is required');
  }
  if (input.courseId === input.prerequisiteCourseId) {
    throw new Error('Course cannot be a prerequisite of itself');
  }
}

/**
 * Check for cycles in prerequisite chain
 */
async function checkPrerequisiteCycle(
  prisma: PrismaClient,
  courseId: string,
  prerequisiteId: string
): Promise<void> {
  // Check if adding this prerequisite would create a cycle
  // We need to check if prerequisiteId has courseId as a prerequisite (directly or indirectly)
  const visited = new Set<string>([courseId]);
  const queue: string[] = [prerequisiteId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;

    if (visited.has(currentId)) {
      throw new Error('Creating this prerequisite would create a cycle in the prerequisite chain');
    }

    visited.add(currentId);

    // Get all prerequisites of current course
    const prerequisites = await prisma.coursePrerequisite.findMany({
      where: { courseId: currentId },
      select: { prerequisiteId: true },
    });

    for (const prereq of prerequisites) {
      if (prereq.prerequisiteId === courseId) {
        throw new Error('Creating this prerequisite would create a cycle in the prerequisite chain');
      }
      queue.push(prereq.prerequisiteId);
    }
  }
}

/**
 * Create course prerequisite
 */
export async function createCoursePrerequisite(
  prisma: PrismaClient,
  input: CoursePrerequisiteInput
): Promise<CoursePrerequisite> {
  validatePrerequisiteInput(input);

  // Verify both courses exist
  const [course, prerequisite] = await Promise.all([
    prisma.course.findUnique({ where: { id: input.courseId } }),
    prisma.course.findUnique({ where: { id: input.prerequisiteCourseId } }),
  ]);

  if (!course) {
    throw new Error(`Course with id "${input.courseId}" does not exist`);
  }
  if (!prerequisite) {
    throw new Error(`Prerequisite course with id "${input.prerequisiteCourseId}" does not exist`);
  }

  // Check if prerequisite already exists
  const existing = await prisma.coursePrerequisite.findFirst({
    where: {
      courseId: input.courseId,
      prerequisiteId: input.prerequisiteCourseId,
    },
  });

  if (existing) {
    throw new Error('This prerequisite relationship already exists');
  }

  // Check for cycles
  await checkPrerequisiteCycle(prisma, input.courseId, input.prerequisiteCourseId);

  return prisma.coursePrerequisite.create({
    data: {
      courseId: input.courseId,
      prerequisiteId: input.prerequisiteCourseId,
    },
  });
}

/**
 * Get prerequisite by ID
 */
export async function getCoursePrerequisite(
  prisma: PrismaClient,
  prerequisiteId: string
): Promise<CoursePrerequisite | null> {
  return prisma.coursePrerequisite.findUnique({
    where: { id: prerequisiteId },
  });
}

/**
 * Get prerequisites for a course
 */
export async function getCoursePrerequisites(
  prisma: PrismaClient,
  courseId: string
): Promise<CoursePrerequisite[]> {
  return prisma.coursePrerequisite.findMany({
    where: { courseId },
    include: {
      prerequisite: true,
    },
  });
}

/**
 * Get courses that require this course as a prerequisite
 */
export async function getCoursesRequiringPrerequisite(
  prisma: PrismaClient,
  prerequisiteCourseId: string
): Promise<CoursePrerequisite[]> {
  return prisma.coursePrerequisite.findMany({
    where: { prerequisiteId: prerequisiteCourseId },
    include: {
      course: true,
    },
  });
}

/**
 * Delete course prerequisite
 */
export async function deleteCoursePrerequisite(
  prisma: PrismaClient,
  prerequisiteId: string
): Promise<CoursePrerequisite> {
  return prisma.coursePrerequisite.delete({
    where: { id: prerequisiteId },
  });
}

/**
 * Delete prerequisite by course and prerequisite course IDs
 */
export async function deletePrerequisiteByCourseIds(
  prisma: PrismaClient,
  courseId: string,
  prerequisiteCourseId: string
): Promise<void> {
  await prisma.coursePrerequisite.deleteMany({
    where: {
      courseId,
      prerequisiteId: prerequisiteCourseId,
    },
  });
}

