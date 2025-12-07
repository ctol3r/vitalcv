import type {
  PrivilegeSafetySignal as PrismaSafetySignalModel,
  PrismaClient,
} from '@prisma/client';
import { PrismaClient as DefaultPrismaClient } from '@prisma/client';
import { getServiceLogger } from '../../logging/serviceLogger.js';
import type { QualitySignal } from '../../qualityFusion/models/QualitySignal.js';
import {
  CreatePrivilegeSafetySignalInput,
  PrivilegeSafetySignal as DomainSafetySignal,
  PrivilegeSafetySignalType,
  SafetySignalSeverity,
  createPrivilegeSafetySignal,
} from '../models/PrivilegeSafetySignal.js';
import {
  getDefaultPrivilegesForSignal,
  isSignalGlobal,
  normalizeSignalType,
} from '../mapping/privilegeSafetyMap.js';
import { SafetyThresholdRegistry, ThresholdDecision } from '../rules/thresholds.js';
import { recordSafetySignalTimelineEvent } from '../../timeline/safetyIntegration.js';

const prisma = new DefaultPrismaClient();
const log = getServiceLogger('safety/signalCollector');

type DriftEventSeverity = 'info' | 'low' | 'medium' | 'high' | 'warning' | 'critical';

export interface DriftSourceEvent {
  id?: string;
  type?: string;
  detector?: string;
  clinicianId?: string;
  orgId?: string;
  privilegeCode?: string;
  privilegeGrantedId?: string;
  severity: DriftEventSeverity;
  summary: string;
  metadata?: Record<string, unknown>;
  source?: string;
  detectedAt?: Date;
}

export interface FusionScoreSignal {
  code: PrivilegeSafetySignalType;
  severity: SafetySignalSeverity;
  summary?: string;
  privilegeCodes?: string[];
}

export interface FusionScoreEvent {
  clinicianId: string;
  orgId?: string;
  privilegeCodes?: string[];
  fusionScore: number;
  source?: string;
  signals?: FusionScoreSignal[];
  detectedAt?: Date;
}

export interface EnrollmentChangeEvent {
  clinicianId: string;
  orgId: string;
  privilegeCodes?: string[];
  changeType: 'ENROLLED' | 'DENIED' | 'SUSPENDED' | 'PANEL_FULL';
  metadata?: Record<string, unknown>;
  detectedAt?: Date;
}

export interface EhrMismatchEvent {
  clinicianId: string;
  orgId: string;
  missingInEhr: string[];
  missingInVital: string[];
  downgraded: string[];
  privilegeCodes?: string[];
  source?: string;
  detectedAt?: Date;
}

export interface SafetySignalResult {
  record: PrismaSafetySignalModel;
  domain: DomainSafetySignal;
  decisions: ThresholdDecision[];
}

const DRIFT_SIGNAL_MAP: Record<string, PrivilegeSafetySignalType> = {
  PRIVILEGE_EXPIRED: 'LICENSE_RISK',
  PRIVILEGE_FPPE_FAILED: 'FPPE_FAILURE',
  PRIVILEGE_RENEWAL_OVERDUE: 'LICENSE_RISK',
  PAYER_REVALIDATION_DUE: 'PAYER_DENIAL_SPIKE',
  PAYER_STATUS_MISMATCH: 'PAYER_DENIAL_SPIKE',
  ACCESS_ROLE_DRIFT: 'QUALITY_RISK',
};

function mapDriftSeverity(severity: DriftEventSeverity): SafetySignalSeverity {
  switch (severity) {
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

function mapQualityTypeToSafety(type: QualitySignal['signalType']): PrivilegeSafetySignalType {
  switch (type) {
    case 'OPPE_LOW':
      return 'OPPE_LOW';
    case 'FPPE_FAILURE':
      return 'FPPE_FAILURE';
    case 'EHR_PRIVILEGE_MISMATCH':
      return 'EHR_MISMATCH';
    case 'PAYER_DENIAL_SPIKE':
    case 'PECOS_CONFLICT':
      return 'PAYER_DENIAL_SPIKE';
    case 'LICENSE_DRIFT':
      return 'LICENSE_RISK';
    case 'BOARD_DRIFT':
      return 'BOARD_EXPIRED';
    default:
      return 'QUALITY_RISK';
  }
}

function mapDriftTypeToSafety(type?: string): PrivilegeSafetySignalType | undefined {
  if (!type) {
    return undefined;
  }
  const normalized = type.toUpperCase();
  return DRIFT_SIGNAL_MAP[normalized];
}

function mapQualitySeverity(severity: QualitySignal['severity']): SafetySignalSeverity {
  if (severity === 'LOW' || severity === 'HIGH' || severity === 'CRITICAL') {
    return severity;
  }
  return 'MED';
}

function toDomain(record: PrismaSafetySignalModel): DomainSafetySignal {
  return {
    clinicianId: record.clinicianId,
    orgId: record.orgId ?? undefined,
    privilegeCodes: [...record.privilegeCodes],
    privilegeGrantedId: record.privilegeGrantedId ?? undefined,
    signalType: record.signalType,
    severity: record.severity,
    summary: record.summary,
    source: record.source,
    detectedAt: new Date(record.detectedAt),
    details: (record.details ?? undefined) as Record<string, unknown> | undefined,
    evidence: (record.evidence ?? undefined) as Record<string, unknown>[] | undefined,
    resolutionNotes: record.resolutionNotes ?? undefined,
    resolutionActor: record.resolutionActor ?? undefined,
    resolvedAt: record.resolvedAt ?? undefined,
    metadata: undefined,
  };
}

type PrismaLike = Pick<PrismaClient, 'privilegeSafetySignal'>;

export interface SafetySignalCollectorOptions {
  prisma?: PrismaLike;
  thresholdRegistry?: SafetyThresholdRegistry;
}

export class SafetySignalCollector {
  private readonly prisma: PrismaLike;
  private readonly thresholds: SafetyThresholdRegistry;

  constructor(options: SafetySignalCollectorOptions = {}) {
    this.prisma = options.prisma ?? prisma;
    this.thresholds = options.thresholdRegistry ?? new SafetyThresholdRegistry();
  }

  async ingestDriftEvent(event: DriftSourceEvent): Promise<SafetySignalResult | null> {
    if (!event.clinicianId) {
      log.debug('Skipping drift event without clinician context', { eventId: event.id });
      return null;
    }

    const inferredType = mapDriftTypeToSafety(event.type);
    const candidateType =
      (event.type as PrivilegeSafetySignalType | undefined) ?? inferredType ?? 'LICENSE_RISK';
    const finalSignalType = normalizeSignalType(candidateType);

    const privilegeCodes = this.resolvePrivilegeCodes(
      finalSignalType,
      event.privilegeCode ? [event.privilegeCode] : undefined
    );

    return this.persistSignal({
      clinicianId: event.clinicianId,
      orgId: event.orgId,
      privilegeCodes,
      privilegeGrantedId: event.privilegeGrantedId,
      signalType: finalSignalType,
      severity: mapDriftSeverity(event.severity),
      summary: event.summary,
      source: event.source ?? `drift:${event.detector ?? 'unknown'}`,
      detectedAt: event.detectedAt ?? new Date(),
      details: {
        driftEventId: event.id,
        ...event.metadata,
      },
    });
  }

  async ingestQualitySignal(
    signal: QualitySignal,
    options: { orgId?: string; privilegeCodes?: string[]; privilegeGrantedId?: string } = {}
  ): Promise<SafetySignalResult> {
    const signalType = mapQualityTypeToSafety(signal.signalType);
    const privilegeCodes = this.resolvePrivilegeCodes(signalType, options.privilegeCodes);

    return this.persistSignal({
      clinicianId: signal.clinicianId,
      orgId: options.orgId,
      privilegeCodes,
      privilegeGrantedId: options.privilegeGrantedId,
      signalType,
      severity: mapQualitySeverity(signal.severity),
      summary:
        signal.details?.summary ??
        `${signal.signalType.replace(/_/g, ' ')} (${signal.severity}) detected`,
      source: 'qualityFusion',
      detectedAt: signal.timestamp,
      details: {
        type: signal.signalType,
        details: signal.details,
      },
    });
  }

  async ingestFusionEvent(event: FusionScoreEvent): Promise<SafetySignalResult[]> {
    const detectedAt = event.detectedAt ?? new Date();
    const results: SafetySignalResult[] = [];

    if (event.signals && event.signals.length > 0) {
      for (const fusionSignal of event.signals) {
        results.push(
          await this.persistSignal({
            clinicianId: event.clinicianId,
            orgId: event.orgId,
            privilegeCodes: this.resolvePrivilegeCodes(
              fusionSignal.code,
              fusionSignal.privilegeCodes ?? event.privilegeCodes
            ),
            signalType: fusionSignal.code,
            severity: fusionSignal.severity,
            summary:
              fusionSignal.summary ??
              `Fusion score flagged ${fusionSignal.code} (${fusionSignal.severity})`,
            source: event.source ?? 'qualityFusion',
            detectedAt,
            details: {
              fusionScore: event.fusionScore,
            },
          })
        );
      }
      return results;
    }

    if (event.fusionScore < 0.4) {
      results.push(
        await this.persistSignal({
          clinicianId: event.clinicianId,
          orgId: event.orgId,
          privilegeCodes: this.resolvePrivilegeCodes('QUALITY_RISK', event.privilegeCodes),
          signalType: 'QUALITY_RISK',
          severity: event.fusionScore < 0.25 ? 'HIGH' : 'MED',
          summary: 'Fusion score indicates elevated quality risk',
          source: event.source ?? 'qualityFusion',
          detectedAt,
          details: {
            fusionScore: event.fusionScore,
          },
        })
      );
    }

    return results;
  }

  async ingestEnrollmentChange(
    event: EnrollmentChangeEvent
  ): Promise<SafetySignalResult | null> {
    const severityMap: Record<EnrollmentChangeEvent['changeType'], SafetySignalSeverity | null> = {
      ENROLLED: null,
      DENIED: 'HIGH',
      SUSPENDED: 'HIGH',
      PANEL_FULL: 'MED',
    };

    const severity = severityMap[event.changeType];
    if (!severity) {
      return null;
    }

    const signalType =
      event.changeType === 'SUSPENDED' ? 'COMPACT_ELIGIBILITY_LOSS' : 'PAYER_DENIAL_SPIKE';
    return this.persistSignal({
      clinicianId: event.clinicianId,
      orgId: event.orgId,
      privilegeCodes: this.resolvePrivilegeCodes(signalType, event.privilegeCodes),
      signalType,
      severity,
      summary: `Enrollment ${event.changeType.toLowerCase()}`,
      source: 'enrollment-monitor',
      detectedAt: event.detectedAt ?? new Date(),
      details: event.metadata,
    });
  }

  async ingestEhrMismatch(event: EhrMismatchEvent): Promise<SafetySignalResult> {
    return this.persistSignal({
      clinicianId: event.clinicianId,
      orgId: event.orgId,
      privilegeCodes: this.resolvePrivilegeCodes('EHR_MISMATCH', event.privilegeCodes),
      signalType: 'EHR_MISMATCH',
      severity: 'CRITICAL',
      summary: 'EHR privilege roster mismatch detected',
      source: event.source ?? 'ehr-sync',
      detectedAt: event.detectedAt ?? new Date(),
      details: {
        missingInEhr: event.missingInEhr,
        missingInVital: event.missingInVital,
        downgraded: event.downgraded,
      },
    });
  }

  private async persistSignal(input: CreatePrivilegeSafetySignalInput): Promise<SafetySignalResult> {
    const normalized = createPrivilegeSafetySignal({
      ...input,
      privilegeCodes: this.resolvePrivilegeCodes(input.signalType, input.privilegeCodes),
    });

    const record = await this.prisma.privilegeSafetySignal.create({
      data: {
        clinicianId: normalized.clinicianId,
        orgId: normalized.orgId,
        privilegeCodes: normalized.privilegeCodes,
        privilegeGrantedId: normalized.privilegeGrantedId,
        signalType: normalized.signalType,
        severity: normalized.severity,
        summary: normalized.summary,
        source: normalized.source,
        detectedAt: normalized.detectedAt,
        details: normalized.details ?? undefined,
        evidence: normalized.evidence ?? undefined,
        resolvedAt: normalized.resolvedAt ?? null,
        resolutionNotes: normalized.resolutionNotes ?? null,
        resolutionActor: normalized.resolutionActor ?? null,
      },
    });

    const domainRecord = toDomain(record);

    await recordSafetySignalTimelineEvent({
      signalId: record.id,
      clinicianId: record.clinicianId,
      orgId: record.orgId ?? undefined,
      severity: record.severity,
      privilegeCodes: record.privilegeCodes,
      summary: record.summary,
      detectedAt: record.detectedAt,
      source: record.source,
      metadata: record.details ?? undefined,
    });

    const lookbackHours = this.thresholds.getMaxWindowHours();
    let decisions: ThresholdDecision[] = [];
    if (lookbackHours > 0) {
      const windowStart = new Date(
        domainRecord.detectedAt.getTime() - lookbackHours * 60 * 60 * 1000
      );
      const historicalRecords = await this.prisma.privilegeSafetySignal.findMany({
        where: {
          clinicianId: domainRecord.clinicianId,
          detectedAt: {
            gte: windowStart,
            lt: domainRecord.detectedAt,
          },
        },
        orderBy: { detectedAt: 'asc' },
      });
      const domainSignals = [...historicalRecords.map(toDomain), domainRecord];
      decisions = this.thresholds.evaluate(domainSignals, domainRecord.detectedAt);
    }

    if (decisions.length > 0) {
      log.warn('Safety thresholds exceeded', {
        clinicianId: record.clinicianId,
        signalId: record.id,
        decisions: decisions.map((decision) => ({
          ruleId: decision.rule.id,
          action: decision.action,
        })),
      });
    }

    return { record, domain: domainRecord, decisions };
  }

  private resolvePrivilegeCodes(
    signalType: PrivilegeSafetySignalType,
    provided?: string[]
  ): string[] {
    if (provided && provided.length > 0) {
      return provided;
    }
    if (isSignalGlobal(signalType)) {
      return ['ALL_PRIVILEGES'];
    }
    return getDefaultPrivilegesForSignal(signalType);
  }
}

