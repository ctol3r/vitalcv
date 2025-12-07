/**
 * B229B-OBS-008: BlueGreenDeploymentPipeline
 *
 * Implements blue/green deployment strategy using CI/CD.
 * Includes automated health checks and traffic shifting.
 * Rollback on failure.
 */

import { createLogger } from '@chai-vc/logging-core';
import * as https from 'https';
import * as http from 'http';

const logger = createLogger({ service: 'blue-green-deployment' });

/**
 * Deployment status
 */
export enum DeploymentStatus {
  PENDING = 'pending',
  DEPLOYING = 'deploying',
  HEALTH_CHECKING = 'health_checking',
  TRAFFIC_SHIFTING = 'traffic_shifting',
  COMPLETED = 'completed',
  ROLLED_BACK = 'rolled_back',
  FAILED = 'failed',
}

/**
 * Environment (blue or green)
 */
export enum Environment {
  BLUE = 'blue',
  GREEN = 'green',
}

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  endpoint: string;
  intervalMs: number;
  timeoutMs: number;
  maxAttempts: number;
  expectedStatus?: number;
  expectedBody?: string | RegExp;
}

/**
 * Traffic shifting configuration
 */
export interface TrafficShiftConfig {
  strategy: 'instant' | 'gradual';
  steps?: number; // For gradual shifting
  stepIntervalMs?: number; // For gradual shifting
}

/**
 * Deployment metadata
 */
export interface DeploymentMetadata {
  id: string;
  version: string;
  status: DeploymentStatus;
  currentEnvironment: Environment;
  targetEnvironment: Environment;
  startTime: Date;
  endTime?: Date;
  healthCheckConfig: HealthCheckConfig;
  trafficShiftConfig: TrafficShiftConfig;
  rollbackOnFailure: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  success: boolean;
  statusCode?: number;
  responseTime?: number;
  error?: string;
  timestamp: Date;
}

/**
 * Default health check configuration
 */
const DEFAULT_HEALTH_CHECK: HealthCheckConfig = {
  endpoint: '/health',
  intervalMs: 5000,
  timeoutMs: 3000,
  maxAttempts: 3,
  expectedStatus: 200,
};

/**
 * Default traffic shift configuration
 */
const DEFAULT_TRAFFIC_SHIFT: TrafficShiftConfig = {
  strategy: 'gradual',
  steps: 5,
  stepIntervalMs: 10000,
};

/**
 * BlueGreenDeploymentPipeline for zero-downtime deployments
 */
export class BlueGreenDeploymentPipeline {
  private deployments: Map<string, DeploymentMetadata> = new Map();
  private activeEnvironment: Environment = Environment.BLUE;
  private trafficSplit: Map<Environment, number> = new Map([
    [Environment.BLUE, 100],
    [Environment.GREEN, 0],
  ]);

  constructor() {
    logger.info('BlueGreenDeploymentPipeline initialized', {
      activeEnvironment: this.activeEnvironment,
    });
  }

  /**
   * Start a blue/green deployment
   */
  async deploy(
    version: string,
    config?: {
      healthCheck?: Partial<HealthCheckConfig>;
      trafficShift?: Partial<TrafficShiftConfig>;
      rollbackOnFailure?: boolean;
      metadata?: Record<string, unknown>;
    }
  ): Promise<string> {
    const deploymentId = `deploy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const targetEnvironment = this.activeEnvironment === Environment.BLUE
      ? Environment.GREEN
      : Environment.BLUE;

    const deployment: DeploymentMetadata = {
      id: deploymentId,
      version,
      status: DeploymentStatus.DEPLOYING,
      currentEnvironment: this.activeEnvironment,
      targetEnvironment,
      startTime: new Date(),
      healthCheckConfig: {
        ...DEFAULT_HEALTH_CHECK,
        ...config?.healthCheck,
      },
      trafficShiftConfig: {
        ...DEFAULT_TRAFFIC_SHIFT,
        ...config?.trafficShift,
      },
      rollbackOnFailure: config?.rollbackOnFailure ?? true,
      metadata: config?.metadata,
    };

    this.deployments.set(deploymentId, deployment);
    logger.info('Starting deployment', {
      deploymentId,
      version,
      targetEnvironment,
    });

    try {
      // Step 1: Deploy to target environment
      await this.deployToEnvironment(targetEnvironment, version);
      deployment.status = DeploymentStatus.HEALTH_CHECKING;

      // Step 2: Run health checks
      const healthCheckResult = await this.runHealthChecks(
        targetEnvironment,
        deployment.healthCheckConfig
      );

      if (!healthCheckResult.success) {
        throw new Error(`Health check failed: ${healthCheckResult.error}`);
      }

      // Step 3: Shift traffic
      deployment.status = DeploymentStatus.TRAFFIC_SHIFTING;
      await this.shiftTraffic(targetEnvironment, deployment.trafficShiftConfig);

      // Step 4: Complete deployment
      deployment.status = DeploymentStatus.COMPLETED;
      deployment.endTime = new Date();
      this.activeEnvironment = targetEnvironment;
      this.deployments.set(deploymentId, deployment);

      logger.info('Deployment completed', {
        deploymentId,
        version,
        targetEnvironment,
        duration: deployment.endTime.getTime() - deployment.startTime.getTime(),
      });

      return deploymentId;
    } catch (error) {
      deployment.status = DeploymentStatus.FAILED;
      deployment.endTime = new Date();
      this.deployments.set(deploymentId, deployment);

      logger.error('Deployment failed', {
        deploymentId,
        version,
        targetEnvironment,
        error,
      });

      // Rollback if configured
      if (deployment.rollbackOnFailure) {
        await this.rollback(deploymentId);
      }

      throw error;
    }
  }

  /**
   * Deploy to an environment (mock implementation)
   */
  private async deployToEnvironment(environment: Environment, version: string): Promise<void> {
    logger.info('Deploying to environment', { environment, version });
    // In production, this would trigger CI/CD pipeline or deployment tool
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  /**
   * Run health checks on an environment
   */
  async runHealthChecks(
    environment: Environment,
    config: HealthCheckConfig
  ): Promise<HealthCheckResult> {
    const environmentUrl = this.getEnvironmentUrl(environment);
    const healthCheckUrl = `${environmentUrl}${config.endpoint}`;

    logger.info('Running health checks', {
      environment,
      url: healthCheckUrl,
      maxAttempts: config.maxAttempts,
    });

    for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
      try {
        const result = await this.performHealthCheck(healthCheckUrl, config);
        if (result.success) {
          logger.info('Health check passed', {
            environment,
            attempt,
            responseTime: result.responseTime,
          });
          return result;
        }
        logger.warn('Health check failed', {
          environment,
          attempt,
          error: result.error,
        });
      } catch (error) {
        logger.warn('Health check error', {
          environment,
          attempt,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Wait before next attempt
      if (attempt < config.maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, config.intervalMs));
      }
    }

    return {
      success: false,
      error: `Health check failed after ${config.maxAttempts} attempts`,
      timestamp: new Date(),
    };
  }

  /**
   * Perform a single health check
   */
  private async performHealthCheck(
    url: string,
    config: HealthCheckConfig
  ): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const protocol = url.startsWith('https') ? https : http;

    return new Promise<HealthCheckResult>((resolve) => {
      const timeout = setTimeout(() => {
        resolve({
          success: false,
          error: 'Health check timeout',
          timestamp: new Date(),
        });
      }, config.timeoutMs);

      const req = protocol.get(url, (res) => {
        clearTimeout(timeout);
        const responseTime = Date.now() - startTime;

        // Check status code
        if (config.expectedStatus && res.statusCode !== config.expectedStatus) {
          resolve({
            success: false,
            statusCode: res.statusCode,
            responseTime,
            error: `Expected status ${config.expectedStatus}, got ${res.statusCode}`,
            timestamp: new Date(),
          });
          return;
        }

        // Check body if specified
        if (config.expectedBody) {
          let body = '';
          res.on('data', (chunk) => {
            body += chunk.toString();
          });
          res.on('end', () => {
            const matches = typeof config.expectedBody === 'string'
              ? body.includes(config.expectedBody)
              : config.expectedBody.test(body);

            resolve({
              success: matches,
              statusCode: res.statusCode,
              responseTime,
              error: matches ? undefined : 'Body does not match expected pattern',
              timestamp: new Date(),
            });
          });
        } else {
          resolve({
            success: true,
            statusCode: res.statusCode,
            responseTime,
            timestamp: new Date(),
          });
        }
      });

      req.on('error', (error) => {
        clearTimeout(timeout);
        resolve({
          success: false,
          error: error.message,
          timestamp: new Date(),
        });
      });

      req.setTimeout(config.timeoutMs, () => {
        req.destroy();
        resolve({
          success: false,
          error: 'Request timeout',
          timestamp: new Date(),
        });
      });
    });
  }

  /**
   * Shift traffic to an environment
   */
  async shiftTraffic(
    environment: Environment,
    config: TrafficShiftConfig
  ): Promise<void> {
    logger.info('Shifting traffic', { environment, strategy: config.strategy });

    if (config.strategy === 'instant') {
      this.trafficSplit.set(environment, 100);
      this.trafficSplit.set(
        environment === Environment.BLUE ? Environment.GREEN : Environment.BLUE,
        0
      );
      logger.info('Traffic shifted instantly', { environment });
    } else {
      // Gradual shifting
      const steps = config.steps || 5;
      const stepInterval = config.stepIntervalMs || 10000;
      const stepSize = 100 / steps;

      for (let step = 1; step <= steps; step++) {
        const percentage = step * stepSize;
        this.trafficSplit.set(environment, percentage);
        this.trafficSplit.set(
          environment === Environment.BLUE ? Environment.GREEN : Environment.BLUE,
          100 - percentage
        );

        logger.info('Traffic shift step', {
          environment,
          step,
          percentage,
        });

        if (step < steps) {
          await new Promise((resolve) => setTimeout(resolve, stepInterval));
        }
      }

      logger.info('Traffic shift completed', { environment });
    }
  }

  /**
   * Rollback a deployment
   */
  async rollback(deploymentId: string): Promise<void> {
    const deployment = this.deployments.get(deploymentId);
    if (!deployment) {
      throw new Error(`Deployment not found: ${deploymentId}`);
    }

    logger.info('Rolling back deployment', {
      deploymentId,
      currentEnvironment: this.activeEnvironment,
      targetEnvironment: deployment.currentEnvironment,
    });

    // Shift traffic back to previous environment
    await this.shiftTraffic(deployment.currentEnvironment, {
      strategy: 'instant',
    });

    this.activeEnvironment = deployment.currentEnvironment;
    deployment.status = DeploymentStatus.ROLLED_BACK;
    deployment.endTime = new Date();
    this.deployments.set(deploymentId, deployment);

    logger.info('Rollback completed', {
      deploymentId,
      activeEnvironment: this.activeEnvironment,
    });
  }

  /**
   * Get environment URL (mock implementation)
   */
  private getEnvironmentUrl(environment: Environment): string {
    // In production, this would return actual environment URLs
    const baseUrl = process.env[`${environment.toUpperCase()}_ENVIRONMENT_URL`]
      || `http://localhost:${environment === Environment.BLUE ? '3000' : '3001'}`;
    return baseUrl;
  }

  /**
   * Get deployment by ID
   */
  getDeployment(deploymentId: string): DeploymentMetadata | undefined {
    return this.deployments.get(deploymentId);
  }

  /**
   * List deployments
   */
  listDeployments(): DeploymentMetadata[] {
    return Array.from(this.deployments.values());
  }

  /**
   * Get current active environment
   */
  getActiveEnvironment(): Environment {
    return this.activeEnvironment;
  }

  /**
   * Get current traffic split
   */
  getTrafficSplit(): Map<Environment, number> {
    return new Map(this.trafficSplit);
  }
}

// Export singleton instance
export const blueGreenPipeline = new BlueGreenDeploymentPipeline();

