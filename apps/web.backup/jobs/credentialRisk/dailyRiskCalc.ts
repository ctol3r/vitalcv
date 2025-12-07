import { PrismaClient } from '@prisma/client';
import { evaluateCredentialRisk } from '../../services/credentialRisk/baselineEngine';
import {
  upsertCredentialRisk,
  CredentialRiskRecord,
} from '../../services/credentialRisk/models/CredentialRisk';
import { applyFusionScoreToRiskScore } from '../../services/credentialRisk/fusionIntegration';

const prisma = new PrismaClient();

export interface CredentialRiskDelta {
  clinicianId: string;
  previousScore: number | null;
  currentScore: number;
}

export interface DailyRiskCalcStats {
  processed: number;
  updated: number;
  unchanged: number;
  startedAt: Date;
  finishedAt: Date;
  deltas: CredentialRiskDelta[];
  errors: string[];
}

export interface DailyRiskCalcOptions {
  asOf?: Date;
}

export async function runDailyCredentialRiskJob(
  options: DailyRiskCalcOptions = {}
): Promise<DailyRiskCalcStats> {
  const startedAt = new Date();
  const stats: DailyRiskCalcStats = {
    processed: 0,
    updated: 0,
    unchanged: 0,
    startedAt,
    finishedAt: startedAt,
    deltas: [],
    errors: [],
  };

  try {
    const clinicians = await prisma.clinicianProfile.findMany({
      select: { id: true },
    });

    for (const clinician of clinicians) {
      stats.processed += 1;
      try {
        const evaluation = await evaluateCredentialRisk(clinician.id, {
          asOf: options.asOf,
          client: prisma,
        });

        const existing = await prisma.credentialRisk.findUnique({
          where: { clinicianId: clinician.id },
          select: { score: true },
        });

        const fusionImpact = await applyFusionScoreToRiskScore(
          clinician.id,
          evaluation.score,
          { client: prisma }
        );

        const record: CredentialRiskRecord = await upsertCredentialRisk(
          {
            clinicianId: clinician.id,
            score: fusionImpact.adjustedScore,
            factors: evaluation.factors,
            details: evaluation.details,
          },
          prisma
        );

        if (!existing || existing.score !== record.score) {
          stats.updated += 1;
          stats.deltas.push({
            clinicianId: clinician.id,
            previousScore: existing?.score ?? null,
            currentScore: record.score,
          });
          const delta = existing ? record.score - existing.score : null;
          console.info(
            `[CredentialRiskJob] ${clinician.id} score ${existing?.score ?? 'n/a'} → ${
              record.score
            }${delta !== null ? ` (Δ ${delta >= 0 ? '+' : ''}${delta})` : ''}${
              fusionImpact.modifier
                ? ` [fusion modifier ${fusionImpact.modifier >= 0 ? '+' : ''}${fusionImpact.modifier}]`
                : ''
            }`
          );
        } else {
          stats.unchanged += 1;
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : `Unknown error: ${String(error)}`;
        stats.errors.push(`[${clinician.id}] ${message}`);
        console.error(`[CredentialRiskJob] Failed for ${clinician.id}:`, message);
      }
    }
  } finally {
    stats.finishedAt = new Date();
  }

  return stats;
}

if (require.main === module) {
  runDailyCredentialRiskJob()
    .then((result) => {
      console.log('[CredentialRiskJob] Completed', {
        processed: result.processed,
        updated: result.updated,
        unchanged: result.unchanged,
        errors: result.errors.length,
      });
      process.exit(result.errors.length ? 1 : 0);
    })
    .catch((error) => {
      console.error('[CredentialRiskJob] Fatal error', error);
      process.exit(1);
    });
}

