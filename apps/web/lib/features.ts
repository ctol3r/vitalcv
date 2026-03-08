/**
 * Feature flags — Wave 182 / Wave 195
 *
 * All major Juggernaut subsystems are gated behind env-var feature flags.
 * Set to "true" in .env.local or Vercel environment variables to enable.
 *
 * Convention: NEXT_PUBLIC_FEATURE_* so flags are readable client-side.
 */

function flag(key: string, defaultVal = false): boolean {
  if (typeof process === 'undefined') return defaultVal;
  const val = process.env[key];
  if (val === undefined) return defaultVal;
  return val === 'true' || val === '1';
}

export const FEATURES = {
  /** Wave 182: Mercorized prequalification flow */
  PREQUALIFY_FLOW_V2:  flag('NEXT_PUBLIC_FEATURE_PREQUALIFY_FLOW_V2',  true),

  /** Wave 180: Multi-workspace persona system */
  WORKSPACES:          flag('NEXT_PUBLIC_FEATURE_WORKSPACES',           true),

  /** Wave 185: AI natural-language search */
  ASK_VITALCV:         flag('NEXT_PUBLIC_FEATURE_ASK_VITALCV',          false),

  /** Wave 187: MATCHA v2 engine */
  MATCHA_V2:           flag('NEXT_PUBLIC_FEATURE_MATCHA_V2',            false),

  /** Wave 191: Referral engine */
  REFERRALS_V2:        flag('NEXT_PUBLIC_FEATURE_REFERRALS_V2',         false),

  /** Wave 186: Employer knowledge pages */
  EMPLOYER_PAGES:      flag('NEXT_PUBLIC_FEATURE_EMPLOYER_PAGES',       true),

  /** Wave 193: Instant offer notifications */
  INSTANT_OFFERS:      flag('NEXT_PUBLIC_FEATURE_INSTANT_OFFERS',       false),
} as const;

export type FeatureKey = keyof typeof FEATURES;
