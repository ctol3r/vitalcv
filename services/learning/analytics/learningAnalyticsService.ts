/**
 * B249B-LRN-015: LearningAnalyticsService
 *
 * Aggregates data: enrollment counts, completion rates, time to completion;
 * anonymizes data; generates reports for admin dashboards
 */

import { PrismaClient } from '@prisma/client';

export interface EnrollmentStats {
  totalEnrollments: number;
  activeEnrollments: number;
  completedEnrollments: number;
  cancelledEnrollments: number;
}

export interface CompletionStats {
  completionRate: number;
  averageTimeToCompletion: number; // in days
  medianTimeToCompletion: number; // in days
}

export interface CourseAnalytics {
  courseId: string;
  courseTitle: string;
  enrollmentCount: number;
  completionCount: number;
  completionRate: number;
  averageProgress: number;
  averageTimeToCompletion: number | null;
}

export interface UserAnalytics {
  userId: string; // Anonymized
  enrollmentsCount: number;
  completionsCount: number;
  averageProgress: number;
  totalCreditHours: number;
}

export interface AdminReport {
  period: {
    start: Date;
    end: Date;
  };
  overallStats: {
    enrollments: EnrollmentStats;
    completions: CompletionStats;
  };
  courseAnalytics: CourseAnalytics[];
  topCourses: CourseAnalytics[];
  anonymizedUserAnalytics: UserAnalytics[];
}

export class LearningAnalyticsService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get overall enrollment statistics
   */
  async getEnrollmentStats(startDate?: Date, endDate?: Date): Promise<EnrollmentStats> {
    const where: any = {};
    if (startDate || endDate) {
      where.enrolledAt = {};
      if (startDate) where.enrolledAt.gte = startDate;
      if (endDate) where.enrolledAt.lte = endDate;
    }

    const [total, active, completed, cancelled] = await Promise.all([
      this.prisma.enrollment.count({ where }),
      this.prisma.enrollment.count({ where: { ...where, status: 'enrolled' } }),
      this.prisma.enrollment.count({ where: { ...where, status: 'completed' } }),
      this.prisma.enrollment.count({ where: { ...where, status: 'cancelled' } }),
    ]);

    return {
      totalEnrollments: total,
      activeEnrollments: active,
      completedEnrollments: completed,
      cancelledEnrollments: cancelled,
    };
  }

  /**
   * Get completion statistics
   */
  async getCompletionStats(startDate?: Date, endDate?: Date): Promise<CompletionStats> {
    const where: any = {
      status: 'completed',
    };

    if (startDate || endDate) {
      where.completedAt = {};
      if (startDate) where.completedAt.gte = startDate;
      if (endDate) where.completedAt.lte = endDate;
    }

    const completedEnrollments = await this.prisma.enrollment.findMany({
      where,
      select: {
        enrolledAt: true,
        completedAt: true,
      },
    });

    if (completedEnrollments.length === 0) {
      return {
        completionRate: 0,
        averageTimeToCompletion: 0,
        medianTimeToCompletion: 0,
      };
    }

    // Calculate time to completion for each enrollment
    const timesToCompletion = completedEnrollments
      .filter((e) => e.completedAt)
      .map((e) => {
        const days = Math.floor(
          (e.completedAt!.getTime() - e.enrolledAt.getTime()) / (1000 * 60 * 60 * 24)
        );
        return days;
      });

    const averageTime = timesToCompletion.reduce((sum, days) => sum + days, 0) / timesToCompletion.length;
    const sortedTimes = [...timesToCompletion].sort((a, b) => a - b);
    const medianTime = sortedTimes[Math.floor(sortedTimes.length / 2)];

    // Calculate overall completion rate
    const totalEnrollments = await this.prisma.enrollment.count({
      where: startDate || endDate
        ? {
            enrolledAt: {
              ...(startDate && { gte: startDate }),
              ...(endDate && { lte: endDate }),
            },
          }
        : {},
    });

    const completionRate = totalEnrollments > 0 ? (completedEnrollments.length / totalEnrollments) * 100 : 0;

    return {
      completionRate,
      averageTimeToCompletion: averageTime,
      medianTimeToCompletion: medianTime,
    };
  }

  /**
   * Get analytics for all courses
   */
  async getCourseAnalytics(startDate?: Date, endDate?: Date): Promise<CourseAnalytics[]> {
    const courses = await this.prisma.course.findMany({
      include: {
        enrollments: {
          where: startDate || endDate
            ? {
                enrolledAt: {
                  ...(startDate && { gte: startDate }),
                  ...(endDate && { lte: endDate }),
                },
              }
            : {},
        },
      },
    });

    return courses.map((course) => {
      const enrollments = course.enrollments;
      const completed = enrollments.filter((e) => e.status === 'completed');
      const totalProgress = enrollments.reduce((sum, e) => sum + Number(e.progressPercent), 0);
      const averageProgress = enrollments.length > 0 ? totalProgress / enrollments.length : 0;

      // Calculate average time to completion
      const completedWithDates = completed.filter((e) => e.completedAt);
      const timesToCompletion = completedWithDates.map((e) => {
        return Math.floor(
          (e.completedAt!.getTime() - e.enrolledAt.getTime()) / (1000 * 60 * 60 * 24)
        );
      });
      const averageTimeToCompletion =
        timesToCompletion.length > 0
          ? timesToCompletion.reduce((sum, days) => sum + days, 0) / timesToCompletion.length
          : null;

      return {
        courseId: course.id,
        courseTitle: course.title,
        enrollmentCount: enrollments.length,
        completionCount: completed.length,
        completionRate: enrollments.length > 0 ? (completed.length / enrollments.length) * 100 : 0,
        averageProgress,
        averageTimeToCompletion,
      };
    });
  }

  /**
   * Get anonymized user analytics
   */
  async getAnonymizedUserAnalytics(startDate?: Date, endDate?: Date): Promise<UserAnalytics[]> {
    const where: any = {};
    if (startDate || endDate) {
      where.enrolledAt = {};
      if (startDate) where.enrolledAt.gte = startDate;
      if (endDate) where.enrolledAt.lte = endDate;
    }

    const enrollments = await this.prisma.enrollment.findMany({
      where,
      include: {
        course: true,
      },
    });

    // Group by user and aggregate
    const userMap = new Map<string, UserAnalytics>();

    for (const enrollment of enrollments) {
      const existing = userMap.get(enrollment.userId);
      const creditHours = Number(enrollment.course.creditHours);
      const progress = Number(enrollment.progressPercent);

      if (existing) {
        existing.enrollmentsCount += 1;
        if (enrollment.status === 'completed') {
          existing.completionsCount += 1;
          existing.totalCreditHours += creditHours;
        }
        existing.averageProgress =
          (existing.averageProgress * (existing.enrollmentsCount - 1) + progress) /
          existing.enrollmentsCount;
      } else {
        userMap.set(enrollment.userId, {
          userId: this.anonymizeUserId(enrollment.userId),
          enrollmentsCount: 1,
          completionsCount: enrollment.status === 'completed' ? 1 : 0,
          averageProgress: progress,
          totalCreditHours: enrollment.status === 'completed' ? creditHours : 0,
        });
      }
    }

    return Array.from(userMap.values());
  }

  /**
   * Generate comprehensive admin report
   */
  async generateAdminReport(startDate?: Date, endDate?: Date): Promise<AdminReport> {
    const [enrollmentStats, completionStats, courseAnalytics, anonymizedUserAnalytics] =
      await Promise.all([
        this.getEnrollmentStats(startDate, endDate),
        this.getCompletionStats(startDate, endDate),
        this.getCourseAnalytics(startDate, endDate),
        this.getAnonymizedUserAnalytics(startDate, endDate),
      ]);

    // Sort courses by enrollment count for top courses
    const topCourses = [...courseAnalytics]
      .sort((a, b) => b.enrollmentCount - a.enrollmentCount)
      .slice(0, 10);

    return {
      period: {
        start: startDate || new Date(0),
        end: endDate || new Date(),
      },
      overallStats: {
        enrollments: enrollmentStats,
        completions: completionStats,
      },
      courseAnalytics,
      topCourses,
      anonymizedUserAnalytics,
    };
  }

  /**
   * Anonymize user ID for privacy
   */
  private anonymizeUserId(userId: string): string {
    // Simple hash-based anonymization (in production, use a proper hashing algorithm)
    // This is just for demonstration - use a proper anonymization strategy
    const hash = userId.split('').reduce((acc, char) => {
      return ((acc << 5) - acc + char.charCodeAt(0)) | 0;
    }, 0);
    return `user_${Math.abs(hash).toString(36)}`;
  }
}

