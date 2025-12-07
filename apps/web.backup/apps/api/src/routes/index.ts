import { Router, type Request, type Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { buildMasterCredentialIndex } from '../services/indexer/build-index';
import { diffIndexSnapshots } from '../services/indexer/diff';
import { reconcileMasterCredentialIndex } from '../services/indexer/reconcile';
import { runCredentialFusion } from '../services/fusion/pipeline';
import { runIdentityFusion } from '../services/identity/pipeline';
import type { IdentityFusionPayload } from '../services/identity/types';
import multiIssuerRouter from './issuer/multi';
import hrisRouter from './hris';
import credentialFabricRouter from './credentials/fabric';
import trustAnchorsRouter from './trust/anchors';
import trustTrajectoryRouter from './trust/trajectory';
import observabilityGridRouter from './observability/grid';
import uxConfigRouter from './ux/config';
import workforceGridRouter from './workforce/grid';
import walletInteropRouter from './wallet/interop';
import auditProofRouter from './audit/proof';
import lifecyclePanelRouter from './lifecycle/panel';
import safetyGraphRouter from './safety/graph';
import reputationLayersRouter from './reputation/layers';
import regulatoryInteropRouter from './regulatory/interop';
import regulatoryOverviewRouter from './regulatory/overview';
import pathwayGeneratorRouter from './pathway/generator';
import employerOnboardingRouter from './onboarding/employer';
import identityContinuityRouter from './identity/continuity';
import passportRouter from './passport/digitalLicense';
import routingRouter from './routing/workforce';
import identityHardeningRouter from './identity/hardening';
import employerTrustRouter from './trust/employer';
import compressionRouter from './compression/index';
import liquidityRouter from './marketplace/liquidity';
import facilityMarketplaceRouter from './marketplace/facility';
import clinicianMarketplaceRouter from './marketplace/clinician';
import marketplaceTransactionsRouter from './marketplace/transactions';
import timelineRouter from './timeline/index';
import safetyExchangeRouter from './safety-exchange/index';
import automationKernelRouter from './automation-kernel/index';
import verifierCheckRouter from './verifier/check';
import observabilityMeshRouter from './observability-mesh/index';
import workforceAccelerationRouter from './workforce-acceleration/index';
import regulatoryIntelligenceRouter from './regulatory-intelligence';
import flexibilityRouter from './flexibility';
import complianceNavigatorRouter from './compliance-navigator';
import workforceSentimentRouter from './workforce-sentiment';
import credentialFusionFabricRouter from './credential-fusion-fabric';
import recoveryMeshRouter from './recovery-mesh';
import routingKernelRouter from './routing-kernel';
import credentialAssuranceRouter from './credential-assurance';
import opsMatrixRouter from './ops-matrix';
import complianceHorizonRouter from './compliance-horizon';
import talentResonanceRouter from './talent-resonance';
import reconciliationRouter from './reconciliation';
import trustElasticityRouter from './trust/elasticity';
import performanceStabilityRouter from './stability/performance';
import credentialContinuumRouter from './continuum/credential';
import complianceImpactRouter from './compliance/impact';
import clinicianEconomicYieldRouter from './economics/yield';
import verificationStateMachineRouter from './verification/state-machine';
import contractHealthRouter from './contracts/health';
import latencyThroughputRouter from './latency-throughput';
import regScenariosRouter from './reg-scenarios';
import readinessGaugeRouter from './readiness-gauge';
import aiSentinelRouter from './ai-sentinel';
import trustSynthesisRouter from './trust-synthesis';
import credentialCoherenceRouter from './credential-coherence';
import talentEquilibriumRouter from './talent-equilibrium';
import regImpactGridRouter from './reg-impact-grid';
import workforceErosionRouter from './workforce-erosion';
import attestationReinforcementRouter from './attestation-reinforcement';
import consensusVectorRouter from './consensus-vector';
import workforceMaturityRouter from './workforce-maturity';
import identityFabricRouter from './identity-fabric';
import ruleDiffRouter from './rule-diff';
import predictiveFlowRouter from './predictive-flow';
import riskHardeningRouter from './risk-hardening';
import temporalAlignmentRouter from './temporal-alignment';
import employerBehaviorTensorRouter from './employer-behavior-tensor';
import competencyRoleFusionRouter from './competency-role-fusion';
import regulatoryConfidenceRouter from './regulatory-confidence';
import workforceVolatilityRouter from './workforce-volatility';
import chainConsensusReactorRouter from './chain-consensus-reactor';
import mobilityIntelligenceRouter from './mobility/intelligence';
import trustlineReactorRouter from './trustline/reactor';
import credentialIntelligenceRouter from './credential-intelligence';
import employerIntegrityRouter from './employer-integrity';
import workforceBrainRouter from './workforce-brain';
import trustFabricRouter from './trust/fabric';
import employerFrictionRouter from './employer/friction';
import workforceNeuroeconRouter from './workforce/neuroecon';
import stateAgentRouter from './state-agent/report';
import stateAgentWaveRouter from './state-agent/wave';
import stateAgentSnapshotsRouter from './state-agent/snapshots';

const router = Router();
const prisma = new PrismaClient();
const DEFAULT_SELF_ID = process.env.NEXT_PUBLIC_WALLET_CLINICIAN_ID ?? process.env.DEFAULT_CLINICIAN_ID;

router.get('/index/:clinicianId', async (req: Request, res: Response) => {
  const resolvedId = resolveClinicianId(req.params.clinicianId);
  if (!resolvedId) {
    return res.status(400).json({
      error: 'invalid_clinician_id',
      message: 'Provide a clinicianId path parameter or configure DEFAULT_CLINICIAN_ID.',
    });
  }

  const includeDiff = String(req.query.diff ?? 'false').toLowerCase() === 'true';
  const reconcileRequested = String(req.query.reconcile ?? 'false').toLowerCase() === 'true';

  try {
    if (reconcileRequested) {
      const reconciliation = await reconcileMasterCredentialIndex(resolvedId, { prisma });
      return res.json(buildResponsePayload(reconciliation.snapshot, reconciliation.diff, reconciliation.mismatches));
    }

    const previousRows = includeDiff
      ? await prisma.masterCredentialIndex.findMany({ where: { clinicianId: resolvedId } })
      : [];
    const snapshot = await buildMasterCredentialIndex(resolvedId, { prisma });
    const diff = includeDiff ? diffIndexSnapshots(resolvedId, previousRows, snapshot.rows) : null;

    return res.json(buildResponsePayload(snapshot, diff, null));
  } catch (error) {
    console.error('[api:index] failed', error);
    return res.status(500).json({
      error: 'index_generation_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

router.get('/fusion/:clinicianId', async (req: Request, res: Response) => {
  const resolvedId = resolveClinicianId(req.params.clinicianId);
  if (!resolvedId) {
    return res.status(400).json({
      error: 'invalid_clinician_id',
      message: 'Provide a clinicianId path parameter or configure DEFAULT_CLINICIAN_ID.',
    });
  }

  const includeBundle = String(req.query.bundle ?? 'false').toLowerCase() === 'true';

  try {
    const fusion = await runCredentialFusion(resolvedId, {
      prisma,
      includeBundle,
    });
    return res.json({
      clinicianId: fusion.clinicianId,
      generatedAt: fusion.generatedAt,
      fused: fusion.fused,
      sources: fusion.sources,
      conflicts: fusion.conflicts,
      resolutions: fusion.resolutions,
      validations: fusion.validations,
      anchor: fusion.anchor ?? null,
      bundle: includeBundle ? fusion.fhirBundle ?? null : undefined,
    });
  } catch (error) {
    console.error('[api:fusion] failed', error);
    return res.status(500).json({
      error: 'fusion_pipeline_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

router.get('/identity/fusion/:clinicianId', async (req: Request, res: Response) => {
  const resolvedId = resolveClinicianId(req.params.clinicianId);
  if (!resolvedId) {
    return res.status(400).json({
      error: 'invalid_clinician_id',
      message: 'Provide a clinicianId path parameter or configure DEFAULT_CLINICIAN_ID.',
    });
  }

  const refresh = String(req.query.refresh ?? 'false').toLowerCase() === 'true';

  try {
    let snapshot = await prisma.identityFusionSnapshot.findFirst({
      where: { clinicianId: resolvedId },
      orderBy: { timestamp: 'desc' },
    });
    let anchor = null;

    if (!snapshot || refresh) {
      const fusion = await runIdentityFusion(resolvedId, { prisma });
      anchor = fusion.anchor ?? null;
      snapshot = await prisma.identityFusionSnapshot.findFirst({
        where: { clinicianId: resolvedId },
        orderBy: { timestamp: 'desc' },
      });
    }

    if (!snapshot) {
      return res.status(404).json({
        error: 'identity_snapshot_missing',
        message: 'Identity fusion snapshot not available for this clinician.',
      });
    }

    const payload = snapshot.fused as IdentityFusionPayload;
    const events = await prisma.identityEventLog.findMany({
      where: { clinicianId: resolvedId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return res.json({
      clinicianId: resolvedId,
      snapshotId: snapshot.id,
      generatedAt: payload.generatedAt,
      payload,
      confidence: snapshot.confidence,
      anchor,
      events,
    });
  } catch (error) {
    console.error('[api:identity-fusion] failed', error);
    return res.status(500).json({
      error: 'identity_fusion_failed',
      message: error instanceof Error ? error.message : 'Unexpected error',
    });
  }
});

function buildResponsePayload(
  snapshot: Awaited<ReturnType<typeof buildMasterCredentialIndex>>,
  diff: ReturnType<typeof diffIndexSnapshots> | null,
  reconciliation: ReturnType<typeof reconcileMasterCredentialIndex>['mismatches'] | null,
) {
  return {
    clinicianId: snapshot.clinicianId,
    generatedAt: snapshot.generatedAt,
    index: snapshot.map,
    rows: snapshot.rows,
    statuses: snapshot.stats,
    snapshotHash: snapshot.snapshotHash,
    chainAnchors: {
      snapshot: snapshot.anchor ?? null,
      diff: diff?.anchor ?? null,
    },
    diff,
    reconciliation,
  };
}

function resolveClinicianId(raw: string | undefined): string | null {
  if (!raw) return null;
  if (raw === 'self') {
    return DEFAULT_SELF_ID ?? null;
  }
  return raw;
}

router.use('/issuer', multiIssuerRouter);
router.use(hrisRouter);
router.use(credentialFabricRouter);
router.use(trustAnchorsRouter);
router.use(observabilityGridRouter);
router.use(uxConfigRouter);
router.use(workforceGridRouter);
router.use(walletInteropRouter);
router.use(auditProofRouter);
router.use(lifecyclePanelRouter);
router.use('/safety/graph', safetyGraphRouter);
router.use('/reputation/layers', reputationLayersRouter);
router.use('/regulatory/interop', regulatoryInteropRouter);
router.use('/api/regulatory/overview', regulatoryOverviewRouter);
router.use('/pathway', pathwayGeneratorRouter);
router.use('/onboarding/employer', employerOnboardingRouter);
router.use('/identity/continuity', identityContinuityRouter);
router.use('/passport', passportRouter);
router.use('/routing', routingRouter);
router.use('/identity/hardening', identityHardeningRouter);
router.use('/trust/employer', employerTrustRouter);
router.use('/compression', compressionRouter);
router.use('/marketplace/liquidity', liquidityRouter);
router.use('/marketplace/facility', facilityMarketplaceRouter);
router.use('/marketplace/clinician', clinicianMarketplaceRouter);
router.use('/marketplace/transactions', marketplaceTransactionsRouter);
router.use('/timeline', timelineRouter);
router.use('/safety-exchange', safetyExchangeRouter);
router.use('/automation-kernel', automationKernelRouter);
router.use('/verifier/check', verifierCheckRouter);
router.use('/observability-mesh', observabilityMeshRouter);
router.use('/workforce-acceleration', workforceAccelerationRouter);
router.use('/api', regulatoryIntelligenceRouter);
router.use('/api', flexibilityRouter);
router.use('/api', complianceNavigatorRouter);
router.use('/api', workforceSentimentRouter);
router.use('/api', credentialFusionFabricRouter);
router.use('/api', recoveryMeshRouter);
router.use('/api/routing-kernel', routingKernelRouter);
router.use('/api/credential-assurance', credentialAssuranceRouter);
router.use('/api/ops-matrix', opsMatrixRouter);
router.use('/api/compliance-horizon', complianceHorizonRouter);
router.use('/api/talent-resonance', talentResonanceRouter);
router.use('/api/reconciliation', reconciliationRouter);
router.use('/api/trust/elasticity', trustElasticityRouter);
router.use('/api/trust/trajectory', trustTrajectoryRouter);
router.use('/api/stability/performance', performanceStabilityRouter);
router.use('/api/continuum', credentialContinuumRouter);
router.use('/api/compliance/impact', complianceImpactRouter);
router.use('/api/economics/yield', clinicianEconomicYieldRouter);
router.use('/api/verification/state-machine', verificationStateMachineRouter);
router.use('/api/contracts/health', contractHealthRouter);
router.use('/api/latency', latencyThroughputRouter);
router.use('/api/reg-scenarios', regScenariosRouter);
router.use('/api/readiness/gauge', readinessGaugeRouter);
router.use('/api/ai-sentinel', aiSentinelRouter);
router.use('/api/trust-synthesis', trustSynthesisRouter);
router.use('/api/coherence', credentialCoherenceRouter);
router.use('/api/talent-equilibrium', talentEquilibriumRouter);
router.use('/api/reg-impact-grid', regImpactGridRouter);
router.use('/api/workforce-erosion', workforceErosionRouter);
router.use('/api/attestation-reinforcement', attestationReinforcementRouter);
router.use('/api/consensus-vector', consensusVectorRouter);
router.use('/api/workforce-maturity', workforceMaturityRouter);
router.use('/api/identity-fabric', identityFabricRouter);
router.use('/api/rule-diff', ruleDiffRouter);
router.use('/api/predictive-flow', predictiveFlowRouter);
router.use('/api/risk-hardening', riskHardeningRouter);
router.use('/api/temporal-alignment', temporalAlignmentRouter);
router.use('/api/employer-behavior-tensor', employerBehaviorTensorRouter);
router.use('/api/competency-role-fusion', competencyRoleFusionRouter);
router.use('/api/regulatory-confidence', regulatoryConfidenceRouter);
router.use('/api/workforce-volatility', workforceVolatilityRouter);
router.use('/api/chain-consensus-reactor', chainConsensusReactorRouter);
router.use('/api/mobility', mobilityIntelligenceRouter);
router.use('/api/trustline', trustlineReactorRouter);
router.use('/api/cred', credentialIntelligenceRouter);
router.use('/api/employer', employerIntegrityRouter);
router.use('/api/routing', workforceBrainRouter);
router.use('/api', trustFabricRouter);
router.use('/api', employerFrictionRouter);
router.use('/api', workforceNeuroeconRouter);
router.use('/api/state-agent', stateAgentRouter);
router.use('/api/state-agent/wave', stateAgentWaveRouter);
router.use('/api/state-agent/snapshots', stateAgentSnapshotsRouter);

export default router;



