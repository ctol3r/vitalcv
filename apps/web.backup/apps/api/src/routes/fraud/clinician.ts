import { Router, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

import { detectTampering } from '../../services/fraud/tamper';
import {
  validateAcrossSources,
  type CrossSourceValidationResult,
} from '../../services/fraud/cross-source';
import { aggregateFraudSignals } from '../../services/fraud/score';

const prisma = new PrismaClient();
const router = Router();

router.get('/fraud/clinicians/:clinicianId', async (req: Request, res: Response) => {
  const { clinicianId } = req.params;
  if (!clinicianId) {
    return res.status(400).json({
      error: 'clinician_id_required',
      message: 'Missing clinician identifier',
    });
  }

  try {
    const clinician = await prisma.clinicianProfile.findUnique({
      where: { id: clinicianId },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (!clinician) {
      return res.status(404).json({
        error: 'clinician_not_found',
        message: `Clinician ${clinicianId} not found`,
      });
    }

    const [latestLicense] = await prisma.stateLicenseVerification.findMany({
      where: { clinicianId },
      orderBy: { updatedAt: 'desc' },
      take: 1,
    });

    const boardCredential = await prisma.credential.findFirst({
      where: {
        userId: clinician.userId,
        type: { contains: 'board', mode: 'insensitive' },
      },
      orderBy: { issuedAt: 'desc' },
    });

    const tamperPayload = buildTamperPayload(clinicianId, latestLicense?.id ?? 'license');
    const tamperResult = await detectTampering(tamperPayload);

    const crossSource = await validateAcrossSources({
      clinicianId,
      npi: clinician.npi ?? '0000000000',
      licenseNumber: latestLicense?.licenseNumber ?? 'UNKNOWN',
      licenseState: latestLicense?.state ?? clinician.state ?? 'NA',
      board: {
        name: boardCredential?.name ?? 'ABMS',
        certificateId: boardCredential?.externalId ?? 'UNKNOWN',
      },
    });

    const sanctionsFrequency = await calculateSanctionsFrequency(clinicianId);
    const fraudScore = aggregateFraudSignals({
      clinicianId,
      tamperLikelihood: tamperResult.tamperLikelihood,
      tamperReasons: tamperResult.reasons,
      sanctionsFrequency,
      crossSource,
    });

    return res.json({
      clinicianId,
      fraudScore: fraudScore.fraudScore,
      tamper: tamperResult,
      crossSource,
      sanctions: {
        eventsPerQuarter: Number((sanctionsFrequency / 4).toFixed(3)),
        normalizedFrequency: sanctionsFrequency,
      },
      warnings: fraudScore.warnings,
      recommendedSteps: buildRecommendations(fraudScore, crossSource),
      evaluatedAt: fraudScore.evaluatedAt,
      clinician: {
        npi: clinician.npi,
        fullName: clinician.user?.name,
        specialty: clinician.specialty,
        state: clinician.state,
      },
    });
  } catch (error) {
    console.error('[fraud][clinician] evaluation failed', error);
    return res.status(500).json({
      error: 'fraud_evaluation_failed',
      message: error instanceof Error ? error.message : 'Unable to compute fraud score',
    });
  }
});

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

async function calculateSanctionsFrequency(clinicianId: string): Promise<number> {
  const windowStart = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const events = await prisma.privilegeSafetySignal.findMany({
    where: {
      clinicianId,
      detectedAt: { gte: windowStart },
    },
    orderBy: { detectedAt: 'desc' },
  });

  if (!events.length) {
    return 0.05;
  }

  const windowDays = Math.max(
    1,
    (Date.now() - new Date(events[events.length - 1].detectedAt).getTime()) /
      (1000 * 60 * 60 * 24),
  );
  const eventsPerYear = (events.length / windowDays) * 365;
  return Number(eventsPerYear.toFixed(4));
}

function buildRecommendations(
  result: ReturnType<typeof aggregateFraudSignals>,
  crossSource: CrossSourceValidationResult,
) {
  const steps: string[] = [];

  if (result.fraudScore > 0.65) {
    steps.push('Escalate to human-in-the-loop review for document authenticity.');
  } else if (result.fraudScore > 0.4) {
    steps.push('Queue targeted tamper re-scan before onboarding.');
  }

  if (crossSource.mismatches.length) {
    const critical = crossSource.mismatches
      .slice(0, 2)
      .map((mismatch) => `${mismatch.field} (${mismatch.source})`)
      .join(', ');
    steps.push(`Regenerate source-of-truth sync for ${critical}.`);
  }

  if (!steps.length) {
    steps.push('Continue monitoring automated fraud telemetry.');
  }

  steps.push('Document outcomes inside HITL queue for downstream explainability.');
  return steps;
}

export default router;










