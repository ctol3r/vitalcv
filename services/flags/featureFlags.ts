const log = getServiceLogger('flags/featureFlags');
/**
 * B149B-FF-000: Feature Flag Service
 *
 * Centralized service for checking feature flags, supporting:
 * - Global feature flags (from environment or ServerConfig)
 * - Per-organization feature flags (from OrgFeatureFlag)
 * - Fallback to defaults
 */

import { getServiceLogger } from '../logging/serviceLogger';

type PrismaClient = any;
const { PrismaClient: PrismaClientCtor } = require('@prisma/client') as {
  PrismaClient: new () => PrismaClient;
};

export interface FeatureFlagConfig {
  enabled: boolean;
  description?: string;
}

export interface FeatureFlags {
  'applyWithVC.enabled': boolean;
  'eudi.verify.enabled': boolean;
  'ehr.facade.enabled': boolean;
  'payer.enrollment.enabled': boolean;
  'notifications.enabled': boolean;
  'billing.vita.enabled': boolean;
}

/**
 * Feature flag service that checks flags with priority:
 * 1. Org-specific override (OrgFeatureFlag)
 * 2. Global ServerConfig
 * 3. Environment variable
 * 4. Default (true for most features)
 */
export class FeatureFlagService {
  private prisma: PrismaClient;
  private cache: Map<string, { value: boolean; timestamp: number }>;
  private cacheTTL: number = 5 * 60 * 1000; // 5 minutes

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.cache = new Map();
  }

  /**
   * Check if a feature flag is enabled
   * @param flagKey - The feature flag key (e.g., 'applyWithVC.enabled')
   * @param orgId - Optional organization ID for per-org flags
   * @returns true if feature is enabled, false otherwise
   */
  async isEnabled(flagKey: keyof FeatureFlags, orgId?: string): Promise<boolean> {
    // Check cache first
    const cacheKey = orgId ? `${flagKey}:${orgId}` : flagKey;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.value;
    }

    let enabled = false;

    try {
      // 1. Check org-specific override if orgId provided
      // Try OrgFeatureFlag model first (if it exists with enabled field)
      // If not, fall back to ServerConfig with org prefix
      if (orgId) {
        try {
          // Try to find org-specific flag in OrgFeatureFlag
          const orgFlag = await this.prisma.orgFeatureFlag.findUnique({
            where: {
              orgId_flagKey: {
                orgId,
                flagKey,
              },
            },
          });

          if (orgFlag && orgFlag.value !== null) {
            // If value is a boolean, use it directly
            // If value is an object with enabled property, use that
            const value = orgFlag.value as any;
            if (typeof value === 'boolean') {
              enabled = value;
            } else if (value && typeof value === 'object' && 'enabled' in value) {
              enabled = value.enabled;
            }
            this.updateCache(cacheKey, enabled);
            return enabled;
          }

          // Check org-specific ServerConfig
          const orgConfig = await this.prisma.serverConfig.findUnique({
            where: {
              key: `featureFlag.${flagKey}.org.${orgId}`,
            },
          });

          if (orgConfig) {
            const config = orgConfig.value as any;
            if (typeof config === 'boolean') {
              enabled = config;
            } else if (config && typeof config === 'object' && 'enabled' in config) {
              enabled = config.enabled;
            }
            this.updateCache(cacheKey, enabled);
            return enabled;
          }
        } catch (error) {
          // If OrgFeatureFlag model doesn't exist or has different structure, continue
          log.debug(`[FeatureFlag] Org-specific check failed for ${flagKey}:`, error);
        }
      }

      // 2. Check global ServerConfig
      const serverConfig = await this.prisma.serverConfig.findUnique({
        where: {
          key: `featureFlag.${flagKey}`,
        },
      });

      if (serverConfig) {
        const config = serverConfig.value as any;
        if (typeof config === 'boolean') {
          enabled = config;
        } else if (config && typeof config === 'object' && 'enabled' in config) {
          enabled = config.enabled;
        }
        this.updateCache(cacheKey, enabled);
        return enabled;
      }

      // 3. Check environment variable
      const envKey = flagKey.toUpperCase().replace(/\./g, '_');
      const envValue = process.env[envKey];
      if (envValue !== undefined) {
        enabled = envValue === 'true' || envValue === '1';
        this.updateCache(cacheKey, enabled);
        return enabled;
      }

      // 4. Default to true (features are enabled by default unless explicitly disabled)
      enabled = true;
      this.updateCache(cacheKey, enabled);
      return enabled;
    } catch (error) {
      log.error(`[FeatureFlag] Error checking flag ${flagKey}:`, error);
      // On error, default to false for safety
      enabled = false;
      this.updateCache(cacheKey, enabled);
      return enabled;
    }
  }

  /**
   * Update cache
   */
  private updateCache(key: string, value: boolean): void {
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear cache for a specific flag or all flags
   */
  clearCache(flagKey?: keyof FeatureFlags, orgId?: string): void {
    if (flagKey) {
      const cacheKey = orgId ? `${flagKey}:${orgId}` : flagKey;
      this.cache.delete(cacheKey);
      // Also clear org-specific entries
      if (!orgId) {
        for (const key of this.cache.keys()) {
          if (key.startsWith(`${flagKey}:`)) {
            this.cache.delete(key);
          }
        }
      }
    } else {
      this.cache.clear();
    }
  }

  /**
   * Set a feature flag globally via ServerConfig
   */
  async setGlobalFlag(
    flagKey: keyof FeatureFlags,
    enabled: boolean,
    description?: string,
    updatedBy?: string,
  ): Promise<void> {
    await this.prisma.serverConfig.upsert({
      where: {
        key: `featureFlag.${flagKey}`,
      },
      create: {
        key: `featureFlag.${flagKey}`,
        value: {
          enabled,
          description,
        },
        description: `Feature flag: ${flagKey}`,
        updatedBy,
      },
      update: {
        value: {
          enabled,
          description,
        },
        updatedBy,
      },
    });

    // Clear cache
    this.clearCache(flagKey);
  }

  /**
   * Set a feature flag for a specific organization
   */
  async setOrgFlag(
    orgId: string,
    flagKey: keyof FeatureFlags,
    enabled: boolean,
    description?: string,
  ): Promise<void> {
    try {
      // Try OrgFeatureFlag model first
      await this.prisma.orgFeatureFlag.upsert({
        where: {
          orgId_flagKey: {
            orgId,
            flagKey,
          },
        },
        create: {
          orgId,
          flagKey,
          value: enabled,
        },
        update: {
          value: enabled,
        },
      });
    } catch (error) {
      // If OrgFeatureFlag doesn't work, use ServerConfig
      await this.prisma.serverConfig.upsert({
        where: {
          key: `featureFlag.${flagKey}.org.${orgId}`,
        },
        create: {
          key: `featureFlag.${flagKey}.org.${orgId}`,
          value: {
            enabled,
            description,
          },
          description: `Org feature flag: ${flagKey} for org ${orgId}`,
        },
        update: {
          value: {
            enabled,
            description,
          },
        },
      });
    }

    // Clear cache
    this.clearCache(flagKey, orgId);
  }

  /**
   * Get all feature flags for an organization
   */
  async getOrgFlags(orgId: string): Promise<Partial<FeatureFlags>> {
    const flags: Partial<FeatureFlags> = {};

    try {
      const orgFlags = await this.prisma.orgFeatureFlag.findMany({
        where: { orgId },
      });

      for (const flag of orgFlags) {
        const value = flag.value as any;
        if (typeof value === 'boolean') {
          flags[flag.flagKey as keyof FeatureFlags] = value;
        } else if (value && typeof value === 'object' && 'enabled' in value) {
          flags[flag.flagKey as keyof FeatureFlags] = value.enabled;
        }
      }
    } catch (error) {
      // If OrgFeatureFlag doesn't exist, check ServerConfig
      const orgConfigs = await this.prisma.serverConfig.findMany({
        where: {
          key: {
            startsWith: `featureFlag.`,
            endsWith: `.org.${orgId}`,
          },
        },
      });

      for (const config of orgConfigs) {
        const key = config.key.replace(`featureFlag.`, '').replace(`.org.${orgId}`, '');
        const value = config.value as any;
        if (typeof value === 'boolean') {
          flags[key as keyof FeatureFlags] = value;
        } else if (value && typeof value === 'object' && 'enabled' in value) {
          flags[key as keyof FeatureFlags] = value.enabled;
        }
      }
    }

    return flags;
  }
}

// Singleton instance
let featureFlagInstance: FeatureFlagService | null = null;

/**
 * Get or create singleton instance of FeatureFlagService
 */
export function getFeatureFlagService(prisma: PrismaClient): FeatureFlagService {
  if (!featureFlagInstance) {
    featureFlagInstance = new FeatureFlagService(prisma);
  }
  return featureFlagInstance;
}

/**
 * Express middleware to check feature flag
 */
export function featureFlagGuard(
  flagKey: keyof FeatureFlags,
  options?: {
    orgIdExtractor?: (req: any) => string | undefined;
    errorMessage?: string;
    errorCode?: string;
    statusCode?: number;
  },
) {
  return async (req: any, res: any, next: any) => {
    try {
      const prisma = (req as any).prisma || new PrismaClientCtor();
      const featureFlagService = getFeatureFlagService(prisma);

      // Extract orgId if provided
      let orgId: string | undefined;
      if (options?.orgIdExtractor) {
        orgId = options.orgIdExtractor(req);
      } else {
        // Default extraction
        orgId =
          req.headers['x-org-id'] ||
          req.query.orgId ||
          req.body.orgId ||
          req.user?.orgId ||
          req.session?.orgId;
      }

      const enabled = await featureFlagService.isEnabled(flagKey, orgId);

      if (!enabled) {
        const statusCode = options?.statusCode || 503;
        const errorCode = options?.errorCode || 'FEATURE_DISABLED';
        const errorMessage =
          options?.errorMessage ||
          `Feature "${flagKey}" is currently disabled${orgId ? ` for organization ${orgId}` : ''}`;

        log.warn(`[FeatureFlag] ${flagKey} disabled${orgId ? ` for org ${orgId}` : ''}`);

        return res.status(statusCode).json({
          error: errorCode,
          message: errorMessage,
          flagKey,
          orgId: orgId || null,
        });
      }

      next();
    } catch (error) {
      log.error(`[FeatureFlag] Error in guard for ${flagKey}:`, error);
      return res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to check feature flag',
      });
    }
  };
}

/**
 * Helper function to check feature flag in route handlers
 */
export async function checkFeatureFlag(
  prisma: PrismaClient,
  flagKey: keyof FeatureFlags,
  orgId?: string,
): Promise<boolean> {
  const service = getFeatureFlagService(prisma);
  return service.isEnabled(flagKey, orgId);
}
