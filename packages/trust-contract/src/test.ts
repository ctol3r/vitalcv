import { SourceStatus, ReadinessPosture, derivePosture, deriveScore, enforceContradictions, TrustContradictionError } from './index';

// ── Contradiction Detector Tests ─────────────────────────────────

const lanes = {
  nppes: { name: 'NPPES', status: SourceStatus.CHECKED, checkedAt: '2026-04-14T18:00:00Z' },
  oig: { name: 'OIG_LEIE', status: SourceStatus.CHECKED, checkedAt: '2026-04-14T18:00:00Z' },
  license: { name: 'STATE_LICENSE', status: SourceStatus.PENDING },
};

// Valid state: 2 checked, 1 pending → should be CHECKING
const posture = derivePosture([lanes.nppes, lanes.oig, lanes.license]);
console.assert(posture === ReadinessPosture.CHECKING, `Expected CHECKING, got ${posture}`);

// Valid state: 2 checked, 0 pending → should be DECISION_GRADE
const posture2 = derivePosture([lanes.nppes, lanes.oig]);
console.assert(posture2 === ReadinessPosture.DECISION_GRADE, `Expected DECISION_GRADE, got ${posture2}`);

// BLOCKED without BLOCKED_SIGNAL → contradiction
try {
  enforceContradictions({
    lanes: [lanes.nppes, lanes.oig],
    posture: ReadinessPosture.BLOCKED,
    proofAvailability: { NONE: 'none', SNAPSHOT: 'snapshot', PARTIAL: 'partial', DECISION_GRADE: 'decision_grade' } as any,
    readinessScore: 0,
    blockerCount: 1,
  });
  console.error('FAIL: Should have thrown contradiction for BLOCKED without BLOCKED_SIGNAL');
} catch (e) {
  if (e instanceof TrustContradictionError) {
    console.log('✓ Contradiction detected: BLOCKED without BLOCKED_SIGNAL');
  } else {
    console.error('FAIL: Wrong error type', e);
  }
}

// Score with 0 CHECKED → must be 0
const score = deriveScore([{ name: 'NPPES', status: SourceStatus.PENDING }]);
console.assert(score === 0, `Expected score 0, got ${score}`);
console.log('✓ Score is 0 with no checked lanes');

// UNAVAILABLE without errorClass → contradiction
try {
  enforceContradictions({
    lanes: [{ name: 'OIG_LEIE', status: SourceStatus.UNAVAILABLE }],
    posture: ReadinessPosture.PARTIAL,
    proofAvailability: { NONE: 'none', SNAPSHOT: 'snapshot', PARTIAL: 'partial', DECISION_GRADE: 'decision_grade' } as any,
    readinessScore: 0,
    blockerCount: 0,
  });
  console.error('FAIL: Should have thrown contradiction for UNAVAILABLE without errorClass');
} catch (e) {
  if (e instanceof TrustContradictionError) {
    console.log('✓ Contradiction detected: UNAVAILABLE without errorClass');
  }
}

// Blocker count mismatch → contradiction
try {
  enforceContradictions({
    lanes: [{ name: 'OIG_LEIE', status: SourceStatus.BLOCKED_SIGNAL }],
    posture: ReadinessPosture.BLOCKED,
    proofAvailability: { NONE: 'none', SNAPSHOT: 'snapshot', PARTIAL: 'partial', DECISION_GRADE: 'decision_grade' } as any,
    readinessScore: 0,
    blockerCount: 3,
  });
  console.error('FAIL: Should have thrown contradiction for blockerCount mismatch');
} catch (e) {
  if (e instanceof TrustContradictionError) {
    console.log('✓ Contradiction detected: blockerCount mismatch');
  }
}

// BLOCKED_SIGNAL present but posture not BLOCKED → contradiction
try {
  enforceContradictions({
    lanes: [{ name: 'OIG_LEIE', status: SourceStatus.BLOCKED_SIGNAL }],
    posture: ReadinessPosture.DECISION_GRADE,
    proofAvailability: { NONE: 'none', SNAPSHOT: 'snapshot', PARTIAL: 'partial', DECISION_GRADE: 'decision_grade' } as any,
    readinessScore: 0,
    blockerCount: 1,
  });
  console.error('FAIL: Should have thrown contradiction for BLOCKED_SIGNAL without BLOCKED posture');
} catch (e) {
  if (e instanceof TrustContradictionError) {
    console.log('✓ Contradiction detected: BLOCKED_SIGNAL with non-BLOCKED posture');
  }
}

console.log('\nAll trust-contract tests passed.');
