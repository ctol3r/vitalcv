/**
 * B207A-LIFE-005: LifecycleStorage
 *
 * Stores lifecycle projections per interval; retrievable by org, clinician, dept.
 */

import { PrismaClient } from '@prisma/client';
import type { LifecycleState } from './models/LifecycleState.js';
import type { ProjectionWindow } from './constants.js';
import { createLifecycleState, validateLifecycleState } from './models/LifecycleState.js';

const prisma = new PrismaClient();

/**
 * Lifecycle projection stored in database
 */
export interface LifecycleProjection {
  id: string;
  clinicianId: string;
  orgId?: string;
  department?: string;
  projectionWindow: ProjectionWindow;
  state: LifecycleState;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Query filters for retrieving projections
 */
export interface ProjectionQuery {
  clinicianId?: string;
  orgId?: string;
  department?: string;
  projectionWindow?: ProjectionWindow;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * LifecycleStorage class
 */
export class LifecycleStorage {
  /**
   * Store a lifecycle projection
   */
  async storeProjection(
    clinicianId: string,
    projectionWindow: ProjectionWindow,
    state: LifecycleState,
    orgId?: string,
    department?: string
  ): Promise<LifecycleProjection> {
    // Validate state
    const validatedState = validateLifecycleState(state);

    // Store in database
    const projection = await prisma.lifecycleProjection.create({
      data: {
        clinicianId: validatedState.clinicianId,
        orgId: orgId || validatedState.orgId,
        department: department || validatedState.department,
        projectionWindow,
        state: validatedState as any, // Prisma JSON type
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return {
      id: projection.id,
      clinicianId: projection.clinicianId,
      orgId: projection.orgId || undefined,
      department: projection.department || undefined,
      projectionWindow: projection.projectionWindow as ProjectionWindow,
      state: validatedState,
      createdAt: projection.createdAt,
      updatedAt: projection.updatedAt,
    };
  }

  /**
   * Retrieve projections by query
   */
  async getProjections(query: ProjectionQuery): Promise<LifecycleProjection[]> {
    const where: any = {};

    if (query.clinicianId) {
      where.clinicianId = query.clinicianId;
    }
    if (query.orgId) {
      where.orgId = query.orgId;
    }
    if (query.department) {
      where.department = query.department;
    }
    if (query.projectionWindow) {
      where.projectionWindow = query.projectionWindow;
    }
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = query.startDate;
      }
      if (query.endDate) {
        where.createdAt.lte = query.endDate;
      }
    }

    const projections = await prisma.lifecycleProjection.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: query.limit || 100,
      skip: query.offset || 0,
    });

    return projections.map((p) => ({
      id: p.id,
      clinicianId: p.clinicianId,
      orgId: p.orgId || undefined,
      department: p.department || undefined,
      projectionWindow: p.projectionWindow as ProjectionWindow,
      state: validateLifecycleState(p.state),
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
  }

  /**
   * Get latest projection for a clinician and window
   */
  async getLatestProjection(
    clinicianId: string,
    projectionWindow: ProjectionWindow,
    orgId?: string
  ): Promise<LifecycleProjection | null> {
    const where: any = {
      clinicianId,
      projectionWindow,
    };
    if (orgId) {
      where.orgId = orgId;
    }

    const projection = await prisma.lifecycleProjection.findFirst({
      where,
      orderBy: { createdAt: 'desc' },
    });

    if (!projection) {
      return null;
    }

    return {
      id: projection.id,
      clinicianId: projection.clinicianId,
      orgId: projection.orgId || undefined,
      department: projection.department || undefined,
      projectionWindow: projection.projectionWindow as ProjectionWindow,
      state: validateLifecycleState(projection.state),
      createdAt: projection.createdAt,
      updatedAt: projection.updatedAt,
    };
  }

  /**
   * Get all projections for a clinician across all windows
   */
  async getClinicianProjections(
    clinicianId: string,
    orgId?: string
  ): Promise<Record<ProjectionWindow, LifecycleProjection | null>> {
    const where: any = { clinicianId };
    if (orgId) {
      where.orgId = orgId;
    }

    const projections = await prisma.lifecycleProjection.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Group by projection window and get latest for each
    const result: Record<ProjectionWindow, LifecycleProjection | null> = {
      '3mo': null,
      '6mo': null,
      '12mo': null,
      '24mo': null,
      '36mo': null,
    };

    const seen = new Set<ProjectionWindow>();
    for (const p of projections) {
      const window = p.projectionWindow as ProjectionWindow;
      if (!seen.has(window)) {
        seen.add(window);
        result[window] = {
          id: p.id,
          clinicianId: p.clinicianId,
          orgId: p.orgId || undefined,
          department: p.department || undefined,
          projectionWindow: window,
          state: validateLifecycleState(p.state),
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        };
      }
    }

    return result;
  }

  /**
   * Get projections by organization
   */
  async getOrgProjections(
    orgId: string,
    projectionWindow?: ProjectionWindow,
    department?: string
  ): Promise<LifecycleProjection[]> {
    const where: any = { orgId };
    if (projectionWindow) {
      where.projectionWindow = projectionWindow;
    }
    if (department) {
      where.department = department;
    }

    const projections = await prisma.lifecycleProjection.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return projections.map((p) => ({
      id: p.id,
      clinicianId: p.clinicianId,
      orgId: p.orgId || undefined,
      department: p.department || undefined,
      projectionWindow: p.projectionWindow as ProjectionWindow,
      state: validateLifecycleState(p.state),
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
  }

  /**
   * Get projections by department
   */
  async getDepartmentProjections(
    department: string,
    orgId?: string,
    projectionWindow?: ProjectionWindow
  ): Promise<LifecycleProjection[]> {
    const where: any = { department };
    if (orgId) {
      where.orgId = orgId;
    }
    if (projectionWindow) {
      where.projectionWindow = projectionWindow;
    }

    const projections = await prisma.lifecycleProjection.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return projections.map((p) => ({
      id: p.id,
      clinicianId: p.clinicianId,
      orgId: p.orgId || undefined,
      department: p.department || undefined,
      projectionWindow: p.projectionWindow as ProjectionWindow,
      state: validateLifecycleState(p.state),
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
  }

  /**
   * Delete old projections (cleanup utility)
   */
  async deleteOldProjections(olderThan: Date): Promise<number> {
    const result = await prisma.lifecycleProjection.deleteMany({
      where: {
        createdAt: {
          lt: olderThan,
        },
      },
    });

    return result.count;
  }
}

/**
 * Default lifecycle storage instance
 */
export const lifecycleStorage = new LifecycleStorage();

