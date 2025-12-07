// B235B-API-018: APIStatusHandler - Returns current API status

import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

export enum APIStatus {
  OK = 'OK',
  DEGRADED = 'DEGRADED',
  OUTAGE = 'OUTAGE',
}

export interface DependencyStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  responseTimeMs?: number;
  lastChecked: Date;
  error?: string;
}

export interface APIStatusResponse {
  status: APIStatus;
  timestamp: Date;
  version: string;
  dependencies: DependencyStatus[];
  uptime: number; // Seconds since last restart
  message?: string;
}

const START_TIME = Date.now();

export class APIStatusHandler {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get current API status
   */
  async getStatus(): Promise<APIStatusResponse> {
    // Check dependencies
    const dependencies = await this.checkDependencies();

    // Determine overall status
    const hasDown = dependencies.some((d) => d.status === 'down');
    const hasDegraded = dependencies.some((d) => d.status === 'degraded');

    let status: APIStatus;
    let message: string | undefined;

    if (hasDown) {
      status = APIStatus.OUTAGE;
      message = 'One or more dependencies are down';
    } else if (hasDegraded) {
      status = APIStatus.DEGRADED;
      message = 'One or more dependencies are experiencing issues';
    } else {
      status = APIStatus.OK;
    }

    const uptime = Math.floor((Date.now() - START_TIME) / 1000);

    return {
      status,
      timestamp: new Date(),
      version: process.env.API_VERSION || '1.0.0',
      dependencies,
      uptime,
      message,
    };
  }

  /**
   * Check upstream dependencies
   */
  private async checkDependencies(): Promise<DependencyStatus[]> {
    const dependencies: DependencyStatus[] = [];

    // Check database
    dependencies.push(await this.checkDatabase());

    // Check Redis (if used)
    // dependencies.push(await this.checkRedis());

    // Check external APIs
    // dependencies.push(await this.checkExternalAPIs());

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
        status: responseTime > 1000 ? 'degraded' : 'healthy',
        responseTimeMs: responseTime,
        lastChecked: new Date(),
      };
    } catch (error: any) {
      return {
        name: 'database',
        status: 'down',
        lastChecked: new Date(),
        error: error.message,
      };
    }
  }

  /**
   * Express handler for status endpoint
   */
  async handleStatusRequest(req: Request, res: Response): Promise<void> {
    try {
      const status = await this.getStatus();
      const statusCode = status.status === APIStatus.OUTAGE ? 503 : 200;
      res.status(statusCode).json(status);
    } catch (error: any) {
      res.status(500).json({
        status: APIStatus.OUTAGE,
        timestamp: new Date(),
        error: error.message,
      });
    }
  }
}

