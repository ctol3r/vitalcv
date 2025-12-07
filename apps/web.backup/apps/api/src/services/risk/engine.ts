import { createHash, randomUUID } from 'crypto';
import { PrismaClient, Prisma } from '@prisma/client';

import { detectTampering } from '../fraud/tamper';
import { validateAcrossSources } from '../fraud/cross-source';
import { aggregateFraudSignals } from '../fraud/score';
import { evaluateCredentialVitals } from '../health/vitals';
import { ingestBehavioralSignals, scoreBehavioralSignals } from './behavior';
import { evaluateRiskAlerts, RiskAlert } from '../alerts/risk-alerts';

const prisma = new PrismaClient();

const WEIGHTS = {
  sanctions: 0.3,
  fraud: 0.25,
  behavior: 0.2,
  npdb: 0.25,
};

type VitalStatus = 'good' | 'warning' | 'critical';

export interface RiskComponentScores {
  sanctionsScore: number;
  fraudScore: number;
  behaviorScore: number;
  npdbScore: number;
}

export interface RiskEngineResult extends RiskComponentScores {
  clinicianId: string;
  compositeRiskScore: number;
  rationale: Record<string, unknown>;
  reasonCodes: string[];
  mitigationSteps: string[];
  alerts: RiskAlert[];
  updatedAt: string;
}

export interface EvaluateRiskOptions {
  prisma?: PrismaClient;
  now?: Date;
  overrideComponents?: Partial<RiskComponentScores>;
  recordEvents?: boolean;
  recipients?: { id: string; role: 'issuer' | 'recruiter' }[];
}

export class RiskEngine {
  private readonly prisma: PrismaClient;
  private readonly now: Date;

  constructor(options: { prisma?: PrismaClient; now?: Date } = {}) {
    this.prisma = options.prisma ?? prisma;
    this.now = options.now ?? new Date();
  }

  async evaluate(clinicianId: string, options: EvaluateRiskOptions = {}): Promise<RiskEngineResult> {
    const client = options.prisma ?? this.prisma;
    const now = options.now ?? this.now;

    const clinician = await client.clinicianProfile.findUnique({
      where: { id: clinicianId },
      include: { user: true },
    });
    if (!clinician) {
      throw new Error(`Clinician ${clinicianId} not found`);
    }

    const [
      componentSnapshot,
      previousCompositeEvent,
      behaviorInputs,
      fraudSnapshot,
      vitals,
    ] = await Promise.all([
      this.collectComponentScores(clinicianId, clinician, options.overrideComponents, client),
      this.getLatestCompositeEvent(clinicianId, client),
      this.collectBehavioralInputs(clinicianId, clinician.user?.id ?? null, client, now),
      this.collectFraudSnapshot(clinicianId, clinician, client),
      evaluateCredentialVitals(clinicianId, { prisma: client, now }),
    ]);

    const behaviorResult = options.overrideComponents?.behaviorScore
      ? scoreBehavioralSignals({
          clinicianId,
          missedDocumentDeadlines: behaviorInputs.missedDocumentDeadlines,
          repeatedMismatches: behaviorInputs.repeatedMismatches,
          revokedCredentials: behaviorInputs.revokedCredentials,
        })
      : await ingestBehavioralSignals({
          clinicianId,
          ...behaviorInputs,
        });

    const sanctionsScore =
      options.overrideComponents?.sanctionsScore ??
      deriveScoreFromVital(vitals, 'sanctions', componentSnapshot.sanctionsScore);
    const npdbScore =
      options.overrideComponents?.npdbScore ??
      deriveScoreFromVital(vitals, 'npdb', componentSnapshot.npdbScore);
    const fraudScore =
      options.overrideComponents?.fraudScore ?? fraudSnapshot.fraudScore;
    const behaviorScore =
      options.overrideComponents?.behaviorScore ?? behaviorResult.behaviorScore;

    const compositeRiskScore = Number(
      clamp01(
        sanctionsScore * WEIGHTS.sanctions +
          fraudScore * WEIGHTS.fraud +
          behaviorScore * WEIGHTS.behavior +
          npdbScore * WEIGHTS.npdb,
      ).toFixed(4),
    );

    const reasonCodes = buildReasonCodes({
      sanctionsScore,
      fraudScore,
      npdbScore,
      behaviorFlags: behaviorResult.flags,
    });
    const mitigationSteps = buildMitigations(reasonCodes);

    const rationale = {
      weights: WEIGHTS,
      components: {
        sanctions: { score: sanctionsScore, details: pickVitalDetails(vitals, 'sanctions') },
        fraud: {
          score: fraudScore,
          breakdown: fraudSnapshot.breakdown,
          warnings: fraudSnapshot.warnings,
        },
        behavior: {
          score: behaviorScore,
          normalizedSignals: behaviorResult.normalized,
          flags: behaviorResult.flags,
        },
        npdb: { score: npdbScore, details: pickVitalDetails(vitals, 'npdb') },
      },
      notes: mitigationSteps,
      reasonCodes,
    };

    const previousScore = previousCompositeEvent?.severity ?? null;
    const alerts = evaluateRiskAlerts({
      clinicianId,
      currentScore: compositeRiskScore,
      previousScore,
      recipients: options.recipients ?? [],
      reasonCodes,
      metadata: { rationale },
    });

    if (options.recordEvents !== false) {
      await this.persistEvents({
        clinicianId,
        sanctionsScore,
        fraudScore,
        behaviorScore,
        npdbScore,
        compositeRiskScore,
        client,
        rationale,
      });
    }

    return {
      clinicianId,
      compositeRiskScore,
      sanctionsScore,
      fraudScore,
      behaviorScore,
      npdbScore,
      rationale,
      reasonCodes,
      mitigationSteps,
      alerts,
      updatedAt: now.toISOString(),
    };
  }

  private async collectComponentScores(
    clinicianId: string,
    clinician: Prisma.ClinicianProfileGetPayload<{ include: { user: true } }>,
    overrides: EvaluateRiskOptions['overrideComponents'],
    client: PrismaClient,
  ): Promise<RiskComponentScores> {
    if (overrides) {
      return {
        sanctionsScore: overrides.sanctionsScore ?? 0,
        fraudScore: overrides.fraudScore ?? 0,
        behaviorScore: overrides.behaviorScore ?? 0,
        npdbScore: overrides.npdbScore ?? 0,
      };
    }

    const [sanctionSignals, npdbSignals] = await Promise.all([
      client.privilegeSafetySignal.count({
        where: {
          clinicianId,
          signalType: { in: ['LICENSE_RISK', 'QUALITY_RISK'] },
          detectedAt: { gte: daysAgo(180, this.now) },
        },
      }),
      client.privilegeSafetySignal.count({
        where: {
          clinicianId,
          signalType: 'NPDB_FLAG',
          detectedAt: { gte: daysAgo(365, this.now) },
        },
      }),
    ]);

    return {
      sanctionsScore: clamp01(0.2 + sanctionSignals * 0.08),
      fraudScore: 0,
      behaviorScore: 0,
      npdbScore: clamp01(0.15 + npdbSignals * 0.2),
    };
  }

  private async collectBehavioralInputs(
    clinicianId: string,
    userId: string | null,
    client: PrismaClient,
    now: Date,
  ) {
    const windowStart = daysAgo(90, now);
    const [expiredDocuments, mismatchCount, revokedCount] = await Promise.all([
      client.stateLicenseVerification.count({
        where: {
          clinicianId,
          expiryDate: { lt: now },
        },
      }),
      client.privilegeSafetySignal.count({
        where: {
          clinicianId,
          signalType: { in: ['EHR_MISMATCH', 'QUALITY_RISK'] },
          detectedAt: { gte: windowStart },
        },
      }),
      userId
        ? client.credential.count({
            where: { userId, revokedAt: { not: null } },
          })
        : Promise.resolve(0),
    ]);

    return {
      missedDocumentDeadlines: expiredDocuments,
      repeatedMismatches: mismatchCount,
      revokedCredentials: revokedCount,
      observationWindowDays: 90,
    };
  }

  private async collectFraudSnapshot(
    clinicianId: string,
    clinician: Prisma.ClinicianProfileGetPayload<{ include: { user: true } }>,
    client: PrismaClient,
  ) {
    const [latestLicense] = await client.stateLicenseVerification.findMany({
      where: { clinicianId },
      orderBy: { updatedAt: 'desc' },
      take: 1,
    });

    const boardCredential = await client.credential.findFirst({
      where: {
        userId: clinician.userId,
        type: { contains: 'board', mode: 'insensitive' },
      },
      orderBy: { issuedAt: 'desc' },
    });

    const tamperPayload = buildTamperPayload(clinicianId, latestLicense?.id ?? randomUUID());
    const [tamperResult, crossSource, sanctionsFrequency] = await Promise.all([
      detectTampering(tamperPayload),
      validateAcrossSources({
        clinicianId,
        npi: clinician.npi ?? '0000000000',
        licenseNumber: latestLicense?.licenseNumber ?? 'UNKNOWN',
        licenseState: latestLicense?.state ?? clinician.state ?? 'NA',
        board: {
          name: boardCredential?.name ?? 'ABMS',
          certificateId: boardCredential?.externalId ?? boardCredential?.id ?? 'UNKNOWN',
        },
      }),
      this.calculateSanctionsFrequency(clinicianId, client),
    ]);

    const fraudScore = aggregateFraudSignals({
      clinicianId,
      tamperLikelihood: tamperResult.tamperLikelihood,
      tamperReasons: tamperResult.reasons,
      sanctionsFrequency,
      crossSource,
    });

    return fraudScore;
  }

  private async calculateSanctionsFrequency(clinicianId: string, client: PrismaClient): Promise<number> {
    const windowStart = daysAgo(365, this.now);
    const events = await client.privilegeSafetySignal.findMany({
      where: {
        clinicianId,
        detectedAt: { gte: windowStart },
      },
      orderBy: { detectedAt: 'desc' },
    });

    if (!events.length) {
      return 0.05;
    }

    const spanDays = Math.max(
      1,
      (this.now.getTime() - new Date(events[events.length - 1].detectedAt).getTime()) /
        (1000 * 60 * 60 * 24),
    );
    return Number(((events.length / spanDays) * 365).toFixed(4));
  }

  private async getLatestCompositeEvent(clinicianId: string, client: PrismaClient) {
    return client.riskEvent.findFirst({
      where: { clinicianId, type: 'composite' },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async persistEvents(params: {
    clinicianId: string;
    sanctionsScore: number;
    fraudScore: number;
    behaviorScore: number;
    npdbScore: number;
    compositeRiskScore: number;
    client: PrismaClient;
    rationale: Record<string, unknown>;
  }) {
    const { clinicianId, client } = params;
    const events = [
      {
        type: 'sanctions',
        severity: params.sanctionsScore,
        metadata: params.rationale.components?.sanctions ?? {},
      },
      {
        type: 'fraud',
        severity: params.fraudScore,
        metadata: params.rationale.components?.fraud ?? {},
      },
      {
        type: 'npdb',
        severity: params.npdbScore,
        metadata: params.rationale.components?.npdb ?? {},
      },
      {
        type: 'composite',
        severity: params.compositeRiskScore,
        metadata: params.rationale,
      },
    ];

    await client.$transaction(
      events.map((event) =>
        client.riskEvent.create({
          data: {
            clinicianId,
            type: event.type,
            severity: event.severity,
            metadata: event.metadata,
          },
        }),
      ),
    );
  }
}

function deriveScoreFromVital(
  vitals: Prisma.CredentialVitalSign[],
  component: string,
  fallback: number,
): number {
  const vital = vitals.find((entry) => entry.component === component);
  if (!vital) {
    return fallback;
  }
  return mapStatusToScore(vital.status as VitalStatus);
}

function mapStatusToScore(status: VitalStatus): number {
  switch (status) {
    case 'critical':
      return 0.95;
    case 'warning':
      return 0.55;
    default:
      return 0.15;
  }
}

function pickVitalDetails(
  vitals: Prisma.CredentialVitalSign[],
  component: string,
): Record<string, unknown> | undefined {
  const vital = vitals.find((entry) => entry.component === component);
  if (!vital) {
    return undefined;
  }
  return vital.details as Record<string, unknown>;
}

function buildReasonCodes(params: {
  sanctionsScore: number;
  fraudScore: number;
  npdbScore: number;
  behaviorFlags: string[];
}): string[] {
  const codes: string[] = [];
  if (params.sanctionsScore >= 0.6) {
    codes.push('SANCTIONS_MONITOR');
  }
  if (params.fraudScore >= 0.55) {
    codes.push('FRAUD_TELEMETRY');
  }
  if (params.npdbScore >= 0.5) {
    codes.push('NPDB_ESCALATION');
  }
  for (const flag of params.behaviorFlags) {
    if (flag === 'MISSED_DEADLINES') {
      codes.push('BEHAVIOR_DEADLINES');
    }
    if (flag === 'MISMATCH_LOOP') {
      codes.push('BEHAVIOR_MISMATCH');
    }
    if (flag === 'CREDENTIAL_REVOKED') {
      codes.push('BEHAVIOR_REVOKED');
    }
  }
  if (!codes.length) {
    codes.push('BASELINE_MONITOR');
  }
  return Array.from(new Set(codes));
}

function buildMitigations(reasonCodes: string[]): string[] {
  const steps = new Set<string>();
  for (const code of reasonCodes) {
    switch (code) {
      case 'SANCTIONS_MONITOR':
        steps.add('Trigger OIG/NPDB attestation workflow and suspend auto-issuance.');
        break;
      case 'FRAUD_TELEMETRY':
        steps.add('Escalate to fraud analyst for tamper replay and device fingerprinting.');
        break;
      case 'NPDB_ESCALATION':
        steps.add('Route NPDB summary to compliance for immediate review.');
        break;
      case 'BEHAVIOR_DEADLINES':
        steps.add('Send remediation plan for missed documentation deadlines.');
        break;
      case 'BEHAVIOR_MISMATCH':
        steps.add('Require dual attestation on future PSV uploads.');
        break;
      case 'BEHAVIOR_REVOKED':
        steps.add('Lock credential issuance until revoked records are reconciled.');
        break;
      default:
        steps.add('Continue monitoring composite risk telemetry.');
    }
  }
  return Array.from(steps);
}

function buildTamperPayload(clinicianId: string, documentId: string) {
  const seed = createHash('sha256').update(`${clinicianId}:${documentId}`).digest('hex');
  const fontSizes = Array.from({ length: 6 }, (_, index) => {
    const slice = seed.slice(index * 5, index * 5 + 5);
    return 10 + (parseInt(slice, 16) % 6);
  });

  const templateRegions = Array.from({ length: 4 }, (_, index) => {
    const slide = seed.slice(index * 8, index * 8 + 8);
    const drift = (parseInt(slide, 16) % 30) / 100;
    return {
      regionId: `region-${index + 1}`,
      expectedShapeScore: 1,
      detectedShapeScore: 1 - drift,
      matchConfidence: 0.9 - drift / 2,
    };
  });

  const pixelStats = {
    noiseRatio: ((parseInt(seed.slice(0, 6), 16) % 30) + 10) / 100,
    clonePatchCount: (parseInt(seed.slice(6, 12), 16) % 5) + 1,
    edgeDeviation: ((parseInt(seed.slice(12, 18), 16) % 20) - 10) / 25,
  };

  return {
    clinicianId,
    documentId,
    hash: seed,
    checksum: seed.slice(0, 32),
    textDensity: 0.6 + ((parseInt(seed.slice(20, 26), 16) % 10) - 5) / 50,
    fontSizes,
    templateRegions,
    pixelDiffStats: pixelStats,
  };
}

function daysAgo(days: number, from: Date): Date {
  return new Date(from.getTime() - days * 24 * 60 * 60 * 1000);
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) {
    return 0;
  }
  return Math.max(0, Math.min(1, value));
}

