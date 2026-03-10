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

  // ── PROGRAM GRAVITY WELL (Waves 196–215) ───────────────────────────────────

  /** Wave 197: Trust anchor management — INTERNAL */
  TRUST_ANCHORS:         flag('NEXT_PUBLIC_FEATURE_TRUST_ANCHORS',         false),

  /** Wave 198: NPI-bound DID identity — INTERNAL */
  NPI_DID_BINDING:       flag('NEXT_PUBLIC_FEATURE_NPI_DID_BINDING',       false),

  /** Wave 199: SD-JWT credential issuance — INTERNAL */
  SD_JWT_ISSUER:         flag('NEXT_PUBLIC_FEATURE_SD_JWT_ISSUER',         false),

  /** Wave 202-203: OpenID4VC flows — INTERNAL */
  OID4VC:                flag('NEXT_PUBLIC_FEATURE_OID4VC',                false),

  /** Wave 205-207: PSV adapter layer — INTERNAL */
  PSV_ADAPTERS:          flag('NEXT_PUBLIC_FEATURE_PSV_ADAPTERS',          false),

  /** Wave 208: Imaging credential stack — INTERNAL */
  VERTICAL_IMAGING:      flag('NEXT_PUBLIC_FEATURE_VERTICAL_IMAGING',      false),

  /** Wave 209: Behavioral health credential stack — INTERNAL */
  VERTICAL_BH:           flag('NEXT_PUBLIC_FEATURE_VERTICAL_BH',           false),

  /** Wave 210: Readiness engine — INTERNAL */
  READINESS_ENGINE:      flag('NEXT_PUBLIC_FEATURE_READINESS_ENGINE',      false),

  /** Wave 211: Operator universal search — INTERNAL */
  OPERATOR_SEARCH:       flag('NEXT_PUBLIC_FEATURE_OPERATOR_SEARCH',       false),

  /** Wave 212: Drawer/modal/inspector system — INTERNAL */
  DRAWER_SYSTEM:         flag('NEXT_PUBLIC_FEATURE_DRAWER_SYSTEM',         false),

  /** Wave 213: Mission Ops v2 — INTERNAL */
  MISSION_OPS_V2:        flag('NEXT_PUBLIC_FEATURE_MISSION_OPS_V2',        false),

  /** Wave 214: Contract registry — INTERNAL */
  CONTRACT_REGISTRY:     flag('NEXT_PUBLIC_FEATURE_CONTRACT_REGISTRY',     false),
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
  // Gravity Well
  TRUST_ANCHORS:         'INTERNAL',
  NPI_DID_BINDING:       'INTERNAL',
  SD_JWT_ISSUER:         'INTERNAL',
  OID4VC:                'INTERNAL',
  PSV_ADAPTERS:          'INTERNAL',
  VERTICAL_IMAGING:      'INTERNAL',
  VERTICAL_BH:           'INTERNAL',
  READINESS_ENGINE:      'INTERNAL',
  OPERATOR_SEARCH:       'INTERNAL',
  DRAWER_SYSTEM:         'INTERNAL',
  MISSION_OPS_V2:        'INTERNAL',
  CONTRACT_REGISTRY:     'INTERNAL',
};
