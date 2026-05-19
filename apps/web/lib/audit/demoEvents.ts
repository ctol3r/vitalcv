/**
 * Demo audit-event store — JSON stubs for the Matuschak Lineage Graph
 * API (WAVE C72).
 *
 * Production audit events live in the Express backend's AuditEvent
 * table (Prisma). Per wave constraint "do not touch production
 * databases", the lineage-graph route reads from this in-memory stub
 * to demonstrate bi-directional resolution without a DB hit.
 *
 * Schema mirrors the real AuditEvent shape (id, runId, lineageKey,
 * kind, subjectId, parentEventIds, summary, occurredAt) so a future
 * adapter can swap this stub for a Prisma query with no API change.
 */

export interface DemoAuditEvent {
  readonly id: string;
  readonly kind:
    | 'source_check'
    | 'attestation'
    | 'committee_action'
    | 'anchor'
    | 'revocation';
  /** Verification-run fingerprint — links runs together. */
  readonly runId: string;
  /** "<laneId>:<subjectId>" — links by subject + lane. */
  readonly lineageKey: string;
  /** Explicit upstream event ids (DAG edges). */
  readonly parentEventIds: readonly string[];
  readonly subjectId: string;
  readonly summary: string;
  readonly occurredAt: string;
}

const EVENTS: readonly DemoAuditEvent[] = [
  // Subject A · NPI 1356428912 · Internal Medicine
  {
    id: 'evt_a01',
    kind: 'source_check',
    runId: 'run_7a2cb8d3',
    lineageKey: 'nppes_identity:1356428912',
    parentEventIds: [],
    subjectId: '1356428912',
    summary: 'NPPES identity resolution',
    occurredAt: '2026-05-12T14:31:58Z',
  },
  {
    id: 'evt_a02',
    kind: 'source_check',
    runId: 'run_7a2cb8d3',
    lineageKey: 'oig_exclusions:1356428912',
    parentEventIds: ['evt_a01'],
    subjectId: '1356428912',
    summary: 'OIG/LEIE sanction screen · 0 records',
    occurredAt: '2026-05-12T14:31:59Z',
  },
  {
    id: 'evt_a03',
    kind: 'source_check',
    runId: 'run_7a2cb8d3',
    lineageKey: 'pecos_enrollment:1356428912',
    parentEventIds: ['evt_a01'],
    subjectId: '1356428912',
    summary: 'PECOS enrollment status',
    occurredAt: '2026-05-12T14:32:01Z',
  },
  {
    id: 'evt_a04',
    kind: 'attestation',
    runId: 'run_7a2cb8d3',
    lineageKey: 'subject_attest:1356428912',
    parentEventIds: ['evt_a02', 'evt_a03'],
    subjectId: '1356428912',
    summary: 'Subject self-attestation · signed by holder DID',
    occurredAt: '2026-05-12T14:32:08Z',
  },
  {
    id: 'evt_a05',
    kind: 'anchor',
    runId: 'run_7a2cb8d3',
    lineageKey: 'tsa_anchor:1356428912',
    parentEventIds: ['evt_a04'],
    subjectId: '1356428912',
    summary: 'RFC 3161 TSA anchor on receipt head',
    occurredAt: '2026-05-12T14:32:12Z',
  },

  // Subject B · NPI 8830014772 · Hospital Medicine
  {
    id: 'evt_b01',
    kind: 'source_check',
    runId: 'run_6e910f48',
    lineageKey: 'nppes_identity:8830014772',
    parentEventIds: [],
    subjectId: '8830014772',
    summary: 'NPPES identity resolution',
    occurredAt: '2026-05-12T12:17:02Z',
  },
  {
    id: 'evt_b02',
    kind: 'committee_action',
    runId: 'run_6e910f48',
    lineageKey: 'committee_review:8830014772',
    parentEventIds: ['evt_b01'],
    subjectId: '8830014772',
    summary: 'Credentialing committee scheduled',
    occurredAt: '2026-05-12T13:02:14Z',
  },
];

export function listDemoAuditEvents(): readonly DemoAuditEvent[] {
  return EVENTS;
}

export function getDemoAuditEvent(id: string): DemoAuditEvent | null {
  return EVENTS.find((e) => e.id === id) ?? null;
}
