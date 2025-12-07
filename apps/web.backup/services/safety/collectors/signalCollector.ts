import { PrismaClient, type Prisma, type PayerEnrollmentV2Status } from '@prisma/client';
import type { DriftEvent } from '../../drift/types.js';
import type { QualitySignal } from '../../qualityFusion/models/QualitySignal.js';
import type { EhrPrivilegeMismatchResult } from '../../qualityFusion/analyzers/ehrMismatch.js';
import { getServiceLogger } from '../../logging/serviceLogger.js';
import { resolvePrivilegesForSignal } from '../mapping/privilegeSafetyMap.js';
import {
  ALL_PRIVILEGES_TOKEN,
  createPrivilegeSafetySignal,
  type PrivilegeSafetyAction,
  type PrivilegeSafetySeverity,
  type PrivilegeSafetySignal,
  type PrivilegeSafetySignalSnapshot,
  type PrivilegeSafetySignalType,
} from '../models/PrivilegeSafetySignal.js';
import { evaluateSafetyAction } from '../rules/thresholds.js';
import { recordPrivilegeSafetyTimelineEvent } from '../../timeline/safetyIntegration.js';

const prisma = new PrismaClient() as unknown as SafetyPrismaClient;
const log = getServiceLogger('safety/signalCollector');

type PrismaCreateArgs = {
  data: {
    clinicianId: string;
    signalType: PrivilegeSafetySignalType;
    severity: PrivilegeSafetySeverity;
    privilegeCodes: string[];
    summary: string;
    source: string;
    sourceEventId?: string | null;
    details?: Prisma.InputJsonValue;
    recommendedAction?: PrivilegeSafetyAction | null;
    detectedAt: Date;
  };
};

interface SafetyPrismaDelegate {
  create(args: PrismaCreateArgs): Promise<PersistedSafetySignal>;
  findMany(args: {
    where: { clinicianId: string };
    orderBy: { detectedAt: 'desc' };
    take: number;
  }): Promise<PersistedSafetySignal[]>;
}

interface SafetyPrismaClient {
  privilegeSafetySignal: SafetyPrismaDelegate;
}

export interface PersistedSafetySignal {
  id: string;
  clinicianId: string;
  signalType: PrivilegeSafetySignalType;
  severity: PrivilegeSafetySeverity;
  privilegeCodes: string[];
  summary: string;
  source: string;
  sourceEventId?: string | null;
  details?: Record<string, unknown> | null;
  recommendedAction?: string | null;
  detectedAt: Date;
  acknowledgedAt?: Date | null;
  resolvedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CollectorResult {
  record: PersistedSafetySignal;
  recommendedAction: PrivilegeSafetyAction;
}

export interface FusionScoreSignalInput {
  clinicianId: string;
  severity: PrivilegeSafetySeverity;
  summary: string;
  score: number;
  domain?: 'privilege' | 'quality' | 'payer' | 'regulatory';
  tags?: string[];
  privilegeCodes?: string[];
  source?: string;
  metadata?: Record<string, unknown>;
}

export interface EnrollmentChangeEvent {
  clinicianId: string;
  enrollmentId: string;
  previousStatus: PayerEnrollmentV2Status;
  currentStatus: PayerEnrollmentV2Status;
  payerId?: string;
  reason?: string;
}

export interface DriftIngestOptions {
  clinicianId?: string;
  privilegeCodes?: string[];
  source?: string;
  signalType?: PrivilegeSafetySignalType;
}

export interface QualitySignalIngestOptions {
  clinicianId?: string;
  privilegeCodes?: string[];
  summary?: string;
  metadata?: Record<string, unknown>;
  source?: string;
  signalType?: PrivilegeSafetySignalType;
}

export class SafetySignalCollector {
  private client: SafetyPrismaClient;

  constructor(client: SafetyPrismaClient = prisma) {
    this.client = client;
  }

  async recordDriftEvent(event: DriftEvent, options: DriftIngestOptions = {}): Promise<CollectorResult | null> {
    const clinicianId = options.clinicianId ?? (event.metadata?.clinicianId as string | undefined);
    if (!clinicianId) {
      log.warn('[SafetySignalCollector] Skipping drift event without clinicianId', {
        eventId: event.id,
        detector: event.detector,
      });
      return null;
    }

    const signalType = options.signalType ?? mapDriftEventToSignalType(event);
    const privilegeCodes = withPrivilegeFallback(
      resolvePrivilegesForSignal(signalType, {
        candidatePrivileges: options.privilegeCodes ?? extractPrivilegeCodes(event.metadata),
      })
    );

    const severity = mapDriftSeverity(event.severity);
    const summary = event.summary || event.title || 'Drift event detected';

    return this.persistSignal({
      clinicianId,
      signalType,
      severity,
      privilegeCodes,
      summary,
      source: options.source ?? `drift/${event.detector ?? 'unknown'}`,
      sourceEventId: event.id,
      metadata: {
        category: event.category,
        title: event.title,
        evidence: event.evidence,
        recommendations: event.recommendations,
        ...event.metadata,
      },
    });
  }

  async recordQualitySignal(
    signal: QualitySignal,
    options: QualitySignalIngestOptions = {}
  ): Promise<CollectorResult> {
    const clinicianId = options.clinicianId ?? signal.clinicianId;
    const signalType = options.signalType ?? mapQualitySignalType(signal.signalType);
    const privilegeCodes = withPrivilegeFallback(
      resolvePrivilegesForSignal(signalType, {
        candidatePrivileges: options.privilegeCodes ?? extractPrivilegeCodes(signal.details),
      })
    );

    const summary =
      options.summary ??
      (typeof signal.details?.summary === 'string' && signal.details.summary.length > 0
        ? signal.details.summary
        : `${signal.signalType} (${signal.severity}) detected`);

    return this.persistSignal({
      clinicianId,
      signalType,
      severity: signal.severity as PrivilegeSafetySeverity,
      privilegeCodes,
      summary,
      source: options.source ?? signal.source ?? 'qualityFusion',
      metadata: {
        ...signal.details,
        ...options.metadata,
      },
    });
  }

  async recordFusionScore(input: FusionScoreSignalInput): Promise<CollectorResult> {
    const signalType = mapFusionDomainToSignalType(input);
    const privilegeCodes = withPrivilegeFallback(
      resolvePrivilegesForSignal(signalType, {
        candidatePrivileges: input.privilegeCodes,
      })
    );

    return this.persistSignal({
      clinicianId: input.clinicianId,
      signalType,
      severity: input.severity,
      privilegeCodes,
      summary: input.summary,
      source: input.source ?? 'fusion/scorecard',
      metadata: {
        score: input.score,
        domain: input.domain ?? 'privilege',
        tags: input.tags,
        ...input.metadata,
      },
    });
  }

  async recordEnrollmentChange(event: EnrollmentChangeEvent): Promise<CollectorResult | null> {
    const mapped = mapEnrollmentChange(event);
    if (!mapped) {
      return null;
    }

    return this.persistSignal({
      clinicianId: event.clinicianId,
      signalType: 'PAYER_DENIAL_SPIKE',
      severity: mapped.severity,
      privilegeCodes: [ALL_PRIVILEGES_TOKEN],
      summary: mapped.summary,
      source: 'payer/enrollment',
      sourceEventId: event.enrollmentId,
      metadata: {
        payerId: event.payerId,
        previousStatus: event.previousStatus,
        currentStatus: event.currentStatus,
        reason: event.reason,
      },
    });
  }

  async recordEhrMismatch(result: EhrPrivilegeMismatchResult): Promise<CollectorResult | null> {
    if (!result.signals.length) {
      return null;
    }

    const signal = result.signals[0];
    return this.recordQualitySignal(signal, {
      signalType: 'EHR_MISMATCH',
      privilegeCodes: [
        ...result.mismatches.missingInVital,
        ...result.mismatches.missingInEhr,
        ...result.mismatches.downgraded,
      ],
      metadata: {
        mismatches: result.mismatches,
      },
      source: signal.source ?? 'ehr/mismatch',
      summary: signal.details?.summary ?? 'EHR privilege mismatch detected',
    });
  }

  private async persistSignal(input: PrivilegeSafetySignal & { metadata?: Record<string, unknown> }): Promise<CollectorResult> {
    const normalized = createPrivilegeSafetySignal(input);

    const history = await this.client.privilegeSafetySignal.findMany({
      where: { clinicianId: normalized.clinicianId },
      orderBy: { detectedAt: 'desc' },
      take: 25,
    });

    const snapshots: PrivilegeSafetySignalSnapshot[] = [
      ...history.map((signal) => ({
        clinicianId: signal.clinicianId,
        signalType: signal.signalType,
        severity: signal.severity,
        detectedAt: new Date(signal.detectedAt),
      })),
      {
        clinicianId: normalized.clinicianId,
        signalType: normalized.signalType,
        severity: normalized.severity,
        detectedAt: normalized.triggeredAt,
      },
    ];

    const recommendedAction = evaluateSafetyAction(snapshots);

    const record = await this.client.privilegeSafetySignal.create({
      data: {
        clinicianId: normalized.clinicianId,
        signalType: normalized.signalType,
        severity: normalized.severity,
        privilegeCodes: normalized.privilegeCodes,
        summary: normalized.summary,
        source: normalized.source,
        sourceEventId: normalized.sourceEventId,
        details: toJson(normalized.metadata),
        recommendedAction: recommendedAction === 'monitor' ? null : recommendedAction,
        detectedAt: normalized.triggeredAt,
      } as PrismaCreateArgs['data'],
    });

    await recordPrivilegeSafetyTimelineEvent({
      clinicianId: record.clinicianId,
      signalType: record.signalType,
      severity: record.severity,
      privilegeCodes: record.privilegeCodes,
      summary: normalized.summary,
      source: normalized.source,
      recommendedAction: recommendedAction === 'monitor' ? undefined : recommendedAction,
      metadata: normalized.metadata,
    });

    return {
      record,
      recommendedAction,
    };
  }
}

function toJson(metadata?: Record<string, unknown>): Prisma.InputJsonValue | undefined {
  if (!metadata) {
    return undefined;
  }
  return metadata as Prisma.InputJsonValue;
}

function withPrivilegeFallback(codes: string[]): string[] {
  if (!codes.length) {
    return [ALL_PRIVILEGES_TOKEN];
  }
  return codes;
}

function extractPrivilegeCodes(
  metadata?: Record<string, unknown>
): string[] | undefined {
  if (!metadata) {
    return undefined;
  }
  const candidate = metadata.privilegeCodes;
  if (Array.isArray(candidate)) {
    return candidate.filter((value): value is string => typeof value === 'string');
  }
  return undefined;
}

function mapDriftSeverity(value?: DriftEvent['severity'] | string): PrivilegeSafetySeverity {
  const normalized = (value ?? '').toString().toLowerCase();
  switch (normalized) {
    case 'critical':
      return 'CRITICAL';
    case 'high':
      return 'HIGH';
    case 'warning':
    case 'medium':
      return 'MED';
    default:
      return 'LOW';
  }
}

function mapDriftEventToSignalType(event: DriftEvent): PrivilegeSafetySignalType {
  switch (event.category) {
    case 'dea':
      return 'DEA_EXPIRED';
    case 'board':
      return 'BOARD_EXPIRED';
    case 'directory':
      return 'EHR_MISMATCH';
    case 'medicaid':
    case 'pecos':
      return 'PAYER_DENIAL_SPIKE';
    case 'licensure':
      return 'LICENSE_RISK';
    default:
      if (event.detector?.toLowerCase().includes('compact')) {
        return 'COMPACT_ELIGIBILITY_LOSS';
      }
      return 'QUALITY_RISK';
  }
}

function mapQualitySignalType(type: QualitySignal['signalType']): PrivilegeSafetySignalType {
  const mapping: Record<QualitySignal['signalType'], PrivilegeSafetySignalType> = {
    LOW_VOLUME: 'QUALITY_RISK',
    EXCESSIVE_VARIANCE: 'QUALITY_RISK',
    COMPLICATION_SPIKE: 'QUALITY_RISK',
    OPPE_LOW: 'OPPE_LOW',
    FPPE_FAILURE: 'FPPE_FAILURE',
    EHR_PRIVILEGE_MISMATCH: 'EHR_MISMATCH',
    PAYER_DENIAL_SPIKE: 'PAYER_DENIAL_SPIKE',
    PECOS_CONFLICT: 'PAYER_DENIAL_SPIKE',
    LICENSE_DRIFT: 'LICENSE_RISK',
    BOARD_DRIFT: 'BOARD_EXPIRED',
  };
  return mapping[type] ?? 'QUALITY_RISK';
}

function mapFusionDomainToSignalType(input: FusionScoreSignalInput): PrivilegeSafetySignalType {
  switch (input.domain) {
    case 'payer':
      return 'PAYER_DENIAL_SPIKE';
    case 'regulatory':
      return 'COMPACT_ELIGIBILITY_LOSS';
    case 'quality':
      return 'QUALITY_RISK';
    case 'privilege':
    default:
      if (input.tags?.includes('dea')) {
        return 'DEA_EXPIRED';
      }
      if (input.tags?.includes('board')) {
        return 'BOARD_EXPIRED';
      }
      return 'QUALITY_RISK';
  }
}

function mapEnrollmentChange(
  event: EnrollmentChangeEvent
): { severity: PrivilegeSafetySeverity; summary: string } | null {
  if (event.currentStatus === 'REJECTED') {
    return {
      severity: 'HIGH',
      summary: 'Payer enrollment was rejected',
    };
  }
  if (event.currentStatus === 'REVALIDATION_DUE') {
    return {
      severity: 'MED',
      summary: 'Payer enrollment requires revalidation',
    };
  }
  if (event.currentStatus === 'PANEL_FULL') {
    return {
      severity: 'MED',
      summary: 'Payer panel is full for this clinician',
    };
  }
  return null;
}

