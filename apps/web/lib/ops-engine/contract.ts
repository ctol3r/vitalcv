/**
 * Operations Engine — real-data contract.
 *
 * The Operations Engine UI (components/ops-engine/) was ported from a seeded
 * demo. To run on REAL data it consumes an `OpsSnapshot` produced server-side
 * from the system of record. apps/web is a thin client — the roster, the
 * append-only ledger, and readiness all live in the backend service
 * (apps/api/backend); apps/web's own Prisma client only carries
 * IssuerRequest + ReceiptCandidate. So a real snapshot is assembled by calling
 * the backend API (see getOpsEngineSnapshot.ts), never by inventing data.
 *
 * Honesty rule: when no data source is configured or reachable, the snapshot
 * MUST report `status: 'unavailable'` (or `'empty'` when reachable but zero
 * rows) — the UI then shows an explicit empty state rather than mock providers.
 */

export type OpsSnapshotStatus = 'live' | 'empty' | 'unavailable';

/** Which real system the workspace's records were sourced from. */
export type OpsSourceId = 'employer' | 'credentialing' | 'verifier';

export type OpsRisk = 'high' | 'med' | 'low';

export interface OpsBlocker {
  id: string;
  label: string;
  sev: OpsRisk;
}

/** One provider/clinician record moving through a pipeline. Mirrors the UI's
 *  internal roster shape so views render unchanged. */
export interface OpsRecord {
  id: string;
  name: string;
  npi: string | null;
  specialty: string;
  group: string;
  stageIdx: number;
  isActive: boolean;
  readiness: number; // 0-100
  risk: OpsRisk;
  daysInStage: number;
  sla: number;
  overdue: boolean;
  blockers: string[]; // blocker ids present in the workspace's blocker catalog
  licenseDays: number | null;
  assignee: string | null; // team-member id
  owner: string | null; // role id
  flagged: boolean;
  /** Provenance — lets real write-actions target the right backend resource. */
  sourceId: OpsSourceId;
  sourceRef: string; // backend primary key (applicationId, contextSubjectId, candidateId)
}

/** One immutable ledger event. Mirrors the backend AuditEntry projected for UI. */
export interface OpsEvent {
  id: string;
  seq: number;
  ts: number; // epoch ms
  type: string;
  actor: string | null;
  subjectId: string | null;
  subject: string | null;
  group: string | null;
  detail: string;
  system: boolean;
}

export interface OpsStage {
  id: string;
  label: string;
  owner: string;
  sla: number;
}

export interface OpsTerms {
  provider: string;
  providerPl: string;
  group: string;
  groupPl: string;
}

export interface OpsTeamMember {
  id: string;
  name: string;
  role: string;
  initials: string;
}

/** A real organization / source the signed-in operator can see. */
export interface OpsWorkspace {
  id: string;
  name: string;
  type: string;
  short: string;
  accent: string;
  icon: string;
  sourceId: OpsSourceId;
  terms: OpsTerms;
  stages: OpsStage[];
  groups: string[];
  blockerCatalog: OpsBlocker[];
  team: OpsTeamMember[];
  records: OpsRecord[];
  events: OpsEvent[];
}

export interface OpsSnapshot {
  status: OpsSnapshotStatus;
  /** Human-readable reason when status !== 'live' (shown in the empty state). */
  reason?: string;
  generatedAt: number;
  /** The operator's org context, when known (Clerk org / active workspace). */
  orgId?: string | null;
  workspaces: OpsWorkspace[];
}

export const EMPTY_SNAPSHOT = (status: OpsSnapshotStatus, reason: string): OpsSnapshot => ({
  status,
  reason,
  generatedAt: 0, // stamped by the caller; kept 0 here to stay pure for tests
  workspaces: [],
});
