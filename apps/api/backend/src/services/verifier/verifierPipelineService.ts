/**
 * Wave 190 — Verifier Pipeline Service
 *
 * ATS ingestion, candidate queue, instant offer tools, and holder state tracking.
 * Wave 190 is in-memory; Wave 191+ migrates to Prisma.
 */

import { randomUUID } from 'crypto';

// ── Types ─────────────────────────────────────────────────────────────────────

export type HolderApplicationState =
  | 'APPLIED'
  | 'SHARED'
  | 'VIEWED'
  | 'VERIFIED'
  | 'INSTANT_OFFER_SENT'
  | 'ACCEPTED'
  | 'DECLINED';

export interface ApplicationRecord {
  id: string;
  npi: string;
  opportunityId: string;
  verifierOrgId: string;
  source: 'widget' | 'direct' | 'instant_offer' | 'recruiter';
  state: HolderApplicationState;
  matchScore?: number;
  matchBand?: string;
  instantOfferEligible: boolean;
  appliedAt: string;
  updatedAt: string;
}

export interface CandidateSummary {
  npi: string;
  name: string;
  specialty: string;
  matchScore: number;
  matchBand: string;
  instantOfferEligible: boolean;
  state: HolderApplicationState;
  appliedAt: string;
  prequalified: boolean;
  credentialSummary: string;
}

export interface InstantOffer {
  offerId: string;
  npi: string;
  opportunityId: string;
  verifierOrgId: string;
  message: string;
  expiresAt: string;
  sentAt: string;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED';
}

// ── In-memory stores ──────────────────────────────────────────────────────────

const applicationStore = new Map<string, ApplicationRecord>();   // id → record
const offerStore = new Map<string, InstantOffer>();              // offerId → offer

// ── Application helpers ───────────────────────────────────────────────────────

export function applyToOpportunity(params: {
  npi: string;
  opportunityId: string;
  verifierOrgId: string;
  source?: ApplicationRecord['source'];
  matchScore?: number;
  matchBand?: string;
  instantOfferEligible?: boolean;
}): ApplicationRecord {
  // Idempotent — prevent duplicate applications
  const existing = [...applicationStore.values()].find(
    a => a.npi === params.npi && a.opportunityId === params.opportunityId,
  );
  if (existing) return existing;

  const record: ApplicationRecord = {
    id: randomUUID(),
    npi: params.npi,
    opportunityId: params.opportunityId,
    verifierOrgId: params.verifierOrgId,
    source: params.source ?? 'widget',
    state: 'APPLIED',
    matchScore: params.matchScore,
    matchBand: params.matchBand,
    instantOfferEligible: params.instantOfferEligible ?? false,
    appliedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  applicationStore.set(record.id, record);
  console.log(JSON.stringify({ event: 'application.created', npi: params.npi, opportunityId: params.opportunityId }));
  return record;
}

export function updateApplicationState(
  id: string,
  state: HolderApplicationState,
): ApplicationRecord | null {
  const record = applicationStore.get(id);
  if (!record) return null;
  record.state = state;
  record.updatedAt = new Date().toISOString();
  applicationStore.set(id, record);
  console.log(JSON.stringify({ event: 'application.state_change', id, state }));
  return record;
}

export function getApplicationsByNpi(npi: string): ApplicationRecord[] {
  return [...applicationStore.values()].filter(a => a.npi === npi);
}

/**
 * Applications for a set of NPIs the caller has already been authorized for.
 *
 * The plural signature is the point (#948). `getApplicationsByNpi` takes the
 * subject as a scalar, which reads naturally as "the NPI the request asked
 * for" — and that is precisely how the route came to select rows by
 * `?npi=`, disclosing which employers any clinician had applied to. This
 * variant is fed the *authorized set* resolved from the verified session, so
 * there is no argument a caller could supply that widens it.
 *
 * An empty set returns no rows. It never means "no filter".
 */
export function getApplicationsForNpis(npis: readonly string[]): ApplicationRecord[] {
  const scope = new Set(npis);
  if (scope.size === 0) return [];
  return [...applicationStore.values()].filter(a => scope.has(a.npi));
}

// ── Verifier candidate queue ──────────────────────────────────────────────────

export function getCandidateQueue(verifierOrgId: string, opportunityId?: string): CandidateSummary[] {
  const records = [...applicationStore.values()].filter(
    a => a.verifierOrgId === verifierOrgId && (!opportunityId || a.opportunityId === opportunityId),
  );

  // Build summaries with stub profile data (Wave 191 queries real profiles)
  return records.map(r => buildCandidateSummary(r));
}

function buildCandidateSummary(r: ApplicationRecord): CandidateSummary {
  // Until 2026-07-27 this consulted a hardcoded map of stub profiles before
  // falling back to the honest summary below. NPI 1003000126 resolved to
  // "Dr. Sarah Chen … CA License L3 · ABIM Certified · DEA Active · Sanctions
  // Clear" — that NPI belongs to a real physician. Because this feeds the
  // verifier candidate queue, an application from that clinician would have been
  // shown to an employer under someone else's name, carrying a credential
  // summary no source ever produced.
  //
  // Do not reintroduce a lookup table here. Until real profiles are wired, the
  // only honest answer is that the record is unresolved.
  const profile = {
    name: `NPI ${r.npi}`,
    specialty: 'Unknown',
    prequalified: false,
    credentialSummary: 'Credential verification pending',
  };

  return {
    npi: r.npi,
    name: profile.name,
    specialty: profile.specialty,
    matchScore: r.matchScore ?? 0,
    matchBand: r.matchBand ?? 'UNKNOWN',
    instantOfferEligible: r.instantOfferEligible,
    state: r.state,
    appliedAt: r.appliedAt,
    prequalified: profile.prequalified,
    credentialSummary: profile.credentialSummary,
  };
}

// ── Instant offer tools ───────────────────────────────────────────────────────

export function sendInstantOffer(params: {
  npi: string;
  opportunityId: string;
  verifierOrgId: string;
  message?: string;
  expiresInHours?: number;
}): InstantOffer {
  const expiresAt = new Date(
    Date.now() + (params.expiresInHours ?? 72) * 60 * 60 * 1000,
  ).toISOString();

  const offer: InstantOffer = {
    offerId: randomUUID(),
    npi: params.npi,
    opportunityId: params.opportunityId,
    verifierOrgId: params.verifierOrgId,
    message: params.message ?? 'You are prequalified for this role. Accept to get started immediately.',
    expiresAt,
    sentAt: new Date().toISOString(),
    status: 'PENDING',
  };

  offerStore.set(offer.offerId, offer);
  console.log(JSON.stringify({ event: 'instant_offer.sent', npi: params.npi, opportunityId: params.opportunityId }));

  // Advance application state
  const app = [...applicationStore.values()].find(
    a => a.npi === params.npi && a.opportunityId === params.opportunityId,
  );
  if (app) updateApplicationState(app.id, 'INSTANT_OFFER_SENT');

  return offer;
}

/**
 * Why this is a discriminated result and not `InstantOffer | null`.
 *
 * The old signature could express exactly two outcomes — "here is the offer"
 * and "no offer" — so the route mapped everything else onto success. The three
 * refusals below (#949) are genuinely different states that the caller must be
 * able to tell apart in order to answer 404 / 409 / 410 correctly, and a `null`
 * cannot carry that. Returning the reason is what stops the route inventing one.
 */
export type OfferResponseResult =
  | { ok: true; offer: InstantOffer }
  /** No such offer, or not this holder's — see the route for why they merge. */
  | { ok: false; reason: 'not_found' }
  /** Past `expiresAt`. The offer has been transitioned to EXPIRED. */
  | { ok: false; reason: 'expired'; offer: InstantOffer }
  /** Already answered. `offer` carries the decision that stands. */
  | { ok: false; reason: 'not_pending'; offer: InstantOffer };

/**
 * Transition an offer to EXPIRED if its deadline has passed.
 *
 * `expiresAt` was written at creation and then never read by any code path, so
 * the `EXPIRED` member of the status union was decorative — no offer could ever
 * hold it. Expiry is evaluated lazily, on read, because these stores are
 * in-process Maps with no scheduler behind them; the important property is that
 * a lapsed offer can never be answered, not that the transition happens at a
 * particular instant.
 */
function expireIfElapsed(offer: InstantOffer, now: number): boolean {
  if (offer.status !== 'PENDING') return offer.status === 'EXPIRED';
  const deadline = Date.parse(offer.expiresAt);
  // An unparseable deadline is treated as expired. Failing closed here means a
  // corrupt timestamp costs an offer, not an unbounded answer window.
  if (Number.isNaN(deadline) || now > deadline) {
    offer.status = 'EXPIRED';
    offerStore.set(offer.offerId, offer);
    console.log(JSON.stringify({ event: 'instant_offer.expired', offerId: offer.offerId }));
    return true;
  }
  return false;
}

/**
 * Answer an instant offer, as the holder it was issued to.
 *
 * Closes #949, which had three separate gaps: no ownership check (a third party
 * who learned an `offerId` could accept or decline on a clinician's behalf, and
 * the response also rewrote the linked application record), no expiry check,
 * and no state-transition check (an ACCEPTED offer could be flipped to DECLINED
 * and back, repeatedly).
 *
 * `authorizedNpis` is the set resolved from the caller's verified session — not
 * an NPI from the request. `offerId` is treated as an identifier throughout,
 * never as a bearer credential: holding one authorizes nothing.
 *
 * Check order is load-bearing. Ownership is decided FIRST so that a caller who
 * does not own the offer gets the same answer whether or not it exists —
 * otherwise 409/410 would confirm the existence and state of a stranger's offer
 * to anyone holding a guessed id.
 */
export function respondToOffer(params: {
  offerId: string;
  accept: boolean;
  authorizedNpis: readonly string[];
  now?: number;
}): OfferResponseResult {
  const { offerId, accept } = params;
  const now = params.now ?? Date.now();
  const scope = new Set(params.authorizedNpis);

  const offer = offerStore.get(offerId);
  if (!offer || !scope.has(offer.npi)) return { ok: false, reason: 'not_found' };

  if (expireIfElapsed(offer, now)) return { ok: false, reason: 'expired', offer };
  if (offer.status !== 'PENDING') return { ok: false, reason: 'not_pending', offer };

  offer.status = accept ? 'ACCEPTED' : 'DECLINED';
  offerStore.set(offerId, offer);

  const app = [...applicationStore.values()].find(
    a => a.npi === offer.npi && a.opportunityId === offer.opportunityId,
  );
  if (app) updateApplicationState(app.id, accept ? 'ACCEPTED' : 'DECLINED');

  console.log(JSON.stringify({ event: 'instant_offer.response', offerId, accept }));
  return { ok: true, offer };
}

export function getOffersForNpi(npi: string): InstantOffer[] {
  return [...offerStore.values()].filter(o => o.npi === npi);
}

// ── Prequalified candidate pool ───────────────────────────────────────────────

export function getPrequalifiedPool(verifierOrgId: string): CandidateSummary[] {
  return getCandidateQueue(verifierOrgId).filter(c => c.instantOfferEligible);
}
