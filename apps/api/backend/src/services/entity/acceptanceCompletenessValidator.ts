import type { TrustPassport } from './passportService';

export type CompletenessLevel = 'full' | 'partial' | 'none';

export interface CompletenessResult {
  ok: boolean;
  completenessLevel: CompletenessLevel;
  requiredFieldsMissing: string[];
  evidenceGaps: string[];
}

// ── Required PSV field checks ────────────────────────────────────────────────
// Each check maps to one entry in requiredFieldsMissing when it fails.
// ALL must pass for completenessLevel === 'full'.

const PSV_FIELD_CHECKS: Array<{
  field: string;
  check: (p: TrustPassport) => boolean;
}> = [
  {
    field: 'npi_active',
    check: (p) => /^\d{10}$/.test(p.identity?.npi ?? ''),
  },
  {
    field: 'exclusion_clear',
    check: (p) => p.standing.exclusionStatus === 'CLEAR',
  },
  {
    field: 'license_verified',
    check: (p) => p.standing.licensureStatus === 'verified',
  },
];

// ── Evidence gap checks ──────────────────────────────────────────────────────
// Evidence gaps do not block acceptance on their own but are recorded in the
// audit trail so reviewers can see the completeness picture at decision time.

const EVIDENCE_CHECKS: Array<{
  gap: string;
  check: (p: TrustPassport) => boolean;
}> = [
  {
    gap: 'identity_not_verified',
    check: (p) => p.truth.identity.status === 'VERIFIED',
  },
  {
    gap: 'no_verified_credentials',
    check: (p) => p.authority.credentials.some((c) => !c.stale && !c.reviewRequired),
  },
];

// ── Validator ────────────────────────────────────────────────────────────────

export function validateAcceptanceCompleteness(passport: TrustPassport): CompletenessResult {
  const requiredFieldsMissing: string[] = PSV_FIELD_CHECKS
    .filter(({ check }) => !check(passport))
    .map(({ field }) => field);

  const evidenceGaps: string[] = EVIDENCE_CHECKS
    .filter(({ check }) => !check(passport))
    .map(({ gap }) => gap);

  const completenessLevel: CompletenessLevel =
    requiredFieldsMissing.length === 0 && evidenceGaps.length === 0 ? 'full'
    : requiredFieldsMissing.length === PSV_FIELD_CHECKS.length ? 'none'
    : 'partial';

  return {
    ok: completenessLevel === 'full',
    completenessLevel,
    requiredFieldsMissing,
    evidenceGaps,
  };
}
