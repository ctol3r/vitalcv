/**
 * Canonical actor model for unresolved trust states.
 *
 * Every blocker, gap, source failure, or access gate must answer four
 * questions:
 *   1. What happened?
 *   2. Who owns the fix?
 *   3. What action is possible now?
 *   4. What happens if the user continues anyway?
 *
 * Doctrine (from Launch Gate H5 + Source Coverage Matrix rule 6):
 *   - System failure is never assigned to USER.
 *   - Access-required is never a clinician defect.
 *   - Stale source is not equivalent to user missing data.
 *   - No ownerless blockers on live wedge surfaces.
 */

export const ACTION_OWNER = {
  USER: 'USER',
  VITALCV: 'VITALCV',
  EMPLOYER: 'EMPLOYER',
  SOURCE: 'SOURCE',
  INSTITUTION: 'INSTITUTION',
  REVIEWER: 'REVIEWER',
  UNKNOWN: 'UNKNOWN',
} as const;

export type ActionOwner = typeof ACTION_OWNER[keyof typeof ACTION_OWNER];

export type ActionType =
  | 'retry'      // VitalCV will retry a failed source call
  | 'upload'     // user provides a document or identity claim
  | 'contact'    // user contacts an external authority
  | 'wait'       // user waits on a system or review
  | 'external'   // user navigates to a third-party site
  | 'none';      // no user-facing action possible

export interface BlockerOwnership {
  /** Canonical owner of the fix. */
  owner: ActionOwner;
  /** One-sentence reason this owner is responsible. */
  rationale: string;
  /** Plain-language blocker title (what the user reads). */
  plainLabel: string;
  /** Owner-prefixed sentence: "You need to…", "VitalCV is retrying…", etc. */
  ownerPrefix: string;
  /** Verb on the CTA. Never generic "Take Action". */
  actionLabel: string;
  /** Nature of the action — drives which surface handles it. */
  actionType: ActionType;
  /** Human-readable ETA or dependency note. Null when unknown. */
  etaOrDependency: string | null;
  /**
   * Whether the user can continue to a passport view without resolving
   * this blocker. Gated/access-required items typically allow a
   * provisional continuation; active integrity failures (OIG exclusion)
   * do not.
   */
  canProceed: boolean;
}

export interface EmployerFacingOwnershipCopy {
  ownerLabel: string;
  title: string;
  detail: string;
}

const UNKNOWN_OWNERSHIP: BlockerOwnership = {
  owner: ACTION_OWNER.UNKNOWN,
  rationale: 'Ownership of this gap has not been classified yet.',
  plainLabel: 'Unclassified gap',
  ownerPrefix: 'We need to classify this gap',
  actionLabel: 'Review details',
  actionType: 'none',
  etaOrDependency: null,
  canProceed: true,
};

/**
 * Map an internal blocker string (from deriveBlockers) to ownership
 * metadata. Exhaustive for every blocker the stream produces today.
 */
export function resolveBlockerOwnership(blocker: string): BlockerOwnership {
  switch (blocker) {
    case 'On OIG exclusion list':
      return {
        owner: ACTION_OWNER.USER,
        rationale:
          'A federal exclusion is attached to this NPI. Only the clinician can pursue a formal dispute with the OIG.',
        plainLabel: 'Federal exclusion on record',
        ownerPrefix: 'You need to resolve this exclusion with the OIG',
        actionLabel: 'Open OIG dispute guide',
        actionType: 'external',
        etaOrDependency: 'OIG dispute process typically takes 30+ days',
        canProceed: false,
      };

    case 'Exclusion check failed':
      return {
        owner: ACTION_OWNER.VITALCV,
        rationale:
          'The OIG/LEIE source did not return a usable response. VitalCV retries automatically on the next ingest.',
        plainLabel: 'Exclusion check did not complete',
        ownerPrefix: 'VitalCV is retrying the OIG check',
        actionLabel: 'Retry OIG check',
        actionType: 'retry',
        etaOrDependency: 'Retries run on the next page load',
        canProceed: true,
      };

    case 'Medicare enrollment unresolved':
      return {
        owner: ACTION_OWNER.SOURCE,
        rationale:
          'CMS PECOS has not returned a definitive enrollment status. PECOS refreshes quarterly — the record may exist but not yet reflect recent changes.',
        plainLabel: 'Medicare enrollment not yet resolved',
        ownerPrefix: 'CMS PECOS is refreshing',
        actionLabel: 'Check PECOS directly',
        actionType: 'external',
        etaOrDependency: 'PECOS refreshes quarterly; direct check at CMS is real-time',
        canProceed: true,
      };

    case 'Not enrolled in Medicare':
      return {
        owner: ACTION_OWNER.USER,
        rationale:
          'CMS returned a definitive "not enrolled" status. Only the clinician can submit a Medicare enrollment application through PECOS.',
        plainLabel: 'Not enrolled in Medicare',
        ownerPrefix: 'You need to enroll in Medicare through PECOS',
        actionLabel: 'Open PECOS enrollment',
        actionType: 'external',
        etaOrDependency: 'Medicare enrollment typically takes 14 days after submission',
        canProceed: true,
      };

    default: {
      // Derived "N unresolved readiness items" pattern — owner unclear
      // without upstream detail. Label honestly; do not imply ownership.
      if (/^\d+ unresolved readiness items?$/.test(blocker)) {
        return {
          owner: ACTION_OWNER.UNKNOWN,
          rationale:
            'Upstream readiness engine reported unresolved items without per-item ownership. Detailed breakdown requires a full passport view.',
          plainLabel: blocker,
          ownerPrefix: 'Open the passport to see per-item detail',
          actionLabel: 'View passport detail',
          actionType: 'none',
          etaOrDependency: null,
          canProceed: true,
        };
      }
      return { ...UNKNOWN_OWNERSHIP, plainLabel: blocker };
    }
  }
}

/**
 * State-board access ownership. State boards are ACCESS_REQUIRED at the
 * platform level (Source Coverage Matrix section 2) — per-state
 * agreements are not in place for pilot. This is an institutional gate,
 * never a clinician defect.
 */
export function resolveStateBoardOwnership(): BlockerOwnership {
  return {
    owner: ACTION_OWNER.INSTITUTION,
    rationale:
      'State medical boards require per-state agreements for programmatic access. VitalCV does not support this lane in the current passport flow.',
    plainLabel: 'State board verification not yet supported',
    ownerPrefix: 'Your employer or institution covers state-board verification for now',
    actionLabel: 'Review state-board note',
    actionType: 'none',
    etaOrDependency: 'State-board coverage rolls out per pilot agreement',
    canProceed: true,
  };
}

/**
 * Omega recompute upstream failure. When the action capsule landed
 * locally but the Omega POST did not, VitalCV owns the retry on the
 * next page load. User can continue; the next refresh reconciles.
 */
export function resolveOmegaRecomputeFailureOwnership(): BlockerOwnership {
  return {
    owner: ACTION_OWNER.VITALCV,
    rationale:
      'Your action was recorded locally, but the upstream decision view did not refresh. VitalCV retries on the next page load.',
    plainLabel: 'Upstream decision view did not refresh',
    ownerPrefix: 'VitalCV will retry the recompute',
    actionLabel: 'Refresh now',
    actionType: 'retry',
    etaOrDependency: 'Retries automatically on the next navigation',
    canProceed: true,
  };
}

export function describeBlockerOwnershipForEmployer(
  blockerOrOwnership: string | BlockerOwnership,
): EmployerFacingOwnershipCopy {
  const ownership = typeof blockerOrOwnership === 'string'
    ? resolveBlockerOwnership(blockerOrOwnership)
    : blockerOrOwnership;

  switch (ownership.owner) {
    case ACTION_OWNER.USER:
      return {
        ownerLabel: 'Clinician-owned',
        title: ownership.plainLabel,
        detail: `${ownership.plainLabel}. The clinician must resolve this before you can rely on it.`,
      };
    case ACTION_OWNER.VITALCV:
      return {
        ownerLabel: 'VitalCV-owned',
        title: ownership.plainLabel,
        detail: `${ownership.plainLabel}. VitalCV is retrying this source check and will update the review when it completes.`,
      };
    case ACTION_OWNER.SOURCE:
      return {
        ownerLabel: 'Source-owned',
        title: ownership.plainLabel,
        detail: `${ownership.plainLabel}. The source system must refresh before this lane becomes current again.`,
      };
    case ACTION_OWNER.EMPLOYER:
      return {
        ownerLabel: 'Employer-owned',
        title: ownership.plainLabel,
        detail: `${ownership.plainLabel}. Your employer owns the next step on this lane.`,
      };
    case ACTION_OWNER.INSTITUTION:
      return {
        ownerLabel: 'Institution-owned',
        title: ownership.plainLabel,
        detail: `${ownership.plainLabel}. Your employer or institution covers this lane outside the current VitalCV proof.`,
      };
    case ACTION_OWNER.REVIEWER:
      return {
        ownerLabel: 'Reviewer-owned',
        title: ownership.plainLabel,
        detail: `${ownership.plainLabel}. A reviewer must examine this finding before you rely on it.`,
      };
    case ACTION_OWNER.UNKNOWN:
    default:
      return {
        ownerLabel: 'Ownership pending',
        title: ownership.plainLabel,
        detail: `${ownership.plainLabel}. Ownership detail is not attached yet. Review the full passport before relying on it.`,
      };
  }
}
