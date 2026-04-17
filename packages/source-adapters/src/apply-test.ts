// ── Apply-with-VCV Flow Tests ────────────────────────────────────

import { ProofAvailability, ReadinessPosture } from '../../trust-contract/src/index';
import { ApplySessionStatus, ApplyActionType, createApplySession, openApplySession, executeApplyAction } from './apply-session';
import { AuditEventType } from './audit-events';
import type { ProofManifest } from './manifest-engine';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) { passed++; console.log(`✓ ${msg}`); }
  else { failed++; console.error(`✗ ${msg}`); }
}

const mockManifest: ProofManifest = {
  manifestId: 'manifest-123',
  schema: 'vitalcv.manifest.v1',
  generatedAt: new Date().toISOString(),
  subject: { npi: '1487664858', entityType: 'Individual', credentialedName: 'MACIE' },
  readinessPosture: ReadinessPosture.DECISION_GRADE,
  proofAvailability: ProofAvailability.DECISION_GRADE,
  coverage: [],
  claims: [],
  receipts: [],
  limitations: [],
  freshnessSummary: { oldestCheck: null, newestCheck: null, staleLanes: 0 },
};

// ── 1. Session Creation ──────────────────────────────────────────

const { session, event: createEvent } = createApplySession(mockManifest, 'employer-1');

assert(session.sessionId.length === 36, 'Session ID is UUID');
assert(session.manifestId === 'manifest-123', 'Binds to correct manifest');
assert(session.status === ApplySessionStatus.CREATED, 'Initial status is CREATED');
assert(createEvent.eventType === AuditEventType.APPLICATION_SUBMITTED, 'Fires APPLICATION_SUBMITTED event');

// Cannot share NONE proof manifest
try {
  createApplySession({ ...mockManifest, proofAvailability: ProofAvailability.NONE });
  failed++;
} catch (e: any) {
  assert(e.message.includes('Cannot share'), 'Prevents sharing manifest with NONE proof');
}

// ── 2. Session Open ──────────────────────────────────────────────

const { session: openedSession, event: openEvent } = openApplySession(session);

assert(openedSession.status === ApplySessionStatus.OPENED, 'Status transitions to OPENED');
assert(openEvent.eventType === AuditEventType.REVIEW_OPENED, 'Fires REVIEW_OPENED event');

// ── 3. Session Execute (Approve) ─────────────────────────────────

const { session: decidedSession, events: executeEvents } = executeApplyAction(
  openedSession,
  ApplyActionType.APPROVE_CANDIDATE,
  { reason: 'Clean checks' }
);

assert(decidedSession.status === ApplySessionStatus.DECIDED, 'Status transitions to DECIDED');
assert(decidedSession.actionTaken === ApplyActionType.APPROVE_CANDIDATE, 'Action recorded');
assert(decidedSession.actionTakenAt !== null, 'Action timestamp recorded');
assert(executeEvents.length === 2, 'Approval generates 2 events');
assert(executeEvents[0].eventType === AuditEventType.EMPLOYER_ACCEPTED, 'Fires EMPLOYER_ACCEPTED');
assert(executeEvents[1].eventType === AuditEventType.EMPLOYMENT_STARTED, 'Fires EMPLOYMENT_STARTED');

// Cannot execute twice
try {
  executeApplyAction(decidedSession, ApplyActionType.REJECT_CANDIDATE);
  failed++;
} catch (e: any) {
  assert(e.message.includes('Cannot execute'), 'Prevents double execution');
}

// ── 4. Session Execute (Request Refresh) ─────────────────────────

const s2 = openApplySession(createApplySession(mockManifest, null).session).session;
const { session: refreshSession, events: refreshEvents } = executeApplyAction(s2, ApplyActionType.REQUEST_REFRESH);

assert(refreshSession.actionTaken === ApplyActionType.REQUEST_REFRESH, 'Action recorded: Refresh');
assert(refreshEvents.length === 1, 'Refresh generates 1 event');
assert(refreshEvents[0].eventType === AuditEventType.EMPLOYER_REQUESTED_REFRESH, 'Fires EMPLOYER_REQUESTED_REFRESH');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) throw new Error('Apply-with-VCV flow tests failed');
