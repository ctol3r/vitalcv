/**
 * Wave F Phase 1 — Start-Activation Console data shape + demo fixture.
 *
 * Pure types + a single demoCase() fixture. No fetch, no DB, no DOM.
 *
 * Truth contract:
 *   - All values returned by demoCase() are demonstrative. They do
 *     NOT describe a real clinician's activation case. The page that
 *     renders them always carries a "Demo case — illustrative only"
 *     banner. data-is-demo is the literal `true`.
 *   - The DTS estimate is a probabilistic range (P10/P50/P90), not
 *     a single point. The burn-down trend shows the P50 series over
 *     the last N days.
 *   - Privilege / payer / onboarding status labels are operational
 *     labels (Granted, Enrolled, In Progress, etc.) — none are the
 *     bare-word status label CLAUDE.md bans.
 *   - Real payer integrations (PECOS, Medicaid, commercial carriers)
 *     are vendor-gated and out of scope for this surface; the demo
 *     describes the tracking shape, not active integrations.
 */

export interface ActivationCaseMeta {
  id: string;
  clinician: string;
  npi: string;
  facility: string;
  facilityCode: string;
  startDate: string;
  startDateLabel: string;
  acceptedAt: string;
  /** Predictive range, never a single point. */
  dtsEstimate: { p10: number; p50: number; p90: number; baseline: number };
  /** P50 series over the last N days (most recent last). */
  dtsTrend: ReadonlyArray<number>;
  daysSinceAccept: number;
  /** Always true in Phase 1 — drives the demo banner. */
  isDemo: true;
}

export type CriticalPathState = 'done' | 'in_progress' | 'pending';

export interface CriticalPathStage {
  id: 'accepted' | 'privileged' | 'enrolled' | 'cleared';
  label: string;
  sub: string;
  state: CriticalPathState;
  owner: string;
  /** Wall-clock ETA (e.g. "May 06") — null when state is 'done'. */
  eta?: string;
  /** ISO timestamp — set only when state is 'done'. */
  completedAt?: string;
  /** Progress 0..1; meaningful only when state is 'in_progress'. */
  progress?: number;
  /** Optional VC 2.0 receipt id once Wave E lands. */
  receiptId?: string;
}

export type PrivilegeStatus =
  | 'granted'
  | 'proctoring'
  | 'training'
  | 'pending_review'
  | 'not_requested';

export interface Privilege {
  id: string;
  name: string;
  category: string;
  bylaws: string;
  fppe: string;
  status: PrivilegeStatus;
  counter: { current: number; required: number; unit: string };
  proctor: string;
  nextProctored?: string;
  note: string;
  grantedAt?: string;
}

export type PayerKind = 'Federal' | 'State' | 'Commercial';

export type PayerStatus =
  | 'enrolled'
  | 'submitted'
  | 'preparing'
  | 'waiting_carrier'
  | 'rejected'
  | 'not_in_scope';

export interface Payer {
  id: string;
  name: string;
  kind: PayerKind;
  status: PayerStatus;
  submittedAt: string | null;
  effectiveAt: string | null;
  /** System-of-record flag — does this payer report back into VitalCV? */
  sor: boolean;
  ptan: string;
  note: string;
  actionable?: boolean;
}

export type OnboardingState = 'done' | 'in_progress' | 'pending';

export interface OnboardingTask {
  id: string;
  label: string;
  owner: string;
  state: OnboardingState;
  dueAt: string;
  completedAt?: string;
  standard: string;
  subprogress?: { collected: number; required: number };
}

export interface Handoff {
  from: { name: string; role: string; kind: 'system' | 'human' | 'committee' };
  to: { name: string; role: string; kind: 'system' | 'human' | 'committee' };
  at: string;
  artifact: string;
  receipt: string;
  isCurrent?: boolean;
}

export interface ActivationCase {
  meta: ActivationCaseMeta;
  criticalPath: ReadonlyArray<CriticalPathStage>;
  privileges: ReadonlyArray<Privilege>;
  payers: ReadonlyArray<Payer>;
  onboardingTasks: ReadonlyArray<OnboardingTask>;
  handoffs: ReadonlyArray<Handoff>;
}

/* ---------- Status meta — pure label/tone maps for the page ---------- */

export const PRIV_STATUS_META: Record<
  PrivilegeStatus,
  { label: string; tone: 'emerald' | 'amber' | 'indigo' | 'slate' }
> = {
  granted:        { label: 'Granted',        tone: 'emerald' },
  proctoring:     { label: 'Proctoring',     tone: 'amber'   },
  training:       { label: 'Training',       tone: 'indigo'  },
  pending_review: { label: 'Pending review', tone: 'slate'   },
  not_requested:  { label: 'Not requested',  tone: 'slate'   },
};

export const PAYER_STATUS_META: Record<
  PayerStatus,
  { label: string; tone: 'emerald' | 'slate' | 'indigo' | 'rose' }
> = {
  enrolled:        { label: 'Enrolled',        tone: 'emerald' },
  submitted:       { label: 'Submitted',       tone: 'slate'   },
  waiting_carrier: { label: 'In carrier review', tone: 'indigo' },
  preparing:       { label: 'Preparing',       tone: 'slate'   },
  rejected:        { label: 'Rejected · action', tone: 'rose'   },
  not_in_scope:    { label: 'Not in scope',    tone: 'slate'   },
};

export const ONBOARD_STATUS_META: Record<
  OnboardingState,
  { label: string; tone: 'emerald' | 'amber' | 'slate' }
> = {
  done:        { label: 'Complete',    tone: 'emerald' },
  in_progress: { label: 'In progress', tone: 'amber'   },
  pending:     { label: 'Pending',     tone: 'slate'   },
};

/* ---------- Pure derived counters ---------- */

export interface ActivationCounts {
  privileges: { total: number; granted: number; inFlight: number };
  payers: { total: number; enrolled: number; rejected: number };
  onboarding: { total: number; done: number; inFlight: number };
}

export function computeActivationCounts(c: ActivationCase): ActivationCounts {
  const privileges = {
    total: c.privileges.length,
    granted: c.privileges.filter((p) => p.status === 'granted').length,
    inFlight: c.privileges.filter((p) => p.status === 'proctoring' || p.status === 'training' || p.status === 'pending_review').length,
  };
  const payers = {
    total: c.payers.length,
    enrolled: c.payers.filter((p) => p.status === 'enrolled').length,
    rejected: c.payers.filter((p) => p.status === 'rejected').length,
  };
  const onboarding = {
    total: c.onboardingTasks.length,
    done: c.onboardingTasks.filter((t) => t.state === 'done').length,
    inFlight: c.onboardingTasks.filter((t) => t.state === 'in_progress').length,
  };
  return { privileges, payers, onboarding };
}

/** Critical-path completion ratio: fraction of stages that are 'done'. */
export function criticalPathCompletion(c: ActivationCase): number {
  if (c.criticalPath.length === 0) return 0;
  const done = c.criticalPath.filter((s) => s.state === 'done').length;
  return done / c.criticalPath.length;
}

/* ---------- Demo fixture ---------- */

export function demoCase(): ActivationCase {
  return {
    meta: {
      id: 'VCV-START-DEMO-000841',
      clinician: 'Demo Clinician, PA-C',
      npi: '0000000000',
      facility: 'Demo Health · Surgical Pavilion',
      facilityCode: 'DEMO-SP',
      startDate: '2026-05-21',
      startDateLabel: 'May 21, 2026',
      acceptedAt: '2026-04-23T09:14:00Z',
      dtsEstimate: { p10: 17, p50: 21, p90: 28, baseline: 47 },
      dtsTrend: [29, 27, 26, 24, 23, 22, 21],
      daysSinceAccept: 5,
      isDemo: true,
    },
    criticalPath: [
      {
        id: 'accepted',
        label: 'Accepted',
        sub: 'File approved by Credentials Committee',
        state: 'done',
        completedAt: '2026-04-23T09:14:00Z',
        owner: 'Credentials Committee',
        receiptId: 'demo:committee-accept',
      },
      {
        id: 'privileged',
        label: 'Privileged',
        sub: 'Facility-specific clinical privileges granted',
        state: 'in_progress',
        eta: 'May 06',
        owner: 'Department Chair',
        progress: 0.72,
      },
      {
        id: 'enrolled',
        label: 'Enrolled',
        sub: 'Federal / state / commercial payer enrollment',
        state: 'in_progress',
        eta: 'May 14',
        owner: 'Payer Enrollment Specialist',
        progress: 0.40,
      },
      {
        id: 'cleared',
        label: 'Cleared to Schedule',
        sub: 'Onboarding complete; clinician on the schedule',
        state: 'pending',
        eta: 'May 21',
        owner: 'Medical Staff Office',
        progress: 0,
      },
    ],
    privileges: [
      { id: 'priv-cv1',         name: 'Central venous catheterization', category: 'Core · Surgery PA',          bylaws: 'Demo Bylaws §IV.3.b', fppe: 'FPPE Plan §2.1', status: 'proctoring',    counter: { current: 2, required: 5, unit: 'proctored procedures' }, proctor: 'Demo Proctor · Vascular',           nextProctored: '2026-04-29', note: 'On track. 3 procedures remaining within 90-day FPPE window.' },
      { id: 'priv-rsi',         name: 'Rapid sequence intubation',      category: 'Advanced',                    bylaws: 'Demo Bylaws §IV.3.c', fppe: 'FPPE Plan §2.2', status: 'training',      counter: { current: 0, required: 1, unit: 'simulation course' },     proctor: '—',                                  nextProctored: 'Course May 02', note: 'Simulation lab booked. Privilege deferred until course completion.' },
      { id: 'priv-firstassist', name: 'First-assist · open laparotomy', category: 'Core · Surgery PA',          bylaws: 'Demo Bylaws §IV.3.a', fppe: 'FPPE Plan §2.0', status: 'granted',       counter: { current: 4, required: 4, unit: 'documented assists' },     proctor: '—',                                  note: 'Granted at committee. External case-log review satisfied requirement.', grantedAt: '2026-04-23' },
      { id: 'priv-prescribing', name: 'Schedule II prescribing',        category: 'Restricted',                  bylaws: 'Demo Bylaws §IV.4', fppe: 'OPPE Plan §1.0', status: 'pending_review', counter: { current: 1, required: 1, unit: 'controlled-substance authority on file' }, proctor: 'P&T', note: 'P&T review scheduled May 06.' },
      { id: 'priv-sedation',    name: 'Moderate sedation',              category: 'Advanced · facility-controlled', bylaws: 'Demo Bylaws §IV.5', fppe: 'Sedation Cmte §3.2', status: 'not_requested', counter: { current: 0, required: 1, unit: 'institution-specific course' }, proctor: 'Sedation Committee', note: 'Not requested at this appointment. May be added in 12-month re-privileging cycle.' },
    ],
    payers: [
      { id: 'medicare', name: 'Medicare · reassignment',     kind: 'Federal',     status: 'enrolled',         submittedAt: '2026-04-24', effectiveAt: '2026-04-24', sor: true,  ptan: 'DEMO-IND-PA', note: 'Reassigned to Demo Health TIN. Real-time confirmation.' },
      { id: 'medicaid', name: 'State Medicaid',               kind: 'State',       status: 'submitted',        submittedAt: '2026-04-25', effectiveAt: null,         sor: true,  ptan: 'pending',     note: 'Submitted via state portal. Carrier ETA 8–14 business days.' },
      { id: 'tricare',  name: 'TRICARE West (HNFS)',          kind: 'Federal',     status: 'submitted',        submittedAt: '2026-04-25', effectiveAt: null,         sor: false, ptan: '—',           note: 'Roster submission · awaiting carrier acknowledgment.' },
      { id: 'comm-1',   name: 'Commercial Carrier 1',          kind: 'Commercial',  status: 'preparing',        submittedAt: null,         effectiveAt: null,         sor: false, ptan: '—',           note: 'Application form pre-populated from passport. 2 docs awaiting clinician signature.' },
      { id: 'comm-2',   name: 'Commercial Carrier 2',          kind: 'Commercial',  status: 'waiting_carrier',  submittedAt: '2026-04-23', effectiveAt: null,         sor: false, ptan: '—',           note: 'Attestation refreshed. Carrier in 21-day review window.' },
      { id: 'comm-3',   name: 'Commercial Carrier 3',          kind: 'Commercial',  status: 'submitted',        submittedAt: '2026-04-24', effectiveAt: null,         sor: false, ptan: '—',           note: 'Delegated roster · monthly cycle close May 03.' },
      { id: 'comm-4',   name: 'Commercial Carrier 4',          kind: 'Commercial',  status: 'rejected',         submittedAt: '2026-04-22', effectiveAt: null,         sor: false, ptan: '—',           note: 'Rejected · Tax ID mismatch on W-9. Re-submitted 2026-04-25.', actionable: true },
      { id: 'comm-5',   name: 'Commercial Carrier 5',          kind: 'Commercial',  status: 'not_in_scope',     submittedAt: null,         effectiveAt: null,         sor: false, ptan: '—',           note: 'Out-of-network for facility. No enrollment required.' },
    ],
    onboardingTasks: [
      { id: 'tb',          label: 'TB · 2-step PPD',                owner: 'Employee Health',      state: 'done',        dueAt: 'Apr 24', completedAt: 'Apr 24', standard: 'CDC · TJC IC.02.04.01' },
      { id: 'imm',         label: 'Immunization compliance',         owner: 'Employee Health',      state: 'done',        dueAt: 'Apr 25', completedAt: 'Apr 25', standard: 'TJC IC.02.04.01' },
      { id: 'drug',        label: 'Pre-employment drug screen',      owner: 'HR · Compliance',      state: 'in_progress', dueAt: 'Apr 28', standard: '49 CFR Part 40 (analogue)' },
      { id: 'fingerprint', label: 'Live Scan · DOJ/FBI',             owner: 'HR · Compliance',      state: 'in_progress', dueAt: 'Apr 30', standard: 'CA Penal Code §11105' },
      { id: 'bls',         label: 'BLS / ACLS card on file',         owner: 'Education · Onboarding', state: 'in_progress', dueAt: 'May 01', standard: 'AHA · facility policy' },
      { id: 'epic',        label: 'EMR training · 4 hrs',            owner: 'IT · Training',        state: 'in_progress', dueAt: 'May 03', standard: 'Facility EMR policy' },
      { id: 'badging',     label: 'Badge & access provisioning',     owner: 'Security',             state: 'pending',     dueAt: 'May 05', standard: 'TJC EC.02.01.01' },
      { id: 'osha',        label: 'OSHA bloodborne pathogens',       owner: 'Education · Onboarding', state: 'pending',   dueAt: 'May 05', standard: '29 CFR 1910.1030' },
      { id: 'peer',        label: 'Peer references (3)',             owner: 'MSO',                  state: 'in_progress', dueAt: 'May 08', standard: 'NCQA CR §3.4', subprogress: { collected: 2, required: 3 } },
      { id: 'fppe',        label: 'FPPE plan execution starts',      owner: 'Department Chair',     state: 'pending',     dueAt: 'May 21', standard: 'TJC MS.08.01.01' },
    ],
    handoffs: [
      { from: { name: 'VitalCV CVO',      role: 'Verification engine',         kind: 'system' },    to: { name: 'Demo Reviewer',         role: 'Credentials reviewer',         kind: 'human' },     at: '2026-04-18T14:32:00Z', artifact: 'Credentialing File · VCV-CF-DEMO-000841', receipt: 'demo:handoff-1' },
      { from: { name: 'Demo Reviewer',    role: 'Credentials reviewer',         kind: 'human' },    to: { name: 'Credentials Committee', role: 'Demo Surgical Pavilion',       kind: 'committee' }, at: '2026-04-22T16:00:00Z', artifact: 'Board Memorandum · MEMO-DEMO-0488',     receipt: 'demo:handoff-2' },
      { from: { name: 'Credentials Committee', role: 'Demo Surgical Pavilion', kind: 'committee' }, to: { name: 'Demo Coordinator',      role: 'Onboarding/MSO coordinator',   kind: 'human' },     at: '2026-04-23T09:14:00Z', artifact: 'Privilege Letter · PRIV-DEMO-0488',     receipt: 'demo:handoff-3', isCurrent: true },
    ],
  };
}
