/**
 * B117C-FEEDS-034: Directory badge API: 'Verified via FHIR Pipeline' evidence flag + URL
 * B128C-FEEDS-034: Enhanced directory badge API with comprehensive evidence + URL
 *
 * Returns evidence flag and link for a provider if they have been verified via FHIR Pipeline.
 * The badge is gated by evidence - only shows if there's a successful FHIR pipeline run.
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
export const fhirBadgeRouter = Router();

/**
 * GET /compliance/fhir-badge/:npi
 *
 * Returns evidence flag and link for FHIR Pipeline verification
 *
 * Response:
 * {
 *   verified: boolean,
 *   evidenceId?: string,
 *   runId?: string,
 *   runUrl?: string,
 *   verifiedAt?: string
 * }
 */
fhirBadgeRouter.get('/compliance/fhir-badge/:npi', async (req: Request, res: Response) => {
  try {
    const { npi } = req.params;

    if (!npi || !/^\d{10}$/.test(npi)) {
      return res.status(400).json({
        error: 'invalid_npi',
        error_description: 'NPI must be a 10-digit number',
      });
    }

    // Check for FHIR pipeline agent runs
    // Look for AgentRun entries with agentName containing 'FHIR' or 'fhir'
    // and status 'ok' for this NPI
    const fhirRuns = await prisma.agentRun.findMany({
      where: {
        npi: npi,
        agentName: {
          contains: 'FHIR',
          mode: 'insensitive',
        },
        status: 'ok',
      },
      orderBy: {
        finishedAt: 'desc',
      },
      take: 1,
    });

    // Also check for evidence linked to this NPI via metadata
    const evidence = await prisma.evidence.findFirst({
      where: {
        metadata: {
          path: ['fhirVerifiedNpi'],
          equals: npi,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // If we have a successful FHIR run or evidence, return verified status
    if (fhirRuns.length > 0 || evidence) {
      const run = fhirRuns[0];
      const runId = run?.id || evidence?.id;
      const runUrl = runId ? `/api/agents/runs/${runId}` : `/api/evidence/registry/${evidence?.id}`;
      const verifiedAt = run?.finishedAt || evidence?.createdAt;

      // B128C-FEEDS-034: Enhanced response with complete evidence data
      return res.json({
        verified: true,
        evidenceId: evidence?.id,
        runId: run?.id,
        runUrl: runUrl || `/api/evidence/registry/${evidence?.id}`,
        verifiedAt: verifiedAt ? new Date(verifiedAt).toISOString() : undefined,
        evidence: evidence ? {
          id: evidence.id,
          doi: evidence.doi,
          title: evidence.title,
          abstract: evidence.abstract,
          hash: evidence.hash,
          chainTxHash: evidence.chainTxHash,
        } : undefined,
        // B128C-FEEDS-034: Evidence flag and URL for FE consumption
        evidenceFlag: true,
        evidenceUrl: evidence?.id ? `/api/evidence/registry/${evidence.id}` : undefined,
        badge: {
          type: 'fhir_pipeline_verified',
          label: 'Verified via FHIR Pipeline',
          url: runUrl || `/api/evidence/registry/${evidence?.id}`,
          issuedAt: verifiedAt ? new Date(verifiedAt).toISOString() : undefined,
          npi,
        },
      });
    }

    // No FHIR verification found
    res.json({
      verified: false,
    });
  } catch (error) {
    console.error('FHIR badge lookup error:', error);
    res.status(500).json({
      error: 'lookup_failed',
      error_description: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

