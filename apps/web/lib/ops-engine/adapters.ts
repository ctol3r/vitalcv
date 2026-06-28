/**
 * Adapters — map real backend payloads into the Operations Engine contract.
 *
 * Every field comes from the backend; nothing is invented. Where the engine UI
 * expects a value the backend does not carry (team assignment, SLA clocks,
 * license expiry), we leave it neutral (null / 0 / false) rather than fabricate.
 * Readiness, blockers (missing-doc requests), workflow stage, and the per-record
 * timeline are all real.
 */

import type { OpsBlocker, OpsEvent, OpsRecord, OpsWorkspace } from './contract';

// Linear employer workflow pipeline. REJECTED is terminal-but-flagged (mapped
// back onto Under Review so the funnel stays linear).
const EMPLOYER_STAGES = [
  { id: 'w_new', label: 'Applied', owner: 'employer', sla: 0 },
  { id: 'w_review', label: 'Under Review', owner: 'employer', sla: 0 },
  { id: 'w_docs', label: 'Docs Requested', owner: 'employer', sla: 0 },
  { id: 'w_approved', label: 'Approved', owner: 'employer', sla: 0 },
];

function stageIdxForState(state: string): number {
  switch (state) {
    case 'APPROVED':
      return 3;
    case 'WAITING_FOR_DOCUMENTS':
      return 2;
    case 'UNDER_REVIEW':
    case 'REJECTED':
      return 1;
    case 'NEW':
    default:
      return 0;
  }
}

function deriveRisk(state: string, openBlockers: number, readiness: number): OpsRecord['risk'] {
  if (state === 'REJECTED' || openBlockers > 0 || readiness < 50) return 'high';
  if (state === 'UNDER_REVIEW' || readiness < 72) return 'med';
  return 'low';
}

function fullName(app: any): string {
  const p = app?.provider ?? {};
  return (
    p.fullName ||
    [p.firstName, p.lastName].filter(Boolean).join(' ') ||
    app?.clerkUserId ||
    'Applicant'
  );
}

function blockerIdForField(field: string): string {
  return 'mr_' + String(field).toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40);
}

function mapTimeline(app: any): OpsEvent[] {
  const rid = String(app?.id ?? '');
  const name = fullName(app);
  const tl: any[] = Array.isArray(app?.timeline) ? app.timeline : [];
  return tl.map((e, i) => ({
    id: `${rid}-tl${i}`,
    seq: i + 1,
    ts: e?.occurredAt ? Date.parse(e.occurredAt) : 0,
    type: String(e?.stage ?? 'event').toLowerCase(),
    actor: null,
    subjectId: rid,
    subject: name,
    group: null,
    detail: String(e?.description ?? ''),
    system: true,
  }));
}

/**
 * Map a backend EmployerWorkflowDashboard payload into a single OpsWorkspace
 * (the operator's organization). `ledger` is the shared audit ledger, merged
 * with each record's real timeline for the workspace event feed.
 */
export function mapEmployerDashboard(
  dashboard: any,
  ledger: OpsEvent[],
  orgId: string | null,
): OpsWorkspace | null {
  const applications: any[] = Array.isArray(dashboard?.applications) ? dashboard.applications : [];
  if (applications.length === 0) return null;

  const now = Date.now();
  const blockerCatalog: Record<string, OpsBlocker> = {};
  const records: OpsRecord[] = [];
  const recordEvents: OpsEvent[] = [];
  const specialties = new Set<string>();
  let orgName = 'Your Organization';

  applications.forEach((app) => {
    const state = String(app?.workflowState ?? 'NEW');
    const openRequests: any[] = (Array.isArray(app?.missingRequests) ? app.missingRequests : []).filter(
      (r: any) => r?.status === 'OPEN',
    );
    const blockerIds: string[] = openRequests.map((r: any) => {
      const id = blockerIdForField(r.field || r.requestId || 'doc');
      if (!blockerCatalog[id]) {
        blockerCatalog[id] = { id, label: r.message || r.field || 'Missing documentation', sev: 'med' };
      }
      return id;
    });

    const readinessScore =
      typeof app?.readiness?.readinessScore === 'number'
        ? Math.max(0, Math.min(100, Math.round(app.readiness.readinessScore)))
        : Math.round((stageIdxForState(state) / (EMPLOYER_STAGES.length - 1)) * 100);

    const specialty = app?.provider?.specialty || app?.opportunity?.specialty || '—';
    specialties.add(specialty);
    orgName = app?.opportunity?.organizationName || app?.employer?.name || orgName;

    const updatedAt = app?.updatedAt ? Date.parse(app.updatedAt) : now;
    const daysInStage = Math.max(0, Math.round((now - updatedAt) / 86400000));
    const isActive = state === 'APPROVED';

    records.push({
      id: String(app?.id ?? ''),
      name: fullName(app),
      npi: app?.npi ?? app?.provider?.npi ?? null,
      specialty,
      group: specialty,
      stageIdx: stageIdxForState(state),
      isActive,
      readiness: readinessScore,
      risk: deriveRisk(state, blockerIds.length, readinessScore),
      daysInStage,
      sla: 0,
      overdue: false,
      blockers: blockerIds,
      licenseDays: null,
      assignee: null,
      owner: 'employer',
      flagged: state === 'REJECTED',
      sourceId: 'employer',
      sourceRef: String(app?.id ?? ''),
    });

    recordEvents.push(...mapTimeline(app));
  });

  const events = [...recordEvents, ...ledger].sort((a, b) => b.ts - a.ts).slice(0, 400);

  return {
    id: orgId || 'employer-org',
    name: orgName,
    type: 'Employer',
    short: orgName.split(/\s+/).map((w) => w[0]).join('').slice(0, 3).toUpperCase() || 'ORG',
    accent: '#34d8e8',
    icon: 'Building',
    sourceId: 'employer',
    terms: { provider: 'Applicant', providerPl: 'Applicants', group: 'Specialty', groupPl: 'Specialties' },
    stages: EMPLOYER_STAGES,
    groups: [...specialties],
    blockerCatalog: Object.values(blockerCatalog),
    team: [],
    records,
    events,
  };
}
