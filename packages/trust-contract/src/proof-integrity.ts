/**
 * Proof Integrity — wave-124
 *
 * Validates event chains, metrics, and proof pages.
 * Generates immutable snapshot hashes.
 * Flags anomalies without hiding them.
 *
 * RULE: fail loudly. No silent suppression of integrity failures.
 */

// Node crypto — available in server contexts
// eslint-disable-next-line @typescript-eslint/no-var-requires
const createHash: (alg: string) => { update(d: string): { digest(e: string): string } } =
  (typeof require !== 'undefined') ? require('crypto').createHash : () => ({ update: () => ({ digest: () => 'no-crypto' }) });

// ─── Event Chain ──────────────────────────────────────────────────

export type ISVEventType =
  | 'readiness.viewed'
  | 'passport.viewed'
  | 'review.opened'
  | 'action.taken'
  | 'state.updated';

export interface ChainEvent {
  eventType: ISVEventType;
  timestamp: number; // unix ms
  loopId: string;
  payload?: Record<string, unknown>;
}

const REQUIRED_EVENTS: ISVEventType[] = [
  'readiness.viewed',
  'action.taken',
];

const VALID_ORDER: ISVEventType[] = [
  'readiness.viewed',
  'passport.viewed',
  'review.opened',
  'action.taken',
  'state.updated',
];

// ─── Validation Results ───────────────────────────────────────────

export type IntegrityLevel = 'valid' | 'warning' | 'invalid';

export interface ChainValidationResult {
  valid: boolean;
  level: IntegrityLevel;
  failures: string[];
  warnings: string[];
}

export interface MetricValidationResult {
  valid: boolean;
  level: IntegrityLevel;
  metricName: string;
  value: number | null;
  computedFrom: string;
  failures: string[];
  warnings: string[];
}

// ─── Step 1: Event Chain Validator ────────────────────────────────

export function validateEventChain(events: ChainEvent[]): ChainValidationResult {
  const failures: string[] = [];
  const warnings: string[] = [];

  // Must have at least one event
  if (events.length === 0) {
    return {
      valid: false,
      level: 'invalid',
      failures: ['Event chain is empty'],
      warnings: [],
    };
  }

  // All events must have valid timestamps
  for (const ev of events) {
    if (!ev.timestamp || ev.timestamp <= 0) {
      failures.push(`Event "${ev.eventType}" has missing or invalid timestamp`);
    }
    if (!ev.loopId) {
      failures.push(`Event "${ev.eventType}" has no loopId`);
    }
  }

  // All events must share the same loopId
  const loopIds = new Set(events.map(e => e.loopId));
  if (loopIds.size > 1) {
    failures.push(`Events span multiple loopIds: ${[...loopIds].join(', ')}`);
  }

  // Required events must exist
  const seenTypes = new Set(events.map(e => e.eventType));
  for (const required of REQUIRED_EVENTS) {
    if (!seenTypes.has(required)) {
      failures.push(`Required event "${required}" is missing`);
    }
  }

  // No duplicate event types (each should appear at most once)
  const typeCounts = new Map<string, number>();
  for (const ev of events) {
    typeCounts.set(ev.eventType, (typeCounts.get(ev.eventType) ?? 0) + 1);
  }
  for (const [type, count] of typeCounts) {
    if (count > 1) {
      warnings.push(`Event "${type}" appears ${count} times — expected once`);
    }
  }

  // Chronological order
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
  const originalOrder = events.map(e => e.eventType);
  const sortedOrder = sorted.map(e => e.eventType);
  if (JSON.stringify(originalOrder) !== JSON.stringify(sortedOrder)) {
    failures.push(`Events are not in chronological order. Expected: ${sortedOrder.join(' → ')}`);
  }

  // Valid transition order (skip optional events)
  const presentInOrder = VALID_ORDER.filter(t => seenTypes.has(t));
  const actualOrder = sorted.filter(e => seenTypes.has(e.eventType)).map(e => e.eventType);
  const deduped = [...new Set(actualOrder)];
  if (JSON.stringify(deduped) !== JSON.stringify(presentInOrder)) {
    failures.push(
      `Event order violates valid transitions.\nExpected: ${presentInOrder.join(' → ')}\nActual: ${deduped.join(' → ')}`
    );
  }

  // Critical: readiness must precede action
  const readinessTs = events.find(e => e.eventType === 'readiness.viewed')?.timestamp;
  const actionTs    = events.find(e => e.eventType === 'action.taken')?.timestamp;
  if (readinessTs && actionTs && actionTs <= readinessTs) {
    failures.push(
      `Action timestamp (${actionTs}) must be AFTER readiness timestamp (${readinessTs}). This event chain is invalid.`
    );
  }

  // Anomaly: suspicious speed (< 5 seconds total = likely synthetic)
  if (readinessTs && actionTs) {
    const deltaMs = actionTs - readinessTs;
    if (deltaMs < 5000) {
      warnings.push(`Readiness → action delta is ${deltaMs}ms — suspiciously fast. May be synthetic data.`);
    }
    // Anomaly: extremely long (> 24 hours = stale loop)
    if (deltaMs > 86400000) {
      warnings.push(`Readiness → action delta is ${Math.round(deltaMs / 3600000)}h — loop may span multiple sessions.`);
    }
  }

  const valid = failures.length === 0;
  return {
    valid,
    level: failures.length > 0 ? 'invalid' : warnings.length > 0 ? 'warning' : 'valid',
    failures,
    warnings,
  };
}

// ─── Step 2: Metric Validator ─────────────────────────────────────

export interface MetricDefinition {
  name: string;
  definition: string;         // human-readable formula
  sourceEvents: [ISVEventType, ISVEventType]; // [start, end]
  unit: 'ms' | 's' | 'min';
}

export const METRICS: MetricDefinition[] = [
  {
    name: 'time_to_first_action',
    definition: 'action.taken.timestamp - readiness.viewed.timestamp',
    sourceEvents: ['readiness.viewed', 'action.taken'],
    unit: 'ms',
  },
  {
    name: 'readiness_to_passport',
    definition: 'passport.viewed.timestamp - readiness.viewed.timestamp',
    sourceEvents: ['readiness.viewed', 'passport.viewed'],
    unit: 'ms',
  },
  {
    name: 'passport_to_review',
    definition: 'review.opened.timestamp - passport.viewed.timestamp',
    sourceEvents: ['passport.viewed', 'review.opened'],
    unit: 'ms',
  },
  {
    name: 'review_to_action',
    definition: 'action.taken.timestamp - review.opened.timestamp',
    sourceEvents: ['review.opened', 'action.taken'],
    unit: 'ms',
  },
];

export function validateMetric(
  events: ChainEvent[],
  metric: MetricDefinition
): MetricValidationResult {
  const failures: string[] = [];
  const warnings: string[] = [];

  const [startType, endType] = metric.sourceEvents;
  const startEvent = events.find(e => e.eventType === startType);
  const endEvent   = events.find(e => e.eventType === endType);

  if (!startEvent) {
    failures.push(`Source event "${startType}" not found`);
  }
  if (!endEvent) {
    failures.push(`End event "${endType}" not found`);
  }

  if (failures.length > 0) {
    return {
      valid: false,
      level: 'invalid',
      metricName: metric.name,
      value: null,
      computedFrom: metric.definition,
      failures,
      warnings,
    };
  }

  const value = endEvent!.timestamp - startEvent!.timestamp;

  // Negative or zero delta is impossible
  if (value <= 0) {
    failures.push(`${metric.name} computed to ${value}ms — impossible (end before start)`);
  }

  // Validate timestamps are real unix ms (after 2020-01-01)
  const MIN_TS = 1577836800000;
  if (startEvent!.timestamp < MIN_TS) {
    failures.push(`Start event "${startType}" has pre-2020 timestamp — likely synthetic`);
  }
  if (endEvent!.timestamp < MIN_TS) {
    failures.push(`End event "${endType}" has pre-2020 timestamp — likely synthetic`);
  }

  return {
    valid: failures.length === 0,
    level: failures.length > 0 ? 'invalid' : warnings.length > 0 ? 'warning' : 'valid',
    metricName: metric.name,
    value: failures.length === 0 ? value : null,
    computedFrom: metric.definition,
    failures,
    warnings,
  };
}

export function validateAllMetrics(events: ChainEvent[]): MetricValidationResult[] {
  return METRICS.map(m => validateMetric(events, m));
}

// ─── Step 3: Proof Lock (Immutable Snapshot) ──────────────────────

export interface ProofSnapshot {
  pilotId: string;
  version: number;
  eventChainHash: string;
  metricValues: Record<string, number | null>;
  limitations: string[];
  generatedAt: number;
  validationStatus: IntegrityLevel;
  failures: string[];
  warnings: string[];
}

export function generateProofSnapshot(
  pilotId: string,
  events: ChainEvent[],
  limitations: string[],
  existingVersion = 0
): ProofSnapshot {
  const chainValidation = validateEventChain(events);
  const metricResults   = validateAllMetrics(events);

  const metricValues: Record<string, number | null> = {};
  for (const r of metricResults) {
    metricValues[r.metricName] = r.value;
  }

  // Hash of the canonical event chain (immutable reference)
  const canonicalChain = events
    .sort((a, b) => a.timestamp - b.timestamp)
    .map(e => `${e.eventType}:${e.timestamp}:${e.loopId}`)
    .join('|');
  const eventChainHash = createHash('sha256').update(canonicalChain).digest('hex').slice(0, 16);

  const allFailures = [
    ...chainValidation.failures,
    ...metricResults.flatMap(r => r.failures),
  ];
  const allWarnings = [
    ...chainValidation.warnings,
    ...metricResults.flatMap(r => r.warnings),
  ];

  const level: IntegrityLevel = allFailures.length > 0
    ? 'invalid'
    : allWarnings.length > 0
    ? 'warning'
    : 'valid';

  return {
    pilotId,
    version: existingVersion + 1,
    eventChainHash,
    metricValues,
    limitations,
    generatedAt: Date.now(),
    validationStatus: level,
    failures: allFailures,
    warnings: allWarnings,
  };
}

// ─── Step 4: Limitation Enforcer ─────────────────────────────────

export interface LimitationCheck {
  hasMeasuredSection: boolean;
  hasEstimatedSection: boolean;
  hasMissingSection: boolean;
  hasNotIntegratedSection: boolean;
  valid: boolean;
  missing: string[];
}

export function enforceLimitations(limitations: string[]): LimitationCheck {
  const text = limitations.join(' ').toLowerCase();

  const hasMeasured    = /measured|direct|real timestamp|live api/.test(text);
  const hasEstimated   = /estimated|estimate|self-reported|approx|~/.test(text);
  const hasMissing     = /missing|not yet|not integrated|access_required|pending/.test(text);
  const hasNotInt      = /not integrated|not wired|no .* integration/.test(text);

  const missing: string[] = [];
  if (!hasMeasured)  missing.push('what is measured directly');
  if (!hasEstimated) missing.push('what is estimated');
  if (!hasMissing)   missing.push('what is missing or pending');
  if (!hasNotInt)    missing.push('what is not integrated');

  return {
    hasMeasuredSection:     hasMeasured,
    hasEstimatedSection:    hasEstimated,
    hasMissingSection:      hasMissing,
    hasNotIntegratedSection: hasNotInt,
    valid: missing.length === 0,
    missing,
  };
}

// ─── Step 5: Metric Label (Measured vs Estimated) ─────────────────

export type MetricLabel = 'Measured' | 'Estimated' | 'Unverified';

export function labelMetric(
  metricName: string,
  validation: MetricValidationResult
): MetricLabel {
  if (!validation.valid || validation.value === null) return 'Unverified';

  // These are derived directly from event timestamps — Measured
  const directMetrics = new Set([
    'time_to_first_action',
    'readiness_to_passport',
    'passport_to_review',
    'review_to_action',
  ]);

  // Anything compared to a baseline is Estimated
  const estimatedMetrics = new Set([
    'days_saved',
    'baseline_comparison',
    'estimated_time_saved',
  ]);

  if (directMetrics.has(metricName)) return 'Measured';
  if (estimatedMetrics.has(metricName)) return 'Estimated';
  return 'Estimated'; // default safe
}

// ─── Step 6: Anomaly Detection ───────────────────────────────────

export interface AnomalyReport {
  hasAnomalies: boolean;
  anomalies: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
    suppress: false; // anomalies are NEVER suppressed — only surfaced
  }>;
}

export function detectAnomalies(
  events: ChainEvent[],
  metricResults: MetricValidationResult[]
): AnomalyReport {
  const anomalies: AnomalyReport['anomalies'] = [];

  // Incomplete chain
  const seenTypes = new Set(events.map(e => e.eventType));
  const missing = VALID_ORDER.filter(t => !seenTypes.has(t));
  if (missing.length > 0) {
    anomalies.push({
      type: 'incomplete_chain',
      severity: missing.includes('action.taken') ? 'high' : 'medium',
      description: `Event chain is incomplete. Missing: ${missing.join(', ')}`,
      suppress: false,
    });
  }

  // Outlier deltas
  for (const r of metricResults) {
    if (r.value === null) continue;
    // Sub-5s is suspicious
    if (r.value < 5000) {
      anomalies.push({
        type: 'outlier_delta_too_fast',
        severity: 'high',
        description: `${r.metricName} = ${r.value}ms (< 5s). May be synthetic or automated.`,
        suppress: false,
      });
    }
    // Over 4h for a single step is unusual
    if (r.value > 14400000) {
      anomalies.push({
        type: 'outlier_delta_too_slow',
        severity: 'low',
        description: `${r.metricName} = ${Math.round(r.value / 3600000)}h. Loop may span multiple sessions.`,
        suppress: false,
      });
    }
  }

  // Abnormal timeline: future timestamps
  const now = Date.now();
  for (const ev of events) {
    if (ev.timestamp > now + 60000) {
      anomalies.push({
        type: 'future_timestamp',
        severity: 'high',
        description: `Event "${ev.eventType}" has a future timestamp (${ev.timestamp}). Clock skew or synthetic data.`,
        suppress: false,
      });
    }
  }

  return {
    hasAnomalies: anomalies.length > 0,
    anomalies,
  };
}
