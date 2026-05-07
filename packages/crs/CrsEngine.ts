/** YC MVP — behavior frozen. Do not modify without scope approval. */
import { validateReceiptSet, type TrustStateReceiptRecord } from '@vitalcv/psv';

export const CRS_START_THRESHOLD = 80;

/**
 * Maximum CRS score allowed when licensure verification cannot be sourced.
 *
 * Rationale: NPPES (the foundational identity source the engine sees most
 * often) enumerates NPI registrations — presence in NPPES does NOT verify
 * that the clinician holds a current, unrevoked medical license. Live
 * licensure sources are Nursys / FSMB / state-board adapters, which today
 * are gated, unsupported, or unintegrated for most jurisdictions.
 *
 * Without verified licensure evidence, the CRS cannot imply PSV-grade
 * trust. The cap forces such records into the L1 (Provisional) band,
 * signaling "manual review required before proceeding" rather than
 * "ready to start."
 *
 * Aligned numerically with the existing missing-acceptance band (45) so
 * the cap composes deterministically with other gates without inventing
 * a new tier.
 */
export const CRS_LICENSURE_UNVERIFIED_CEILING = 45;

export type CrsBand = 'GREEN' | 'YELLOW' | 'RED';

export type CrsBlockingReason =
  | 'MISSING_PSV'
  | 'EXPIRED_PSV'
  | 'REVOKED_PSV'
  | 'MISSING_ACCEPTANCE'
  | 'LICENSURE_UNVERIFIED'
  | 'ACTIVE_DIVERGENCE';

/**
 * State a licensure-verification source can be in for a given clinician.
 *
 * Only `verified` lifts the licensure cap. Every other state — including
 * `unchecked`, `unavailable`, `access_required` (Nursys/FSMB onboarding
 * pending), `unsupported` (no integration), and `missing` (no source for
 * the jurisdiction) — leaves the cap engaged.
 */
export type CrsLicensureSourceState =
  | 'verified'
  | 'unverified'
  | 'unavailable'
  | 'unchecked'
  | 'access_required'
  | 'unsupported'
  | 'missing';

export type CrsLicensureCheck = Readonly<{
  /**
   * True ONLY when at least one licensure source returned a `verified`
   * state for this clinician. Identity-only sources (NPPES) do NOT
   * satisfy this — they enumerate NPIs, they do not verify licensure.
   */
  hasVerifiedLicensure: boolean;
  /**
   * Per-source states observed during the licensure check. Engine reads
   * only `hasVerifiedLicensure`; this field is preserved so the audit
   * trail shows why the cap was engaged.
   */
  source_states: readonly CrsLicensureSourceState[];
}>;

export type CrsOutput = Readonly<{
  clinician_id: string;
  score: number;
  band: CrsBand;
  blocking_reasons: CrsBlockingReason[];
  last_verified_at: string;
}>;

export type CrsEngineDependencies = Readonly<{
  receipts: {
    listByClinician(clinician_id: string):
      | readonly TrustStateReceiptRecord[]
      | Promise<readonly TrustStateReceiptRecord[]>;
  };
  acceptances: {
    existsForClinician(clinician_id: string): boolean | Promise<boolean>;
  };
  divergence?: {
    getForClinician(
      clinician_id: string,
      as_of: string,
    ): { penalty: number; hasBlocking: boolean } | Promise<{ penalty: number; hasBlocking: boolean }>;
  };
  /**
   * Optional licensure-verification check.
   *
   * When supplied AND `hasVerifiedLicensure === false`, the engine caps
   * the score at `CRS_LICENSURE_UNVERIFIED_CEILING` (45) and surfaces
   * `LICENSURE_UNVERIFIED` in `blocking_reasons`. The cap is a HARD
   * CEILING — it strictly clamps the score, never raises it, and is
   * applied AFTER all other gates so it cannot be undone by a later
   * positive signal.
   *
   * When NOT supplied, behavior is unchanged from the YC-MVP frozen
   * baseline — callers that have not yet integrated licensure-source
   * state see no change. The cap is opt-in for callers; once integrated,
   * it is a hard invariant.
   */
  licensure?: {
    getForClinician(clinician_id: string): CrsLicensureCheck | Promise<CrsLicensureCheck>;
  };
  now?: () => Date;
  missing_acceptance_band?: 'YELLOW' | 'RED';
}>;

const BLOCKING_REASON_ORDER: readonly CrsBlockingReason[] = [
  'MISSING_PSV',
  'EXPIRED_PSV',
  'REVOKED_PSV',
  'MISSING_ACCEPTANCE',
  'LICENSURE_UNVERIFIED',
] as const;

function assertClinicianId(value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('clinician_id is required');
  }
}

function sortReasons(reasons: Set<CrsBlockingReason>): CrsBlockingReason[] {
  return BLOCKING_REASON_ORDER.filter((reason) => reasons.has(reason));
}

function computeLastVerifiedAt(receipts: readonly TrustStateReceiptRecord[], fallbackIso: string): string {
  let latest = 0;

  for (const receipt of receipts) {
    const parsed = Date.parse(receipt.fetched_at);
    if (Number.isFinite(parsed)) {
      latest = Math.max(latest, parsed);
    }
  }

  return latest > 0 ? new Date(latest).toISOString() : fallbackIso;
}

export class CrsEngine {
  constructor(private readonly deps: CrsEngineDependencies) {}

  async computeForClinician(input: { clinician_id: string; as_of: string }): Promise<CrsOutput> {
    assertClinicianId(input?.clinician_id);

    const asOf = input.as_of || (this.deps.now ?? (() => new Date()))().toISOString();

    const [receipts, hasAcceptance] = await Promise.all([
      this.deps.receipts.listByClinician(input.clinician_id),
      this.deps.acceptances.existsForClinician(input.clinician_id),
    ]);
    const divergence = this.deps.divergence
      ? await this.deps.divergence.getForClinician(input.clinician_id, asOf)
      : { penalty: 0, hasBlocking: false };
    const licensure = this.deps.licensure
      ? await this.deps.licensure.getForClinician(input.clinician_id)
      : null;
    const licensureUnverified = licensure !== null && !licensure.hasVerifiedLicensure;

    const receiptSummary = validateReceiptSet(receipts, asOf);

    const reasons = new Set<CrsBlockingReason>();
    if (receiptSummary.has_missing) reasons.add('MISSING_PSV');
    if (receiptSummary.has_expired) reasons.add('EXPIRED_PSV');
    if (receiptSummary.has_revoked) reasons.add('REVOKED_PSV');
    if (!hasAcceptance) reasons.add('MISSING_ACCEPTANCE');
    if (licensureUnverified) reasons.add('LICENSURE_UNVERIFIED');
    if (divergence.hasBlocking) reasons.add('ACTIVE_DIVERGENCE');

    const orderedReasons = sortReasons(reasons);

    let score = 95;
    let band: CrsBand = 'GREEN';

    if (receiptSummary.has_missing || receiptSummary.has_expired || receiptSummary.has_revoked) {
      score = 25;
      band = 'RED';
    } else if (!hasAcceptance) {
      if (this.deps.missing_acceptance_band === 'RED') {
        score = 45;
        band = 'RED';
      } else {
        // Missing acceptance remains start-blocking via YELLOW band, while preserving deterministic score >= 80.
        score = 80;
        band = 'YELLOW';
      }
    }

    score = Math.max(0, score - Math.max(0, divergence.penalty));

    if (band !== 'RED') {
      band = score >= 80 ? 'GREEN' : 'YELLOW';
    }

    if (divergence.hasBlocking && band !== 'RED') {
      score = Math.min(score, 79);
      band = 'YELLOW';
    }

    // Licensure cap — final invariant.
    //
    // Applied AFTER every other gate so a later positive signal cannot
    // lift a record above the L1 ceiling once licensure is unverified.
    // The cap strictly clamps; it never raises. RED records stay RED;
    // YELLOW stays YELLOW; GREEN drops to YELLOW.
    if (licensureUnverified) {
      score = Math.min(score, CRS_LICENSURE_UNVERIFIED_CEILING);
      if (band !== 'RED') {
        band = 'YELLOW';
      }
    }

    return Object.freeze({
      clinician_id: input.clinician_id,
      score,
      band,
      blocking_reasons: orderedReasons,
      last_verified_at: computeLastVerifiedAt(receipts, asOf),
    });
  }
}
