/**
 * B229B-OBS-010: FailoverManager
 *
 * Automatically redirects traffic to healthy regions and replicas upon failure.
 * Monitors service health.
 * Emits events to ObservabilityDashboard.
 */

import { createLogger } from '@chai-vc/logging-core';
import * as https from 'https';
import * as http from 'http';
import { EventEmitter } from 'events';

const logger = createLogger({ service: 'failover-manager' });

/**
 * Region/replica identifier
 */
export type RegionId = string;
export type ReplicaId = string;

/**
 * Health status
 */
export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  UNKNOWN = 'unknown',
}

/**
 * Service health information
 */
export interface ServiceHealth {
  regionId: RegionId;
  replicaId?: ReplicaId;
  status: HealthStatus;
  lastChecked: Date;
  responseTime?: number;
  errorRate?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Failover event types
 */
export enum FailoverEventType {
  HEALTH_CHECK_FAILED = 'health_check_failed',
  FAILOVER_TRIGGERED = 'failover_triggered',
  FAILOVER_COMPLETED = 'failover_completed',
  REGION_RECOVERED = 'region_recovered',
  TRAFFIC_REDIRECTED = 'traffic_redirected',
}

/**
 * Failover event
 */
export interface FailoverEvent {
  type: FailoverEventType;
  timestamp: Date;
  sourceRegion?: RegionId;
  targetRegion?: RegionId;
  service?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  endpoint: string;
  intervalMs: number;
  timeoutMs: number;
  failureThreshold: number; // Number of consecutive failures before marking unhealthy
  successThreshold: number; // Number of consecutive successes before marking healthy
}

/**
 * Failover configuration
 */
export interface FailoverConfig {
  enabled: boolean;
  autoFailover: boolean;
  healthCheck: HealthCheckConfig;
  regions: RegionConfig[];
}

/**
 * Region configuration
 */
export interface RegionConfig {
  id: RegionId;
  url: string;
  priority: number; // Lower number = higher priority
  replicas?: ReplicaConfig[];
  enabled: boolean;
}

/**
 * Replica configuration
 */
export interface ReplicaConfig {
  id: ReplicaId;
  url: string;
  priority: number;
  enabled: boolean;
}

/**
 * Default health check configuration
 */
const DEFAULT_HEALTH_CHECK: HealthCheckConfig = {
  endpoint: '/health',
  intervalMs: 10000, // 10 seconds
  timeoutMs: 5000, // 5 seconds
  failureThreshold: 3,
  successThreshold: 2,
};

/**
 * FailoverManager for automatic failover and traffic redirection
 */
export class FailoverManager extends EventEmitter {
  private config: FailoverConfig;
  private healthStatuses: Map<RegionId, Map<ReplicaId | 'primary', ServiceHealth>> = new Map();
  private activeRegion: RegionId | null = null;
  private healthCheckIntervals: Map<RegionId, NodeJS.Timeout> = new Map();
  private consecutiveFailures: Map<string, number> = new Map();
  private consecutiveSuccesses: Map<string, number> = new Map();

  constructor(config: FailoverConfig) {
    super();
    this.config = config;

    // Initialize health statuses
    for (const region of config.regions) {
      const regionHealth = new Map<ReplicaId | 'primary', ServiceHealth>();
      regionHealth.set('primary', {
        regionId: region.id,
        status: HealthStatus.UNKNOWN,
        lastChecked: new Date(),
      });
      this.healthStatuses.set(region.id, regionHealth);
    }

    // Set initial active region (highest priority)
    const sortedRegions = [...config.regions].sort((a, b) => a.priority - b.priority);
    if (sortedRegions.length > 0 && sortedRegions[0].enabled) {
      this.activeRegion = sortedRegions[0].id;
    }

    logger.info('FailoverManager initialized', {
      enabled: config.enabled,
      autoFailover: config.autoFailover,
      regionCount: config.regions.length,
      activeRegion: this.activeRegion,
    });

    if (config.enabled) {
      this.startHealthChecks();
    }
  }

  /**
   * Start health checks for all regions
   */
  private startHealthChecks(): void {
    for (const region of this.config.regions) {
      if (!region.enabled) {
        continue;
      }

      // Check immediately
      this.checkRegionHealth(region.id).catch((error) => {
        logger.error('Error in initial health check', {
          regionId: region.id,
          error: error instanceof Error ? error.message : String(error),
        });
      });

      // Schedule periodic checks
      const interval = setInterval(() => {
        this.checkRegionHealth(region.id).catch((error) => {
          logger.error('Error in periodic health check', {
            regionId: region.id,
            error: error instanceof Error ? error.message : String(error),
          });
        });
      }, this.config.healthCheck.intervalMs);

      this.healthCheckIntervals.set(region.id, interval);
    }
  }

  /**
   * Stop health checks
   */
  stopHealthChecks(): void {
    for (const [regionId, interval] of this.healthCheckIntervals) {
      clearInterval(interval);
    }
    this.healthCheckIntervals.clear();
  }

  /**
   * Check health of a region
   */
  async checkRegionHealth(regionId: RegionId): Promise<ServiceHealth> {
    const region = this.config.regions.find((r) => r.id === regionId);
    if (!region) {
      throw new Error(`Region not found: ${regionId}`);
    }

    const healthKey = `${regionId}:primary`;
    const startTime = Date.now();

    try {
      const healthUrl = `${region.url}${this.config.healthCheck.endpoint}`;
      const healthResult = await this.performHealthCheck(healthUrl);

      const responseTime = Date.now() - startTime;
      const currentFailures = this.consecutiveFailures.get(healthKey) || 0;
      const currentSuccesses = this.consecutiveSuccesses.get(healthKey) || 0;

      let status = HealthStatus.HEALTHY;
      if (healthResult.success) {
        const newSuccesses = currentSuccesses + 1;
        this.consecutiveSuccesses.set(healthKey, newSuccesses);
        this.consecutiveFailures.set(healthKey, 0);

        // Mark as healthy if we have enough consecutive successes
        if (newSuccesses >= this.config.healthCheck.successThreshold) {
          status = HealthStatus.HEALTHY;
        } else if (currentFailures > 0) {
          status = HealthStatus.DEGRADED;
        }
      } else {
        const newFailures = currentFailures + 1;
        this.consecutiveFailures.set(healthKey, newFailures);
        this.consecutiveSuccesses.set(healthKey, 0);

        // Mark as unhealthy if we have enough consecutive failures
        if (newFailures >= this.config.healthCheck.failureThreshold) {
          status = HealthStatus.UNHEALTHY;
        } else {
          status = HealthStatus.DEGRADED;
        }

        // Emit health check failed event
        this.emitFailoverEvent({
          type: FailoverEventType.HEALTH_CHECK_FAILED,
          timestamp: new Date(),
          sourceRegion: regionId,
          reason: healthResult.error,
        });
      }

      const health: ServiceHealth = {
        regionId,
        status,
        lastChecked: new Date(),
        responseTime,
        metadata: {
          statusCode: healthResult.statusCode,
          error: healthResult.error,
        },
      };

      const regionHealth = this.healthStatuses.get(regionId);
      if (regionHealth) {
        regionHealth.set('primary', health);
        this.healthStatuses.set(regionId, regionHealth);
      }

      // Trigger failover if active region becomes unhealthy
      if (
        this.config.autoFailover &&
        regionId === this.activeRegion &&
        status === HealthStatus.UNHEALTHY
      ) {
        await this.triggerFailover(regionId);
      }

      return health;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const currentFailures = (this.consecutiveFailures.get(healthKey) || 0) + 1;
      this.consecutiveFailures.set(healthKey, currentFailures);
      this.consecutiveSuccesses.set(healthKey, 0);

      const status =
        currentFailures >= this.config.healthCheck.failureThreshold
          ? HealthStatus.UNHEALTHY
          : HealthStatus.DEGRADED;

      const health: ServiceHealth = {
        regionId,
        status,
        lastChecked: new Date(),
        responseTime,
        metadata: {
          error: error instanceof Error ? error.message : String(error),
        },
      };

      const regionHealth = this.healthStatuses.get(regionId);
      if (regionHealth) {
        regionHealth.set('primary', health);
        this.healthStatuses.set(regionId, regionHealth);
      }

      // Emit health check failed event
      this.emitFailoverEvent({
        type: FailoverEventType.HEALTH_CHECK_FAILED,
        timestamp: new Date(),
        sourceRegion: regionId,
        reason: error instanceof Error ? error.message : String(error),
      });

      // Trigger failover if active region becomes unhealthy
      if (
        this.config.autoFailover &&
        regionId === this.activeRegion &&
        status === HealthStatus.UNHEALTHY
      ) {
        await this.triggerFailover(regionId);
      }

      return health;
    }
  }

  /**
   * Perform a health check
   */
  private async performHealthCheck(url: string): Promise<{
    success: boolean;
    statusCode?: number;
    error?: string;
  }> {
    const protocol = url.startsWith('https') ? https : http;

    return new Promise<{ success: boolean; statusCode?: number; error?: string }>(
      (resolve) => {
        const timeout = setTimeout(() => {
          resolve({
            success: false,
            error: 'Health check timeout',
          });
        }, this.config.healthCheck.timeoutMs);

        const req = protocol.get(url, (res) => {
          clearTimeout(timeout);
          resolve({
            success: res.statusCode === 200,
            statusCode: res.statusCode,
          });
        });

        req.on('error', (error) => {
          clearTimeout(timeout);
          resolve({
            success: false,
            error: error.message,
          });
        });

        req.setTimeout(this.config.healthCheck.timeoutMs, () => {
          req.destroy();
          resolve({
            success: false,
            error: 'Request timeout',
          });
        });
      }
    );
  }

  /**
   * Trigger failover to a healthy region
   */
  async triggerFailover(fromRegion: RegionId): Promise<void> {
    logger.warn('Triggering failover', { fromRegion });

    // Find healthy regions sorted by priority
    const healthyRegions = this.config.regions
      .filter((region) => {
        if (!region.enabled) {
          return false;
        }
        if (region.id === fromRegion) {
          return false;
        }
        const health = this.healthStatuses.get(region.id)?.get('primary');
        return health?.status === HealthStatus.HEALTHY;
      })
      .sort((a, b) => a.priority - b.priority);

    if (healthyRegions.length === 0) {
      logger.error('No healthy regions available for failover', { fromRegion });
      this.emitFailoverEvent({
        type: FailoverEventType.FAILOVER_TRIGGERED,
        timestamp: new Date(),
        sourceRegion: fromRegion,
        reason: 'No healthy regions available',
      });
      return;
    }

    const targetRegion = healthyRegions[0];
    this.activeRegion = targetRegion.id;

    // Emit failover events
    this.emitFailoverEvent({
      type: FailoverEventType.FAILOVER_TRIGGERED,
      timestamp: new Date(),
      sourceRegion: fromRegion,
      targetRegion: targetRegion.id,
      reason: 'Active region became unhealthy',
    });

    // Redirect traffic (in production, this would update load balancer config)
    await this.redirectTraffic(targetRegion.id);

    this.emitFailoverEvent({
      type: FailoverEventType.FAILOVER_COMPLETED,
      timestamp: new Date(),
      sourceRegion: fromRegion,
      targetRegion: targetRegion.id,
    });

    logger.info('Failover completed', {
      fromRegion,
      toRegion: targetRegion.id,
    });
  }

  /**
   * Redirect traffic to a region
   */
  private async redirectTraffic(regionId: RegionId): Promise<void> {
    // In production, this would update load balancer configuration
    logger.info('Redirecting traffic', { regionId });

    this.emitFailoverEvent({
      type: FailoverEventType.TRAFFIC_REDIRECTED,
      timestamp: new Date(),
      targetRegion: regionId,
    });
  }

  /**
   * Emit failover event to observability dashboard
   */
  private emitFailoverEvent(event: FailoverEvent): void {
    // Emit to EventEmitter for internal listeners
    this.emit('failover', event);

    // In production, this would also emit to ObservabilityDashboard
    // For now, we'll log it
    logger.info('Failover event', {
      type: event.type,
      sourceRegion: event.sourceRegion,
      targetRegion: event.targetRegion,
      reason: event.reason,
    });

    // TODO: Integrate with ObservabilityDashboard service
    // await observabilityDashboard.recordEvent(event);
  }

  /**
   * Get health status for a region
   */
  getRegionHealth(regionId: RegionId): ServiceHealth | undefined {
    return this.healthStatuses.get(regionId)?.get('primary');
  }

  /**
   * Get health status for all regions
   */
  getAllRegionHealth(): Map<RegionId, ServiceHealth> {
    const result = new Map<RegionId, ServiceHealth>();
    for (const [regionId, healthMap] of this.healthStatuses) {
      const health = healthMap.get('primary');
      if (health) {
        result.set(regionId, health);
      }
    }
    return result;
  }

  /**
   * Get current active region
   */
  getActiveRegion(): RegionId | null {
    return this.activeRegion;
  }

  /**
   * Manually set active region
   */
  async setActiveRegion(regionId: RegionId): Promise<void> {
    const region = this.config.regions.find((r) => r.id === regionId);
    if (!region) {
      throw new Error(`Region not found: ${regionId}`);
    }

    if (!region.enabled) {
      throw new Error(`Region is disabled: ${regionId}`);
    }

    const previousRegion = this.activeRegion;
    this.activeRegion = regionId;

    await this.redirectTraffic(regionId);

    logger.info('Active region changed', {
      fromRegion: previousRegion,
      toRegion: regionId,
    });
  }
}

