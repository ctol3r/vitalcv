/**
 * Wave F Phase 2 — Career Autopilot data shape + demo fixture.
 *
 * Pure types + a single demoAutopilot() fixture. No fetch, no DB, no DOM.
 *
 * Truth contract:
 *   - All values returned by demoAutopilot() are demonstrative. They
 *     do NOT describe a real clinician's autopilot state. The page
 *     that renders them always carries a "Demo autopilot —
 *     illustrative only" banner. data-is-demo is the literal `true`.
 *   - The trust-level label is a tier id (e.g. "T3") — never the
 *     bare status label that CLAUDE.md bans for status copy.
 *   - The composite trust score is shown with explicit factor
 *     weights and per-factor scores so a viewer can see how the
 *     headline number is constructed.
 *   - Real upstream credentialing sources (state professional
 *     licensing boards, controlled-substance authorities, issuing
 *     boards, sanctions monitors, federal payer systems, interstate
 *     compacts, malpractice carriers, etc.) are vendor-gated and out
 *     of scope for this surface; the demo describes the shape of
 *     monitoring, not active integrations.
 */

export interface AutopilotClinician {
  name: string;
  npi: string;
  homeState: string;
  primaryFacility: string;
  /** Tier label like 'T1' | 'T2' | 'T3'. Never the bare status label
   *  that CLAUDE.md bans for status copy. */
  trustLevel: string;
  /** 0..1 composite trust score. */
  trustScore: number;
  monitoringSince: string;
  lastFullSync: string;
  enrollmentsActive: number;
  /** Always true in Phase 1 — drives the demo banner. */
  isDemo: true;
}

export type RenewalKind =
  | 'license'
  | 'controlled_substance'
  | 'board'
  | 'certification'
  | 'enrollment'
  | 'clearance';

export type RenewalAction = 'monitor' | 'renew_self' | 'expiring' | 'urgent';

export interface RenewalEntry {
  id: string;
  kind: RenewalKind;
  label: string;
  expires: string;
  /** Negative = already expired. */
  daysToExpire: number;
  action: RenewalAction;
  protocol: string;
  /** Authority is intentionally generic ("home state board",
   *  "issuing board") — specific vendor names are NOT used. */
  authority: string;
  autoRenewable: boolean;
  fee: string;
  cmeRequired: number | null;
  cmeOnFile: number | null;
}

export type PortabilityStatus =
  | 'licensed'
  | 'compact_eligible'
  | 'enrolled_payer'
  | 'dormant';

export interface PortabilityEntry {
  state: string;
  name: string;
  status: PortabilityStatus;
  since: string | null;
  payers: number;
  primary: boolean;
  note: string;
}

export type NbaSeverity = 'low' | 'medium' | 'high';

export interface NbaEntry {
  id: string;
  rank: number;
  severity: NbaSeverity;
  title: string;
  subtitle: string;
  impact: string;
  receipt: string;
  ctaLabel: string;
  ctaSecondary?: string;
}

export type DriftStatus = 'fresh' | 'aging' | 'stale' | 'divergent';

export interface DriftField {
  id: string;
  label: string;
  /** ISO date a primary-source check last confirmed this field. Null
   *  when no primary-source check has ever run for it (divergent). */
  verifiedAt: string | null;
  attestedAt: string;
  status: DriftStatus;
  /** Vendor-neutral authority description. */
  authority: string;
  delta: string;
}

export interface TrustFactor {
  label: string;
  weight: number;
  score: number;
  note: string;
}

export interface AutopilotState {
  clinician: AutopilotClinician;
  renewals: ReadonlyArray<RenewalEntry>;
  portability: ReadonlyArray<PortabilityEntry>;
  nba: ReadonlyArray<NbaEntry>;
  drift: ReadonlyArray<DriftField>;
  trustFactors: ReadonlyArray<TrustFactor>;
}

/* ---------- Status meta — pure label/tone maps ---------- */

export const ACTION_META: Record<
  RenewalAction,
  { label: string; tone: 'slate' | 'indigo' | 'amber' | 'rose' }
> = {
  monitor:    { label: 'Monitoring',     tone: 'slate'  },
  renew_self: { label: 'Renew',          tone: 'indigo' },
  expiring:   { label: 'Expiring soon',  tone: 'amber'  },
  urgent:     { label: 'Action required', tone: 'rose'  },
};

export const KIND_META: Record<RenewalKind, { label: string; glyph: string }> = {
  license:              { label: 'State License',           glyph: '⚖' },
  controlled_substance: { label: 'Controlled-Substance',    glyph: 'Rx' },
  board:                { label: 'Board Cert',              glyph: '◆' },
  certification:        { label: 'Certification',           glyph: '+' },
  enrollment:           { label: 'Enrollment',              glyph: '↳' },
  clearance:            { label: 'Health Clearance',        glyph: '✚' },
};

export const PORTABILITY_META: Record<
  PortabilityStatus,
  { label: string; tone: 'emerald' | 'indigo' | 'slate' }
> = {
  licensed:         { label: 'Licensed',         tone: 'emerald' },
  compact_eligible: { label: 'Compact eligible', tone: 'indigo'  },
  enrolled_payer:   { label: 'Enrolled (payer)', tone: 'emerald' },
  dormant:          { label: 'Dormant',          tone: 'slate'   },
};

export const SEVERITY_META: Record<
  NbaSeverity,
  { label: string; tone: 'rose' | 'amber' | 'slate' }
> = {
  high:   { label: 'High',   tone: 'rose'  },
  medium: { label: 'Medium', tone: 'amber' },
  low:    { label: 'Low',    tone: 'slate' },
};

export const DRIFT_META: Record<
  DriftStatus,
  { label: string; tone: 'emerald' | 'slate' | 'amber' | 'rose' }
> = {
  fresh:     { label: 'Fresh',     tone: 'emerald' },
  aging:     { label: 'Aging',     tone: 'slate'   },
  stale:     { label: 'Stale',     tone: 'amber'   },
  divergent: { label: 'Divergent', tone: 'rose'    },
};

/* ---------- Pure derived helpers ---------- */

/**
 * Compute the weighted composite trust score from the factor list.
 * Returns a 0..1 number rounded to 2 decimal places. Weights are
 * expected to sum to 1; the function does NOT renormalize so a
 * malformed list is surfaced as a non-1 sum in the test.
 */
export function computeCompositeTrustScore(factors: ReadonlyArray<TrustFactor>): number {
  let weighted = 0;
  for (const f of factors) {
    weighted += f.weight * f.score;
  }
  return Math.round(weighted * 100) / 100;
}

/** Sum of factor weights — exposed so tests can verify it equals 1. */
export function sumFactorWeights(factors: ReadonlyArray<TrustFactor>): number {
  return Math.round(factors.reduce((acc, f) => acc + f.weight, 0) * 1000) / 1000;
}

export interface RenewalCounts {
  total: number;
  urgent: number;
  expiring: number;
  renewSelf: number;
  monitoring: number;
}

export function computeRenewalCounts(renewals: ReadonlyArray<RenewalEntry>): RenewalCounts {
  return {
    total: renewals.length,
    urgent: renewals.filter((r) => r.action === 'urgent').length,
    expiring: renewals.filter((r) => r.action === 'expiring').length,
    renewSelf: renewals.filter((r) => r.action === 'renew_self').length,
    monitoring: renewals.filter((r) => r.action === 'monitor').length,
  };
}

/* ---------- Demo fixture ---------- */

export function demoAutopilot(): AutopilotState {
  return {
    clinician: {
      name: 'Demo Clinician, PA-C',
      npi: '0000000000',
      homeState: 'Demo State',
      primaryFacility: 'Demo Health · Surgical Pavilion',
      trustLevel: 'T3',
      trustScore: 0.94,
      monitoringSince: '2024-09-12',
      lastFullSync: '2026-04-18T14:32:00Z',
      enrollmentsActive: 23,
      isDemo: true,
    },
    renewals: [
      { id: 'lic-home',     kind: 'license',              label: 'Home-state PA license',         expires: '2026-09-30', daysToExpire: 156, action: 'renew_self', protocol: 'Home-state board · CME 50 hrs/2yr', authority: 'Home-state professional licensing board', autoRenewable: true,  fee: '$370',  cmeRequired: 50,  cmeOnFile: 38 },
      { id: 'csa',          kind: 'controlled_substance', label: 'Controlled-substance authority', expires: '2026-08-15', daysToExpire: 110, action: 'renew_self', protocol: 'Federal · 3-year cycle',             authority: 'Federal controlled-substance authority',  autoRenewable: true,  fee: '$888',  cmeRequired: null, cmeOnFile: null },
      { id: 'board',        kind: 'board',                label: 'Board certification',            expires: '2027-12-31', daysToExpire: 612, action: 'monitor',     protocol: 'Issuing board · 10-year cycle',      authority: 'Issuing certification board',             autoRenewable: false, fee: '$350',  cmeRequired: 100, cmeOnFile: 62 },
      { id: 'acls',         kind: 'certification',        label: 'ACLS card',                       expires: '2026-06-04', daysToExpire: 39,  action: 'urgent',      protocol: 'Issuing assn · 2-year renewal',      authority: 'Issuing health-skills association',      autoRenewable: false, fee: '$255',  cmeRequired: null, cmeOnFile: null },
      { id: 'bls',          kind: 'certification',        label: 'BLS card',                        expires: '2027-01-10', daysToExpire: 259, action: 'monitor',     protocol: 'Issuing assn · 2-year renewal',      authority: 'Issuing health-skills association',      autoRenewable: false, fee: '$95',   cmeRequired: null, cmeOnFile: null },
      { id: 'fed-rev',      kind: 'enrollment',           label: 'Federal payer revalidation',     expires: '2027-02-28', daysToExpire: 308, action: 'monitor',     protocol: 'Federal · 5-year revalidation cycle', authority: 'Federal payer enrollment authority',      autoRenewable: false, fee: 'no fee', cmeRequired: null, cmeOnFile: null },
      { id: 'priv-fac',     kind: 'enrollment',           label: 'Facility privileges',             expires: '2028-04-30', daysToExpire: 735, action: 'monitor',     protocol: 'Facility bylaws · 2-year re-privileging', authority: 'Facility credentials committee',     autoRenewable: false, fee: 'no fee', cmeRequired: null, cmeOnFile: null },
      { id: 'tb',           kind: 'clearance',            label: 'TB clearance · annual',           expires: '2026-04-25', daysToExpire: 0,   action: 'expiring',    protocol: 'Annual employee health',             authority: 'Facility employee health',                autoRenewable: false, fee: 'no fee', cmeRequired: null, cmeOnFile: null },
      { id: 'attestation',  kind: 'enrollment',           label: 'Roster re-attestation',           expires: '2026-07-12', daysToExpire: 76,  action: 'renew_self', protocol: '120-day attestation cycle',          authority: 'Roster attestation system',               autoRenewable: true,  fee: 'no fee', cmeRequired: null, cmeOnFile: null },
    ],
    portability: [
      { state: 'D1', name: 'Demo State 1',  status: 'licensed',         since: '2018-06', payers: 23, primary: true,  note: 'Home state · primary licensure' },
      { state: 'D2', name: 'Demo State 2',  status: 'compact_eligible', since: null,      payers: 0,  primary: false, note: 'Eligible via interstate compact · 14-day issuance' },
      { state: 'D3', name: 'Demo State 3',  status: 'compact_eligible', since: null,      payers: 0,  primary: false, note: 'Eligible via interstate compact · 21-day issuance' },
      { state: 'D4', name: 'Demo State 4',  status: 'compact_eligible', since: null,      payers: 0,  primary: false, note: 'Eligible · facility endorsement available' },
      { state: 'D5', name: 'Demo State 5',  status: 'licensed',         since: '2022-03', payers: 4,  primary: false, note: 'Active second licensure · used last for tele-consult' },
      { state: 'D6', name: 'Demo State 6',  status: 'dormant',          since: '2019-08', payers: 0,  primary: false, note: 'License lapsed 2023-11 · reactivation requires CME hours' },
    ],
    nba: [
      {
        id: 'nba-acls',
        rank: 1,
        severity: 'high',
        title: 'Book ACLS skills check',
        subtitle: 'Card expires June 4 · 39 days · class slots tightening',
        impact: 'Without renewal, the facility moderate-sedation privilege auto-suspends June 5.',
        receipt: 'Pulled from issuing-association roster · refreshed 14m ago',
        ctaLabel: 'See class slots near you',
        ctaSecondary: 'Snooze 7d',
      },
      {
        id: 'nba-cme',
        rank: 2,
        severity: 'medium',
        title: 'Home-state PA renewal · 12 CME hrs short',
        subtitle: 'Renewal opens July 1 · 38/50 hrs on file',
        impact: 'On current pace you finish CME 14 days late. Ten on-demand courses match your scope.',
        receipt: 'CME records reconciled with membership organization · 4d ago',
        ctaLabel: 'Plan CME (12 hrs)',
        ctaSecondary: 'I have credits elsewhere',
      },
      {
        id: 'nba-compact',
        rank: 3,
        severity: 'low',
        title: 'Pre-stage second-state license via interstate compact',
        subtitle: 'Locum offers in your inbox · 14-day issuance',
        impact: 'Pre-staging captures up to ~$28k in tele-consult and locum margin without dual board fees.',
        receipt: 'Inferred from inbound recruiter messages · last week',
        ctaLabel: 'Start compact pre-stage',
        ctaSecondary: 'Not interested',
      },
    ],
    drift: [
      { id: 'address',      label: 'Practice address',             verifiedAt: '2026-04-12', attestedAt: '2026-04-18', status: 'fresh',     authority: 'Provider directory · live ping',          delta: '6 days' },
      { id: 'tin',          label: 'Tax ID / TIN',                  verifiedAt: '2026-04-18', attestedAt: '2026-04-18', status: 'fresh',     authority: 'TIN match · payer rosters',               delta: 'same day' },
      { id: 'csa',          label: 'Controlled-substance schedules', verifiedAt: '2026-04-15', attestedAt: '2026-04-18', status: 'fresh',     authority: 'Controlled-substance registration database', delta: '3 days' },
      { id: 'malpractice',  label: 'Malpractice carrier',           verifiedAt: '2026-01-09', attestedAt: '2026-04-18', status: 'aging',     authority: 'Coverage letter on file',                  delta: '99 days' },
      { id: 'reference-1',  label: 'Peer reference',                 verifiedAt: '2025-08-22', attestedAt: '2026-04-18', status: 'stale',     authority: 'Direct attestation',                       delta: '239 days' },
      { id: 'phone',        label: 'Direct phone',                   verifiedAt: '2025-12-04', attestedAt: '2026-04-18', status: 'aging',     authority: 'Roster attestation system',                delta: '135 days' },
      { id: 'specialty',    label: 'Self-reported specialty',         verifiedAt: null,         attestedAt: '2026-04-18', status: 'divergent', authority: 'No primary source · attestation only',     delta: 'never source-confirmed' },
    ],
    trustFactors: [
      { label: 'Primary-source check freshness',     weight: 0.30, score: 0.97, note: '7/7 anchor sources within 30-day window' },
      { label: 'No active sanctions or actions',     weight: 0.25, score: 1.00, note: 'Sanctions controls clean · adverse-event monitoring nightly' },
      { label: 'Document attestations current',      weight: 0.15, score: 0.92, note: '1 attestation aging > 60 days' },
      { label: 'Malpractice coverage on file',       weight: 0.15, score: 0.88, note: 'Carrier letter aging 99 days' },
      { label: 'CME / continuing competence pace',   weight: 0.10, score: 0.76, note: '38/50 hrs · on track if current pace holds' },
      { label: 'Profile drift index',                weight: 0.05, score: 0.84, note: '2 fields aging · 1 divergent self-report' },
    ],
  };
}
