/**
 * Feature flags — Wave 182 / Wave 195
 *
 * All major Juggernaut subsystems are gated behind env-var feature flags.
 * Set to "true" in .env.local or Vercel environment variables to enable.
 *
 * Convention: NEXT_PUBLIC_FEATURE_* so flags are readable client-side.
 *
 * Staged rollout tiers (Wave 195):
 *   INTERNAL  — enabled for internal team only (default: flags that are true)
 *   PILOT     — enabled for pilot employers (set via env)
 *   PUBLIC    — fully public
 */

function flag(key: string, defaultVal = false): boolean {
  if (typeof process === 'undefined') return defaultVal;
  const val = process.env[key];
  if (val === undefined) return defaultVal;
  return val === 'true' || val === '1';
}

export const FEATURES = {
  /** Wave 180: Multi-workspace persona system — INTERNAL */
  WORKSPACES:          flag('NEXT_PUBLIC_FEATURE_WORKSPACES',           true),

  /** Wave 182: Mercorized prequalification flow — INTERNAL */
  PREQUALIFY_FLOW_V2:  flag('NEXT_PUBLIC_FEATURE_PREQUALIFY_FLOW_V2',  true),

  /** Wave 185: AI natural-language search — PILOT */
  ASK_VITALCV:         flag('NEXT_PUBLIC_FEATURE_ASK_VITALCV',          false),

  /** Wave 186: Employer knowledge pages — PUBLIC */
  EMPLOYER_PAGES:      flag('NEXT_PUBLIC_FEATURE_EMPLOYER_PAGES',       true),

  /** Wave 187: MATCHA v2 engine — PILOT */
  MATCHA_V2:           flag('NEXT_PUBLIC_FEATURE_MATCHA_V2',            false),

  /** Wave 188: Enhanced explore surface — PUBLIC */
  EXPLORE_V2:          flag('NEXT_PUBLIC_FEATURE_EXPLORE_V2',           true),

  /** Wave 189: AI interview + assessments — PILOT */
  ASSESSMENTS:         flag('NEXT_PUBLIC_FEATURE_ASSESSMENTS',          false),

  /** Wave 190: Verifier pipeline + ATS — PILOT */
  VERIFIER_PIPELINE:   flag('NEXT_PUBLIC_FEATURE_VERIFIER_PIPELINE',    false),

  /** Wave 191: Referral engine — INTERNAL */
  REFERRALS_V2:        flag('NEXT_PUBLIC_FEATURE_REFERRALS_V2',         false),

  /** Wave 192: Ambassador program — INTERNAL */
  AMBASSADOR:          flag('NEXT_PUBLIC_FEATURE_AMBASSADOR',           false),

  /** Wave 193: Instant offer notifications — PILOT */
  INSTANT_OFFERS:      flag('NEXT_PUBLIC_FEATURE_INSTANT_OFFERS',       false),

  /** Wave 194: Marketplace analytics dashboard — INTERNAL */
  MARKETPLACE_ANALYTICS: flag('NEXT_PUBLIC_FEATURE_MARKETPLACE_ANALYTICS', false),
} as const;

export type FeatureKey = keyof typeof FEATURES;

/** Rollout tier metadata — used by Wave 195 docs and launch checklist */
export const ROLLOUT_TIERS: Record<FeatureKey, 'INTERNAL' | 'PILOT' | 'PUBLIC'> = {
  WORKSPACES:            'INTERNAL',
  PREQUALIFY_FLOW_V2:    'INTERNAL',
  ASK_VITALCV:           'PILOT',
  EMPLOYER_PAGES:        'PUBLIC',
  MATCHA_V2:             'PILOT',
  EXPLORE_V2:            'PUBLIC',
  ASSESSMENTS:           'PILOT',
  VERIFIER_PIPELINE:     'PILOT',
  REFERRALS_V2:          'INTERNAL',
  AMBASSADOR:            'INTERNAL',
  INSTANT_OFFERS:        'PILOT',
  MARKETPLACE_ANALYTICS: 'INTERNAL',
};
