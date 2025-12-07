import { Prisma, PrismaClient } from '@prisma/client';
import {
  MobilityIntegration,
  type MobilityDecision,
  type MobilityReadinessStatus,
} from '../workforce/matching/mobilityIntegration.js';
import { KeyedConcurrencyGate } from '../queue/handlers/concurrency.js';

interface MobilityEvaluationResult {
  requestId: string;
  clinicianId: string;
  orgId: string;
  readinessScore: number;
  readinessStatus: MobilityReadinessStatus;
  missingPrivileges: string[];
  reasons: string[];
  mobilityDecision: MobilityDecision;
}

const mobilityOrgConcurrency = new KeyedConcurrencyGate('MOBILITY_EVALUATE_ORG');

export class MobilityEngine {
  constructor(
    private readonly prisma: PrismaClient = new PrismaClient(),
    private readonly integration: MobilityIntegration = new MobilityIntegration(),
  ) {}

  async evaluateOnboardingRequest(
    onboardingRequestId: string,
  ): Promise<MobilityEvaluationResult> {
    const request = await this.prisma.orgOnboardingRequest.findUnique({
      where: { id: onboardingRequestId },
      include: {
        clinician: {
          include: {
            user: {
              select: {
                id: true,
                did: true,
                email: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!request) {
      throw new Error(`OrgOnboardingRequest ${onboardingRequestId} not found`);
    }

    return mobilityOrgConcurrency.run(request.orgId, async () => {
      const clinicianDid = request.clinician.user?.did ?? '';
      const requiredPrivileges = normalizePrivilegeCodes(
        request.requiredPrivileges as unknown,
      );

      const [activeLicenses, grantedPrivileges, safetyRestrictions] =
        await Promise.all([
          this.prisma.stateLicenseVerification.count({
            where: {
              clinicianId: request.clinicianId,
              status: 'ACTIVE',
            },
          }),
          this.prisma.privilegeGranted.findMany({
            where: {
              clinicianDid,
              status: 'ACTIVE',
            },
            select: {
              privilegeSetId: true,
              orgId: true,
            },
          }),
          this.prisma.privilegeSafetyState.count({
            where: {
              clinicianId: request.clinicianId,
              resolvedAt: null,
              state: { in: ['HOLD', 'SUSPENDED'] },
            },
          }),
        ]);

      const grantedCodes = grantedPrivileges.map((priv) =>
        priv.privilegeSetId.toUpperCase(),
      );

      const missingPrivileges = requiredPrivileges.filter(
        (code) => !grantedCodes.includes(code),
      );

      const coverageRatio =
        requiredPrivileges.length === 0
          ? 1
          : (requiredPrivileges.length - missingPrivileges.length) /
            requiredPrivileges.length;

      const mobilityDecision = await this.integration.canMatch({
        clinicianId: request.clinicianId,
        clinicianOrgId: 'home-org',
        targetOrgId: request.orgId,
      });

      const readinessScore = computeReadinessScore({
        coverageRatio,
        activeLicenses,
        safetyRestrictions,
        mobilityDecision,
      });

      const readinessStatus = classifyReadiness(readinessScore);
      const reasons = buildReasons(
        missingPrivileges,
        safetyRestrictions,
        mobilityDecision,
      );

      await this.prisma.orgOnboardingRequest.update({
        where: { id: request.id },
        data: {
          metadata: serializeMetadata(request.metadata, {
            mobilityAnalysis: {
              evaluatedAt: new Date().toISOString(),
              readinessScore,
              readinessStatus,
              missingPrivileges,
              safetyRestrictions,
              decision: mobilityDecision,
            },
          }),
        },
      });

      return {
        requestId: request.id,
        clinicianId: request.clinicianId,
        orgId: request.orgId,
        readinessScore,
        readinessStatus,
        missingPrivileges,
        reasons,
        mobilityDecision,
      };
    });
  }
}

export const mobilityEngine = new MobilityEngine();

function normalizePrivilegeCodes(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => {
      if (typeof entry === 'string') {
        return entry;
      }
      if (entry && typeof entry === 'object' && 'code' in entry) {
        return String((entry as { code: string }).code);
      }
      return null;
    })
    .filter((code): code is string => Boolean(code))
    .map((code) => code.toUpperCase());
}

function computeReadinessScore(input: {
  coverageRatio: number;
  activeLicenses: number;
  safetyRestrictions: number;
  mobilityDecision: MobilityDecision;
}): number {
  let score = 0.4;
  score += Math.min(input.activeLicenses, 4) * 0.05;
  score += input.coverageRatio * 0.35;
  score -= Math.min(input.safetyRestrictions, 3) * 0.08;

  switch (input.mobilityDecision.readiness.status) {
    case 'instantly_onboardable':
      score += 0.2;
      break;
    case 'portable':
      score += 0.08;
      break;
    default:
      score -= 0.1;
  }

  return Math.max(0, Math.min(1, Number(score.toFixed(3))));
}

function classifyReadiness(score: number): MobilityReadinessStatus {
  if (score >= 0.8) {
    return 'instantly_onboardable';
  }
  if (score >= 0.5) {
    return 'portable';
  }
  return 'blocked';
}

function buildReasons(
  missingPrivileges: string[],
  safetyRestrictions: number,
  decision: MobilityDecision,
): string[] {
  const reasons: string[] = [];
  if (missingPrivileges.length > 0) {
    reasons.push(`Missing privileges: ${missingPrivileges.join(', ')}`);
  }
  if (safetyRestrictions > 0) {
    reasons.push(`Active safety restrictions: ${safetyRestrictions}`);
  }
  reasons.push(decision.reason);
  return reasons;
}

function serializeMetadata(
  existing: Prisma.JsonValue | null,
  updates: Record<string, unknown>,
): Prisma.JsonValue {
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {};
  return { ...base, ...updates };
}

