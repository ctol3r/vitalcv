// ── Truth Enforcement Tests ───────────────────────────────────────
// Critical gap coverage: Revocation cascade, Divergence detection, Acceptance HTTP semantics

import { SourceStatus, ReadinessPosture } from '../../trust-contract/dist/index';
import {
  guardAdapterResult,
  guardReadinessTransition,
  guardCanonicalPath,
  guardAuditTransaction,
  guardUiTruthMapping,
  guardCopyValidation,
  guardTemporalValidation,
  enforce,
  EnforcementViolation,
  type AdapterResult,
  type TemporalCheck,
} from './index';

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) { passed++; }
  else { failed++; console.error(`  FAIL: ${name}`); }
}

function assertThrows(fn: () => void, name: string, expectedSeam?: string) {
  try {
    fn();
    failed++;
    console.error(`  FAIL: ${name} (no throw)`);
  } catch (err) {
    if (err instanceof EnforcementViolation) {
      if (expectedSeam && !err.seam.includes(expectedSeam)) {
        failed++;
        console.error(`  FAIL: ${name} (wrong seam: ${err.seam}, expected ${expectedSeam})`);
      } else {
        passed++;
      }
    } else {
      failed++;
      console.error(`  FAIL: ${name} (wrong error type)`);
    }
  }
}

function assertNoThrow(fn: () => void, name: string) {
  try {
    fn();
    passed++;
  } catch (err) {
    failed++;
    console.error(`  FAIL: ${name} (unexpected throw: ${err})`);
  }
}

// ── Seam A: Adapter Validation ──────────────────────────────────

console.log('\n── Seam A: Adapter Validation ──');

assertThrows(() => guardAdapterResult({ sourceId: '', status: SourceStatus.CHECKED, raw: {} }),
  'A1: empty sourceId', 'A');

assertThrows(() => guardAdapterResult({ sourceId: 'nppes', status: 'invalid' as SourceStatus, raw: {} }),
  'A2: invalid status', 'A');

assertThrows(() => guardAdapterResult({ sourceId: 'oig', status: SourceStatus.CHECKED, raw: null }),
  'A3: CHECKED without data', 'A');

assertNoThrow(() => guardAdapterResult({ sourceId: 'nppes', status: SourceStatus.PENDING, raw: null }),
  'A_OK: PENDING without data is fine');

assertNoThrow(() => guardAdapterResult({ sourceId: 'oig', status: SourceStatus.CHECKED, raw: { excluded: false } }),
  'A_OK: CHECKED with data passes');

// ── Seam B: Readiness Transition ────────────────────────────────

console.log('\n── Seam B: Readiness Transition ──');

assertThrows(() => guardReadinessTransition(ReadinessPosture.CHECKING, ReadinessPosture.DECISION_GRADE,
  { hasReviewRequired: true, criticalLanesChecked: true, hasAdverseSignal: false }),
  'B1: promotion with reviewRequired', 'B');

assertThrows(() => guardReadinessTransition(ReadinessPosture.PARTIAL, ReadinessPosture.DECISION_GRADE,
  { hasReviewRequired: false, criticalLanesChecked: false, hasAdverseSignal: false }),
  'B2: DECISION_GRADE without critical lanes', 'B');

assertThrows(() => guardReadinessTransition(ReadinessPosture.PARTIAL, ReadinessPosture.BLOCKED,
  { hasReviewRequired: false, criticalLanesChecked: true, hasAdverseSignal: false }),
  'B3: BLOCKED without adverse signal', 'B');

assertThrows(() => guardReadinessTransition(ReadinessPosture.CHECKING, ReadinessPosture.BLOCKED,
  { hasReviewRequired: false, criticalLanesChecked: false, hasAdverseSignal: false }),
  'B4: CHECKING→BLOCKED without evidence', 'B');

assertNoThrow(() => guardReadinessTransition(ReadinessPosture.PARTIAL, ReadinessPosture.DECISION_GRADE,
  { hasReviewRequired: false, criticalLanesChecked: true, hasAdverseSignal: false }),
  'B_OK: valid promotion passes');

assertNoThrow(() => guardReadinessTransition(ReadinessPosture.PARTIAL, ReadinessPosture.BLOCKED,
  { hasReviewRequired: false, criticalLanesChecked: true, hasAdverseSignal: true }),
  'B_OK: BLOCKED with adverse signal passes');

// ── Seam C: Canonical Path ──────────────────────────────────────

console.log('\n── Seam C: Canonical Path ──');

assertThrows(() => guardCanonicalPath('legacy-passport-endpoint'), 'C1: non-canonical path', 'C');

assertNoThrow(() => guardCanonicalPath('omega'), 'C_OK: omega passes');
assertNoThrow(() => guardCanonicalPath('source-adapters'), 'C_OK: source-adapters passes');
assertNoThrow(() => guardCanonicalPath('manifest-engine'), 'C_OK: manifest-engine passes');

// ── Seam D: Audit Transaction ───────────────────────────────────

console.log('\n── Seam D: Audit Transaction ──');

assertThrows(() => guardAuditTransaction('approve_candidate', { success: false, eventId: null }),
  'D1: no audit for state change', 'D');

assertThrows(() => guardAuditTransaction('reject_candidate', { success: true, eventId: null }),
  'D2: audit eventId missing', 'D');

assertNoThrow(() => guardAuditTransaction('view_readonly', { success: false, eventId: null }),
  'D_OK: readonly skips audit requirement');

assertNoThrow(() => guardAuditTransaction('approve_candidate', { success: true, eventId: 'evt_123' }),
  'D_OK: valid audit write passes');

// ── Seam E: UI Truth Mapping ────────────────────────────────────

console.log('\n── Seam E: UI Truth Mapping ──');

assertThrows(() => guardUiTruthMapping({ posture: 'decision_grade', backendPosture: 'partial', scoreVisible: false, minimumEvidenceMet: false }),
  'E1: UI/backend posture mismatch', 'E');

assertThrows(() => guardUiTruthMapping({ posture: 'partial', backendPosture: 'partial', scoreVisible: true, minimumEvidenceMet: false }),
  'E2: score visible before minimum evidence', 'E');

assertNoThrow(() => guardUiTruthMapping({ posture: 'partial', backendPosture: 'partial', scoreVisible: false, minimumEvidenceMet: false }),
  'E_OK: matching partial passes');

// ── Seam F: Copy Validation ─────────────────────────────────────

console.log('\n── Seam F: Copy Validation ──');

assertThrows(() => guardCopyValidation({ manifestId: 'm1', claimCount: 5, receiptCount: 0, hasBlockedLanes: false, blockedSignalsCount: 0 }),
  'F1: claims without receipts', 'F');

assertThrows(() => guardCopyValidation({ manifestId: 'm2', claimCount: 0, receiptCount: 0, hasBlockedLanes: true, blockedSignalsCount: 0 }),
  'F2: BLOCKED without signals', 'F');

assertNoThrow(() => guardCopyValidation({ manifestId: 'm3', claimCount: 5, receiptCount: 5, hasBlockedLanes: false, blockedSignalsCount: 0 }),
  'F_OK: valid copy passes');

assertNoThrow(() => guardCopyValidation({ manifestId: 'm4', claimCount: 3, receiptCount: 3, hasBlockedLanes: true, blockedSignalsCount: 2 }),
  'F_OK: blocked with signals passes');

// ── Seam G: Temporal Validation ─────────────────────────────────

console.log('\n── Seam G: Temporal Validation ──');

const now = Date.now();

assertThrows(() => guardTemporalValidation([{
  laneId: 'oig', checkedAt: new Date(now - 31 * 24 * 60 * 60 * 1000).toISOString(),
  ttlMs: 30 * 24 * 60 * 60 * 1000, status: SourceStatus.CHECKED,
}]), 'G1: stale treated as fresh', 'G');

assertThrows(() => guardTemporalValidation([{
  laneId: 'nppes', checkedAt: new Date(now - 60 * 1000).toISOString(),
  ttlMs: 24 * 60 * 60 * 1000, status: SourceStatus.UNAVAILABLE,
}]), 'G2: premature retry', 'G');

assertNoThrow(() => guardTemporalValidation([{
  laneId: 'oig', checkedAt: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(),
  ttlMs: 30 * 24 * 60 * 60 * 1000, status: SourceStatus.CHECKED,
}]), 'G_OK: fresh CHECKED passes');

assertNoThrow(() => guardTemporalValidation([{
  laneId: 'nppes', checkedAt: new Date(now - 10 * 60 * 1000).toISOString(),
  ttlMs: 24 * 60 * 60 * 1000, status: SourceStatus.UNAVAILABLE,
}]), 'G_OK: UNAVAILABLE after cooldown passes');

// ── Universal enforce() Gate ────────────────────────────────────

console.log('\n── Universal enforce() Gate ──');

const result1 = enforce([
  () => guardCanonicalPath('omega'),
  () => guardAdapterResult({ sourceId: 'test', status: SourceStatus.PENDING, raw: null }),
]);
assert(result1.passed === true && result1.violations.length === 0, 'enforce: all guards pass');

try {
  enforce([
    () => guardReadinessTransition(ReadinessPosture.PARTIAL, ReadinessPosture.BLOCKED,
      { hasReviewRequired: false, criticalLanesChecked: true, hasAdverseSignal: false }),
    () => guardAdapterResult({ sourceId: 'test', status: SourceStatus.PENDING, raw: null }),
  ]);
  failed++;
  console.error('  FAIL: enforce should throw on critical');
} catch (err) {
  assert(err instanceof EnforcementViolation, 'enforce: throws EnforcementViolation on CRITICAL');
}

// ── Summary ──────────────────────────────────────────────────────

console.log(`\n══════════════════════════════════`);
console.log(`  Truth Enforcement Tests: ${passed} passed, ${failed} failed`);
console.log(`══════════════════════════════════\n`);

if (failed > 0) process.exit(1);
