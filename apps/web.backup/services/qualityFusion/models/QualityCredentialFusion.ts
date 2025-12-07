import { PrismaClient } from '@prisma/client';
import {
  ComplianceFinding,
  ComplianceFindingInput,
  FusionEngineResult,
  FusionRuleMatch,
  FusionSignal,
  FusionSignalInput,
} from '../types';

type PrismaWithQualityFusion = PrismaClient & {
  qualityCredentialFusion: {
    upsert: (...args: any[]) => Promise<any>;
    findUnique: (...args: any[]) => Promise<any>;
    findMany: (...args: any[]) => Promise<any>;
  };
};

const prisma = new PrismaClient() as PrismaWithQualityFusion;

export interface QualityCredentialFusionRecord {
  clinicianId: string;
  compositeScore: number;
  contributingQualitySignals: FusionSignal[];
  contributingCredentialSignals: FusionSignal[];
  complianceFindings: ComplianceFinding[];
  recommendedActions: string[];
  ruleMatches: FusionRuleMatch[];
  lastCalculatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertQualityCredentialFusionInput {
  clinicianId: string;
  compositeScore: number;
  qualitySignals: FusionSignalInput[];
  credentialSignals: FusionSignalInput[];
  complianceFindings?: ComplianceFindingInput[];
  recommendedActions?: string[];
  ruleMatches?: FusionRuleMatch[];
  lastCalculatedAt?: Date;
}

type SerializedSignal = FusionSignal;
type SerializedComplianceFinding = ComplianceFinding;

function clampScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  if (score < 0) return 0;
  if (score > 100) return 100;
  return Math.round(score);
}

function isoDate(value?: Date | string | null): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function dedupeActions(actions: string[]): string[] {
  return Array.from(
    new Set(
      actions
        .map((action) => action?.trim())
        .filter((action) => Boolean(action && action.length > 0)) as string[]
    )
  );
}

function normalizeSignal(
  signal: FusionSignalInput,
  fallbackPrefix: string
): SerializedSignal {
  const severity = signal.severity ?? 'LOW';
  const label = signal.label ?? signal.type;
  const occurredAt = isoDate(signal.occurredAt);

  return {
    id: signal.id ?? `${fallbackPrefix}:${signal.type}:${occurredAt ?? 'latest'}`,
    label,
    type: signal.type,
    severity,
    source: signal.source ?? 'QUALITY',
    weight: signal.weight ?? inferDefaultWeight(severity),
    description: signal.description,
    occurredAt,
    metadata: signal.metadata ?? null,
    recommendedActions: signal.recommendedActions
      ? dedupeActions(signal.recommendedActions)
      : undefined,
  };
}

function normalizeSignals(
  signals: FusionSignalInput[],
  fallbackPrefix: string
): SerializedSignal[] {
  return signals.map((signal, index) =>
    normalizeSignal(
      {
        id: signal.id ?? `${fallbackPrefix}_${index}`,
        ...signal,
      },
      fallbackPrefix
    )
  );
}

function normalizeComplianceFindings(
  findings: ComplianceFindingInput[]
): SerializedComplianceFinding[] {
  return findings.map((finding, index) => {
    const severity = finding.severity ?? 'MODERATE';
    return {
      id: finding.id ?? `compliance_${index}`,
      label: finding.label,
      severity,
      framework: finding.framework,
      description: finding.description,
      occurredAt: isoDate(finding.occurredAt),
    };
  });
}

function inferDefaultWeight(severity: string): number {
  switch (severity) {
    case 'CRITICAL':
      return 28;
    case 'HIGH':
      return 20;
    case 'MODERATE':
      return 12;
    default:
      return 6;
  }
}

function serializeUpsertInput(input: UpsertQualityCredentialFusionInput) {
  const qualitySignals = normalizeSignals(input.qualitySignals ?? [], 'quality');
  const credentialSignals = normalizeSignals(
    input.credentialSignals ?? [],
    'credential'
  );
  const complianceFindings = normalizeComplianceFindings(
    input.complianceFindings ?? []
  );
  const recommendedActions = dedupeActions(input.recommendedActions ?? []);

  return {
    clinicianId: input.clinicianId,
    compositeScore: clampScore(input.compositeScore),
    contributingQualitySignals: qualitySignals,
    contributingCredentialSignals: credentialSignals,
    complianceFindings,
    recommendedActions,
    ruleMatches: (input.ruleMatches ?? []).map((match, index) => ({
      id: match.id ?? `rule_${index}`,
      label: match.label,
      severity: match.severity,
      impact: match.impact,
      matchedSignals: match.matchedSignals,
      description: match.description,
      recommendedActions: dedupeActions(match.recommendedActions),
    })),
    lastCalculatedAt: input.lastCalculatedAt ?? new Date(),
  };
}

function deserializeRecord(record: any): QualityCredentialFusionRecord {
  return {
    clinicianId: record.clinicianId,
    compositeScore: clampScore(record.compositeScore),
    contributingQualitySignals: (record.contributingQualitySignals ??
      []) as SerializedSignal[],
    contributingCredentialSignals: (record.contributingCredentialSignals ??
      []) as SerializedSignal[],
    complianceFindings: (record.complianceFindings ??
      []) as SerializedComplianceFinding[],
    recommendedActions: dedupeActions(record.recommendedActions ?? []),
    ruleMatches: (record.ruleMatches ?? []) as FusionRuleMatch[],
    lastCalculatedAt: new Date(record.lastCalculatedAt ?? record.updatedAt),
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  };
}

export async function upsertQualityCredentialFusion(
  input: UpsertQualityCredentialFusionInput,
  client: PrismaWithQualityFusion = prisma
): Promise<QualityCredentialFusionRecord> {
  const payload = serializeUpsertInput(input);
  const record = await client.qualityCredentialFusion.upsert({
    where: { clinicianId: payload.clinicianId },
    create: payload,
    update: {
      compositeScore: payload.compositeScore,
      contributingQualitySignals: payload.contributingQualitySignals,
      contributingCredentialSignals: payload.contributingCredentialSignals,
      complianceFindings: payload.complianceFindings,
      recommendedActions: payload.recommendedActions,
      ruleMatches: payload.ruleMatches,
      lastCalculatedAt: payload.lastCalculatedAt,
      updatedAt: new Date(),
    },
  });
  return deserializeRecord(record);
}

export async function getQualityCredentialFusion(
  clinicianId: string,
  client: PrismaWithQualityFusion = prisma
): Promise<QualityCredentialFusionRecord | null> {
  if (!clinicianId) return null;
  const record = await client.qualityCredentialFusion.findUnique({
    where: { clinicianId },
  });
  return record ? deserializeRecord(record) : null;
}

export async function listQualityCredentialFusions(
  limit = 50,
  client: PrismaWithQualityFusion = prisma
): Promise<QualityCredentialFusionRecord[]> {
  const records = await client.qualityCredentialFusion.findMany({
    orderBy: { updatedAt: 'desc' },
    take: Math.min(500, Math.max(1, limit)),
  });
  return records.map(deserializeRecord);
}

export function projectFusionResult(
  result: FusionEngineResult
): UpsertQualityCredentialFusionInput {
  return {
    clinicianId: result.clinicianId,
    compositeScore: result.compositeScore,
    qualitySignals: result.contributingQualitySignals,
    credentialSignals: result.contributingCredentialSignals,
    complianceFindings: result.complianceFindings,
    recommendedActions: result.recommendedActions,
    ruleMatches: result.ruleMatches,
    lastCalculatedAt: result.timestamp,
  };
}

export const __testUtils = {
  clampScore,
  dedupeActions,
  normalizeSignals,
};


