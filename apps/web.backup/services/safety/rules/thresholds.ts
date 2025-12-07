import {
  compareSafetySeverity,
  type PrivilegeSafetyAction,
  type PrivilegeSafetySeverity,
  type PrivilegeSafetySignalSnapshot,
  type PrivilegeSafetySignalType,
} from '../models/PrivilegeSafetySignal.js';

export interface SafetyThresholdRule {
  resultingAction: PrivilegeSafetyAction;
  minSeverity: PrivilegeSafetySeverity;
  occurrences: number;
  windowHours?: number;
  signalTypes?: PrivilegeSafetySignalType[];
}

const ACTION_ORDER: PrivilegeSafetyAction[] = ['monitor', 'alert', 'restrict', 'suspend'];

export const SAFETY_THRESHOLD_REGISTRY: SafetyThresholdRule[] = [
  {
    resultingAction: 'suspend',
    minSeverity: 'CRITICAL',
    occurrences: 1,
    signalTypes: ['DEA_EXPIRED', 'NPDB_FLAG', 'BOARD_EXPIRED'],
  },
  {
    resultingAction: 'restrict',
    minSeverity: 'HIGH',
    occurrences: 2,
    windowHours: 24,
  },
  {
    resultingAction: 'alert',
    minSeverity: 'MED',
    occurrences: 2,
    windowHours: 72,
  },
  {
    resultingAction: 'alert',
    minSeverity: 'HIGH',
    occurrences: 1,
  },
];

export function evaluateSafetyAction(
  signals: PrivilegeSafetySignalSnapshot[],
  rules: SafetyThresholdRule[] = SAFETY_THRESHOLD_REGISTRY
): PrivilegeSafetyAction {
  if (signals.length === 0) {
    return 'monitor';
  }

  const sorted = [...signals].sort(
    (a, b) => b.detectedAt.getTime() - a.detectedAt.getTime()
  );
  const mostRecent = sorted[0]?.detectedAt ?? new Date();

  let highestAction: PrivilegeSafetyAction = 'monitor';
  for (const rule of rules) {
    if (ruleSatisfied(rule, sorted, mostRecent)) {
      if (ACTION_ORDER.indexOf(rule.resultingAction) > ACTION_ORDER.indexOf(highestAction)) {
        highestAction = rule.resultingAction;
      }
    }
  }

  return highestAction;
}

function ruleSatisfied(
  rule: SafetyThresholdRule,
  signals: PrivilegeSafetySignalSnapshot[],
  referenceTime: Date
): boolean {
  const windowMs = rule.windowHours ? rule.windowHours * 60 * 60 * 1000 : null;
  let matches = 0;

  for (const signal of signals) {
    if (compareSafetySeverity(signal.severity, rule.minSeverity) < 0) {
      continue;
    }

    if (rule.signalTypes && !rule.signalTypes.includes(signal.signalType)) {
      continue;
    }

    if (windowMs !== null) {
      const delta = Math.abs(referenceTime.getTime() - signal.detectedAt.getTime());
      if (delta > windowMs) {
        continue;
      }
    }

    matches += 1;
    if (matches >= rule.occurrences) {
      return true;
    }
  }

  return false;
}

