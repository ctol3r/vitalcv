/**
 * B149B-FF-000: Feature Flag Service
 *
 * Centralized service for checking feature flags, supporting:
 * - Global feature flags (from environment or ServerConfig)
 * - Per-organization feature flags (from OrgFeatureFlag)
 * - Fallback to defaults
 */
type PrismaClient = {
  [key: string]: any;
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
export declare class FeatureFlagService {
  private prisma;
  private cache;
  private cacheTTL;
  constructor(prisma: PrismaClient);
  /**
   * Check if a feature flag is enabled
   * @param flagKey - The feature flag key (e.g., 'applyWithVC.enabled')
   * @param orgId - Optional organization ID for per-org flags
   * @returns true if feature is enabled, false otherwise
   */
  isEnabled(flagKey: keyof FeatureFlags, orgId?: string): Promise<boolean>;
  /**
   * Update cache
   */
  private updateCache;
  /**
   * Clear cache for a specific flag or all flags
   */
  clearCache(flagKey?: keyof FeatureFlags, orgId?: string): void;
  /**
   * Set a feature flag globally via ServerConfig
   */
  setGlobalFlag(
    flagKey: keyof FeatureFlags,
    enabled: boolean,
    description?: string,
    updatedBy?: string,
  ): Promise<void>;
  /**
   * Set a feature flag for a specific organization
   */
  setOrgFlag(
    orgId: string,
    flagKey: keyof FeatureFlags,
    enabled: boolean,
    description?: string,
  ): Promise<void>;
  /**
   * Get all feature flags for an organization
   */
  getOrgFlags(orgId: string): Promise<Partial<FeatureFlags>>;
}
/**
 * Get or create singleton instance of FeatureFlagService
 */
export declare function getFeatureFlagService(prisma: PrismaClient): FeatureFlagService;
/**
 * Express middleware to check feature flag
 */
export declare function featureFlagGuard(
  flagKey: keyof FeatureFlags,
  options?: {
    orgIdExtractor?: (req: any) => string | undefined;
    errorMessage?: string;
    errorCode?: string;
    statusCode?: number;
  },
): (req: any, res: any, next: any) => Promise<any>;
/**
 * Helper function to check feature flag in route handlers
 */
export declare function checkFeatureFlag(
  prisma: PrismaClient,
  flagKey: keyof FeatureFlags,
  orgId?: string,
): Promise<boolean>;
