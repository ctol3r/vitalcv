/**
 * Exact-key status vocabulary for licensure and board-certification claims.
 *
 * FAIL-CLOSED CONTRACT. This module exists because three separate call sites
 * classified a licence by substring, testing the affirmative arm first:
 *
 *     statusStr.includes('ACTIVE') ? 'ACTIVE' : ...
 *
 * `'INACTIVE'.includes('ACTIVE')` is true, so the INACTIVE arm below it was
 * unreachable dead code and every INACTIVE licence was published as ACTIVE.
 * The same trap fired on 'NOT CURRENT' via `includes('CURRENT')` and on
 * 'NOT CERTIFIED' via `includes('CERTIFIED')` — a clinician the board reports
 * as *not* board certified read as certified. This is the same defect fixed in
 * the DCA BreEZe PSV adapter (`psv-adapters/adapters/dcaBreezeAdapter.ts`); it
 * was copied into the identity ingestion path four times.
 *
 * Substring matching cannot express negation safely, so it is gone. A status
 * is resolved by exact lookup on a normalized key, and anything unmapped
 * resolves to UNKNOWN — never to an affirmative. Callers are expected to set
 * `reviewRequired` when `recognized` is false: an unreadable status is a
 * finding to surface, not a licence to grant.
 *
 * Adding a key to AFFIRMATIVE buckets (ACTIVE / CERTIFIED) widens what the
 * platform will publish as verified. Adding a key to any other bucket cannot.
 * Treat the affirmative buckets as the security boundary of this file.
 *
 * The already-correct guarded checks in
 * `providers/connectors/caBreezeLiveLookup.ts` and
 * `packages/source-adapters/src/adapters/ca-board.ts` use
 * `includes('ACTIVE') && !includes('INACTIVE')`, and supplied the
 * board-reported vocabulary encoded below.
 */
import type { BoardCertValue, LicenseValue } from './evidenceModel';

export type LicenseStatus = LicenseValue['licenseStatus'];
export type CertificationStatus = BoardCertValue['certificationStatus'];

export interface StatusResolution<T> {
  /** The resolved status. Never affirmative unless an exact key matched. */
  status: T;
  /** False when the source carried no status, or one outside the vocabulary. */
  recognized: boolean;
  /** The board-reported text, or null when the source carried no status field. */
  raw: string | null;
}

/**
 * Normalizes separators so 'NOT_CURRENT' and 'NOT-CURRENT' reach the same key
 * as 'NOT CURRENT'. This can only ever merge spellings of the same word; it
 * cannot turn a negated status into an affirmative one, because no affirmative
 * key contains a separator that a negation could be collapsed into.
 */
function statusKey(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s_-]+/g, ' ');
}

/**
 * The ONLY strings that may produce an active licence. Everything else fails
 * closed. Keep this list short and exact — it is the affirmative boundary.
 */
const ACTIVE_LICENSE_KEYS = new Set([
  'ACTIVE',
  'ACTIVE IN RENEWAL',
  'CURRENT',
]);

/**
 * Non-affirmative board vocabulary. These all fail closed, so breadth here is
 * safe: a status landing in the wrong non-affirmative bucket cannot manufacture
 * readiness. INACTIVE maps to EXPIRED to match the ruling made for the DCA
 * BreEZe adapter — the union has no INACTIVE member and EXPIRED is the closest
 * non-affirmative one.
 */
const NON_AFFIRMATIVE_LICENSE_KEYS: Record<string, Exclude<LicenseStatus, 'ACTIVE' | 'UNKNOWN'>> = {
  EXPIRED: 'EXPIRED',
  LAPSED: 'EXPIRED',
  INACTIVE: 'EXPIRED',
  'IN ACTIVE': 'EXPIRED',
  'NOT CURRENT': 'EXPIRED',
  'NOT ACTIVE': 'EXPIRED',
  'NOT RENEWED': 'EXPIRED',
  DELINQUENT: 'EXPIRED',
  CANCELLED: 'EXPIRED',
  CANCELED: 'EXPIRED',
  CLOSED: 'EXPIRED',
  RETIRED: 'EXPIRED',
  REVOKED: 'REVOKED',
  REVOCATION: 'REVOKED',
  SUSPENDED: 'SUSPENDED',
  SUSPENSION: 'SUSPENDED',
};

/**
 * Deliberately absent: SURRENDERED, PROBATION, RESTRICTED, ENCUMBERED,
 * DECEASED. Each is unambiguously adverse, but `LicenseValue['licenseStatus']`
 * has no member that states what the board actually said, and rounding a
 * surrender to REVOKED misstates the record in the other direction. They
 * resolve to UNKNOWN with `recognized: false`, which keeps them out of
 * readiness and puts them in front of a human instead.
 */

const CERTIFIED_KEYS = new Set(['CERTIFIED']);

const NON_AFFIRMATIVE_CERT_KEYS: Record<string, Exclude<CertificationStatus, 'CERTIFIED' | 'UNKNOWN'>> = {
  'NOT CERTIFIED': 'NOT_CERTIFIED',
  'NEVER CERTIFIED': 'NOT_CERTIFIED',
  'NON CERTIFIED': 'NOT_CERTIFIED',
  UNCERTIFIED: 'NOT_CERTIFIED',
  LAPSED: 'LAPSED',
  EXPIRED: 'LAPSED',
  'NOT MEETING MOC REQUIREMENTS': 'LAPSED',
};

function resolve<T>(
  raw: unknown,
  affirmative: Set<string>,
  affirmativeValue: T,
  nonAffirmative: Record<string, T>,
  unknownValue: T,
): StatusResolution<T> {
  if (typeof raw !== 'string' || raw.trim() === '') {
    // Absence of a status is not a status. It must never default to the
    // affirmative — that fabricates a board finding out of a missing field.
    return { status: unknownValue, recognized: false, raw: null };
  }

  const key = statusKey(raw);
  if (affirmative.has(key)) {
    return { status: affirmativeValue, recognized: true, raw };
  }

  const mapped = nonAffirmative[key];
  if (mapped !== undefined) {
    return { status: mapped, recognized: true, raw };
  }

  return { status: unknownValue, recognized: false, raw };
}

/** Resolve a board-reported licence status. Fails closed to UNKNOWN. */
export function resolveLicenseStatus(raw: unknown): StatusResolution<LicenseStatus> {
  return resolve<LicenseStatus>(
    raw,
    ACTIVE_LICENSE_KEYS,
    'ACTIVE',
    NON_AFFIRMATIVE_LICENSE_KEYS,
    'UNKNOWN',
  );
}

/** Resolve a board-reported certification status. Fails closed to UNKNOWN. */
export function resolveCertificationStatus(raw: unknown): StatusResolution<CertificationStatus> {
  return resolve<CertificationStatus>(
    raw,
    CERTIFIED_KEYS,
    'CERTIFIED',
    NON_AFFIRMATIVE_CERT_KEYS,
    'UNKNOWN',
  );
}

/**
 * The reason a claim needs human review, or null when the status was
 * recognized. Distinguishes "the source said nothing" from "the source said
 * something we do not have a member for" — both are UNKNOWN, but they are
 * different findings and a reviewer needs to know which one they are looking at.
 */
export function unrecognizedStatusReason(
  sourceLabel: string,
  resolution: StatusResolution<unknown>,
): string | null {
  if (resolution.recognized) return null;
  return resolution.raw === null
    ? `${sourceLabel} returned no license status — treated as UNKNOWN, not as active.`
    : `${sourceLabel} returned an unrecognized status "${resolution.raw}" — treated as UNKNOWN, not as active.`;
}
