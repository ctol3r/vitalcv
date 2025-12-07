import { CredentialRiskFactors } from '../credentialRisk/enums';
import {
  ComplianceFinding,
  ComplianceFindingInput,
  FusionEngineInput,
  FusionEngineResult,
  FusionSignal,
  FusionSignalInput,
  FusionSeverity,
  QualitySignalType,
  CredentialSignalType,
} from './types';
import { evaluateFusionRules } from './rules/fusionRules';

const SEVERITY_WEIGHTS: Record<FusionSeverity, number> = {
  LOW: 6,
  MODERATE: 12,
  HIGH: 20,
  CRITICAL: 28,
};

const QUALITY_CAP = 45;
const CREDENTIAL_CAP = 30;
const COMPLIANCE_CAP = 15;
const RULE_CAP = 20;
const BASELINE_CAP = 10;

const RISK_FACTOR_SIGNAL_MAP: Partial<
  Record<
    CredentialRiskFactors,
    {
      type: string;
      severity: FusionSeverity;
      label: string;
      description: string;
      recommendedActions?: string[];
    }
  >
> = {
  [CredentialRiskFactors.BOARD_EXPIRED]: {
    type: CredentialSignalType.BOARD_STATUS_DRIFT,
    severity: 'MODERATE',
    label: 'Board certification drift',
    description: 'Board credential is expired, inactive, or missing attestations.',
    recommendedActions: ['Request updated board certificate'],
  },
  [CredentialRiskFactors.LICENSE_EXPIRED]: {
    type: CredentialSignalType.LICENSE_DRIFT,
    severity: 'HIGH',
    label: 'License drift',
    description: 'One or more licenses are expired or inactive.',
    recommendedActions: ['Suspend impacted states until renewal is verified'],
  },
  [CredentialRiskFactors.OUT_OF_STATE_WITHOUT_COMPACT]: {
    type: CredentialSignalType.LICENSE_DRIFT,
    severity: 'MODERATE',
    label: 'Out-of-state coverage gap',
    description: 'Practicing outside home state without compact coverage.',
  },
  [CredentialRiskFactors.PECOS_REVOKED]: {
    type: CredentialSignalType.PECOS_CONFLICT,
    severity: 'HIGH',
    label: 'PECOS enrollment conflict',
    description: 'Recent PECOS rejection or deactivation detected.',
    recommendedActions: ['Escalate to enrollment to remediate PECOS record'],
  },
  [CredentialRiskFactors.SANCTION_FLAG]: {
    type: CredentialSignalType.SANCTION_ACTIVITY,
    severity: 'HIGH',
    label: 'Sanction activity',
    description: 'OIG/LEIE sanction or disciplinary action detected.',
    recommendedActions: ['Open compliance case for sanction review'],
  },
  [CredentialRiskFactors.MULTIPLE_DISCIPLINARY_ACTIONS]: {
    type: CredentialSignalType.SANCTION_ACTIVITY,
    severity: 'CRITICAL',
    label: 'Multiple disciplinary actions',
    description: 'Stacked NPDB, sanction, or board actions detected.',
  },
  [CredentialRiskFactors.FAILED_FPPE]: {
    type: CredentialSignalType.PRIVILEGE_GAP,
    severity: 'HIGH',
    label: 'FPPE failure',
    description: 'FPPE program reports failed or overdue completion.',
  },
  [CredentialRiskFactors.LOW_OPPE]: {
    type: QualitySignalType.OPPE_FAILURE,
    severity: 'MODERATE',
    label: 'OPPE monitoring alerts',
    description: 'OPPE monitoring indicates failed cases or holds.',
  },
};

const severityRank: Record<FusionSeverity, number> = {
  LOW: 1,
  MODERATE: 2,
  HIGH: 3,
  CRITICAL: 4,
};

function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  if (score < 0) return 0;
  if (score > 100) return 100;
  return Math.round(score);
}

function dedupe<T extends string>(values: T[]): T[] {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))
  );
}

function toFusionSignal(
  signal: FusionSignalInput,
  fallbackSource: FusionSignal['source']
): FusionSignal {
  const severity = signal.severity ?? 'LOW';
  return {
    id: signal.id ?? `${signal.type}_${Math.random().toString(36).slice(2, 8)}`,
    label: signal.label ?? signal.type,
    type: signal.type,
    severity,
    source: signal.source ?? fallbackSource,
    weight: signal.weight ?? SEVERITY_WEIGHTS[severity],
    description: signal.description,
    occurredAt: normalizeDate(signal.occurredAt),
    metadata: signal.metadata ?? null,
    recommendedActions: signal.recommendedActions
      ? dedupe(signal.recommendedActions)
      : undefined,
  };
}

function normalizeDate(input?: Date | string | null): string | undefined {
  if (!input) return undefined;
  if (input instanceof Date) return input.toISOString();
  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function normalizeSignals(
  signals: FusionSignalInput[] | undefined,
  fallbackSource: FusionSignal['source']
): FusionSignal[] {
  if (!signals?.length) return [];
  return signals.map((signal) => toFusionSignal(signal, fallbackSource));
}

function normalizeComplianceFindings(
  findings: ComplianceFindingInput[] | undefined
): ComplianceFinding[] {
  if (!findings?.length) return [];
  return findings.map((finding) => ({
    id: finding.id ?? `compliance_${finding.label}`,
    label: finding.label,
    severity: finding.severity ?? 'MODERATE',
    framework: finding.framework,
    description: finding.description,
    occurredAt: normalizeDate(finding.occurredAt),
  }));
}

function scoreSignals(signals: FusionSignal[], cap: number): number {
  if (!signals.length) return 0;
  const total = signals.reduce((sum, signal) => sum + (signal.weight ?? 0), 0);
  return Math.min(cap, Math.round(total));
}

function scoreCompliance(findings: ComplianceFinding[]): number {
  if (!findings.length) return 0;
  const total = findings.reduce((sum, finding) => {
    return sum + SEVERITY_WEIGHTS[finding.severity] * 0.5;
  }, 0);
  return Math.min(COMPLIANCE_CAP, Math.round(total));
}

function mapRiskFactorsToSignals(
  factors: string[] | undefined
): FusionSignal[] {
  if (!factors?.length) return [];
  return factors
    .map((factor) => RISK_FACTOR_SIGNAL_MAP[factor as CredentialRiskFactors])
    .filter(Boolean)
    .map((config, index) =>
      toFusionSignal(
        {
          id: `${config!.type}_${index}`,
          type: config!.type,
          label: config!.label,
          severity: config!.severity,
          description: config!.description,
          recommendedActions: config!.recommendedActions,
        },
        'CREDENTIAL'
      )
    );
}

function mergeSignals(
  provided: FusionSignal[],
  derived: FusionSignal[]
): FusionSignal[] {
  const byType = new Map<string, FusionSignal>();
  for (const signal of [...provided, ...derived]) {
    const existing = byType.get(signal.type);
    if (!existing) {
      byType.set(signal.type, signal);
      continue;
    }
    if (severityRank[signal.severity] > severityRank[existing.severity]) {
      byType.set(signal.type, signal);
    }
  }
  return Array.from(byType.values());
}

export function evaluateQualityCredentialFusion(
  input: FusionEngineInput
): FusionEngineResult {
  const timestamp = input.asOf ?? new Date();

  const qualitySignals = normalizeSignals(
    input.qualitySignals,
    'QUALITY'
  );
  const credentialSignals = mergeSignals(
    normalizeSignals(input.credentialSignals, 'CREDENTIAL'),
    mapRiskFactorsToSignals(input.credentialRiskFactors)
  );
  const complianceFindings = normalizeComplianceFindings(input.complianceFindings);

  const qualityScore = scoreSignals(qualitySignals, QUALITY_CAP);
  const credentialScore = scoreSignals(credentialSignals, CREDENTIAL_CAP);
  const complianceScore = scoreCompliance(complianceFindings);

  const ruleMatches = evaluateFusionRules({
    qualitySignals,
    credentialSignals,
    complianceFindings,
  });
  const ruleScore = Math.min(
    RULE_CAP,
    ruleMatches.reduce((sum, match) => sum + match.impact, 0)
  );

  const baselineContribution = Math.min(
    BASELINE_CAP,
    Math.max(0, Math.round((input.baselineRiskScore ?? 0) * 0.1))
  );

  const compositeScore = clampScore(
    qualityScore + credentialScore + complianceScore + ruleScore + baselineContribution
  );

  const recommendedActions = dedupe([
    ...qualitySignals.flatMap((signal) => signal.recommendedActions ?? []),
    ...credentialSignals.flatMap((signal) => signal.recommendedActions ?? []),
    ...ruleMatches.flatMap((match) => match.recommendedActions),
  ]);

  return {
    clinicianId: input.clinicianId,
    compositeScore,
    contributingQualitySignals: qualitySignals,
    contributingCredentialSignals: credentialSignals,
    complianceFindings,
    recommendedActions,
    ruleMatches,
    breakdown: {
      qualityScore,
      credentialScore,
      complianceScore,
      ruleScore,
      baselineContribution,
    },
    timestamp,
  };
}

export const __testUtils = {
  clampScore,
  dedupe,
  scoreSignals,
  scoreCompliance,
  mapRiskFactorsToSignals,
};


