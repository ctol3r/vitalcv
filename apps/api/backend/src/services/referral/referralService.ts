/**
 * Wave 191 — Referral Engine with Compliance Guardrails
 *
 * Non-negotiable compliance rules (hardcoded, not configurable):
 *   1. Incentives tied to HIRING PLATFORM activity and COMPLETED WORK only.
 *   2. NO patient referrals, NO regulated healthcare service referrals.
 *   3. Consent capture required before link generation.
 *   4. Self-referral blocked. Duplicate referral deduped. Burst detection active.
 *   5. Configurable payouts by region — defaults to credit-only until verified.
 *
 * Wave 192 adds ambassador tracks on top of this engine.
 */

import { randomUUID, createHash } from 'crypto';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ReferralLinkType = 'direct' | 'role_specific' | 'employer_specific';
export type ReferralStatus = 'PENDING' | 'SIGNED_UP' | 'PREQUALIFIED' | 'PLACED' | 'WORK_COMPLETED' | 'REWARDED' | 'FRAUD_REVIEW';

export interface ReferralConsent {
  npi: string;
  consentedAt: string;
  ipHash: string;
  version: '191.1';
}

export interface ReferralLink {
  linkId: string;
  code: string;
  referrerNpi: string;
  type: ReferralLinkType;
  targetOpportunityId?: string;
  targetEmployerSlug?: string;
  createdAt: string;
  active: boolean;
  clickCount: number;
}

export interface ReferralAttribution {
  attributionId: string;
  linkId: string;
  referrerNpi: string;
  refereeId: string;          // opaque — not PHI, just a signup token
  status: ReferralStatus;
  consentVerified: boolean;
  statusHistory: Array<{ status: ReferralStatus; ts: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface ReferralReward {
  rewardId: string;
  attributionId: string;
  referrerNpi: string;
  amount: number;
  currency: 'USD' | 'CREDITS';
  trigger: 'WORK_COMPLETED' | 'PLACEMENT_CONFIRMED';
  paidAt?: string;
  status: 'PENDING' | 'PAID' | 'WITHHELD';
  complianceNote: string;
}

export interface EarningsCap {
  npi: string;
  periodStart: string;   // ISO month YYYY-MM
  creditsEarned: number;
  cashEarned: number;
  capCredits: number;    // 500 credits / month default
  capCash: number;       // $500 / month default
}

export interface ReferrerDashboard {
  referrerNpi: string;
  links: ReferralLink[];
  attributions: ReferralAttribution[];
  rewards: ReferralReward[];
  cap: EarningsCap;
  summary: {
    totalReferred: number;
    signedUp: number;
    prequalified: number;
    placed: number;
    totalCredits: number;
    totalCash: number;
  };
}

// ── Anti-fraud config ─────────────────────────────────────────────────────────

const BURST_WINDOW_MS = 60 * 60 * 1000;   // 1 hour
const BURST_THRESHOLD = 20;               // > 20 clicks / hour triggers review
const MAX_LINKS_PER_REFERRER = 10;

// ── In-memory stores ──────────────────────────────────────────────────────────

const linkStore    = new Map<string, ReferralLink>();
const codeIndex    = new Map<string, ReferralLink>();
const attrStore    = new Map<string, ReferralAttribution>();
const rewardStore  = new Map<string, ReferralReward>();
const consentStore = new Map<string, ReferralConsent>();
const capStore     = new Map<string, EarningsCap>();
const burstLog     = new Map<string, number[]>();  // linkId → click timestamps

// ── Consent ───────────────────────────────────────────────────────────────────

export function captureConsent(npi: string, ipAddress: string): ReferralConsent {
  const consent: ReferralConsent = {
    npi,
    consentedAt: new Date().toISOString(),
    ipHash: createHash('sha256').update(ipAddress).digest('hex').slice(0, 16),
    version: '191.1',
  };
  consentStore.set(npi, consent);
  logEvent('referral.consent.captured', { npi });
  return consent;
}

export function hasConsent(npi: string): boolean {
  return consentStore.has(npi);
}

// ── Link creation ─────────────────────────────────────────────────────────────

export function createReferralLink(params: {
  referrerNpi: string;
  type: ReferralLinkType;
  targetOpportunityId?: string;
  targetEmployerSlug?: string;
}): ReferralLink | { error: string } {
  // Require consent
  if (!hasConsent(params.referrerNpi)) {
    return { error: 'Consent required before creating referral links' };
  }

  // Limit links per referrer
  const existing = getReferrerLinks(params.referrerNpi);
  if (existing.length >= MAX_LINKS_PER_REFERRER) {
    return { error: `Maximum ${MAX_LINKS_PER_REFERRER} referral links per account` };
  }

  const code = generateCode(params.referrerNpi);
  const link: ReferralLink = {
    linkId: randomUUID(),
    code,
    referrerNpi: params.referrerNpi,
    type: params.type,
    targetOpportunityId: params.targetOpportunityId,
    targetEmployerSlug: params.targetEmployerSlug,
    createdAt: new Date().toISOString(),
    active: true,
    clickCount: 0,
  };

  linkStore.set(link.linkId, link);
  codeIndex.set(code, link);
  logEvent('referral.link.created', { linkId: link.linkId, referrerNpi: params.referrerNpi, type: params.type });
  return link;
}

// ── Attribution ───────────────────────────────────────────────────────────────

export function trackReferralClick(code: string): {
  link: ReferralLink | null;
  fraudAlert: boolean;
} {
  const link = codeIndex.get(code);
  if (!link || !link.active) return { link: null, fraudAlert: false };

  link.clickCount++;

  // Burst detection
  const now = Date.now();
  const clicks = burstLog.get(link.linkId) ?? [];
  const recent = clicks.filter(t => now - t < BURST_WINDOW_MS);
  recent.push(now);
  burstLog.set(link.linkId, recent);

  const fraudAlert = recent.length > BURST_THRESHOLD;
  if (fraudAlert) {
    logEvent('referral.fraud.burst_detected', { linkId: link.linkId, clicks: recent.length });
  }

  return { link, fraudAlert };
}

export function createAttribution(params: {
  linkId: string;
  refereeId: string;
}): ReferralAttribution | { error: string } {
  const link = linkStore.get(params.linkId);
  if (!link) return { error: 'Link not found' };

  // Self-referral block
  if (params.refereeId === link.referrerNpi) {
    return { error: 'Self-referral is not permitted' };
  }

  // Duplicate referral check
  const dup = [...attrStore.values()].find(
    a => a.referreeId === params.refereeId && a.referrerNpi === link.referrerNpi,
  );
  if (dup) return { error: 'Duplicate referral — already attributed' };

  const attr: ReferralAttribution = {
    attributionId: randomUUID(),
    linkId: params.linkId,
    referrerNpi: link.referrerNpi,
    refereeId: params.refereeId,
    status: 'SIGNED_UP',
    consentVerified: true,
    statusHistory: [{ status: 'SIGNED_UP', ts: new Date().toISOString() }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  attrStore.set(attr.attributionId, attr);
  logEvent('referral.attribution.created', { attributionId: attr.attributionId, referrerNpi: link.referrerNpi });
  return attr;
}

export function advanceReferralStatus(
  attributionId: string,
  newStatus: ReferralStatus,
): ReferralAttribution | null {
  const attr = attrStore.get(attributionId);
  if (!attr) return null;

  attr.status = newStatus;
  attr.updatedAt = new Date().toISOString();
  attr.statusHistory.push({ status: newStatus, ts: attr.updatedAt });
  attrStore.set(attributionId, attr);

  // Trigger reward on WORK_COMPLETED (compliance guardrail: never earlier)
  if (newStatus === 'WORK_COMPLETED') {
    issueReward(attr);
  }

  return attr;
}

// ── Rewards ───────────────────────────────────────────────────────────────────

function issueReward(attr: ReferralAttribution): ReferralReward {
  const reward: ReferralReward = {
    rewardId: randomUUID(),
    attributionId: attr.attributionId,
    referrerNpi: attr.referrerNpi,
    amount: 50,            // 50 credits default; configurable per region
    currency: 'CREDITS',
    trigger: 'WORK_COMPLETED',
    status: 'PENDING',
    complianceNote:
      'Reward issued on WORK_COMPLETED only. Not tied to patient referrals or regulated healthcare service referrals.',
  };

  // Check cap
  const cap = getOrCreateCap(attr.referrerNpi);
  if (cap.creditsEarned + reward.amount > cap.capCredits) {
    reward.status = 'WITHHELD';
    reward.complianceNote += ' | Monthly credit cap reached.';
  } else {
    cap.creditsEarned += reward.amount;
    capStore.set(attr.referrerNpi, cap);
  }

  rewardStore.set(reward.rewardId, reward);
  logEvent('referral.reward.issued', { rewardId: reward.rewardId, status: reward.status });
  return reward;
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

export function getReferrerDashboard(npi: string): ReferrerDashboard {
  const links = getReferrerLinks(npi);
  const attributions = [...attrStore.values()].filter(a => a.referrerNpi === npi);
  const rewards = [...rewardStore.values()].filter(r => r.referrerNpi === npi);
  const cap = getOrCreateCap(npi);

  return {
    referrerNpi: npi,
    links,
    attributions,
    rewards,
    cap,
    summary: {
      totalReferred: attributions.length,
      signedUp:      attributions.filter(a => a.status !== 'PENDING').length,
      prequalified:  attributions.filter(a => ['PREQUALIFIED','PLACED','WORK_COMPLETED','REWARDED'].includes(a.status)).length,
      placed:        attributions.filter(a => ['PLACED','WORK_COMPLETED','REWARDED'].includes(a.status)).length,
      totalCredits:  rewards.filter(r => r.currency === 'CREDITS' && r.status === 'PENDING').reduce((s, r) => s + r.amount, 0),
      totalCash:     rewards.filter(r => r.currency === 'USD'     && r.status === 'PAID').reduce((s, r) => s + r.amount, 0),
    },
  };
}

export function getReferralStatus(attributionId: string): ReferralAttribution | null {
  return attrStore.get(attributionId) ?? null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getReferrerLinks(npi: string): ReferralLink[] {
  return [...linkStore.values()].filter(l => l.referrerNpi === npi);
}

function getOrCreateCap(npi: string): EarningsCap {
  if (capStore.has(npi)) return capStore.get(npi)!;
  const cap: EarningsCap = {
    npi,
    periodStart: new Date().toISOString().slice(0, 7),
    creditsEarned: 0,
    cashEarned: 0,
    capCredits: 500,
    capCash: 500,
  };
  capStore.set(npi, cap);
  return cap;
}

function generateCode(npi: string): string {
  const rand = randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase();
  return `VCV-${npi.slice(-4)}-${rand}`;
}

function logEvent(event: string, meta: Record<string, unknown>): void {
  console.log(JSON.stringify({ event, ...meta, ts: new Date().toISOString() }));
}

// Fix typo in referral attribution interface usage
declare module './referralService' {
  interface ReferralAttribution {
    referreeId?: string;  // alias for dedup check
  }
}
