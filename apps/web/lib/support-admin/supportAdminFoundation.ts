/**
 * FOUNDATION-SWEEP-3 — support / admin foundation plan.
 *
 * Truth invariants:
 *   - This is a FOUNDATION-only plan. No live staffed support is
 *     shipped today. No production admin powers are exposed.
 *   - Audit-safe notes never include raw PII, secrets, or upstream
 *     payloads.
 *   - Demo reset requests are non-destructive and require explicit
 *     operator confirmation (see demoResetFoundation).
 *   - Escalation policy documents who may act, not what they may
 *     irreversibly do.
 */

export type SupportAdminCapability =
  | 'support_intake'
  | 'issue_triage'
  | 'admin_review_queue'
  | 'audit_safe_note'
  | 'demo_reset_request'
  | 'escalation_policy';

export type SupportAdminStatus =
  | 'foundation_planned'
  | 'foundation_ready'
  | 'partial'
  | 'unavailable';

export interface SupportAdminRequirement {
  capability: SupportAdminCapability;
  label: string;
  description: string;
  /** Is this capability shipped + staffed today? Always false. */
  isLive: boolean;
  status: SupportAdminStatus;
}

export interface SupportAdminFoundationPlan {
  staffed: false;
  productionAdminEnabled: false;
  requirements: SupportAdminRequirement[];
  disclaimers: string[];
}

const NOT_LIVE_DISCLAIMER =
  'Support and admin are foundation-only this wave. No staffed support is live and no production admin powers are exposed.';
const NON_DESTRUCTIVE_DISCLAIMER =
  'Demo reset plans are non-production and require explicit operator confirmation. No destructive database changes ship in this foundation.';

export function buildSupportAdminFoundationPlan(): SupportAdminFoundationPlan {
  const requirements: SupportAdminRequirement[] = [
    {
      capability: 'support_intake',
      label: 'Support intake',
      description:
        'A documented intake shape for support cases. No live ticketing system is wired.',
      isLive: false,
      status: 'foundation_planned',
    },
    {
      capability: 'issue_triage',
      label: 'Issue triage',
      description:
        'A documented triage flow that classifies a case before any holder-visible action.',
      isLive: false,
      status: 'foundation_planned',
    },
    {
      capability: 'admin_review_queue',
      label: 'Admin review queue',
      description:
        'A read-only foundation for an operator review queue. No production admin powers are exposed.',
      isLive: false,
      status: 'foundation_planned',
    },
    {
      capability: 'audit_safe_note',
      label: 'Audit-safe support note',
      description:
        'A note shape that captures the case decision without raw PII / secrets / upstream payload.',
      isLive: false,
      status: 'foundation_planned',
    },
    {
      capability: 'demo_reset_request',
      label: 'Demo reset request',
      description:
        'Routes a demo-reset request through the demo reset foundation (non-production, non-destructive).',
      isLive: false,
      status: 'foundation_planned',
    },
    {
      capability: 'escalation_policy',
      label: 'Escalation policy',
      description:
        'Documents who may act on each case class. Does NOT grant any new production powers.',
      isLive: false,
      status: 'foundation_planned',
    },
  ];

  return {
    staffed: false,
    productionAdminEnabled: false,
    requirements,
    disclaimers: [NOT_LIVE_DISCLAIMER, NON_DESTRUCTIVE_DISCLAIMER],
  };
}

export function explainSupportAdminStatus(status: SupportAdminStatus): string {
  switch (status) {
    case 'foundation_planned':
      return 'Foundation is documented; capability has not shipped.';
    case 'foundation_ready':
      return 'Foundation is in place; capability is wired but not yet certified end-to-end.';
    case 'partial':
      return 'Capability ships in some flows; not uniform across surfaces.';
    case 'unavailable':
      return 'Capability is unavailable in this environment.';
  }
}
