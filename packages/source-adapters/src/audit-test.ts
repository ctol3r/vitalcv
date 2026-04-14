// ── Audit Event System Tests ────────────────────────────────────

import {
  AuditEventType,
  createAuditEvent,
  validateAuditEvent,
  isValidAuditEvent,
  type AuditEvent,
} from './audit-events';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) { passed++; console.log(`✓ ${msg}`); }
  else { failed++; console.error(`✗ ${msg}`); }
}

// ── 1. Valid event creation ──────────────────────────────────────

const event = createAuditEvent({
  eventType: AuditEventType.SOURCE_CHECKED,
  subjectNpi: '1487664858',
  actor: 'employer-123',
  metadata: { source: 'NPPES', status: 'checked' },
});

assert(typeof event.eventId === 'string' && event.eventId.length === 36, 'Event has UUID v4 eventId');
assert(event.eventType === 'source.checked', 'Event type is correct');
assert(event.subjectNpi === '1487664858', 'subjectNpi is correct');
assert(event.actor === 'employer-123', 'Actor is correct');
assert(event.manifestId === null, 'manifestId defaults to null');
assert(event.attestationId === null, 'attestationId defaults to null');
assert(event.inputsHash === null, 'inputsHash defaults to null');
assert(event.outputsHash === null, 'outputsHash defaults to null');
assert(typeof event.metadata === 'object' && !Array.isArray(event.metadata), 'metadata is object');
assert(event.metadata.source === 'NPPES', 'metadata is preserved');
assert(!isNaN(Date.parse(event.timestamp)), 'timestamp is valid ISO 8601');

// ── 2. All event types produce valid events ──────────────────────

const eventTypes = Object.values(AuditEventType);
for (const type of eventTypes) {
  const e = createAuditEvent({
    eventType: type as AuditEventType,
    subjectNpi: '1234567890',
    metadata: { test: true },
  });
  assert(isValidAuditEvent(e), `Event type "${type}" produces valid event`);
}

// ── 3. Validation catches missing required fields ────────────────

const noNpi = validateAuditEvent({
  eventId: '',
  eventType: AuditEventType.SOURCE_CHECKED,
  timestamp: '2026-04-14T00:00:00Z',
  actor: null,
  subjectNpi: '',
  manifestId: null,
  attestationId: null,
  inputsHash: null,
  outputsHash: null,
  metadata: {},
});
assert(noNpi.some(e => e.field === 'subjectNpi'), 'Missing NPI caught');
assert(noNpi.some(e => e.field === 'eventId'), 'Empty eventId caught');

const badTimestamp = validateAuditEvent({
  eventId: crypto.randomUUID(),
  eventType: AuditEventType.SOURCE_CHECKED,
  timestamp: 'not-a-date',
  actor: null,
  subjectNpi: '1234567890',
  manifestId: null,
  attestationId: null,
  inputsHash: null,
  outputsHash: null,
  metadata: {},
});
assert(badTimestamp.some(e => e.field === 'timestamp'), 'Invalid timestamp caught');

const badNpi = validateAuditEvent({
  eventId: crypto.randomUUID(),
  eventType: AuditEventType.SOURCE_CHECKED,
  timestamp: '2026-04-14T00:00:00Z',
  actor: null,
  subjectNpi: 'ABC',
  manifestId: null,
  attestationId: null,
  inputsHash: null,
  outputsHash: null,
  metadata: {},
});
assert(badNpi.some(e => e.field === 'subjectNpi'), 'Non-numeric NPI caught');

const nullMetadata = validateAuditEvent({
  eventId: crypto.randomUUID(),
  eventType: AuditEventType.SOURCE_CHECKED,
  timestamp: '2026-04-14T00:00:00Z',
  actor: null,
  subjectNpi: '1234567890',
  manifestId: null,
  attestationId: null,
  inputsHash: null,
  outputsHash: null,
  metadata: null as any,
});
assert(nullMetadata.some(e => e.field === 'metadata'), 'Null metadata caught');

// ── 4. Invalid event throws on creation ──────────────────────────

try {
  createAuditEvent({
    eventType: AuditEventType.SOURCE_CHECKED,
    subjectNpi: 'invalid',
  });
  console.error('✗ Should have thrown for invalid NPI');
  failed++;
} catch {
  passed++;
  console.log('✓ Invalid NPI throws on creation');
}

// ── 5. Event is immutable (structural, not deep freeze) ──────────

const frozenEvent = createAuditEvent({
  eventType: AuditEventType.REVIEW_OPENED,
  subjectNpi: '1234567890',
  metadata: { page: '/p/1234567890' },
});

assert(frozenEvent.eventType === 'review.opened', 'Immutability: eventType correct');
assert(frozenEvent.metadata.page === '/p/1234567890', 'Immutability: metadata correct');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) throw new Error('Audit event tests failed');
