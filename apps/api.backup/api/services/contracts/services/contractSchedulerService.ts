/**
 * B251B-CON-018: ContractSchedulerService
 *
 * Monitors ContractSchedules: sends reminders for upcoming due dates;
 * marks milestones as overdue; triggers notifications;
 * includes cron job or queue; tests cover scheduling edge cases.
 */

import { PrismaClient, MilestoneStatus } from '@prisma/client';
import { ContractNotificationService } from './contractNotificationService.js';
import { getServiceLogger } from '../../logging/serviceLogger.js';

const prisma = new PrismaClient();
const log = getServiceLogger('contracts/scheduler');

export interface ScheduleMilestoneInput {
  contractId: string;
  milestoneName: string;
  dueDate: Date;
}

export class ContractSchedulerService {
  private notificationService: ContractNotificationService;

  constructor() {
    this.notificationService = new ContractNotificationService();
  }

  /**
   * Schedule a milestone for a contract
   */
  async scheduleMilestone(input: ScheduleMilestoneInput): Promise<any> {
    log.info('Scheduling milestone', {
      contractId: input.contractId,
      milestoneName: input.milestoneName,
      dueDate: input.dueDate,
    });

    // Verify contract exists
    const contract = await prisma.contract.findUnique({
      where: { id: input.contractId },
    });

    if (!contract) {
      throw new Error(`Contract ${input.contractId} not found`);
    }

    // Create schedule
    const schedule = await prisma.contractSchedule.create({
      data: {
        contractId: input.contractId,
        milestoneName: input.milestoneName,
        dueDate: input.dueDate,
        status: MilestoneStatus.PENDING,
      },
    });

    log.info('Milestone scheduled', {
      scheduleId: schedule.id,
      contractId: input.contractId,
    });

    return schedule;
  }

  /**
   * Mark milestone as completed
   */
  async completeMilestone(
    scheduleId: string,
    completedAt?: Date
  ): Promise<any> {
    log.info('Completing milestone', { scheduleId });

    const schedule = await prisma.contractSchedule.findUnique({
      where: { id: scheduleId },
      include: { contract: true },
    });

    if (!schedule) {
      throw new Error(`Schedule ${scheduleId} not found`);
    }

    const updated = await prisma.contractSchedule.update({
      where: { id: scheduleId },
      data: {
        status: MilestoneStatus.COMPLETED,
        completedAt: completedAt || new Date(),
      },
    });

    // Send notification
    await this.notificationService.sendNotification(
      schedule.contract.authorId,
      'contract.milestone_completed',
      {
        contractId: schedule.contractId,
        contractTitle: schedule.contract.title,
        milestoneName: schedule.milestoneName,
      }
    );

    log.info('Milestone completed', { scheduleId });
    return updated;
  }

  /**
   * Process upcoming milestones and send reminders
   * This should be called by a cron job or queue worker
   */
  async processUpcomingMilestones(
    daysAhead: number = 7
  ): Promise<{ processed: number; reminders: number }> {
    log.info('Processing upcoming milestones', { daysAhead });

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + daysAhead);

    // Find milestones due within the next N days
    const upcomingMilestones = await prisma.contractSchedule.findMany({
      where: {
        status: MilestoneStatus.PENDING,
        dueDate: {
          lte: cutoffDate,
          gte: new Date(), // Not already past
        },
      },
      include: {
        contract: {
          include: {
            parties: true,
          },
        },
      },
    });

    let remindersSent = 0;

    for (const milestone of upcomingMilestones) {
      // Calculate days until due
      const daysUntilDue = Math.ceil(
        (milestone.dueDate.getTime() - new Date().getTime()) /
          (1000 * 60 * 60 * 24)
      );

      // Send reminder to all parties
      for (const party of milestone.contract.parties) {
        if (party.contactEmail) {
          await this.notificationService.sendNotification(
            party.contactEmail,
            'contract.milestone_reminder',
            {
              contractId: milestone.contractId,
              contractTitle: milestone.contract.title,
              milestoneName: milestone.milestoneName,
              dueDate: milestone.dueDate,
              daysUntilDue,
            }
          );
        }
      }

      // Send reminder to contract author
      await this.notificationService.sendNotification(
        milestone.contract.authorId,
        'contract.milestone_reminder',
        {
          contractId: milestone.contractId,
          contractTitle: milestone.contract.title,
          milestoneName: milestone.milestoneName,
          dueDate: milestone.dueDate,
          daysUntilDue,
        }
      );

      remindersSent++;
    }

    log.info('Upcoming milestones processed', {
      processed: upcomingMilestones.length,
      reminders: remindersSent,
    });

    return {
      processed: upcomingMilestones.length,
      reminders: remindersSent,
    };
  }

  /**
   * Mark overdue milestones
   */
  async markOverdueMilestones(): Promise<{ marked: number }> {
    log.info('Marking overdue milestones');

    const now = new Date();

    // Find overdue milestones
    const overdue = await prisma.contractSchedule.findMany({
      where: {
        status: MilestoneStatus.PENDING,
        dueDate: {
          lt: now,
        },
      },
      include: {
        contract: {
          include: {
            parties: true,
          },
        },
      },
    });

    let marked = 0;

    for (const milestone of overdue) {
      // Mark as overdue (we could add an OVERDUE status, but for now we'll just notify)
      // In production, you might want to add an OVERDUE status to MilestoneStatus enum

      // Send overdue notification
      for (const party of milestone.contract.parties) {
        if (party.contactEmail) {
          await this.notificationService.sendNotification(
            party.contactEmail,
            'contract.milestone_overdue',
            {
              contractId: milestone.contractId,
              contractTitle: milestone.contract.title,
              milestoneName: milestone.milestoneName,
              dueDate: milestone.dueDate,
            }
          );
        }
      }

      // Notify contract author
      await this.notificationService.sendNotification(
        milestone.contract.authorId,
        'contract.milestone_overdue',
        {
          contractId: milestone.contractId,
          contractTitle: milestone.contract.title,
          milestoneName: milestone.milestoneName,
          dueDate: milestone.dueDate,
        }
      );

      marked++;
    }

    log.info('Overdue milestones marked', { marked });
    return { marked };
  }

  /**
   * Get schedules for a contract
   */
  async getSchedules(contractId: string): Promise<any[]> {
    return prisma.contractSchedule.findMany({
      where: { contractId },
      orderBy: { dueDate: 'asc' },
    });
  }

  /**
   * Get upcoming schedules across all contracts
   */
  async getUpcomingSchedules(
    daysAhead: number = 30
  ): Promise<any[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + daysAhead);

    return prisma.contractSchedule.findMany({
      where: {
        status: MilestoneStatus.PENDING,
        dueDate: {
          lte: cutoffDate,
          gte: new Date(),
        },
      },
      include: {
        contract: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    });
  }
}

// Export singleton instance
export const contractSchedulerService = new ContractSchedulerService();

