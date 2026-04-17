// ── Drift Engine Tests ───────────────────────────────────────────

import { SourceStatus } from '../../trust-contract/src/index';
import type { SourceCheckResult } from './types';
import type { CoverageLane } from './manifest-engine';
import type { Claim } from './claim-engine';
import { detectDrift, DriftType, DriftSeverity } from './drift-engine';
import { AuditEventType } from './audit-events';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) { passed++; console.log(`✓ ${msg}`); }
  else { failed++; console.error(`✗ ${msg}`); }
}

const mockPreviousLane: CoverageLane = {
  source: 'OIG_LEIE',
  laneType: 'exclusion',
  status: SourceStatus.CHECKED,
  checkedAt: '2026-04-14T11:00:00Z',
  observedAt: '2026-04-14T11:00:00Z',
  ttl: 24 * 60 * 60 * 1000,
  errorClass: null,
};

const mockPreviousClaims: Claim[] = [
  {
    claimId: 'c-1',
    claimType: 'oig.exclusion',
    value: false,
    source: 'OIG_LEIE',
    observedAt: null,
    confidence: 'exact',
    matchBasis: '',
    limitations: [],
    sourceCheckId: 'OIG_LEIE:1',
  }
];

// ── 1. Status Changed & New Adverse Signal ───────────────────────

const newAdverseCheck: SourceCheckResult = {
  sourceId: 'OIG_LEIE',
  laneType: 'exclusion',
  status: SourceStatus.BLOCKED_SIGNAL,
  claims: [
    { key: 'has_active_exclusion', value: true, present: true },
  ],
  limitations: [
    { code: 'OIG_EXCLUSION_ACTIVE', description: 'Active exclusion', adverse: true }
  ],
  matchBasis: { mode: 'npi_exact', confidence: 'exact', explanation: '' },
  observedAt: '2026-04-14T00:00:00Z',
  checkedAt: '2026-04-14T12:00:00Z',
  rawHash: 'hash',
  parserVersion: 'v1',
  errorClass: null,
};

const result1 = detectDrift({
  subjectNpi: '1234567890',
  previousLanes: [mockPreviousLane],
  previousClaims: mockPreviousClaims,
  newCheck: newAdverseCheck,
});

assert(result1.drifts.length === 3, 'Detected 3 drifts (status, adverse signal, value)');
assert(result1.drifts.some(d => d.driftType === DriftType.STATUS_CHANGED), 'Detected status_changed');
assert(result1.drifts.some(d => d.driftType === DriftType.NEW_ADVERSE_SIGNAL), 'Detected new_adverse_signal');
assert(result1.drifts.some(d => d.driftType === DriftType.VALUE_CHANGED), 'Detected value_changed');
assert(result1.drifts.find(d => d.driftType === DriftType.STATUS_CHANGED)?.severity === DriftSeverity.HIGH, 'Status changed to BLOCKED is HIGH severity');
assert(result1.events.length === 3, 'Generated 3 audit events');
assert(result1.events[0].eventType === AuditEventType.DRIFT_DETECTED, 'Audit event is DRIFT_DETECTED');

// ── 2. No Drift ──────────────────────────────────────────────────

const noDriftCheck: SourceCheckResult = {
  sourceId: 'OIG_LEIE',
  laneType: 'exclusion',
  status: SourceStatus.CHECKED,
  claims: [
    { key: 'has_active_exclusion', value: false, present: true },
  ],
  limitations: [],
  matchBasis: { mode: 'npi_exact', confidence: 'exact', explanation: '' },
  observedAt: '2026-04-14T00:00:00Z',
  checkedAt: '2026-04-14T12:00:00Z',
  rawHash: 'hash',
  parserVersion: 'v1',
  errorClass: null,
};

const result2 = detectDrift({
  subjectNpi: '1234567890',
  previousLanes: [mockPreviousLane],
  previousClaims: mockPreviousClaims,
  newCheck: noDriftCheck,
});

assert(result2.drifts.length === 0, 'No drift detected when data matches');
assert(result2.events.length === 0, 'No events generated');

// ── 3. Freshness Expired ─────────────────────────────────────────

// Simulate a fresh check that is UNAVAILABLE, revealing that the old CHECKED state
// has exceeded its TTL.
const staleCheck: SourceCheckResult = {
  sourceId: 'OIG_LEIE',
  laneType: 'exclusion',
  status: SourceStatus.UNAVAILABLE,
  claims: [],
  limitations: [],
  matchBasis: { mode: 'npi_exact', confidence: 'unresolved', explanation: '' },
  observedAt: null,
  checkedAt: '2026-04-14T12:00:00Z', // 14 days later, TTL was 1 day
  rawHash: 'hash',
  parserVersion: 'v1',
  errorClass: 'TIMEOUT',
};

const result3 = detectDrift({
  subjectNpi: '1234567890',
  previousLanes: [{ ...mockPreviousLane, checkedAt: '2026-04-01T00:00:00Z' }],
  previousClaims: mockPreviousClaims,
  newCheck: staleCheck,
});

assert(result3.drifts.some(d => d.driftType === DriftType.FRESHNESS_EXPIRED), 'Detected freshness_expired');
assert(result3.drifts.find(d => d.driftType === DriftType.FRESHNESS_EXPIRED)?.severity === DriftSeverity.LOW, 'Freshness expiry is LOW severity');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) throw new Error('Drift engine tests failed');
