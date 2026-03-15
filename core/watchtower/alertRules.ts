import {
  computeWatchtowerHash,
  type WatchtowerAlert,
  type WatchtowerAlertSeverity,
  type WatchtowerClaimDelta,
  type WatchtowerDeltaKind,
  type WatchtowerSubscription,
} from './eventStore';

export interface WatchtowerAlertRuleConfig {
  severityByDeltaKind?: Partial<Record<WatchtowerDeltaKind, WatchtowerAlertSeverity>>;
  severityByClaimType?: Record<string, WatchtowerAlertSeverity>;
  criticalClaimTypes?: readonly string[];
  suppressDeltaKinds?: readonly WatchtowerDeltaKind[];
}

export interface WatchtowerAlertContext {
  checkedAt: string;
  subscription?: WatchtowerSubscription;
  config?: WatchtowerAlertRuleConfig;
}

export interface WatchtowerAlertRule {
  id: string;
  applies(delta: WatchtowerClaimDelta, context: WatchtowerAlertContext): boolean;
  create(delta: WatchtowerClaimDelta, context: WatchtowerAlertContext): WatchtowerAlert;
}

const DEFAULT_SEVERITY_BY_DELTA: Record<WatchtowerDeltaKind, WatchtowerAlertSeverity> = {
  CLAIM_ADDED: 'LOW',
  CLAIM_CHANGED: 'MEDIUM',
  CLAIM_REMOVED: 'HIGH',
  CLAIM_STATUS_CHANGED: 'HIGH',
  CLAIM_EXPIRED: 'HIGH',
};

function normalizeString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim().toUpperCase() : null;
}

function currentValueContainsCriticalState(value: unknown): boolean {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const entries = Object.values(value as Record<string, unknown>);
  return entries.some((entry) => {
    const normalized = normalizeString(entry);
    return normalized === 'REVOKED' || normalized === 'SUSPENDED' || normalized === 'EXCLUDED';
  });
}

function resolveSeverity(
  delta: WatchtowerClaimDelta,
  context: WatchtowerAlertContext,
): WatchtowerAlertSeverity {
  const criticalClaimTypes = new Set(context.config?.criticalClaimTypes ?? ['EXCLUSION_STATUS', 'SANCTION', 'LICENSE']);
  if (criticalClaimTypes.has(delta.claimType) && (delta.kind === 'CLAIM_STATUS_CHANGED' || delta.kind === 'CLAIM_EXPIRED')) {
    return 'CRITICAL';
  }

  if (normalizeString(delta.currentStatus) === 'REVOKED' || normalizeString(delta.currentStatus) === 'SUSPENDED') {
    return 'CRITICAL';
  }

  if (currentValueContainsCriticalState(delta.currentValue)) {
    return 'CRITICAL';
  }

  return context.config?.severityByClaimType?.[delta.claimType]
    ?? context.config?.severityByDeltaKind?.[delta.kind]
    ?? DEFAULT_SEVERITY_BY_DELTA[delta.kind];
}

function buildAlertCopy(delta: WatchtowerClaimDelta): Pick<WatchtowerAlert, 'title' | 'description' | 'recommendedAction'> {
  switch (delta.kind) {
    case 'CLAIM_ADDED':
      return {
        title: `${delta.claimType} claim added`,
        description: `${delta.claimType} was newly observed during verification.`,
        recommendedAction: 'Review the new claim and confirm its trust impact.',
      };
    case 'CLAIM_CHANGED':
      return {
        title: `${delta.claimType} claim changed`,
        description: `${delta.claimType} changed between verification checks.`,
        recommendedAction: 'Inspect the changed value and re-evaluate downstream trust decisions.',
      };
    case 'CLAIM_REMOVED':
      return {
        title: `${delta.claimType} claim removed`,
        description: `${delta.claimType} is no longer present in the latest verification snapshot.`,
        recommendedAction: 'Investigate source availability and confirm whether the claim should still exist.',
      };
    case 'CLAIM_STATUS_CHANGED':
      return {
        title: `${delta.claimType} status changed`,
        description: `${delta.claimType} status moved from ${delta.previousStatus ?? 'UNKNOWN'} to ${delta.currentStatus ?? 'UNKNOWN'}.`,
        recommendedAction: 'Escalate the status change to dependent systems and operators.',
      };
    case 'CLAIM_EXPIRED':
      return {
        title: `${delta.claimType} expired`,
        description: `${delta.claimType} is no longer valid as of the latest verification check.`,
        recommendedAction: 'Trigger renewal or suspend reliance on the expired claim.',
      };
  }
}

function createAlert(delta: WatchtowerClaimDelta, context: WatchtowerAlertContext, ruleId: string): WatchtowerAlert {
  const copy = buildAlertCopy(delta);
  const severity = resolveSeverity(delta, context);
  const alertSeed = {
    subjectId: delta.subjectId,
    subscriptionId: context.subscription?.subscriptionId ?? null,
    ruleId,
    deltaId: delta.deltaId,
    severity,
  };

  return {
    alertId: `alert_${computeWatchtowerHash(alertSeed).slice(0, 24)}`,
    subjectId: delta.subjectId,
    subscriptionId: context.subscription?.subscriptionId ?? null,
    deltaId: delta.deltaId,
    deltaKind: delta.kind,
    claimId: delta.claimId,
    claimType: delta.claimType,
    sourceId: delta.sourceId ?? null,
    severity,
    title: copy.title,
    description: copy.description,
    recommendedAction: copy.recommendedAction,
    ruleId,
    observedAt: context.checkedAt,
    metadata: {
      previousStatus: delta.previousStatus ?? null,
      currentStatus: delta.currentStatus ?? null,
      previousValue: delta.previousValue ?? null,
      currentValue: delta.currentValue ?? null,
    },
  };
}

export function createDefaultAlertRules(): WatchtowerAlertRule[] {
  return [
    'CLAIM_ADDED',
    'CLAIM_CHANGED',
    'CLAIM_REMOVED',
    'CLAIM_STATUS_CHANGED',
    'CLAIM_EXPIRED',
  ].map((kind) => ({
    id: `default:${kind.toLowerCase()}`,
    applies(delta: WatchtowerClaimDelta, context: WatchtowerAlertContext): boolean {
      return delta.kind === kind && !(context.config?.suppressDeltaKinds ?? []).includes(delta.kind);
    },
    create(delta: WatchtowerClaimDelta, context: WatchtowerAlertContext): WatchtowerAlert {
      return createAlert(delta, context, `default:${kind.toLowerCase()}`);
    },
  }));
}

export function evaluateAlertRules(
  deltas: readonly WatchtowerClaimDelta[],
  context: WatchtowerAlertContext,
  rules: readonly WatchtowerAlertRule[] = createDefaultAlertRules(),
): WatchtowerAlert[] {
  const alerts: WatchtowerAlert[] = [];

  for (const delta of deltas) {
    for (const rule of rules) {
      if (!rule.applies(delta, context)) {
        continue;
      }

      alerts.push(rule.create(delta, context));
      break;
    }
  }

  return alerts;
}
