/**
 * Feature Flags System
 *
 * Purpose:
 * - Safe rollouts for new features
 * - Instant disable capability for unstable features
 * - A/B testing support
 * - Gradual rollout capacity
 *
 * Usage:
 * 1. Add feature flag to FEATURE_FLAGS object
 * 2. Use in code with isFeatureEnabled() helper
 * 3. Override via environment variable: FEATURE_FLAGS__FLAG_NAME__enabled=true
 * 4. Monitor and adjust rollout percentage
 */

export interface FeatureFlag {
  enabled: boolean;
  rollout: number; // 0-100% of users
  description: string;
  allowOverride?: boolean; // Allow local dev override
}

export const FEATURE_FLAGS = {
  // Readiness enhancements
  ENHANCED_READINESS_SUMMARY: {
    enabled: false,
    rollout: 0,
    description: "Enhanced readiness summary with AI insights",
    allowOverride: true,
  },

  // Passport improvements
  DIGITAL_WALLET_INTEGRATION: {
    enabled: false,
    rollout: 0,
    description: "Digital wallet integration for passport",
    allowOverride: true,
  },

  // API features
  EMPLOYER_RISK_INTELLIGENCE: {
    enabled: false,
    rollout: 0,
    description: "Employer risk intelligence API",
    allowOverride: true,
  },

  // Verification features
  REALTIME_VERIFICATION: {
    enabled: false,
    rollout: 0,
    description: "Real-time verification status updates",
    allowOverride: true,
  },

  // Compliance features
  COMPLIANCE_AUTOMATION: {
    enabled: false,
    rollout: 0,
    description: "Automated compliance checks and alerts",
    allowOverride: true,
  },

  // Decision engine
  DECISION_ENGINE_V2: {
    enabled: false,
    rollout: 0,
    description: "Enhanced decision engine with trust graph",
    allowOverride: true,
  },
} as const satisfies Record<string, FeatureFlag>;

export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

/**
 * Check if a feature flag is enabled for a given user
 *
 * @param flagKey - Feature flag name
 * @param userId - User ID for rollout percentage (optional)
 * @returns true if feature is enabled
 */
export function isFeatureEnabled(
  flagKey: FeatureFlagKey,
  userId?: string
): boolean {
  const flag = FEATURE_FLAGS[flagKey];

  // Check environment override for local development
  if (flag.allowOverride && process.env.NODE_ENV === "development") {
    const envOverride = process.env[
      `FEATURE_FLAGS__${flagKey}__enabled`
    ] as string;
    if (envOverride !== undefined) {
      return envOverride === "true";
    }
  }

  // If flag is globally enabled
  if (flag.enabled) {
    return true;
  }

  // If rollout is 0, disabled
  if (flag.rollout === 0) {
    return false;
  }

  // If no userId provided and rollout > 0, enable
  if (!userId) {
    return true;
  }

  // Hash-based rollout for consistent user experience
  const hash = hashUserId(userId);
  const threshold = (flag.rollout / 100) * 0xFFFFFFFF;
  return hash < threshold;
}

/**
 * Simple hash function for consistent feature flag rollout
 *
 * @param userId - User ID
 * @returns Hash value
 */
function hashUserId(userId: string): number {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Get all enabled feature flags
 *
 * @returns Array of enabled feature flag names
 */
export function getEnabledFlags(): FeatureFlagKey[] {
  return Object.keys(FEATURE_FLAGS).filter((key) =>
    FEATURE_FLAGS[key as FeatureFlagKey].enabled
  ) as FeatureFlagKey[];
}

/**
 * Get feature flag config (for admin/debug use)
 *
 * @param flagKey - Feature flag name
 * @returns Feature flag configuration
 */
export function getFeatureFlag(flagKey: FeatureFlagKey): FeatureFlag {
  return FEATURE_FLAGS[flagKey];
}

/**
 * Check if feature flag exists
 *
 * @param flagKey - Feature flag name
 * @returns true if flag exists
 */
export function hasFeatureFlag(flagKey: string): flagKey is FeatureFlagKey {
  return flagKey in FEATURE_FLAGS;
}

/**
 * Emergency disable all features
 *
 * Use this for rapid response to production incidents
 */
export function emergencyDisableAll(): void {
  Object.keys(FEATURE_FLAGS).forEach((key) => {
    // This would normally update a database or config service
    // For now, it's a no-op that documents intent
    console.warn(`Emergency disable: ${key}`);
  });
}
