/**
 * B233A-CAREER-003: CareerProgressionService
 *
 * Calculates career progress metrics: completed courses vs goals, upcoming expirations;
 * suggests next credentials based on public data and personal goals;
 * does NOT use sensitive personal attributes
 */

import { PrismaClient } from '@prisma/client';
import { getCareerProfile, CareerProfile, CareerGoals } from './models/CareerProfile';
import { getTrainingCourse, TrainingCourse } from './models/TrainingCourse';

export interface CareerProgressMetrics {
  userId: string;
  completedCourses: number;
  totalCredits: number;
  coursesInProgress: number;
  upcomingExpirations: number;
  progressPercentage: number;
  suggestedCredentials: SuggestedCredential[];
}

export interface SuggestedCredential {
  credentialName: string;
  reason: string;
  requiredCourses?: string[];
  estimatedCredits?: number;
}

export interface CourseExpiration {
  courseId: string;
  courseTitle: string;
  expiresAt: Date | null;
  daysUntilExpiration: number | null;
}

export class CareerProgressionService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Calculate career progress metrics for a user
   */
  async calculateProgress(userId: string): Promise<CareerProgressMetrics> {
    const profile = await getCareerProfile(this.prisma, userId);
    if (!profile) {
      throw new Error(`Career profile not found for user ${userId}`);
    }

    // Get all enrollments for the user
    const enrollments = await this.prisma.trainingEnrollment.findMany({
      where: { userId },
      include: { course: true },
    });

    const completedCourses = enrollments.filter((e) => e.status === 'completed').length;
    const coursesInProgress = enrollments.filter((e) => e.status === 'enrolled').length;
    const totalCredits = profile.trainingCredits;

    // Calculate progress percentage based on career goals
    const progressPercentage = this.calculateProgressPercentage(profile, enrollments);

    // Get upcoming expirations (if courses have expiration dates)
    const upcomingExpirations = await this.getUpcomingExpirations(userId);

    // Suggest next credentials based on goals and completed courses
    const suggestedCredentials = await this.suggestCredentials(profile, enrollments);

    return {
      userId,
      completedCourses,
      totalCredits,
      coursesInProgress,
      upcomingExpirations: upcomingExpirations.length,
      progressPercentage,
      suggestedCredentials,
    };
  }

  /**
   * Get upcoming course expirations
   */
  async getUpcomingExpirations(userId: string, daysAhead: number = 90): Promise<CourseExpiration[]> {
    const enrollments = await this.prisma.trainingEnrollment.findMany({
      where: {
        userId,
        status: 'completed',
      },
      include: { course: true },
    });

    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(now.getDate() + daysAhead);

    // Note: TrainingCourse doesn't have expiration dates in the schema,
    // but we can check if credentials have expiration dates
    // For now, we'll return empty array as courses don't expire
    // This can be extended if credential expiration tracking is added
    return [];
  }

  /**
   * Calculate progress percentage based on career goals
   */
  private calculateProgressPercentage(
    profile: CareerProfile,
    enrollments: Array<{ status: string; course: TrainingCourse }>
  ): number {
    const goals = profile.careerGoals as CareerGoals | null;
    if (!goals || !goals.targetRoles || goals.targetRoles.length === 0) {
      // If no specific goals, base progress on completed courses
      const completedCount = enrollments.filter((e) => e.status === 'completed').length;
      return Math.min(100, (completedCount / 10) * 100); // Assume 10 courses = 100%
    }

    // Count courses that align with target roles/specialties
    const targetRoles = goals.targetRoles || [];
    const targetSpecialties = goals.targetSpecialties || [];

    const relevantCourses = enrollments.filter((e) => {
      if (e.status !== 'completed') return false;
      const course = e.course;
      // Check if course tags match target roles or specialties
      return (
        course.tags.some((tag) => targetRoles.includes(tag)) ||
        course.tags.some((tag) => targetSpecialties.includes(tag))
      );
    });

    // Progress is based on relevant courses completed vs target
    const targetCourseCount = Math.max(5, targetRoles.length * 2); // Estimate target courses
    return Math.min(100, (relevantCourses.length / targetCourseCount) * 100);
  }

  /**
   * Suggest next credentials based on public data and personal goals
   * Does NOT use sensitive personal attributes
   */
  async suggestCredentials(
    profile: CareerProfile,
    enrollments: Array<{ status: string; course: TrainingCourse }>
  ): Promise<SuggestedCredential[]> {
    const suggestions: SuggestedCredential[] = [];
    const goals = profile.careerGoals as CareerGoals | null;

    if (!goals) {
      return suggestions;
    }

    const completedCourseIds = enrollments
      .filter((e) => e.status === 'completed')
      .map((e) => e.courseId);

    // Get all available courses
    const allCourses = await this.prisma.trainingCourse.findMany({
      where: {
        tags: {
          hasSome: profile.preferredRoles.length > 0 ? profile.preferredRoles : [],
        },
      },
    });

    // Suggest credentials based on target roles
    if (goals.targetRoles && goals.targetRoles.length > 0) {
      for (const targetRole of goals.targetRoles) {
        // Find courses that lead to this role but haven't been completed
        const relevantCourses = allCourses.filter(
          (course) =>
            course.tags.includes(targetRole) && !completedCourseIds.includes(course.id)
        );

        if (relevantCourses.length > 0) {
          const credentialName = `${targetRole} Certification`;
          const requiredCourses = relevantCourses.slice(0, 3).map((c) => c.title);
          const estimatedCredits = relevantCourses.reduce((sum, c) => sum + c.creditHours, 0);

          suggestions.push({
            credentialName,
            reason: `Based on your goal to pursue ${targetRole} role`,
            requiredCourses,
            estimatedCredits,
          });
        }
      }
    }

    // Suggest credentials based on specialty
    if (profile.speciality) {
      const specialtyCourses = allCourses.filter(
        (course) =>
          course.tags.includes(profile.speciality!) && !completedCourseIds.includes(course.id)
      );

      if (specialtyCourses.length > 0) {
        const credentialName = `${profile.speciality} Advanced Certification`;
        const requiredCourses = specialtyCourses.slice(0, 2).map((c) => c.title);
        const estimatedCredits = specialtyCourses.reduce((sum, c) => sum + c.creditHours, 0);

        suggestions.push({
          credentialName,
          reason: `Based on your specialty in ${profile.speciality}`,
          requiredCourses,
          estimatedCredits,
        });
      }
    }

    return suggestions.slice(0, 5); // Return top 5 suggestions
  }

  /**
   * Get courses that align with career goals
   */
  async getRecommendedCourses(userId: string, limit: number = 10): Promise<TrainingCourse[]> {
    const profile = await getCareerProfile(this.prisma, userId);
    if (!profile) {
      throw new Error(`Career profile not found for user ${userId}`);
    }

    const goals = profile.careerGoals as CareerGoals | null;
    const targetTags: string[] = [];

    if (goals?.targetRoles) {
      targetTags.push(...goals.targetRoles);
    }
    if (goals?.targetSpecialties) {
      targetTags.push(...goals.targetSpecialties);
    }
    if (profile.preferredRoles.length > 0) {
      targetTags.push(...profile.preferredRoles);
    }
    if (profile.speciality) {
      targetTags.push(profile.speciality);
    }

    // Get user's completed courses
    const enrollments = await this.prisma.trainingEnrollment.findMany({
      where: { userId },
      select: { courseId: true },
    });
    const completedCourseIds = enrollments.map((e) => e.courseId);

    // Find courses that match tags but haven't been completed
    const courses = await this.prisma.trainingCourse.findMany({
      where: {
        tags: {
          hasSome: targetTags.length > 0 ? targetTags : [],
        },
        id: {
          notIn: completedCourseIds,
        },
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    return courses;
  }
}

