/**
 * B249B-LRN-017: CourseRecommendationService
 *
 * Suggests courses based on user interests, tags, and completed courses;
 * uses simple heuristic (e.g., matching tags or category popularity);
 * ensures no ranking of users
 */

import { PrismaClient } from '@prisma/client';

export interface CourseRecommendation {
  courseId: string;
  courseTitle: string;
  score: number;
  reason: string;
}

export interface RecommendationOptions {
  limit?: number;
  excludeEnrolled?: boolean;
  excludeCompleted?: boolean;
}

export class CourseRecommendationService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get course recommendations for a user
   */
  async getRecommendations(
    userId: string,
    options: RecommendationOptions = {}
  ): Promise<CourseRecommendation[]> {
    const limit = options.limit || 10;

    // Get user's completed courses and their tags
    const userEnrollments = await this.prisma.enrollment.findMany({
      where: {
        userId,
        status: { in: ['completed', 'enrolled'] },
      },
      include: {
        course: {
          select: {
            id: true,
            tags: true,
            categoryId: true,
          },
        },
      },
    });

    const completedCourseIds = new Set(
      userEnrollments.filter((e) => e.status === 'completed').map((e) => e.courseId)
    );
    const enrolledCourseIds = new Set(userEnrollments.map((e) => e.courseId));

    // Collect tags from completed courses
    const userTags = new Set<string>();
    const userCategories = new Set<string>();

    for (const enrollment of userEnrollments) {
      if (enrollment.course.tags) {
        enrollment.course.tags.forEach((tag) => userTags.add(tag));
      }
      if (enrollment.course.categoryId) {
        userCategories.add(enrollment.course.categoryId);
      }
    }

    // Get all published courses
    const allCourses = await this.prisma.course.findMany({
      where: {
        status: 'published',
      },
      include: {
        enrollments: {
          where: {
            status: 'completed',
          },
        },
      },
    });

    // Score courses based on heuristics
    const scoredCourses: CourseRecommendation[] = [];

    for (const course of allCourses) {
      // Skip if should be excluded
      if (options.excludeEnrolled && enrolledCourseIds.has(course.id)) {
        continue;
      }
      if (options.excludeCompleted && completedCourseIds.has(course.id)) {
        continue;
      }

      let score = 0;
      const reasons: string[] = [];

      // Score based on tag matching
      if (course.tags && course.tags.length > 0) {
        const matchingTags = course.tags.filter((tag) => userTags.has(tag));
        if (matchingTags.length > 0) {
          score += matchingTags.length * 10;
          reasons.push(`Matches ${matchingTags.length} of your interests`);
        }
      }

      // Score based on category matching
      if (course.categoryId && userCategories.has(course.categoryId)) {
        score += 15;
        reasons.push('Similar to courses you\'ve taken');
      }

      // Score based on popularity (completion count)
      const completionCount = course.enrollments.length;
      if (completionCount > 0) {
        score += Math.min(completionCount, 20); // Cap at 20 points
        if (completionCount > 10) {
          reasons.push('Popular course');
        }
      }

      // Boost score for courses with prerequisites that user has completed
      const prerequisites = await this.prisma.coursePrerequisite.findMany({
        where: {
          courseId: course.id,
        },
      });

      if (prerequisites.length > 0) {
        const completedPrerequisites = prerequisites.filter((p) =>
          completedCourseIds.has(p.prerequisiteId)
        );
        if (completedPrerequisites.length === prerequisites.length) {
          score += 25;
          reasons.push('You\'ve completed the prerequisites');
        }
      }

      // Only include courses with some score
      if (score > 0) {
        scoredCourses.push({
          courseId: course.id,
          courseTitle: course.title,
          score,
          reason: reasons.join('; ') || 'Recommended for you',
        });
      }
    }

    // Sort by score (descending) and return top N
    return scoredCourses
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Get recommendations based on a specific course (similar courses)
   */
  async getSimilarCourses(courseId: string, limit: number = 5): Promise<CourseRecommendation[]> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        tags: true,
        categoryId: true,
      },
    });

    if (!course) {
      return [];
    }

    const allCourses = await this.prisma.course.findMany({
      where: {
        status: 'published',
        id: { not: courseId },
      },
    });

    const scoredCourses: CourseRecommendation[] = [];

    for (const otherCourse of allCourses) {
      let score = 0;
      const reasons: string[] = [];

      // Score based on tag overlap
      if (course.tags && otherCourse.tags) {
        const courseTags = new Set(course.tags);
        const otherTags = new Set(otherCourse.tags);
        const overlap = [...courseTags].filter((tag) => otherTags.has(tag)).length;
        if (overlap > 0) {
          score += overlap * 10;
          reasons.push(`Shares ${overlap} tags`);
        }
      }

      // Score based on same category
      if (course.categoryId && course.categoryId === otherCourse.categoryId) {
        score += 15;
        reasons.push('Same category');
      }

      if (score > 0) {
        scoredCourses.push({
          courseId: otherCourse.id,
          courseTitle: otherCourse.title,
          score,
          reason: reasons.join('; ') || 'Similar course',
        });
      }
    }

    return scoredCourses.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  /**
   * Get popular courses (not personalized)
   */
  async getPopularCourses(limit: number = 10): Promise<CourseRecommendation[]> {
    const courses = await this.prisma.course.findMany({
      where: {
        status: 'published',
      },
      include: {
        enrollments: {
          where: {
            status: 'completed',
          },
        },
      },
      orderBy: {
        enrollments: {
          _count: 'desc',
        },
      },
      take: limit,
    });

    return courses.map((course) => ({
      courseId: course.id,
      courseTitle: course.title,
      score: course.enrollments.length,
      reason: `${course.enrollments.length} completions`,
    }));
  }
}

