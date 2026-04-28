/**
 * FOUNDATION-SWEEP-3 — demo reset foundation plan.
 *
 * Truth invariants:
 *   - Demo reset is PLANNED / FOUNDATION ONLY. No production reset
 *     ships in this wave.
 *   - No method here performs a destructive database change. Every
 *     reset action requires explicit operator confirmation.
 *   - "Production" data (real clinician records, real PSV receipts,
 *     real audit-boundary records) is OUT of every demo reset
 *     scope by construction.
 */

export type DemoResetScope =
  | 'demo_session'
  | 'demo_clinician_profile'
  | 'demo_issuer_request'
  | 'demo_review_decision'
  | 'demo_import_inbox';

export type DemoResetStatus =
  | 'foundation_planned'
  | 'foundation_ready_pending_confirmation'
  | 'unavailable';

export interface DemoResetSpec {
  scope: DemoResetScope;
  label: string;
  description: string;
  /** Is the reset for this scope shipped and runnable today? Always false. */
  isLive: boolean;
  /** Is this scope ever destructive to production data? Always false. */
  destructiveToProduction: false;
  /** Does this scope require explicit operator confirmation? Always true. */
  requiresOperatorConfirmation: true;
  status: DemoResetStatus;
}

export interface DemoResetPlan {
  /** Is any demo reset shipped + runnable today? Always false. */
  productionResetEnabled: false;
  /** Is any demo reset ever destructive to production data? Always false. */
  destructive: false;
  scopes: DemoResetSpec[];
  /** UI disclaimers rendered verbatim. */
  disclaimers: string[];
}

const NON_PRODUCTION_DISCLAIMER =
  'Demo reset plans are non-production and require explicit operator confirmation.';
const NO_DESTRUCTIVE_DISCLAIMER =
  'No destructive database changes ship in this wave. Every scope is bounded to demo data only.';
const PRODUCTION_DATA_DISCLAIMER =
  'Real clinician records, real PSV receipts, and real audit-boundary records are out of every demo reset scope by construction.';

export function buildDemoResetFoundationPlan(): DemoResetPlan {
  const scopes: DemoResetSpec[] = [
    {
      scope: 'demo_session',
      label: 'Demo session reset',
      description:
        'Clears the local demo session for the current operator. Does not touch any persisted record.',
      isLive: false,
      destructiveToProduction: false,
      requiresOperatorConfirmation: true,
      status: 'foundation_planned',
    },
    {
      scope: 'demo_clinician_profile',
      label: 'Demo clinician profile reset',
      description:
        'Resets demo-only clinician profile fields. Real clinician profiles are out of scope.',
      isLive: false,
      destructiveToProduction: false,
      requiresOperatorConfirmation: true,
      status: 'foundation_planned',
    },
    {
      scope: 'demo_issuer_request',
      label: 'Demo issuer request reset',
      description:
        'Resets demo-only issuer request state. No production issuer request is touched.',
      isLive: false,
      destructiveToProduction: false,
      requiresOperatorConfirmation: true,
      status: 'foundation_planned',
    },
    {
      scope: 'demo_review_decision',
      label: 'Demo review decision reset',
      description:
        'Resets demo-only review decision state. No production review decision is touched.',
      isLive: false,
      destructiveToProduction: false,
      requiresOperatorConfirmation: true,
      status: 'foundation_planned',
    },
    {
      scope: 'demo_import_inbox',
      label: 'Demo import inbox reset',
      description:
        'Clears the demo-only import inbox queue. Real import data is out of scope.',
      isLive: false,
      destructiveToProduction: false,
      requiresOperatorConfirmation: true,
      status: 'foundation_planned',
    },
  ];

  return {
    productionResetEnabled: false,
    destructive: false,
    scopes,
    disclaimers: [
      NON_PRODUCTION_DISCLAIMER,
      NO_DESTRUCTIVE_DISCLAIMER,
      PRODUCTION_DATA_DISCLAIMER,
    ],
  };
}

export function explainDemoResetSafety(spec: DemoResetSpec): string {
  return `Scope "${spec.label}" is bounded to demo data; cannot reach production records; requires explicit operator confirmation.`;
}
