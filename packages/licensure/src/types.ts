/**
 * Licensure data contracts.
 *
 * These types encode the DATA-TRUTH RULES of the national licensure coverage
 * program. They are deliberately narrow: several rules are enforced by making
 * the dishonest state *unrepresentable* rather than by runtime validation.
 *
 * Rules encoded here:
 *   - LICENSE_REPORTED is not LICENSE      -> LicensureClaimKind
 *   - A catalog entry is not a live source -> LicensureAuthority carries NO status
 *   - A configured URL is not an adapter   -> AuthorityRoute.runtime is separate
 *   - A fixture is not a production run    -> LicensureRuntimeState splits the two
 *   - A fuzzy name miss is not proof       -> no "NO_LICENSE_EXISTS" outcome exists
 *   - Unavailable is not adverse           -> isAdverseFinding()
 *   - A stale result is not current        -> FreshnessAssessment
 *   - A compact privilege is not a license -> CredentialObjectKind
 *   - A certification is not a license     -> CredentialObjectKind
 *   - Aggregation retains the board        -> LicensureObservation.originatingAuthorityId
 */

// ── Jurisdictions & professions ─────────────────────────────────────

export type Jurisdiction =
  | 'AL' | 'AK' | 'AZ' | 'AR' | 'CA' | 'CO' | 'CT' | 'DE' | 'DC' | 'FL'
  | 'GA' | 'GU' | 'HI' | 'ID' | 'IL' | 'IN' | 'IA' | 'KS' | 'KY' | 'LA'
  | 'ME' | 'MD' | 'MA' | 'MI' | 'MN' | 'MS' | 'MO' | 'MT' | 'NE' | 'NV'
  | 'NH' | 'NJ' | 'NM' | 'NY' | 'MP' | 'NC' | 'ND' | 'OH' | 'OK' | 'OR'
  | 'PA' | 'PR' | 'RI' | 'SC' | 'SD' | 'TN' | 'TX' | 'UT' | 'VT' | 'VI'
  | 'VA' | 'WA' | 'WV' | 'WI' | 'WY';

/**
 * Professions the program is architected around. Presence in this union is NOT
 * a claim that any authority is inventoried or reachable for that profession —
 * see LicensureAuthority.professions and LicensureRuntimeState.
 */
export type Profession =
  | 'PHYSICIAN_MD'
  | 'PHYSICIAN_DO'
  | 'PHYSICIAN_ASSISTANT'
  | 'RN'
  | 'LPN_VN'
  | 'APRN';

export type BoardType =
  /** Licenses both MD and DO physicians. */
  | 'COMBINED'
  /** Licenses MDs; a separate osteopathic board exists in this jurisdiction. */
  | 'ALLOPATHIC'
  /** Licenses DOs. */
  | 'OSTEOPATHIC'
  /** Issues the license where a separate examining body evaluates applicants. */
  | 'LICENSURE_COMMISSION'
  /** Handles discipline only; does not issue licenses. */
  | 'DISCIPLINE_ONLY'
  /** Licenses nurses (RN / LPN-VN / APRN). */
  | 'NURSING';

// ── Rule: a certification is not a license; a compact privilege is not one either ──

export type CredentialObjectKind =
  /** A license issued by a jurisdiction's licensing authority. */
  | 'STATE_LICENSE'
  /** Practice privilege via an interstate compact. Distinct object from a license. */
  | 'COMPACT_PRIVILEGE'
  /** Board certification. Never a license. */
  | 'CERTIFICATION'
  /** Registration/permit that is not a full license (e.g. training permit). */
  | 'LIMITED_PERMIT';

// ── Rule: LICENSE_REPORTED is not LICENSE ───────────────────────────

export type LicensureClaimKind =
  /**
   * Someone said a license exists — the clinician, an application form, or a
   * registry that republishes self-attested data (e.g. NPPES taxonomy fields).
   * This is NEVER authority-observed and NEVER decision-grade.
   */
  | 'LICENSE_REPORTED'
  /**
   * A licensing authority (or an authorized national aggregator of that
   * authority) returned a record. Still not automatically decision-grade —
   * see DecisionUseClassification.
   */
  | 'LICENSE_AUTHORITY_OBSERVED';

// ── Source routes ───────────────────────────────────────────────────

export type LicensureRouteKind =
  /** Authorized national network (FSMB PDC, Nursys/NCSBN). */
  | 'NATIONAL'
  /** Direct machine adapter against a single board. */
  | 'DIRECT_BOARD'
  /** Permitted public board search surface. */
  | 'PUBLIC_SEARCH'
  /** Human institutional verification (letter, portal, phone). */
  | 'MANUAL_INSTITUTIONAL';

export type AccessRequirement =
  | 'INSTITUTIONAL_AGREEMENT'
  | 'API_CREDENTIALS'
  | 'PUBLIC_NO_CREDENTIALS'
  | 'MANUAL_ONLY'
  | 'UNKNOWN';

export type TermsReviewState =
  | 'NOT_STARTED'
  | 'IN_REVIEW'
  | 'PERMITTED'
  | 'PROHIBITED';

// ── Rule: a catalog entry is not a live source ──────────────────────

/**
 * A catalog row. Describes an authority that exists in the world.
 *
 * This type intentionally has NO status, health, or coverage field. Knowing a
 * board exists and knowing we can read it are different facts, and conflating
 * them is how "national coverage" gets overclaimed. Runtime facts live in
 * LicensureRuntimeState, keyed by authorityId.
 */
export interface LicensureAuthority {
  /** Stable key, e.g. 'CA_MED' / 'CA_OSTEO'. */
  readonly authorityId: string;
  readonly jurisdiction: Jurisdiction;
  readonly boardName: string;
  readonly boardType: BoardType;
  /** Professions this board is evidenced to license. See registry provenance notes. */
  readonly professions: readonly Profession[];
  readonly officialUrl: string;
  /**
   * A public search surface, when one is known to exist. A URL here is a
   * pointer for humans — it is NOT an operational adapter and NOT a promise
   * that automated access is permitted.
   */
  readonly publicSearchUrl: string | null;
  /** Where this catalog row came from. Rows are not authored from memory. */
  readonly provenance: AuthorityProvenance;
  /** Free-text limitation that must travel with anything derived from this row. */
  readonly limitation: string;
}

export interface AuthorityProvenance {
  readonly source: 'FSMB_MEMBER_BOARD_DIRECTORY' | 'NCSBN_PUBLISHED' | 'MANUAL_ENTRY';
  readonly sourceUrl: string;
  readonly retrievedAt: string;
}

// ── Rule: a configured URL is not an operational adapter ────────────

/**
 * A declared route from a profession+jurisdiction to a source. Declaring a
 * route does not make it operational; see LicensureRuntimeState.
 */
export interface AuthorityRoute {
  readonly authorityId: string;
  readonly profession: Profession;
  readonly routeKind: LicensureRouteKind;
  /** Lower number = tried first. */
  readonly priority: number;
  readonly accessRequirement: AccessRequirement;
  readonly termsReview: TermsReviewState;
  /** Identifiers a lookup needs. Empty means the lookup contract is unknown. */
  readonly lookupIdentifiers: readonly LookupIdentifier[];
  readonly disciplineAvailable: DisciplineAvailability;
  readonly monitoringAvailable: boolean;
  /** How long a result from this route may be treated as current. */
  readonly freshnessWindowHours: number;
  readonly owner: string;
}

export type LookupIdentifier = 'NPI' | 'LICENSE_NUMBER' | 'NAME_DOB' | 'NCSBN_ID' | 'FSMB_ID';

export type DisciplineAvailability =
  /** Route returns disciplinary detail. */
  | 'AVAILABLE'
  /** Route returns only an indicator flag, not the underlying detail. */
  | 'INDICATOR_ONLY'
  /** Route returns no disciplinary information at all. */
  | 'NOT_AVAILABLE'
  /** Not yet established. Never render as "no discipline found". */
  | 'UNKNOWN';

// ── Rule: a parser fixture is not a successful production source run ──

export type LicensureRuntimePhase =
  /** No adapter code exists. */
  | 'NOT_IMPLEMENTED'
  /** Adapter exists; access/terms/credentials are not resolved. Fails closed. */
  | 'BLOCKED_ON_ACCESS'
  /** Adapter exists and is permitted, but has never completed a production run. */
  | 'READY_UNPROVEN'
  /** Adapter has completed a fresh successful production run. */
  | 'LIVE';

/**
 * Runtime truth for one route. Deliberately separate from the catalog.
 *
 * `LIVE` is gated by isLive() below, which requires every activation condition
 * at once. No single field can promote a route on its own.
 */
export interface LicensureRuntimeState {
  readonly authorityId: string;
  readonly profession: Profession;
  readonly routeKind: LicensureRouteKind;
  readonly phase: LicensureRuntimePhase;
  readonly permittedAccess: boolean;
  readonly productionCredentialsConfigured: boolean;
  /**
   * Timestamp of the last successful run against PRODUCTION. Fixtures and
   * sandbox runs must never write this field — that is the whole point of it.
   */
  readonly lastProductionSuccessAt: string | null;
  /** Parser/schema validation passing against recorded real-shape samples. */
  readonly schemaValidationPassing: boolean;
  /** Tests proving the route yields no affirmation when the source is down. */
  readonly failClosedTestsPassing: boolean;
  readonly provenancePersisted: boolean;
  readonly healthMonitored: boolean;
  /** Why this route is not LIVE, in words a human can act on. */
  readonly blockedReason: string | null;
}

/**
 * The single activation gate. A route is LIVE only when every condition holds.
 *
 * Do not add an early return, an override flag, or an env-var bypass here.
 */
export function isLive(state: LicensureRuntimeState, now: Date, freshnessWindowHours: number): boolean {
  if (state.phase !== 'LIVE') return false;
  if (!state.permittedAccess) return false;
  if (!state.productionCredentialsConfigured) return false;
  if (!state.schemaValidationPassing) return false;
  if (!state.failClosedTestsPassing) return false;
  if (!state.provenancePersisted) return false;
  if (!state.healthMonitored) return false;
  if (state.lastProductionSuccessAt === null) return false;

  const elapsedMs = now.getTime() - new Date(state.lastProductionSuccessAt).getTime();
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return false;
  return elapsedMs <= freshnessWindowHours * 3_600_000;
}

// ── Observation outcomes ────────────────────────────────────────────

/**
 * What a lookup produced.
 *
 * Note what is absent: there is no `NO_LICENSE_EXISTS`. A search that returns
 * nothing is NO_MATCHING_RECORD_RETURNED — a statement about the search, not
 * about the clinician. The rule "a fuzzy name miss is not proof that no license
 * exists" is enforced by that omission.
 */
export type LookupOutcome =
  /** The authority returned a record for this clinician. */
  | 'RECORD_RETURNED'
  /** The query ran and returned nothing. This is a fact about the query. */
  | 'NO_MATCHING_RECORD_RETURNED'
  /** Multiple candidates; identity could not be resolved. Never an adverse finding. */
  | 'AMBIGUOUS_IDENTITY'
  /** Source down, rate-limited, or unreachable. Never an adverse finding. */
  | 'SOURCE_UNAVAILABLE'
  /** Access/terms/credentials not resolved. Never an adverse finding. */
  | 'ACCESS_NOT_ESTABLISHED'
  /** Response shape was not recognized. Never an adverse finding. */
  | 'RESPONSE_UNRECOGNIZED';

/**
 * Rule: an unavailable source is not an adverse finding.
 *
 * Only a returned record can carry an adverse status. Every non-answer is a
 * gap in our reading, not a mark against the clinician.
 */
export function isAdverseFinding(
  outcome: LookupOutcome,
  status: LicenseStatus | null,
): boolean {
  if (outcome !== 'RECORD_RETURNED') return false;
  if (status === null) return false;
  return status === 'REVOKED' || status === 'SUSPENDED' || status === 'SURRENDERED';
}

export type LicenseStatus =
  | 'ACTIVE'
  | 'INACTIVE'
  | 'EXPIRED'
  | 'LAPSED'
  | 'REVOKED'
  | 'SUSPENDED'
  | 'SURRENDERED'
  | 'PROBATION'
  /** The authority returned a status string we do not map. Never coerce this to ACTIVE. */
  | 'UNMAPPED';

// ── Rule: a national aggregation must retain the originating board ──

/**
 * One authority reading. Every field the founder requirement lists as
 * mandatory for display is non-optional here, so a projection cannot render a
 * result that has lost its board, its route, or its limitation.
 */
export interface LicensureObservation {
  readonly claimKind: LicensureClaimKind;
  /**
   * The board the record actually came from — never the aggregator. When FSMB
   * returns a Texas license, this is the Texas board, not FSMB.
   */
  readonly originatingAuthorityId: string;
  readonly originatingBoardName: string;
  readonly jurisdiction: Jurisdiction;
  readonly profession: Profession;
  readonly credentialObjectKind: CredentialObjectKind;
  readonly licenseType: string;
  /** Null when the route does not permit redisplay of the number. */
  readonly licenseNumber: string | null;
  readonly outcome: LookupOutcome;
  readonly status: LicenseStatus | null;
  readonly observedAt: string;
  readonly expiresAt: string | null;
  readonly disciplineScope: DisciplineAvailability;
  readonly disciplineIndicator: boolean | null;
  /** The immediate source that answered: 'FSMB_PDC', 'NURSYS', 'CA_MED', ... */
  readonly sourceId: string;
  readonly routeKind: LicensureRouteKind;
  readonly freshness: FreshnessAssessment;
  readonly limitation: string;
  readonly decisionUse: DecisionUseClassification;
}

// ── Rule: a stale result is not current ─────────────────────────────

export interface FreshnessAssessment {
  readonly observedAt: string;
  readonly freshnessWindowHours: number;
  readonly ageHours: number;
  readonly isCurrent: boolean;
}

export function assessFreshness(
  observedAt: string,
  freshnessWindowHours: number,
  now: Date,
): FreshnessAssessment {
  const observedMs = new Date(observedAt).getTime();
  const ageHours = Number.isFinite(observedMs)
    ? (now.getTime() - observedMs) / 3_600_000
    : Number.POSITIVE_INFINITY;

  return {
    observedAt,
    freshnessWindowHours,
    ageHours,
    // Fails closed: an unparseable timestamp or a future timestamp is not current.
    isCurrent: Number.isFinite(ageHours) && ageHours >= 0 && ageHours <= freshnessWindowHours,
  };
}

// ── Decision-use classification ─────────────────────────────────────

/**
 * How a reader is allowed to use this observation.
 *
 * `decisionGrade` is the literal `false` across every value the current build
 * can produce, matching the repository's issuer/PSV truth contract. Promotion
 * to a decision-grade tier is a separate gated wave and requires a new type.
 */
export type DecisionUseClassification =
  | { readonly tier: 'REPORTED_NOT_VERIFIED'; readonly decisionGrade: false }
  | { readonly tier: 'AUTHORITY_OBSERVED_CANDIDATE'; readonly decisionGrade: false }
  | { readonly tier: 'SOURCE_GAP'; readonly decisionGrade: false }
  | { readonly tier: 'MANUAL_REVIEW_REQUIRED'; readonly decisionGrade: false };

export function classifyDecisionUse(
  claimKind: LicensureClaimKind,
  outcome: LookupOutcome,
  freshness: FreshnessAssessment,
): DecisionUseClassification {
  if (claimKind === 'LICENSE_REPORTED') {
    return { tier: 'REPORTED_NOT_VERIFIED', decisionGrade: false };
  }
  if (outcome === 'AMBIGUOUS_IDENTITY') {
    return { tier: 'MANUAL_REVIEW_REQUIRED', decisionGrade: false };
  }
  if (outcome !== 'RECORD_RETURNED') {
    return { tier: 'SOURCE_GAP', decisionGrade: false };
  }
  // A record we read too long ago is not a current reading of it.
  if (!freshness.isCurrent) {
    return { tier: 'SOURCE_GAP', decisionGrade: false };
  }
  return { tier: 'AUTHORITY_OBSERVED_CANDIDATE', decisionGrade: false };
}
