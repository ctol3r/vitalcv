// ── Monitoring Engine Tests ──────────────────────────────────────

import { SubscriptionStatus, AlertAction, createSubscription, evaluateDrift } from './monitoring-engine';
import { DriftType, DriftSeverity, type DriftEvent } from './drift-engine';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) { passed++; console.log(`✓ ${msg}`); }
  else { failed++; console.error(`✗ ${msg}`); }
}

const npi = '1487664858';
const empId = 'employer-1';

// ── 1. Create Subscription ───────────────────────────────────────

const { subscription, event } = createSubscription(npi, empId);

assert(subscription.subscriptionId.length === 36, 'Subscription ID is UUID');
assert(subscription.subjectNpi === npi, 'Subject NPI is correct');
assert(subscription.employerId === empId, 'Employer ID is correct');
assert(subscription.status === SubscriptionStatus.ACTIVE, 'Initial status is ACTIVE');
assert(event.metadata.subscriptionId === subscription.subscriptionId, 'Audit event tracks subscription ID');

// ── 2. Evaluate Drift: LOW Severity ──────────────────────────────

const lowDrift: DriftEvent = {
  driftId: 'd-1',
  subjectNpi: npi,
  source: 'NPPES',
  driftType: DriftType.FRESHNESS_EXPIRED,
  severity: DriftSeverity.LOW,
  fieldKey: 'freshness',
  previousValue: 'CHECKED',
  newValue: 'STALE',
  detectedAt: new Date().toISOString(),
};

const resultLow = evaluateDrift([subscription], [lowDrift]);
assert(resultLow.alerts.length === 1, 'Generates 1 alert for LOW drift');
assert(resultLow.alerts[0].action === AlertAction.LOG_ONLY, 'LOW severity maps to LOG_ONLY');

// ── 3. Evaluate Drift: MEDIUM Severity ───────────────────────────

const medDrift: DriftEvent = {
  ...lowDrift,
  driftId: 'd-2',
  driftType: DriftType.VALUE_CHANGED,
  severity: DriftSeverity.MEDIUM,
};

const resultMed = evaluateDrift([subscription], [lowDrift, medDrift]);
assert(resultMed.alerts[0].action === AlertAction.MARK_DEGRADED, 'MEDIUM severity maps to MARK_DEGRADED');

// ── 4. Evaluate Drift: HIGH Severity ─────────────────────────────

const highDrift: DriftEvent = {
  ...lowDrift,
  driftId: 'd-3',
  driftType: DriftType.NEW_ADVERSE_SIGNAL,
  severity: DriftSeverity.HIGH,
};

const resultHigh = evaluateDrift([subscription], [lowDrift, medDrift, highDrift]);
assert(resultHigh.alerts[0].action === AlertAction.TRIGGER_ALERT, 'HIGH severity maps to TRIGGER_ALERT');

// ── 5. Inactive Subscriptions Ignored ────────────────────────────

const pausedSub = { ...subscription, status: SubscriptionStatus.PAUSED };
const resultPaused = evaluateDrift([pausedSub], [highDrift]);
assert(resultPaused.alerts.length === 0, 'PAUSED subscriptions do not generate alerts');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) throw new Error('Monitoring engine tests failed');
