/**
 * B249B-LRN-020: ContinuingEducationTrackingService
 *
 * Tallies CEUs completed per user against profession requirements;
 * notifies user when they are close to meeting requirements;
 * provides summary; ensures not used for credentialing decisions
 */

import { PrismaClient } from '@prisma/client';
import { emitEvent } from '../../../backend/src/agents/bus';

export interface CEURequirement {
  id: string;
  profession: string;
  requirementName: string;
  creditHoursRequired: number;
  period: 'YEARLY' | 'BIANNUAL';
}

export interface CEUTracking {
  id: string;
  userId: string;
  requirementId: string;
  creditHoursCompleted: number;
  creditHoursRequired: number;
  periodStart: Date;
  periodEnd: Date;
  progressPercent: number;
  notifiedAt: Date | null;
}

export interface CEUSummary {
  userId: string;
  profession: string;
  requirements: Array<{
    requirementName: string;
    creditHoursRequired: number;
    creditHoursCompleted: number;
    progressPercent: number;
    periodEnd: Date;
    status: 'met' | 'in_progress' | 'at_risk';
  }>;
  totalCreditHoursCompleted: number;
  totalCreditHoursRequired: number;
  overallProgressPercent: number;
}

export class ContinuingEducationTrackingService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get or create tracking record for a user and requirement
   */
  async getOrCreateTracking(
    userId: string,
    requirementId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<CEUTracking> {
    const existing = await this.prisma.continuingEducationTracking.findUnique({
      where: {
        userId_requirementId_periodStart: {
          userId,
          requirementId,
          periodStart,
        },
      },
      include: {
        requirement: true,
      },
    });

    if (existing) {
      return this.mapToCEUTracking(existing);
    }

    const requirement = await this.prisma.continuingEducationRequirement.findUnique({
      where: { id: requirementId },
    });

    if (!requirement) {
      throw new Error(`Requirement not found: ${requirementId}`);
    }

    const tracking = await this.prisma.continuingEducationTracking.create({
      data: {
        userId,
        requirementId,
        periodStart,
        periodEnd,
        creditHoursCompleted: 0,
      },
      include: {
        requirement: true,
      },
    });

    return this.mapToCEUTracking(tracking);
  }

  /**
   * Add completed credit hours from a course completion
   */
  async addCreditHours(
    userId: string,
    courseId: string,
    creditHours: number
  ): Promise<void> {
    // Get user's profession (this would come from user profile in a real system)
    // For now, we'll get all requirements and update tracking for each

    const requirements = await this.prisma.continuingEducationRequirement.findMany();

    for (const requirement of requirements) {
      // Determine current period
      const { periodStart, periodEnd } = this.getCurrentPeriod(requirement.period);

      // Get or create tracking
      const tracking = await this.getOrCreateTracking(
        userId,
        requirement.id,
        periodStart,
        periodEnd
      );

      // Update credit hours
      const updated = await this.prisma.continuingEducationTracking.update({
        where: { id: tracking.id },
        data: {
          creditHoursCompleted: {
            increment: creditHours,
          },
        },
        include: {
          requirement: true,
        },
      });

      // Check if requirement is met or close to deadline
      await this.checkRequirementStatus(userId, updated);
    }
  }

  /**
   * Get CEU summary for a user
   */
  async getCEUSummary(userId: string, profession?: string): Promise<CEUSummary> {
    const where: any = {};
    if (profession) {
      where.profession = profession;
    }

    const requirements = await this.prisma.continuingEducationRequirement.findMany({
      where,
    });

    const summary: CEUSummary = {
      userId,
      profession: profession || 'all',
      requirements: [],
      totalCreditHoursCompleted: 0,
      totalCreditHoursRequired: 0,
      overallProgressPercent: 0,
    };

    for (const requirement of requirements) {
      const { periodStart, periodEnd } = this.getCurrentPeriod(requirement.period);

      const tracking = await this.prisma.continuingEducationTracking.findUnique({
        where: {
          userId_requirementId_periodStart: {
            userId,
            requirementId: requirement.id,
            periodStart,
          },
        },
      });

      const creditHoursCompleted = tracking
        ? Number(tracking.creditHoursCompleted)
        : 0;
      const creditHoursRequired = Number(requirement.creditHoursRequired);
      const progressPercent = creditHoursRequired > 0
        ? (creditHoursCompleted / creditHoursRequired) * 100
        : 0;

      // Determine status
      let status: 'met' | 'in_progress' | 'at_risk';
      const daysUntilDeadline = Math.floor(
        (periodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      if (creditHoursCompleted >= creditHoursRequired) {
        status = 'met';
      } else if (daysUntilDeadline < 30) {
        status = 'at_risk';
      } else {
        status = 'in_progress';
      }

      summary.requirements.push({
        requirementName: requirement.requirementName,
        creditHoursRequired,
        creditHoursCompleted,
        progressPercent,
        periodEnd,
        status,
      });

      summary.totalCreditHoursCompleted += creditHoursCompleted;
      summary.totalCreditHoursRequired += creditHoursRequired;
    }

    summary.overallProgressPercent =
      summary.totalCreditHoursRequired > 0
        ? (summary.totalCreditHoursCompleted / summary.totalCreditHoursRequired) * 100
        : 0;

    return summary;
  }

  /**
   * Check requirement status and send notifications if needed
   */
  private async checkRequirementStatus(
    userId: string,
    tracking: any
  ): Promise<void> {
    const creditHoursCompleted = Number(tracking.creditHoursCompleted);
    const creditHoursRequired = Number(tracking.requirement.creditHoursRequired);
    const progressPercent = creditHoursRequired > 0
      ? (creditHoursCompleted / creditHoursRequired) * 100
      : 0;

    const daysUntilDeadline = Math.floor(
      (tracking.periodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    // Notify if close to deadline and not met
    if (daysUntilDeadline < 30 && creditHoursCompleted < creditHoursRequired) {
      // Check if already notified
      if (!tracking.notifiedAt || daysUntilDeadline < 7) {
        await this.notifyUser(userId, tracking, daysUntilDeadline, progressPercent);
      }
    }

    // Notify if requirement is met
    if (creditHoursCompleted >= creditHoursRequired && !tracking.notifiedAt) {
      await this.notifyUser(userId, tracking, 0, 100, true);
    }
  }

  /**
   * Notify user about CEU status
   */
  private async notifyUser(
    userId: string,
    tracking: any,
    daysUntilDeadline: number,
    progressPercent: number,
    isMet: boolean = false
  ): Promise<void> {
    // Update notifiedAt timestamp
    await this.prisma.continuingEducationTracking.update({
      where: { id: tracking.id },
      data: {
        notifiedAt: new Date(),
      },
    });

    // Emit notification event
    emitEvent({
      type: 'CEU_NOTIFICATION',
      userId,
      requirementId: tracking.requirementId,
      requirementName: tracking.requirement.requirementName,
      creditHoursCompleted: Number(tracking.creditHoursCompleted),
      creditHoursRequired: Number(tracking.requirement.creditHoursRequired),
      daysUntilDeadline,
      progressPercent,
      isMet,
    } as any);
  }

  /**
   * Get current period based on requirement period type
   */
  private getCurrentPeriod(period: 'YEARLY' | 'BIANNUAL'): {
    periodStart: Date;
    periodEnd: Date;
  } {
    const now = new Date();
    let periodStart: Date;
    let periodEnd: Date;

    if (period === 'YEARLY') {
      periodStart = new Date(now.getFullYear(), 0, 1); // January 1st
      periodEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59); // December 31st
    } else {
      // BIANNUAL - split year into two 6-month periods
      const month = now.getMonth();
      if (month < 6) {
        periodStart = new Date(now.getFullYear(), 0, 1); // January 1st
        periodEnd = new Date(now.getFullYear(), 5, 30, 23, 59, 59); // June 30th
      } else {
        periodStart = new Date(now.getFullYear(), 6, 1); // July 1st
        periodEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59); // December 31st
      }
    }

    return { periodStart, periodEnd };
  }

  /**
   * Map database model to CEUTracking interface
   */
  private mapToCEUTracking(tracking: any): CEUTracking {
    const creditHoursRequired = Number(tracking.requirement.creditHoursRequired);
    const creditHoursCompleted = Number(tracking.creditHoursCompleted);
    const progressPercent = creditHoursRequired > 0
      ? (creditHoursCompleted / creditHoursRequired) * 100
      : 0;

    return {
      id: tracking.id,
      userId: tracking.userId,
      requirementId: tracking.requirementId,
      creditHoursCompleted,
      creditHoursRequired,
      periodStart: tracking.periodStart,
      periodEnd: tracking.periodEnd,
      progressPercent,
      notifiedAt: tracking.notifiedAt,
    };
  }
}

