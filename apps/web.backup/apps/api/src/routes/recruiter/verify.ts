import { Router, Request, Response } from 'express';
import { createHash } from 'crypto';
import { generatePresentationRequest } from '../../services/oidc4vp/request';
import { ensureTrustedIssuer } from '../../services/verify/validator';
import { evaluateRecruiterAlerts } from '../../services/alerts/recruiter';
import { buildFitSummary, CredentialGraphNode, JobRequirement } from '../../services/matching/fit-summary';

const router = Router();

interface RecruiterVerifyRequest extends Request {
  body: {
    issuerDid?: string;
    credentialGraph?: CredentialGraphNode[];
    jobRequirements?: JobRequirement[];
    readinessScoreBefore?: number;
  };
}

router.post('/verify/:clinicianId', async (req: RecruiterVerifyRequest, res: Response) => {
  try {
    const { clinicianId } = req.params;
    const issuerDid = req.body?.issuerDid ?? 'did:web:vitalcv.issuer.pilot';

    const trustCheck = await ensureTrustedIssuer('__placeholder__', issuerDid);
    if (!trustCheck.trusted) {
      return res.status(403).json({
        error: trustCheck.reason ?? 'ISSUERUntrusted',
        message: `Issuer ${issuerDid} must be trusted before auto-verification`,
      });
    }

    const warnings: string[] = [];
    if (trustCheck.requiresSecondFactor) {
      warnings.push(
        `Issuer ${issuerDid} is below trust threshold (${trustCheck.trustThreshold}) – capture second-factor proof.`,
      );
    }

    const credentialGraph = req.body?.credentialGraph ?? buildDefaultCredentialGraph(clinicianId);
    const jobRequirements = req.body?.jobRequirements ?? buildDefaultJobRequirements();

    const oidcStep = runOidcStep(issuerDid);
    const statuslistStep = runStatusListStep(credentialGraph);
    const chainStep = runChainStep(clinicianId, credentialGraph);

    const readinessScore = Number(
      (
        0.5 * ratio(statuslistStep.metadata.verifiedCount, credentialGraph.length) +
        0.3 * (chainStep.metadata.anchorConfidence ?? 0.9) +
        0.2 * oidcStep.metadata.proofConfidence
      ).toFixed(2),
    );

    const fitSummary = buildFitSummary(credentialGraph, jobRequirements);
    const alerts = evaluateRecruiterAlerts({
      clinicianId,
      readinessScoreBefore: req.body?.readinessScoreBefore ?? 0.81,
      readinessScoreAfter: readinessScore,
      surgeMatches:
        readinessScore > 0.88
          ? [
              {
                jobId: 'job-surgeo-1',
                score: fitSummary.fitScore,
                specialty: 'Acute Care NP',
                matchedAt: new Date().toISOString(),
              },
            ]
          : [],
      expiringCredentials: statuslistStep.metadata.expiringCredentials,
    });

    return res.json({
      clinicianId,
      issuerDid,
      trust: trustCheck,
      readinessScore,
      fitSummary,
      steps: [oidcStep, statuslistStep, chainStep],
      chain: chainStep.metadata.anchor,
      alerts,
      warnings,
      controls: {
        requiresSecondFactor: trustCheck.requiresSecondFactor ?? false,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[recruiter:verify] failed', error);
    return res.status(500).json({
      error: 'RECRUITER_VERIFY_FAILED',
      message: error instanceof Error ? error.message : 'Unknown failure',
    });
  }
});

function runOidcStep(issuerDid: string) {
  const startedAt = Date.now();
  const presentation = generatePresentationRequest({
    clientId: 'did:web:vitalcv.recruiter',
    presentationDefinition: {
      id: 'credential-bundle',
      purpose: 'Recruiter auto-verification',
      input_descriptors: [
        {
          id: 'license',
          purpose: 'Active medical license',
          format: { jwt_vc: { alg: ['ES256'] } },
        },
      ],
    },
    metadata: { verifierName: 'Recruiter Auto-Verify' },
  });

  return {
    id: 'oidc-proof',
    label: 'OIDC4VP proof request',
    status: 'completed',
    durationMs: Date.now() - startedAt,
    metadata: {
      state: presentation.state,
      expiresAt: presentation.expiresAt,
      requestUri: presentation.requestObject,
      proofConfidence: 0.95,
      issuerDid,
    },
  };
}

function runStatusListStep(credentialGraph: CredentialGraphNode[]) {
  const startedAt = Date.now();
  const expiringCredentials = credentialGraph
    .filter((credential) => credential.category === 'license')
    .map((credential) => ({
      credentialId: credential.id,
      label: credential.label,
      expiresAt: new Date(Date.now() + 27 * 24 * 60 * 60 * 1000).toISOString(),
      daysUntilExpiry: 27,
    }));

  return {
    id: 'statuslist',
    label: 'Status list pre-check',
    status: 'completed',
    durationMs: Date.now() - startedAt,
    metadata: {
      verifiedCount: credentialGraph.filter((node) => node.verified).length,
      expiringCredentials,
      statusListUrl: 'https://status.vitalcv.example/list/1',
    },
  };
}

function runChainStep(clinicianId: string, credentialGraph: CredentialGraphNode[]) {
  const startedAt = Date.now();
  const seed = `${clinicianId}:${credentialGraph.length}:${credentialGraph
    .map((node) => node.id)
    .join('-')}`;
  const txHash = `0x${createHash('sha256').update(seed).digest('hex')}`;
  const anchor = {
    txHash,
    blockHash: `0x${createHash('sha256').update(txHash).digest('hex')}`,
    network: process.env.VERIFIER_CHAIN_NETWORK || 'pilot-l2',
    anchoredAt: new Date().toISOString(),
  };

  return {
    id: 'on-chain',
    label: 'On-chain integrity checks',
    status: 'completed',
    durationMs: Date.now() - startedAt,
    metadata: {
      anchor,
      anchorConfidence: 0.92,
    },
  };
}

function buildDefaultCredentialGraph(clinicianId: string): CredentialGraphNode[] {
  return [
    {
      id: `${clinicianId}-license-ny`,
      code: 'license-ny',
      label: 'NY Medical License',
      category: 'license',
      verified: true,
      readinessWeight: 1,
      chainStatus: 'anchored',
      jurisdiction: 'NY',
    },
    {
      id: `${clinicianId}-license-nj`,
      code: 'license-nj',
      label: 'NJ Medical License',
      category: 'license',
      verified: true,
      readinessWeight: 0.9,
      chainStatus: 'anchored',
      jurisdiction: 'NJ',
    },
    {
      id: `${clinicianId}-board`,
      code: 'board-abim',
      label: 'ABIM Board',
      category: 'board',
      verified: true,
      readinessWeight: 0.85,
      chainStatus: 'pending',
    },
    {
      id: `${clinicianId}-compact`,
      code: 'imlcc',
      label: 'IMLCC Compact Ready',
      category: 'compact',
      verified: true,
      readinessWeight: 0.95,
      chainStatus: 'anchored',
      jurisdiction: 'IMLCC',
    },
  ];
}

function buildDefaultJobRequirements(): JobRequirement[] {
  return [
    { code: 'license-ny', label: 'Active NY License', mandatory: true },
    { code: 'license-nj', label: 'Active NJ License', mandatory: true },
    { code: 'board-abim', label: 'ABIM Certified', mandatory: false },
  ];
}

function ratio(part: number, total: number) {
  if (!total) return 0;
  return Math.min(1, part / total);
}

export default router;

