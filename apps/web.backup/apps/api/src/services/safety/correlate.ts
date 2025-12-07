import { PrismaClient, type PrivilegeSafetySignal, type SafetySignal } from '@prisma/client';
import {
  SAFETY_SIGNAL_SEVERITIES,
  SAFETY_SIGNAL_TYPES,
  type CommendationEligibility,
  type SafetySignalRecord,
  type SafetySignalRiskImpact,
  type SafetySignalSeverity,
  type SafetySignalType,
  calculateRiskImpact,
  evaluateCommendationEligibility,
  hashWithSalt,
} from './ingest';
import { anchorSafetyCorrelationSummary } from '../audit/anchor';

const prisma = new PrismaClient();
const DEFAULT_WINDOW_DAYS = 180;
const AUDIT_SALT = process.env.SAFETY_AUDIT_SALT ?? 'vital-safety';

export interface SafetyAnomaly {
  type: 'department_spike' | 'role_repeat' | 'privilege_cluster';
  severity: 'low' | 'medium' | 'high';
  summary: string;
  detectedAt: string;
  context: Record<string, unknown>;
}

export interface PrivilegeCorrelationEntry {
  signalId: string;
  type: SafetySignalType;
  severity: SafetySignalSeverity;
  reportedAt: string;
  privilegeCodes: string[];
  privilegeSignal?: {
    id: string;
    signalType: string;
    severity: string;
    detectedAt: string;
    overlap: number;
  };
}

export interface SafetyAuditExport {
  clinicianHash: string;
  window: { start: string; end: string; days: number };
  events: Array<{ eventHash: string; type: string; severity: string; reportedAt: string }>;
}

export interface SafetyCorrelationSummary {
  clinicianId: string;
  generatedAt: string;
  signalStats: {
    total: number;
    byType: Record<SafetySignalType, number>;
    bySeverity: Record<SafetySignalSeverity, number>;
    commendations: number;
  };
  privilegeCorrelation: PrivilegeCorrelationEntry[];
  riskImpact: {
    privilegingScore: number;
    matchingScore: number;
    contributions: SafetySignalRiskImpact[];
    narrative: string[];
  };
  commendation: CommendationEligibility;
  anomalies: SafetyAnomaly[];
  auditExport: SafetyAuditExport;
  anchor: ReturnType<typeof anchorSafetyCorrelationSummary> | null;
}

export class SafetyCorrelationEngine {
  private readonly prisma: PrismaClient;

  constructor(prismaClient: PrismaClient = prisma) {
    this.prisma = prismaClient;
  }

  async summarize(options: { clinicianId: string; windowDays?: number }): Promise<SafetyCorrelationSummary> {
    const windowDays = options.windowDays ?? DEFAULT_WINDOW_DAYS;
    const windowStart = daysAgo(windowDays);

    const [safetySignals, privilegeSignals] = await Promise.all([
      this.prisma.safetySignal.findMany({
        where: { clinicianId: options.clinicianId, reportedAt: { gte: windowStart } },
        orderBy: { reportedAt: 'desc' },
        take: 120,
      }),
      this.prisma.privilegeSafetySignal.findMany({
        where: { clinicianId: options.clinicianId, detectedAt: { gte: windowStart } },
        orderBy: { detectedAt: 'desc' },
        take: 120,
      }),
    ]);

    const normalizedSignals = safetySignals.map(normalizeSafetySignal);
    const stats = summarizeSignals(normalizedSignals);
    const privilegeCorrelation = correlatePrivileges(normalizedSignals, privilegeSignals);
    const riskImpact = aggregateRiskImpact(normalizedSignals);
    const commendation = await evaluateCommendationEligibility(options.clinicianId, this.prisma);
    const anomalies = detectSafetySignalAnomalies(normalizedSignals, privilegeSignals);
    const auditExport = buildAuditSafeExport(options.clinicianId, normalizedSignals, {
      windowDays,
    });

    const anchor =
      stats.total === 0
        ? null
        : anchorSafetyCorrelationSummary({
            clinicianId: options.clinicianId,
            generatedAt: new Date().toISOString(),
            signalCount: stats.total,
            privilegingScore: riskImpact.privilegingScore,
            matchingScore: riskImpact.matchingScore,
            windowDays,
            anomalies: anomalies.map((anomaly) => anomaly.type),
          });

    return {
      clinicianId: options.clinicianId,
      generatedAt: new Date().toISOString(),
      signalStats: stats,
      privilegeCorrelation,
      riskImpact,
      commendation,
      anomalies,
      auditExport,
      anchor,
    };
  }

  async buildAuditExport(
    clinicianId: string,
    options: { windowDays?: number } = {},
  ): Promise<SafetyAuditExport> {
    const summary = await this.summarize({
      clinicianId,
      windowDays: options.windowDays ?? DEFAULT_WINDOW_DAYS,
    });
    return summary.auditExport;
  }
}

function normalizeSafetySignal(signal: SafetySignal): SafetySignalRecord {
  return {
    ...signal,
    metadata: (signal.metadata as Record<string, unknown>) ?? {},
  };
}

function summarizeSignals(signals: SafetySignalRecord[]) {
  const byType = SAFETY_SIGNAL_TYPES.reduce(
    (acc, type) => ({ ...acc, [type]: 0 }),
    {} as Record<SafetySignalType, number>,
  );
  const bySeverity = SAFETY_SIGNAL_SEVERITIES.reduce(
    (acc, severity) => ({ ...acc, [severity]: 0 }),
    {} as Record<SafetySignalSeverity, number>,
  );

  signals.forEach((signal) => {
    const type = toSafetySignalType(signal.type);
    const severity = toSafetySignalSeverity(signal.severity);
    if (type) byType[type] += 1;
    if (severity) bySeverity[severity] += 1;
  });

  return {
    total: signals.length,
    byType,
    bySeverity,
    commendations: byType['commendation'],
  };
}

function correlatePrivileges(
  safetySignals: SafetySignalRecord[],
  privilegeSignals: PrivilegeSafetySignal[],
): PrivilegeCorrelationEntry[] {
  return safetySignals.slice(0, 40).map((signal) => {
    const privilegeMatch = privilegeSignals.find((priv) => {
      const deltaMs = Math.abs(
        new Date(signal.reportedAt).getTime() - new Date(priv.detectedAt).getTime(),
      );
      return deltaMs <= 1000 * 60 * 60 * 24 * 21;
    });

    const overlap = privilegeMatch ? overlapScore(signal, privilegeMatch) : 0;

    return {
      signalId: signal.id,
      type: toSafetySignalType(signal.type) ?? 'near-miss',
      severity: toSafetySignalSeverity(signal.severity) ?? 'low',
      reportedAt: new Date(signal.reportedAt).toISOString(),
      privilegeCodes: Array.isArray(signal.metadata.privilegeCodes)
        ? (signal.metadata.privilegeCodes as string[]).slice(0, 5)
        : [],
      privilegeSignal: privilegeMatch
        ? {
            id: privilegeMatch.id,
            signalType: privilegeMatch.signalType,
            severity: privilegeMatch.severity,
            detectedAt: privilegeMatch.detectedAt.toISOString(),
            overlap,
          }
        : undefined,
    };
  });
}

function aggregateRiskImpact(signals: SafetySignalRecord[]) {
  const contributions = signals
    .map((signal) => {
      const type = toSafetySignalType(signal.type);
      const severity = toSafetySignalSeverity(signal.severity);
      if (!type || !severity) {
        return null;
      }
      const metadataImpact = extractRiskImpact(signal.metadata);
      return metadataImpact ?? calculateRiskImpact(type, severity);
    })
    .filter((entry): entry is SafetySignalRiskImpact => Boolean(entry));

  if (!contributions.length) {
    return {
      privilegingScore: 0,
      matchingScore: 0,
      contributions: [],
      narrative: ['No recent safety signals recorded.'],
    };
  }

  const privilegingScore = clamp(
    contributions.reduce((acc, entry) => acc + entry.privilegingDelta, 0),
    -1,
    1,
  );
  const matchingScore = clamp(
    contributions.reduce((acc, entry) => acc + entry.matchingDelta, 0),
    -1,
    1,
  );
  const narrative = buildNarrative(contributions, privilegingScore, matchingScore);

  return {
    privilegingScore,
    matchingScore,
    contributions,
    narrative,
  };
}

function detectSafetySignalAnomalies(
  safetySignals: SafetySignalRecord[],
  privilegeSignals: PrivilegeSafetySignal[],
): SafetyAnomaly[] {
  const now = new Date();
  const departmentWindow = daysAgo(14, now);
  const baselineWindow = daysAgo(60, now);
  const departmentRecent = new Map<string, number>();
  const departmentBaseline = new Map<string, number>();

  safetySignals.forEach((signal) => {
    const department = extractString(
      signal.metadata.department ?? signal.metadata.serviceLine ?? signal.metadata.unit,
    );
    if (!department) return;
    const reportedAt = new Date(signal.reportedAt);
    if (reportedAt >= departmentWindow) {
      departmentRecent.set(department, (departmentRecent.get(department) ?? 0) + 1);
    } else if (reportedAt >= baselineWindow) {
      departmentBaseline.set(department, (departmentBaseline.get(department) ?? 0) + 1);
    }
  });

  const anomalies: SafetyAnomaly[] = [];

  departmentRecent.forEach((count, department) => {
    const baseline = departmentBaseline.get(department) ?? 0.5;
    if (count >= 3 && count / baseline >= 2) {
      anomalies.push({
        type: 'department_spike',
        severity: count >= 6 ? 'high' : 'medium',
        summary: `${department} recorded ${count} safety signals in the last 14 days`,
        detectedAt: now.toISOString(),
        context: { department, recent: count, baseline },
      });
    }
  });

  const roleCounts = new Map<string, number>();
  safetySignals.forEach((signal) => {
    if (signal.severity === 'low') return;
    const role = extractString(signal.metadata.role ?? signal.metadata.roleType);
    if (!role) return;
    roleCounts.set(role, (roleCounts.get(role) ?? 0) + 1);
  });

  roleCounts.forEach((count, role) => {
    if (count >= 4) {
      anomalies.push({
        type: 'role_repeat',
        severity: count >= 6 ? 'high' : 'medium',
        summary: `${role} triggered ${count} moderate/high events this quarter`,
        detectedAt: now.toISOString(),
        context: { role, incidents: count },
      });
    }
  });

  const privilegeClusters = detectPrivilegeClusters(privilegeSignals);
  anomalies.push(...privilegeClusters);

  return anomalies;
}

function detectPrivilegeClusters(privilegeSignals: PrivilegeSafetySignal[]): SafetyAnomaly[] {
  const clusters = new Map<string, number>();
  privilegeSignals.forEach((signal) => {
    const key = signal.privilegeCodes.sort().slice(0, 2).join('|') || signal.signalType;
    clusters.set(key, (clusters.get(key) ?? 0) + 1);
  });

  const anomalies: SafetyAnomaly[] = [];
  clusters.forEach((count, key) => {
    if (count >= 5) {
      anomalies.push({
        type: 'privilege_cluster',
        severity: count >= 8 ? 'high' : 'medium',
        summary: `Privilege cluster ${key} produced ${count} safety signals`,
        detectedAt: new Date().toISOString(),
        context: { cluster: key, incidents: count },
      });
    }
  });
  return anomalies;
}

function buildAuditSafeExport(
  clinicianId: string,
  signals: SafetySignalRecord[],
  options: { windowDays: number },
): SafetyAuditExport {
  const sorted = [...signals].sort(
    (a, b) => new Date(a.reportedAt).getTime() - new Date(b.reportedAt).getTime(),
  );
  const windowStart = sorted[0]?.reportedAt
    ? new Date(sorted[0].reportedAt).toISOString()
    : daysAgo(options.windowDays).toISOString();
  const windowEnd = sorted[sorted.length - 1]?.reportedAt
    ? new Date(sorted[sorted.length - 1].reportedAt).toISOString()
    : new Date().toISOString();

  return {
    clinicianHash: hashWithSalt(clinicianId, AUDIT_SALT),
    window: {
      start: windowStart,
      end: windowEnd,
      days: options.windowDays,
    },
    events: sorted.map((signal) => ({
      eventHash: hashWithSalt(`${signal.id}:${signal.type}`, AUDIT_SALT),
      type: signal.type,
      severity: signal.severity,
      reportedAt: new Date(signal.reportedAt).toISOString(),
    })),
  };
}

function overlapScore(signal: SafetySignalRecord, privilege: PrivilegeSafetySignal): number {
  const reported = new Set(
    Array.isArray(signal.metadata.privilegeCodes)
      ? (signal.metadata.privilegeCodes as string[])
      : [],
  );
  const privilegeCodes = privilege.privilegeCodes ?? [];
  if (!reported.size || !privilegeCodes.length) return 0;
  const overlap = privilegeCodes.filter((code) => reported.has(code)).length;
  return Number((overlap / Math.min(reported.size, privilegeCodes.length)).toFixed(2));
}

function extractRiskImpact(metadata: Record<string, unknown>): SafetySignalRiskImpact | null {
  const candidate = metadata?.riskImpact;
  if (!candidate || typeof candidate !== 'object') {
    return null;
  }
  const type = toSafetySignalType((candidate as Record<string, unknown>).type as string);
  const severity = toSafetySignalSeverity((candidate as Record<string, unknown>).severity as string);
  if (!type || !severity) {
    return null;
  }
  const privilegingDelta = Number((candidate as Record<string, unknown>).privilegingDelta ?? 0);
  const matchingDelta = Number((candidate as Record<string, unknown>).matchingDelta ?? 0);
  return {
    type,
    severity,
    privilegingDelta,
    matchingDelta,
    direction: privilegingDelta >= 0 && matchingDelta >= 0 ? 'positive' : 'negative',
    rationale: (candidate as Record<string, unknown>).rationale as string,
  };
}

function buildNarrative(
  contributions: SafetySignalRiskImpact[],
  privilegingScore: number,
  matchingScore: number,
) {
  const topDrivers = contributions
    .sort((a, b) => Math.abs(b.privilegingDelta) - Math.abs(a.privilegingDelta))
    .slice(0, 3)
    .map((entry) => `${entry.type} (${entry.severity.toLowerCase()})`);
  return [
    `Privileging impact: ${formatScore(privilegingScore)} · Matching impact: ${formatScore(
      matchingScore,
    )}`,
    `Top drivers: ${topDrivers.join(', ') || 'n/a'}`,
  ];
}

function extractString(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 80);
  return null;
}

function toSafetySignalType(value: string): SafetySignalType | null {
  if (SAFETY_SIGNAL_TYPES.includes(value as SafetySignalType)) {
    return value as SafetySignalType;
  }
  return null;
}

function toSafetySignalSeverity(value: string): SafetySignalSeverity | null {
  if (SAFETY_SIGNAL_SEVERITIES.includes(value as SafetySignalSeverity)) {
    return value as SafetySignalSeverity;
  }
  return null;
}

function clamp(value: number, min: number, max: number) {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.max(min, Math.min(max, Number(value.toFixed(4))));
}

function formatScore(value: number) {
  if (value === 0) return 'neutral';
  if (value > 0) return `+${(value * 100).toFixed(0)}bp`;
  return `${(value * 100).toFixed(0)}bp`;
}

function daysAgo(days: number, now: Date = new Date()): Date {
  const clone = new Date(now);
  clone.setDate(clone.getDate() - days);
  return clone;
}

