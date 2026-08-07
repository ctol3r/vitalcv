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

export function respondToOffer(
  offerId: string,
  accept: boolean,
): InstantOffer | null {
  const offer = offerStore.get(offerId);
  if (!offer) return null;

  offer.status = accept ? 'ACCEPTED' : 'DECLINED';
  offerStore.set(offerId, offer);

  const app = [...applicationStore.values()].find(
    a => a.npi === offer.npi && a.opportunityId === offer.opportunityId,
  );
  if (app) updateApplicationState(app.id, accept ? 'ACCEPTED' : 'DECLINED');

  console.log(JSON.stringify({ event: 'instant_offer.response', offerId, accept }));
  return offer;
}

export function getOffersForNpi(npi: string): InstantOffer[] {
  return [...offerStore.values()].filter(o => o.npi === npi);
}

// ── Prequalified candidate pool ───────────────────────────────────────────────

export function getPrequalifiedPool(verifierOrgId: string): CandidateSummary[] {
  return getCandidateQueue(verifierOrgId).filter(c => c.instantOfferEligible);
}
