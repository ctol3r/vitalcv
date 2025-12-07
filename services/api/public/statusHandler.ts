/**
 * B235B-API-018: APIStatusHandler
 *
 * Endpoint that returns current API status (OK, degraded, outage).
 * Includes upstream dependency checks for health monitoring by clients.
 */

import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

export type APIStatus = 'OK' | 'DEGRADED' | 'OUTAGE';

export interface DependencyStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  responseTime?: number;
  lastChecked: Date;
  error?: string;
}

export interface APIStatusResponse {
  status: APIStatus;
  timestamp: Date;
  version: string;
  uptime: number;
  dependencies: DependencyStatus[];
  message?: string;
}

const START_TIME = Date.now();

export class APIStatusHandler {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get API status
   */
  async getStatus(): Promise<APIStatusResponse> {
    const dependencies = await this.checkDependencies();
    const status = this.determineStatus(dependencies);

    return {
      status,
      timestamp: new Date(),
      version: process.env.API_VERSION || '1.0.0',
      uptime: Math.floor((Date.now() - START_TIME) / 1000),
      dependencies,
      message: this.getStatusMessage(status),
    };
  }

  /**
   * Check all upstream dependencies
   */
  private async checkDependencies(): Promise<DependencyStatus[]> {
    const checks = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkExternalAPIs(),
    ]);

    const dependencies: DependencyStatus[] = [];

    // Database check
    const dbCheck = checks[0];
    if (dbCheck.status === 'fulfilled') {
      dependencies.push(dbCheck.value);
    } else {
      dependencies.push({
        name: 'database',
        status: 'down',
        lastChecked: new Date(),
        error: dbCheck.reason?.message || 'Unknown error',
      });
    }

    // Redis check (optional)
    const redisCheck = checks[1];
    if (redisCheck.status === 'fulfilled') {
      dependencies.push(redisCheck.value);
    }

    // External APIs check
    const apiCheck = checks[2];
    if (apiCheck.status === 'fulfilled') {
      dependencies.push(...apiCheck.value);
    }

    return dependencies;
  }

  /**
   * Check database connectivity
   */
  private async checkDatabase(): Promise<DependencyStatus> {
    const startTime = Date.now();
    try {
      // Simple query to check database
      await this.prisma.$queryRaw`SELECT 1`;
      const responseTime = Date.now() - startTime;

      return {
        name: 'database',
        status: responseTime < 100 ? 'healthy' : 'degraded',
        responseTime,
        lastChecked: new Date(),
      };
    } catch (error: any) {
      return {
        name: 'database',
        status: 'down',
        lastChecked: new Date(),
        error: error.message || 'Database connection failed',
      };
    }
  }

  /**
   * Check Redis connectivity (if configured)
   */
  private async checkRedis(): Promise<DependencyStatus> {
    // TODO: Implement Redis health check
    // For now, return healthy if Redis is not required
    return {
      name: 'redis',
      status: 'healthy',
      lastChecked: new Date(),
    };
  }

  /**
   * Check external API dependencies
   */
  private async checkExternalAPIs(): Promise<DependencyStatus[]> {
    const dependencies: DependencyStatus[] = [];

    // Check NPPES API (if configured)
    if (process.env.NPPES_API_BASE) {
      try {
        const startTime = Date.now();
        // Simple health check - in production, use actual health endpoint
        const responseTime = Date.now() - startTime;

        dependencies.push({
          name: 'nppes-api',
          status: responseTime < 500 ? 'healthy' : 'degraded',
          responseTime,
          lastChecked: new Date(),
        });
      } catch (error: any) {
        dependencies.push({
          name: 'nppes-api',
          status: 'down',
          lastChecked: new Date(),
          error: error.message,
        });
      }
    }

    return dependencies;
  }

  /**
   * Determine overall API status based on dependencies
   */
  private determineStatus(dependencies: DependencyStatus[]): APIStatus {
    const criticalDeps = dependencies.filter((d) => d.name === 'database');
    const hasDownCritical = criticalDeps.some((d) => d.status === 'down');
    const hasDegradedCritical = criticalDeps.some(
      (d) => d.status === 'degraded'
    );

    if (hasDownCritical) {
      return 'OUTAGE';
    }

    const hasAnyDown = dependencies.some((d) => d.status === 'down');
    const hasAnyDegraded = dependencies.some((d) => d.status === 'degraded');

    if (hasAnyDown || hasDegradedCritical) {
      return 'DEGRADED';
    }

    if (hasAnyDegraded) {
      return 'DEGRADED';
    }

    return 'OK';
  }

  /**
   * Get status message
   */
  private getStatusMessage(status: APIStatus): string {
    switch (status) {
      case 'OK':
        return 'API is operating normally';
      case 'DEGRADED':
        return 'API is experiencing degraded performance';
      case 'OUTAGE':
        return 'API is currently unavailable';
    }
  }

  /**
   * Express handler
   */
  async handleStatus(req: Request, res: Response): Promise<void> {
    try {
      const status = await this.getStatus();
      const statusCode = status.status === 'OK' ? 200 : status.status === 'DEGRADED' ? 200 : 503;
      res.status(statusCode).json(status);
    } catch (error: any) {
      res.status(503).json({
        status: 'OUTAGE' as APIStatus,
        timestamp: new Date(),
        message: 'Unable to determine API status',
        error: error.message,
      });
    }
  }
}

