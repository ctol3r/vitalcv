/**
 * B143C-LAUNCH-005: Soft-Launch Feature Flag Service
 *
 * Limits access to production flows to whitelisted pilot organizations only.
 * Non-whitelisted organizations are redirected to a waitlist page.
 *
 * Features:
 * - Organization-based whitelist
 * - Gradual rollout controls
 * - Waitlist management
 * - Feature toggle per organization
 *
 * Usage:
 * ```typescript
 * import { SoftLaunchService } from './services/featureFlags/softLaunch';
 *
 * const softLaunch = new SoftLaunchService();
 *
 * // Check if org has access
 * if (await softLaunch.hasAccess(orgId)) {
 *   // Allow access to production flows
 * } else {
 *   // Redirect to waitlist
 *   res.redirect('/waitlist');
 * }
 * ```
 */

import { PrismaClient } from '@prisma/client';
import { Request, Response, NextFunction } from 'express';

export interface SoftLaunchConfig {
  enabled: boolean;
  whitelistedOrgIds: string[];
  whitelistedPartnerIds: string[];
  rolloutPercentage: number; // 0-100
  featureToggles: Record<string, boolean>;
  waitlistRedirectUrl: string;
}

export interface WaitlistEntry {
  orgId: string;
  orgName: string;
  email: string;
  requestedAt: Date;
  priority: number;
  metadata?: Record<string, any>;
}

export class SoftLaunchService {
  private prisma: PrismaClient;
  private config: SoftLaunchConfig;
  private cache: Map<string, { hasAccess: boolean; timestamp: number }>;
  private cacheTTL: number = 5 * 60 * 1000; // 5 minutes

  constructor(prisma?: PrismaClient, config?: Partial<SoftLaunchConfig>) {
    this.prisma = prisma || new PrismaClient();
    this.cache = new Map();

    // Default configuration
    this.config = {
      enabled: process.env.SOFT_LAUNCH_ENABLED === 'true',
      whitelistedOrgIds: this.parseWhitelist(process.env.SOFT_LAUNCH_WHITELIST_ORG_IDS),
      whitelistedPartnerIds: this.parseWhitelist(process.env.SOFT_LAUNCH_WHITELIST_PARTNER_IDS),
      rolloutPercentage: parseInt(process.env.SOFT_LAUNCH_ROLLOUT_PERCENTAGE || '0', 10),
      featureToggles: {},
      waitlistRedirectUrl: process.env.SOFT_LAUNCH_WAITLIST_URL || '/waitlist',
      ...config,
    };
  }

  /**
   * Parse comma-separated whitelist from environment variable
   */
  private parseWhitelist(value?: string): string[] {
    if (!value) return [];
    return value.split(',').map(id => id.trim()).filter(Boolean);
  }

  /**
   * Check if soft launch is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Check if organization has access to production flows
   */
  async hasAccess(orgId: string): Promise<boolean> {
    // If soft launch is disabled, everyone has access
    if (!this.config.enabled) {
      return true;
    }

    // Check cache first
    const cached = this.cache.get(orgId);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.hasAccess;
    }

    // Check if org is explicitly whitelisted
    if (this.config.whitelistedOrgIds.includes(orgId)) {
      this.updateCache(orgId, true);
      return true;
    }

    // Check if org is whitelisted via partner ID
    const partner = await this.prisma.partnerConfig.findFirst({
      where: {
        OR: [
          { id: orgId },
          { partnerId: orgId },
        ],
        isActive: true,
      },
    });

    if (partner && this.config.whitelistedPartnerIds.includes(partner.partnerId)) {
      this.updateCache(orgId, true);
      return true;
    }

    // Check database for dynamic whitelist
    const serverConfig = await this.prisma.serverConfig.findUnique({
      where: { key: 'soft_launch_whitelist' },
    });

    if (serverConfig) {
      const dynamicWhitelist = (serverConfig.value as any).orgIds || [];
      if (dynamicWhitelist.includes(orgId)) {
        this.updateCache(orgId, true);
        return true;
      }
    }

    // Check rollout percentage (deterministic based on orgId hash)
    if (this.config.rolloutPercentage > 0) {
      const hasAccessViaRollout = this.checkRolloutPercentage(orgId);
      this.updateCache(orgId, hasAccessViaRollout);
      return hasAccessViaRollout;
    }

    // No access by default
    this.updateCache(orgId, false);
    return false;
  }

  /**
   * Check if org should have access based on rollout percentage
   * Uses deterministic hashing to ensure consistent results
   */
  private checkRolloutPercentage(orgId: string): boolean {
    // Simple hash function to get a consistent percentage for an orgId
    let hash = 0;
    for (let i = 0; i < orgId.length; i++) {
      const char = orgId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    const percentage = Math.abs(hash % 100);
    return percentage < this.config.rolloutPercentage;
  }

  /**
   * Update cache
   */
  private updateCache(orgId: string, hasAccess: boolean): void {
    this.cache.set(orgId, {
      hasAccess,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear cache for specific org or all orgs
   */
  clearCache(orgId?: string): void {
    if (orgId) {
      this.cache.delete(orgId);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Add organization to whitelist
   */
  async addToWhitelist(orgId: string, addedBy?: string): Promise<void> {
    const serverConfig = await this.prisma.serverConfig.findUnique({
      where: { key: 'soft_launch_whitelist' },
    });

    const currentWhitelist = (serverConfig?.value as any)?.orgIds || [];

    if (!currentWhitelist.includes(orgId)) {
      await this.prisma.serverConfig.upsert({
        where: { key: 'soft_launch_whitelist' },
        create: {
          key: 'soft_launch_whitelist',
          value: {
            orgIds: [...currentWhitelist, orgId],
            updatedBy: addedBy || 'system',
            updatedAt: new Date().toISOString(),
          },
          description: 'Soft launch whitelist for pilot organizations',
          updatedBy: addedBy,
        },
        update: {
          value: {
            orgIds: [...currentWhitelist, orgId],
            updatedBy: addedBy || 'system',
            updatedAt: new Date().toISOString(),
          },
          updatedBy: addedBy,
        },
      });

      this.clearCache(orgId);
    }
  }

  /**
   * Remove organization from whitelist
   */
  async removeFromWhitelist(orgId: string, removedBy?: string): Promise<void> {
    const serverConfig = await this.prisma.serverConfig.findUnique({
      where: { key: 'soft_launch_whitelist' },
    });

    if (serverConfig) {
      const currentWhitelist = (serverConfig.value as any)?.orgIds || [];
      const newWhitelist = currentWhitelist.filter((id: string) => id !== orgId);

      await this.prisma.serverConfig.update({
        where: { key: 'soft_launch_whitelist' },
        data: {
          value: {
            orgIds: newWhitelist,
            updatedBy: removedBy || 'system',
            updatedAt: new Date().toISOString(),
          },
          updatedBy: removedBy,
        },
      });

      this.clearCache(orgId);
    }
  }

  /**
   * Get all whitelisted organization IDs
   */
  async getWhitelist(): Promise<string[]> {
    const serverConfig = await this.prisma.serverConfig.findUnique({
      where: { key: 'soft_launch_whitelist' },
    });

    const dynamicWhitelist = (serverConfig?.value as any)?.orgIds || [];

    return [
      ...this.config.whitelistedOrgIds,
      ...this.config.whitelistedPartnerIds,
      ...dynamicWhitelist,
    ];
  }

  /**
   * Add organization to waitlist
   */
  async addToWaitlist(entry: WaitlistEntry): Promise<void> {
    const serverConfig = await this.prisma.serverConfig.findUnique({
      where: { key: 'soft_launch_waitlist' },
    });

    const currentWaitlist = (serverConfig?.value as any)?.entries || [];

    // Check if already on waitlist
    const existingIndex = currentWaitlist.findIndex((e: WaitlistEntry) => e.orgId === entry.orgId);

    if (existingIndex >= 0) {
      // Update existing entry
      currentWaitlist[existingIndex] = {
        ...currentWaitlist[existingIndex],
        ...entry,
        requestedAt: currentWaitlist[existingIndex].requestedAt, // Keep original request date
      };
    } else {
      // Add new entry
      currentWaitlist.push({
        ...entry,
        requestedAt: entry.requestedAt || new Date(),
      });
    }

    await this.prisma.serverConfig.upsert({
      where: { key: 'soft_launch_waitlist' },
      create: {
        key: 'soft_launch_waitlist',
        value: {
          entries: currentWaitlist,
          updatedAt: new Date().toISOString(),
        },
        description: 'Soft launch waitlist for organizations',
      },
      update: {
        value: {
          entries: currentWaitlist,
          updatedAt: new Date().toISOString(),
        },
      },
    });
  }

  /**
   * Get waitlist entries
   */
  async getWaitlist(): Promise<WaitlistEntry[]> {
    const serverConfig = await this.prisma.serverConfig.findUnique({
      where: { key: 'soft_launch_waitlist' },
    });

    const waitlist = (serverConfig?.value as any)?.entries || [];

    // Sort by priority (descending) and requestedAt (ascending)
    return waitlist.sort((a: WaitlistEntry, b: WaitlistEntry) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime();
    });
  }

  /**
   * Remove from waitlist (when granted access)
   */
  async removeFromWaitlist(orgId: string): Promise<void> {
    const serverConfig = await this.prisma.serverConfig.findUnique({
      where: { key: 'soft_launch_waitlist' },
    });

    if (serverConfig) {
      const currentWaitlist = (serverConfig.value as any)?.entries || [];
      const newWaitlist = currentWaitlist.filter((e: WaitlistEntry) => e.orgId !== orgId);

      await this.prisma.serverConfig.update({
        where: { key: 'soft_launch_waitlist' },
        data: {
          value: {
            entries: newWaitlist,
            updatedAt: new Date().toISOString(),
          },
        },
      });
    }
  }

  /**
   * Set rollout percentage (0-100)
   */
  async setRolloutPercentage(percentage: number, updatedBy?: string): Promise<void> {
    if (percentage < 0 || percentage > 100) {
      throw new Error('Rollout percentage must be between 0 and 100');
    }

    await this.prisma.serverConfig.upsert({
      where: { key: 'soft_launch_rollout_percentage' },
      create: {
        key: 'soft_launch_rollout_percentage',
        value: { percentage },
        description: 'Soft launch rollout percentage',
        updatedBy,
      },
      update: {
        value: { percentage },
        updatedBy,
      },
    });

    this.config.rolloutPercentage = percentage;
    this.clearCache(); // Clear cache as rollout changed
  }

  /**
   * Get current rollout percentage
   */
  async getRolloutPercentage(): Promise<number> {
    const serverConfig = await this.prisma.serverConfig.findUnique({
      where: { key: 'soft_launch_rollout_percentage' },
    });

    return (serverConfig?.value as any)?.percentage || this.config.rolloutPercentage;
  }

  /**
   * Express middleware to enforce soft launch access control
   */
  middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      if (!this.config.enabled) {
        return next();
      }

      // Extract orgId from request (adjust based on your auth strategy)
      const orgId = req.headers['x-organization-id'] as string ||
                    req.query.orgId as string ||
                    (req as any).user?.orgId ||
                    (req as any).session?.orgId;

      if (!orgId) {
        // No orgId, check if this is a public route
        if (req.path.startsWith('/public') || req.path === '/waitlist') {
          return next();
        }

        return res.status(403).json({
          error: 'Organization ID required',
          message: 'Please provide a valid organization ID to access this resource',
        });
      }

      const hasAccess = await this.hasAccess(orgId);

      if (!hasAccess) {
        // Check if this is an API request or web request
        if (req.accepts('json')) {
          return res.status(403).json({
            error: 'Access Denied',
            message: 'Your organization is not yet part of the pilot program. Please join our waitlist.',
            waitlistUrl: this.config.waitlistRedirectUrl,
            orgId,
          });
        } else {
          // Redirect to waitlist page
          return res.redirect(this.config.waitlistRedirectUrl);
        }
      }

      next();
    };
  }

  /**
   * Get soft launch status for admin dashboard
   */
  async getStatus(): Promise<{
    enabled: boolean;
    whitelistCount: number;
    waitlistCount: number;
    rolloutPercentage: number;
  }> {
    const whitelist = await this.getWhitelist();
    const waitlist = await this.getWaitlist();

    return {
      enabled: this.config.enabled,
      whitelistCount: whitelist.length,
      waitlistCount: waitlist.length,
      rolloutPercentage: await this.getRolloutPercentage(),
    };
  }
}

// Singleton instance
let softLaunchInstance: SoftLaunchService | null = null;

/**
 * Get or create singleton instance of SoftLaunchService
 */
export function getSoftLaunchService(prisma?: PrismaClient): SoftLaunchService {
  if (!softLaunchInstance) {
    softLaunchInstance = new SoftLaunchService(prisma);
  }
  return softLaunchInstance;
}

/**
 * Express middleware helper
 */
export function softLaunchGuard(prisma?: PrismaClient) {
  const service = getSoftLaunchService(prisma);
  return service.middleware();
}

export default SoftLaunchService;

