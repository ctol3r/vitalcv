import type {
  PrivilegeSafetySignal,
  PrivilegeSafetySignalType,
  SafetySignalSeverity,
} from '../models/PrivilegeSafetySignal.js';

export type SafetyAction = 'ALERT' | 'RESTRICT' | 'SUSPEND';

export interface SafetyThresholdRule {
  id: string;
  signalType?: PrivilegeSafetySignalType | 'ANY';
  severity?: SafetySignalSeverity | 'ANY';
  occurrences: number;
  windowHours: number;
  action: SafetyAction;
  description?: string;
}

export interface ThresholdDecision {
  rule: SafetyThresholdRule;
  signals: PrivilegeSafetySignal[];
  action: SafetyAction;
}

const HOURS = {
  DAY: 24,
  WEEK: 24 * 7,
};

export const DEFAULT_SAFETY_THRESHOLD_RULES: SafetyThresholdRule[] = [
  {
    id: 'critical-one-shot',
    signalType: 'ANY',
    severity: 'CRITICAL',
    occurrences: 1,
    windowHours: HOURS.DAY,
    action: 'SUSPEND',
    description: 'Any critical safety signal triggers immediate suspension review',
  },
  {
    id: 'high-repeat',
    signalType: 'ANY',
    severity: 'HIGH',
    occurrences: 2,
    windowHours: HOURS.WEEK,
    action: 'RESTRICT',
    description: 'Two high severity signals in seven days require restriction',
  },
  {
    id: 'oppe-low-trend',
    signalType: 'OPPE_LOW',
    severity: 'MED',
    occurrences: 3,
    windowHours: HOURS.WEEK,
    action: 'ALERT',
    description: 'Repeated OPPE low signals should alert quality reviewers',
  },
  {
    id: 'fppe-failure',
    signalType: 'FPPE_FAILURE',
    severity: 'ANY',
    occurrences: 1,
    windowHours: HOURS.WEEK,
    action: 'RESTRICT',
    description: 'Any FPPE failure moves privilege to restricted state',
  },
];

export class SafetyThresholdRegistry {
  private readonly rules: SafetyThresholdRule[];

  constructor(rules: SafetyThresholdRule[] = DEFAULT_SAFETY_THRESHOLD_RULES) {
    this.rules = [...rules];
  }

  listRules(): SafetyThresholdRule[] {
    return [...this.rules];
  }

  registerRule(rule: SafetyThresholdRule): void {
    this.rules.push(rule);
  }

  getMaxWindowHours(): number {
    return this.rules.reduce((max, rule) => Math.max(max, rule.windowHours), 0);
  }

  evaluate(signals: PrivilegeSafetySignal[], now: Date = new Date()): ThresholdDecision[] {
    if (signals.length === 0) {
      return [];
    }

    const sortedSignals = [...signals].sort(
      (a, b) => a.detectedAt.getTime() - b.detectedAt.getTime()
    );

    return this.rules.reduce<ThresholdDecision[]>((decisions, rule) => {
      const windowStart = new Date(now.getTime() - rule.windowHours * 60 * 60 * 1000);
      const matched = sortedSignals.filter((signal) => {
        if (signal.detectedAt < windowStart) {
          return false;
        }
        const signalTypeMatch =
          !rule.signalType ||
          rule.signalType === 'ANY' ||
          signal.signalType === rule.signalType;
        const severityMatch =
          !rule.severity || rule.severity === 'ANY' || signal.severity === rule.severity;
        return signalTypeMatch && severityMatch;
      });

      if (matched.length >= rule.occurrences) {
        decisions.push({
          rule,
          action: rule.action,
          signals: matched.slice(-rule.occurrences),
        });
      }

      return decisions;
    }, []);
  }
}

