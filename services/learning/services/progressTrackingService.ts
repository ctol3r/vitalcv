/**
 * B249B-LRN-013: ProgressTrackingService
 *
 * Records progress on modules (e.g., percentage watched); updates Enrollment.progressPercent;
 * triggers completion when modules completed; emits events
 */

import { PrismaClient } from '@prisma/client';
import { emitEvent } from '../../../backend/src/agents/bus';

export interface ModuleProgressInput {
  enrollmentId: string;
  moduleId: string;
  progressPercent: number;
  watchedSeconds?: number;
}

export interface ModuleProgress {
  id: string;
  enrollmentId: string;
  moduleId: string;
  progressPercent: number;
  watchedSeconds: number;
  completed: boolean;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class ProgressTrackingService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Record progress on a module
   */
  async recordProgress(input: ModuleProgressInput): Promise<ModuleProgress> {
    // Validate progress percent
    if (input.progressPercent < 0 || input.progressPercent > 100) {
      throw new Error('progressPercent must be between 0 and 100');
    }

    // Check if enrollment exists
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: input.enrollmentId },
      include: {
        course: {
          include: {
            modules: true,
          },
        },
      },
    });

    if (!enrollment) {
      throw new Error(`Enrollment not found: ${input.enrollmentId}`);
    }

    if (enrollment.status !== 'enrolled') {
      throw new Error(`Cannot record progress for enrollment with status: ${enrollment.status}`);
    }

    // Check if module belongs to the course
    const module = enrollment.course.modules.find((m) => m.id === input.moduleId);
    if (!module) {
      throw new Error(`Module ${input.moduleId} does not belong to course ${enrollment.courseId}`);
    }

    // Update or create module progress
    const isCompleted = input.progressPercent >= 100;
    const existingProgress = await this.prisma.moduleProgress.findUnique({
      where: {
        enrollmentId_moduleId: {
          enrollmentId: input.enrollmentId,
          moduleId: input.moduleId,
        },
      },
    });

    let moduleProgress: ModuleProgress;
    if (existingProgress) {
      moduleProgress = await this.prisma.moduleProgress.update({
        where: { id: existingProgress.id },
        data: {
          progressPercent: input.progressPercent,
          watchedSeconds: input.watchedSeconds ?? existingProgress.watchedSeconds,
          completed: isCompleted,
          completedAt: isCompleted && !existingProgress.completed ? new Date() : existingProgress.completedAt,
        },
      });
    } else {
      moduleProgress = await this.prisma.moduleProgress.create({
        data: {
          enrollmentId: input.enrollmentId,
          moduleId: input.moduleId,
          progressPercent: input.progressPercent,
          watchedSeconds: input.watchedSeconds ?? 0,
          completed: isCompleted,
          completedAt: isCompleted ? new Date() : null,
        },
      });
    }

    // Update enrollment progress percent
    await this.updateEnrollmentProgress(input.enrollmentId);

    // Emit progress event
    emitEvent({
      type: 'MODULE_PROGRESS_UPDATED',
      enrollmentId: input.enrollmentId,
      moduleId: input.moduleId,
      progressPercent: input.progressPercent,
      completed: isCompleted,
    } as any);

    // Check if course is completed
    if (isCompleted) {
      await this.checkCourseCompletion(input.enrollmentId);
    }

    return moduleProgress;
  }

  /**
   * Update enrollment progress percent based on module progress
   */
  private async updateEnrollmentProgress(enrollmentId: string): Promise<void> {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        course: {
          include: {
            modules: true,
          },
        },
        progress: true,
      },
    });

    if (!enrollment || enrollment.course.modules.length === 0) {
      return;
    }

    // Calculate average progress across all modules
    const totalModules = enrollment.course.modules.length;
    const moduleProgressMap = new Map(
      enrollment.progress.map((p) => [p.moduleId, p.progressPercent])
    );

    let totalProgress = 0;
    for (const module of enrollment.course.modules) {
      const progress = moduleProgressMap.get(module.id) || 0;
      totalProgress += Number(progress);
    }

    const averageProgress = totalProgress / totalModules;

    // Update enrollment progress
    await this.prisma.enrollment.update({
      where: { id: enrollmentId },
      data: {
        progressPercent: averageProgress,
      },
    });
  }

  /**
   * Check if course is completed and trigger completion event
   */
  private async checkCourseCompletion(enrollmentId: string): Promise<void> {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        course: {
          include: {
            modules: true,
          },
        },
        progress: true,
      },
    });

    if (!enrollment || enrollment.status === 'completed') {
      return;
    }

    // Check if all modules are completed
    const totalModules = enrollment.course.modules.length;
    if (totalModules === 0) {
      return;
    }

    const completedModules = enrollment.progress.filter((p) => p.completed).length;

    if (completedModules === totalModules && enrollment.progressPercent >= 100) {
      // Mark enrollment as completed
      const updated = await this.prisma.enrollment.update({
        where: { id: enrollmentId },
        data: {
          status: 'completed',
          progressPercent: 100,
          completedAt: new Date(),
        },
      });

      // Emit completion event
      emitEvent({
        type: 'COURSE_COMPLETED',
        userId: enrollment.userId,
        courseId: enrollment.courseId,
        enrollmentId: enrollment.id,
      } as any);
    }
  }

  /**
   * Get progress for an enrollment
   */
  async getEnrollmentProgress(enrollmentId: string): Promise<{
    enrollment: any;
    moduleProgress: ModuleProgress[];
    overallProgress: number;
  }> {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        course: {
          include: {
            modules: {
              orderBy: { order: 'asc' },
            },
          },
        },
        progress: true,
      },
    });

    if (!enrollment) {
      throw new Error(`Enrollment not found: ${enrollmentId}`);
    }

    return {
      enrollment,
      moduleProgress: enrollment.progress,
      overallProgress: Number(enrollment.progressPercent),
    };
  }

  /**
   * Get progress for a specific module
   */
  async getModuleProgress(
    enrollmentId: string,
    moduleId: string
  ): Promise<ModuleProgress | null> {
    return this.prisma.moduleProgress.findUnique({
      where: {
        enrollmentId_moduleId: {
          enrollmentId,
          moduleId,
        },
      },
    });
  }
}

