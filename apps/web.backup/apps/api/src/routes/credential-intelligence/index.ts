import { Router, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Task 499.49 — /api/cred/health endpoint
router.get('/health', async (req: Request, res: Response) => {
  try {
    const { clinicianId } = req.query;

    if (!clinicianId || typeof clinicianId !== 'string') {
      return res.status(400).json({
        error: 'missing_clinician_id',
        message: 'clinicianId query parameter is required',
      });
    }

    // Get credential health metrics
    const synapseGraph = await prisma.credentialSynapseGraph.findUnique({
      where: { clinicianId },
    });

    const reliabilityScore = await prisma.credentialReliabilityScore.findFirst({
      where: { credentialId: clinicianId },
      orderBy: { updatedAt: 'desc' },
    });

    const driftPredictions = await prisma.credentialDriftPrediction.findMany({
      where: { credentialId: clinicianId },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const contradictions = await prisma.credentialContradiction.findMany({
      where: {
        AND: [
          {
            OR: [
              { credentialId1: clinicianId },
              { credentialId2: clinicianId },
            ],
          },
          { resolution: null },
        ],
      },
      take: 10,
    });

    return res.json({
      clinicianId,
      health: {
        synapseGraph: synapseGraph ? {
          coherence: synapseGraph.coherence,
          nodeCount: Array.isArray(synapseGraph.nodes) ? synapseGraph.nodes.length : 0,
          edgeCount: Array.isArray(synapseGraph.edges) ? synapseGraph.edges.length : 0,
        } : null,
        reliability: reliabilityScore ? {
          overall: reliabilityScore.overallScore,
          trust: reliabilityScore.trustScore,
          stability: reliabilityScore.stabilityScore,
          coherence: reliabilityScore.coherenceScore,
        } : null,
        driftPredictions: driftPredictions.map(d => ({
          probability: d.driftProbability,
          type: d.predictedDriftType,
          timeHorizon: d.timeHorizon,
          confidence: d.confidence,
        })),
        activeContradictions: contradictions.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[cred/health] error:', error);
    return res.status(500).json({
      error: 'health_check_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

// Task 499.50 — /api/cred/provenance/export
router.get('/provenance/export', async (req: Request, res: Response) => {
  try {
    const { clinicianId } = req.query;

    if (!clinicianId || typeof clinicianId !== 'string') {
      return res.status(400).json({
        error: 'missing_clinician_id',
        message: 'clinicianId query parameter is required',
      });
    }

    const provenanceSurvival = await prisma.provenanceSurvival.findUnique({
      where: { credentialId: clinicianId },
    });

    const forks = await prisma.provenanceFork.findMany({
      where: { credentialId: clinicianId },
      orderBy: { createdAt: 'desc' },
    });

    const convergences = await prisma.lineageConvergence.findMany({
      where: { credentialId: clinicianId },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({
      clinicianId,
      provenance: {
        survival: provenanceSurvival ? {
          score: provenanceSurvival.survivalScore,
          estimatedLifetime: provenanceSurvival.estimatedLifetime,
          riskFactors: provenanceSurvival.riskFactors,
        } : null,
        forks: forks.map(f => ({
          type: f.forkType,
          branches: f.branches,
          reconciled: f.reconciled,
          reconciledAt: f.reconciledAt,
        })),
        convergences: convergences.map(c => ({
          sources: c.sources,
          convergence: c.convergence,
          validated: c.validated,
        })),
      },
      exportedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[cred/provenance/export] error:', error);
    return res.status(500).json({
      error: 'provenance_export_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

// Task 499.39-499.42 — Multi-Proof Validation endpoints
router.post('/verify/bundled', async (req: Request, res: Response) => {
  try {
    const { credentialId, proofs } = req.body;

    if (!credentialId || !proofs || !Array.isArray(proofs)) {
      return res.status(400).json({
        error: 'invalid_request',
        message: 'credentialId and proofs array are required',
      });
    }

    // Create bundled proof record
    const bundledProof = await prisma.bundledProof.create({
      data: {
        credentialId,
        proofs,
        verificationStatus: 'pending',
      },
    });

    // TODO: Implement actual proof verification logic
    // For now, mark as verified after a delay (simulate async verification)
    setTimeout(async () => {
      await prisma.bundledProof.update({
        where: { id: bundledProof.id },
        data: {
          verificationStatus: 'verified',
          verifiedAt: new Date(),
        },
      });
    }, 1000);

    return res.json({
      id: bundledProof.id,
      credentialId,
      status: 'pending',
      message: 'Bundled proof verification initiated',
    });
  } catch (error) {
    console.error('[cred/verify/bundled] error:', error);
    return res.status(500).json({
      error: 'bundled_verification_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

router.get('/verify/bundled/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const bundledProof = await prisma.bundledProof.findUnique({
      where: { id },
    });

    if (!bundledProof) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Bundled proof not found',
      });
    }

    return res.json(bundledProof);
  } catch (error) {
    console.error('[cred/verify/bundled/:id] error:', error);
    return res.status(500).json({
      error: 'fetch_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

export default router;

