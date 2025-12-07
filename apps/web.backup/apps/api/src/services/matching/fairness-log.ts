import { PrismaClient } from '@prisma/client';
import type { FairnessAdjustment } from './fairness';

const prisma = new PrismaClient();
const BULK_CATEGORY = 'MATCH_FAIRNESS';
const PER_MATCH_CATEGORY = 'matching.fairness';

export interface FairnessAuditContext {
  jobId: string;
  orgId?: string | null;
  featureWeights: Record<string, number>;
  adjustments: FairnessAdjustment[];
}

export async function logFairnessDecisions(context: FairnessAuditContext): Promise<void> {
  if (!context.adjustments.length) {
    return;
  }

  const timestamp = new Date().toISOString();
  try {
    await Promise.all(
      context.adjustments.map((adjustment) =>
        prisma.auditEvidence.create({
          data: {
            clinicianId: adjustment.clinicianId,
            category: BULK_CATEGORY,
            payload: {
              jobId: context.jobId,
              orgId: context.orgId ?? null,
              featureWeights: context.featureWeights,
              fairnessScore: adjustment.fairnessScore,
              adjustedScore: adjustment.adjustedScore,
              boundary: adjustment.boundary,
              biasAlerts: adjustment.biasAlerts,
              loggedAt: timestamp,
            },
          },
        }),
      ),
    );
  } catch (error) {
    console.warn('[Matching] fairness audit logging skipped', error);
  }
}

export interface FairnessAuditPayload {
  prisma: PrismaClient;
  clinicianId: string;
  jobId: string;
  fairnessScore: number;
  decisionScore: number;
  weights: Record<string, number>;
  alerts: string[];
}

export async function recordFairnessAudit(payload: FairnessAuditPayload): Promise<void> {
  try {
    if (!(payload.prisma as any).auditEvidence?.create) {
      return;
    }

    await (payload.prisma as any).auditEvidence.create({
      data: {
        clinicianId: payload.clinicianId,
        category: PER_MATCH_CATEGORY,
        payload: {
          jobId: payload.jobId,
          fairnessScore: payload.fairnessScore,
          decisionScore: payload.decisionScore,
          weights: payload.weights,
          alerts: payload.alerts,
          recordedAt: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    console.warn('[fairness] audit log skipped', error);
  }
}

