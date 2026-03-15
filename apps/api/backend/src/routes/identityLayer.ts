/**
 * identityLayer.ts — Canonical Clinician Identity API
 *
 * GET  /api/identity/:npi                    — canonical identity + all claims
 * GET  /api/identity/:npi/claims             — all claims with full provenance
 * GET  /api/identity/:npi/claims/:claimId    — single claim + receipt
 * GET  /api/identity/:npi/receipts           — all verification receipts
 * POST /api/identity/:npi/ingest             — trigger multi-source ingestion
 * GET  /api/identity/sources                 — source catalog
 * GET  /api/identity/sources/:id             — single source definition
 * GET  /api/identity/:npi/monitor            — run all alert rules, check SLA freshness
 * POST /api/identity/monitor/batch           — batch monitoring across all tracked clinicians
 */

import type { Express, Request, Response } from 'express';
import {
  ingestClinicianIdentity,
  getClaimsForNpi,
  getVerificationReceiptsForNpi,
  type IngestionSources,
} from '../services/identity/identityIngestionPipeline';
import { buildIdentitySummary } from '../services/identity/evidenceModel';
import { listSources, getSource } from '../services/identity/sourceCatalog';
import { monitorClinicianIdentity, monitorAllTrackedClinicians } from '../services/identity/changeMonitor';
import { getEnrichedTrustIntelligence } from '../services/identity/trustStateBridge';
import {
  SOURCE_GOVERNANCE, enforceSourcePolicy, getSourceCautionMap,
  getBuildPriorityOrder, COMPETITIVE_POSITIONING, TRUST_TIER_COPY,
  isAutomationSafe,
} from '../services/identity/sourceGovernance';
import { getWatchtowerState, registerWatchlist } from '../services/identity/watchtowerEngine';
import { listWatchlists } from '../services/identity/watchtowerStore';
import prisma from '../graphql/prisma_client';
import { log } from '../obs/logger';

const NPI_RE    = /^\d{10}$/;
const CLAIM_RE  = /^claim_[0-9a-f]{32}$/;

// In-flight guard per NPI
const inFlight = new Set<string>();

export function registerIdentityLayerRoutes(app: Express): void {

  /**
   * GET /api/identity/sources
   * Full source catalog — what we ingest, from where, at what trust tier.
   */
  app.get('/api/identity/sources', (_req: Request, res: Response) => {
    const sources = listSources();
    res.json({
      schema:  'https://vitalcv.com/identity/v1',
      total:   sources.length,
      byTier: {
        GOLD:   sources.filter(s => s.tier === 'GOLD').length,
        SILVER: sources.filter(s => s.tier === 'SILVER').length,
        BRONZE: sources.filter(s => s.tier === 'BRONZE').length,
      },
      byPhase: [0,1,2,3,4,5].map(p => ({
        phase: p,
        count: sources.filter(s => s.phase === p).length,
        sources: sources.filter(s => s.phase === p).map(s => s.id),
      })),
      sources: sources.map(s => ({
        id:              s.id,
        name:            s.name,
        tier:            s.tier,
        phase:           s.phase,
        accessPattern:   s.accessPattern,
        refreshCadence:  s.refreshCadence,
        claimTypes:      s.claimTypes,
        liveAvailable:   s.liveAvailable,
        currentlyActive: process.env[s.envFlag] === 'true' || s.liveAvailable,
        parserVersion:   s.parserVersion,
        notes:           s.notes,
      })),
    });
  });

  /**
   * GET /api/identity/sources/:id
   * Single source definition.
   */
  app.get('/api/identity/sources/:id', (req: Request, res: Response) => {
    const src = getSource(req.params.id!);
    if (!src) { res.status(404).json({ error: `Source not found: ${req.params.id}` }); return; }
    res.json({ ...src, currentlyActive: process.env[src.envFlag] === 'true' || src.liveAvailable });
  });

  app.get('/api/identity/watchlists', async (_req: Request, res: Response) => {
    try {
      const watchlists = await listWatchlists();
      res.json({
        total: watchlists.length,
        watchlists,
      });
    } catch (err) {
      log('error', 'identity: watchlists GET failed', { error: String(err) });
      res.status(500).json({ error: 'Watchlist fetch failed' });
    }
  });

  app.post('/api/identity/watchlists', async (req: Request, res: Response) => {
    try {
      const {
        name,
        ownerOrganizationId,
        targetType,
        targetValue,
        claimType,
        fieldPath,
        severityFloor,
        suppressionWindowMinutes,
        deliveryChannels,
        webhookUrl,
        metadata,
      } = req.body ?? {};

      if (!name || typeof name !== 'string') {
        res.status(400).json({ error: 'name is required' });
        return;
      }
      if (!targetType || !['PROVIDER', 'INSTITUTION', 'CLAIM_CLASS'].includes(String(targetType))) {
        res.status(400).json({ error: 'targetType must be PROVIDER, INSTITUTION, or CLAIM_CLASS' });
        return;
      }
      if (!targetValue || typeof targetValue !== 'string') {
        res.status(400).json({ error: 'targetValue is required' });
        return;
      }

      const watchlist = await registerWatchlist({
        name,
        ...(typeof ownerOrganizationId === 'string' ? { ownerOrganizationId } : {}),
        targetType: targetType as 'PROVIDER' | 'INSTITUTION' | 'CLAIM_CLASS',
        targetValue,
        ...(typeof claimType === 'string' ? { claimType } : {}),
        ...(typeof fieldPath === 'string' ? { fieldPath } : {}),
        ...(typeof severityFloor === 'string'
          ? { severityFloor: severityFloor as 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' }
          : {}),
        ...(typeof suppressionWindowMinutes === 'number' ? { suppressionWindowMinutes } : {}),
        ...(Array.isArray(deliveryChannels)
          ? { deliveryChannels: deliveryChannels.filter((entry): entry is string => typeof entry === 'string') }
          : {}),
        ...(typeof webhookUrl === 'string' ? { webhookUrl } : {}),
        ...(metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? { metadata } : {}),
      });

      res.status(201).json({ watchlist });
    } catch (err) {
      log('error', 'identity: watchlist POST failed', { error: String(err) });
      res.status(500).json({ error: 'Watchlist creation failed' });
    }
  });

  /**
   * GET /api/identity/:npi
   *
   * Canonical clinician identity — the single resolved view of a clinician
   * from all ingested sources. Each claim shows its source and tier.
   *
   * This is Layer 4: the human-facing narrative built from Layer 2 claims.
   * Nothing here is invented — every field traces to a source artifact.
   */
  app.get('/api/identity/:npi([0-9]{10})', async (req: Request, res: Response) => {
    const { npi } = req.params;

    try {
      const claims  = await getClaimsForNpi(npi);
      const summary = buildIdentitySummary(npi, claims);

      if (claims.length === 0) {
        res.json({
          schema:   'https://vitalcv.com/identity/v1',
          npi,
          status:   'NOT_INGESTED',
          message:  'No ingested claims for this NPI. POST /api/identity/:npi/ingest to begin.',
          ingestUrl: `/api/identity/${npi}/ingest`,
          identity: null,
        });
        return;
      }

      // Build narrative from claims (Gold sources take precedence)
      const activeClaims = claims.filter(c => c.status === 'ACTIVE');
      const npiClaim     = activeClaims.find(c => c.claimType === 'NPI_IDENTITY');
      const nameClaim    = activeClaims.find(c => c.claimType === 'PERSONAL_IDENTITY');
      const specialties  = activeClaims.filter(c => c.claimType === 'SPECIALTY');
      const locations    = activeClaims.filter(c => c.claimType === 'PRACTICE_LOCATION');
      const exclusion    = activeClaims.find(c => c.claimType === 'EXCLUSION_STATUS');
      const enrollment   = activeClaims.find(c => c.claimType === 'ENROLLMENT_STATUS');
      const license      = activeClaims.find(c => c.claimType === 'LICENSE' || c.claimType === 'NURSING_LICENSE');

      const npiVal  = npiClaim?.value  as Record<string, unknown> | undefined;
      const nameVal = nameClaim?.value as Record<string, unknown> | undefined;
      const excVal  = exclusion?.value as Record<string, unknown> | undefined;
      const enrVal  = enrollment?.value as Record<string, unknown> | undefined;

      res.json({
        schema:   'https://vitalcv.com/identity/v1',
        npi,

        // Layer 3: Resolved identity fields (with source attribution)
        identity: {
          npi,
          npiStatus:      npiVal?.status ?? 'UNKNOWN',
          enumerationType: npiVal?.enumerationType ?? 'UNKNOWN',
          firstName:      nameVal?.firstName ?? null,
          lastName:       nameVal?.lastName ?? null,
          credential:     nameVal?.credential ?? npiVal?.credential ?? null,
          specialties:    specialties.map(s => {
            const v = s.value as Record<string, unknown>;
            return { code: v.taxonomyCode, description: v.taxonomyDescription, isPrimary: v.isPrimary };
          }),
          practiceStates: locations.map(l => (l.value as Record<string, unknown>).state as string),
          exclusionStatus: excVal?.excluded ? 'EXCLUDED' : excVal ? 'CLEAR' : 'NOT_CHECKED',
          exclusionMatchType: excVal?.matchType ?? null,
          medicareEnrolled: enrVal?.enrolled ?? null,
          hasActiveLicense: summary.hasActiveLicense,
          hasBoardCert:     summary.hasBoardCert,
        },

        // Claim quality metadata
        evidenceSummary: {
          claimCount:      summary.claimCount,
          goldClaimCount:  summary.goldClaimCount,
          highestTier:     summary.highestTier,
          claimsByType:    summary.claimsByType,
          lastIngestedAt:  summary.lastIngestedAt,
        },

        // Navigation links
        links: {
          claims:    `/api/identity/${npi}/claims`,
          receipts:  `/api/identity/${npi}/receipts`,
          ingest:    `/api/identity/${npi}/ingest`,
          trustState: `/api/trust-state/${npi}`,
          passport:  `/api/passport/${npi}`,
        },
      });
    } catch (err) {
      log('error', 'identity: GET failed', { npi, error: String(err) });
      res.status(500).json({ error: 'Identity fetch failed' });
    }
  });

  /**
   * GET /api/identity/:npi/claims
   *
   * All normalized claims for a clinician — the full evidence layer.
   * Every claim shows: claimType, tier, confidence, sourceId, artifactId,
   * parserVersion, derivedAt, and the claim value.
   *
   * Query: ?type=EXCLUSION_STATUS&tier=GOLD&status=ACTIVE
   */
  app.get('/api/identity/:npi([0-9]{10})/claims', async (req: Request, res: Response) => {
    const { npi } = req.params;
    const typeFilter   = typeof req.query.type === 'string' ? req.query.type : null;
    const tierFilter   = typeof req.query.tier === 'string' ? req.query.tier.toUpperCase() : null;
    const statusFilter = typeof req.query.status === 'string' ? req.query.status.toUpperCase() : null;

    try {
      let claims = await getClaimsForNpi(npi);
      if (typeFilter)   claims = claims.filter(c => c.claimType === typeFilter);
      if (tierFilter)   claims = claims.filter(c => c.tier === tierFilter);
      if (statusFilter) claims = claims.filter(c => c.status === statusFilter);

      res.json({
        npi, total: claims.length,
        filters: { type: typeFilter, tier: tierFilter, status: statusFilter },
        claims: claims.map(c => ({
          claimId:       c.claimId,
          claimType:     c.claimType,
          tier:          c.tier,
          confidence:    c.confidence,
          confidenceScore: c.confidenceScore,
          status:        c.status,
          sourceId:      c.sourceId,
          artifactId:    c.artifactId,
          parserVersion: c.parserVersion,
          derivedAt:     c.derivedAt,
          observedAt:    c.observedAt,
          validUntil:    c.validUntil,
          reviewRequired: c.reviewRequired,
          reviewReason:  c.reviewReason,
          value:         c.value,
        })),
      });
    } catch (err) {
      log('error', 'identity: claims GET failed', { npi, error: String(err) });
      res.status(500).json({ error: 'Claims fetch failed' });
    }
  });

  /**
   * GET /api/identity/:npi/claims/:claimId
   * Single claim with full provenance — the complete paper trail for one fact.
   */
  app.get('/api/identity/:npi([0-9]{10})/claims/:claimId', async (req: Request, res: Response) => {
    const { npi, claimId } = req.params;
    if (!CLAIM_RE.test(claimId ?? '')) { res.status(400).json({ error: 'Invalid claimId format' }); return; }

    try {
      const claims = await getClaimsForNpi(npi);
      const claim  = claims.find(c => c.claimId === claimId);
      if (!claim) { res.status(404).json({ error: `Claim not found: ${claimId}` }); return; }

      // Fetch the source artifact for this claim
      const artifact = await prisma.verificationArtifact.findUnique({
        where: { id: claim.artifactId },
        select: { id: true, source: true, checksum: true, createdAt: true, verifiedAt: true, rawPayload: true },
      });

      const receipts = ((artifact?.rawPayload as Record<string, unknown>)?._receipts ?? []) as unknown[];

      res.json({
        claim,
        sourceArtifact: artifact ? {
          id:         artifact.id,
          source:     artifact.source,
          checksum:   artifact.checksum,
          ingestedAt: artifact.createdAt,
          verifiedAt: artifact.verifiedAt,
          rawPayloadUrl: `/api/identity/${npi}/artifacts/${artifact.id}/raw`,
        } : null,
        receipts,
        explainability: {
          sentence: `This ${claim.claimType} claim was derived from ${claim.sourceId} (tier: ${claim.tier}) using parser ${claim.parserVersion} at ${claim.derivedAt}. Confidence: ${Math.round(claim.confidenceScore * 100)}%. Artifact checksum: ${claim.artifactChecksum?.slice(0, 16)}…`,
          reproducible: `Re-run POST /api/identity/${npi}/ingest with sources=[${claim.sourceId}] to reproduce this claim verdict.`,
        },
      });
    } catch (err) {
      log('error', 'identity: claim detail failed', { npi, claimId, error: String(err) });
      res.status(500).json({ error: 'Claim detail fetch failed' });
    }
  });

  /**
   * GET /api/identity/:npi/receipts
   * All verification receipts — the official audit paper trail.
   */
  app.get('/api/identity/:npi([0-9]{10})/receipts', async (req: Request, res: Response) => {
    const { npi } = req.params;

    try {
      const receipts = await getVerificationReceiptsForNpi(npi);

      res.json({
        npi,
        total:    receipts.length,
        receipts,
        note:     'Receipts are append-only. Every claim verdict is permanently traceable.',
      });
    } catch (err) {
      log('error', 'identity: receipts GET failed', { npi, error: String(err) });
      res.status(500).json({ error: 'Receipts fetch failed' });
    }
  });

  app.get('/api/identity/:npi([0-9]{10})/watchtower', async (req: Request, res: Response) => {
    const { npi } = req.params;

    try {
      const state = await getWatchtowerState(npi);
      res.json({
        npi,
        ...state,
      });
    } catch (err) {
      log('error', 'identity: watchtower GET failed', { npi, error: String(err) });
      res.status(500).json({ error: 'Watchtower state fetch failed' });
    }
  });

  /**
   * POST /api/identity/:npi/ingest
   *
   * Trigger multi-source ingestion for a clinician.
   * Each source runs independently; failure of one does not abort others.
   *
   * Body: { sources?: ['NPPES_API', 'OIG_LEIE', 'PECOS_PUBLIC', 'ALL'] }
   *
   * Returns: FullIngestionReport with per-source results, delta events, and identity summary.
   */
  app.post('/api/identity/:npi([0-9]{10})/ingest', async (req: Request, res: Response) => {
    const { npi } = req.params;

    if (inFlight.has(npi)) {
      res.status(202).json({ message: 'Ingestion already in progress for this NPI', npi });
      return;
    }

    const body    = req.body as Record<string, unknown>;
    const sources = Array.isArray(body.sources)
      ? body.sources.filter((s): s is IngestionSources => typeof s === 'string') as IngestionSources[]
      : ['ALL' as IngestionSources];

    inFlight.add(npi);
    try {
      const report = await ingestClinicianIdentity(npi, sources);

      // Surface critical delta events prominently
      const criticals = report.deltaEvents.filter(d => d.severity === 'CRITICAL');

      res.status(criticals.length > 0 ? 207 : 200).json({
        ...report,
        alerts: criticals.length > 0 ? {
          count:    criticals.length,
          message:  `${criticals.length} CRITICAL delta event(s) detected — immediate review required`,
          events:   criticals,
        } : null,
      });
    } catch (err) {
      log('error', 'identity: ingest failed', { npi, error: String(err) });
      res.status(500).json({ error: 'Ingestion failed', detail: String(err) });
    } finally {
      inFlight.delete(npi);
    }
  });

  /**
   * GET /api/identity/:npi/monitor
   *
   * Run all alert rules against a clinician's identity claims.
   * Checks: exclusions, license status, expiring creds, source SLA freshness.
   * Returns MonitorReport with overall health and actionable alerts.
   */
  app.get('/api/identity/:npi([0-9]{10})/monitor', async (req: Request, res: Response) => {
    const { npi } = req.params;
    try {
      const report = await monitorClinicianIdentity(npi);
      const statusCode = report.overallHealth === 'CRITICAL' ? 207 : 200;
      res.status(statusCode).json({
        schema: 'https://vitalcv.com/identity-monitor/v1',
        ...report,
      });
    } catch (err) {
      log('error', 'identity: monitor failed', { npi, error: String(err) });
      res.status(500).json({ error: 'Monitor check failed' });
    }
  });

  /**
   * POST /api/identity/monitor/batch
   *
   * Run monitoring across all tracked clinicians (those with IDENTITY_INDEX artifacts).
   * Body: { limit?: number } — defaults to 100.
   * Returns aggregate health stats + per-clinician reports.
   */
  app.post('/api/identity/monitor/batch', async (req: Request, res: Response) => {
    const body  = req.body as Record<string, unknown>;
    const limit = typeof body.limit === 'number' ? Math.min(body.limit, 500) : 100;

    try {
      const result = await monitorAllTrackedClinicians({ limit });
      res.json({
        schema: 'https://vitalcv.com/identity-monitor/v1',
        ...result,
      });
    } catch (err) {
      log('error', 'identity: batch monitor failed', { error: String(err) });
      res.status(500).json({ error: 'Batch monitor failed' });
    }
  });

  /**
   * GET /api/identity/:npi/enriched
   *
   * Identity-enriched trust intelligence — the bridge between the identity
   * layer and the trust state engine. Returns structured verdicts,
   * confidence scores, monitoring alerts, and actionable recommendations.
   *
   * Query: ?ingestIfStale=true — re-ingest sources past their SLA
   */
  app.get('/api/identity/:npi([0-9]{10})/enriched', async (req: Request, res: Response) => {
    const { npi } = req.params;
    const ingestIfStale = req.query.ingestIfStale === 'true';

    try {
      const result = await getEnrichedTrustIntelligence(npi, { ingestIfStale });
      const statusCode = result.enrichment.criticalAlerts > 0 ? 207 : 200;

      res.status(statusCode).json({
        schema: 'https://vitalcv.com/identity-enriched/v1',
        ...result,
        links: {
          identity:   `/api/identity/${npi}`,
          claims:     `/api/identity/${npi}/claims`,
          monitor:    `/api/identity/${npi}/monitor`,
          trustState: `/api/trust-state/${npi}`,
          ingest:     `/api/identity/${npi}/ingest`,
        },
      });
    } catch (err) {
      log('error', 'identity: enriched GET failed', { npi, error: String(err) });
      res.status(500).json({ error: 'Enriched trust intelligence failed' });
    }
  });

  // ══════════════════════════════════════════════════════════════════════════
  // SOURCE GOVERNANCE + COVERAGE INTELLIGENCE
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * GET /api/identity/governance
   *
   * Source governance registry — access policies, risk levels, automation
   * rules, build priorities, and competitive positioning.
   */
  app.get('/api/identity/governance', (_req: Request, res: Response) => {
    const sources = listSources();
    const cautionMap = getSourceCautionMap();
    const buildOrder = getBuildPriorityOrder();

    res.json({
      schema: 'https://vitalcv.com/identity-governance/v1',
      sources: sources.map(s => {
        const gov = SOURCE_GOVERNANCE[s.id];
        return {
          id:                s.id,
          name:              s.name,
          tier:              s.tier,
          phase:             s.phase,
          // Governance fields
          sourceType:        gov?.sourceType ?? 'api',
          accessBoundary:    gov?.accessBoundary ?? 'public',
          termsRiskLevel:    gov?.termsRiskLevel ?? 'green',
          automationPolicy:  gov?.automationPolicy ?? 'allowed',
          connectorComplexity: gov?.connectorComplexity ?? 'low',
          monitoringMode:    gov?.monitoringMode ?? 'pull',
          automationSafe:    isAutomationSafe(s.id),
          // Scoring
          feasibilityScore:  gov?.feasibilityScore ?? 0,
          leverageScore:     gov?.leverageScore ?? 0,
          maintenanceBurden: gov?.maintenanceBurden ?? 0,
          // Build status
          buildStatus:       gov?.buildStatus ?? 'planned',
          implementationPriority: gov?.implementationPriority ?? 99,
          // Policy
          automationNotes:   gov?.automationNotes ?? '',
          openQuestions:     gov?.openQuestions ?? [],
          // Source catalog
          liveAvailable:     s.liveAvailable,
          claimTypes:        s.claimTypes,
          refreshCadence:    s.refreshCadence,
        };
      }),
      cautionMap,
      buildOrder,
      competitive: COMPETITIVE_POSITIONING,
      trustTierCopy: TRUST_TIER_COPY,
    });
  });

  /**
   * GET /api/identity/governance/caution-map
   * Machine-readable source caution map — risk levels and policies.
   */
  app.get('/api/identity/governance/caution-map', (_req: Request, res: Response) => {
    res.json(getSourceCautionMap());
  });

  /**
   * GET /api/identity/governance/build-order
   * Recommended build priority order based on truth-pack sequencing.
   */
  app.get('/api/identity/governance/build-order', (_req: Request, res: Response) => {
    res.json({ order: getBuildPriorityOrder() });
  });

  /**
   * GET /api/identity/:npi/coverage
   *
   * Source coverage for a specific clinician — which sources have been
   * checked, which are pending, which are unavailable or gated.
   */
  app.get('/api/identity/:npi([0-9]{10})/coverage', async (req: Request, res: Response) => {
    const { npi } = req.params;

    try {
      // Get all artifacts for this NPI
      const artifacts = await prisma.verificationArtifact.findMany({
        where: { npi, lifecycleState: 'active', source: { not: 'IDENTITY_INDEX' } },
        select: { source: true, createdAt: true, verifiedAt: true, status: true },
        orderBy: { createdAt: 'desc' },
      });

      // Dedupe to latest per source
      const latestBySource = new Map<string, { createdAt: Date; verifiedAt: Date; status: string }>();
      for (const art of artifacts) {
        if (!latestBySource.has(art.source)) {
          latestBySource.set(art.source, { createdAt: art.createdAt, verifiedAt: art.verifiedAt, status: art.status });
        }
      }

      const sources = listSources();
      const now = Date.now();

      const coverage = sources.map(s => {
        const latest = latestBySource.get(s.id);
        const gov = SOURCE_GOVERNANCE[s.id];
        const ageHours = latest ? Math.round((now - latest.verifiedAt.getTime()) / (1000 * 60 * 60)) : null;
        const isStale = ageHours !== null && ageHours > s.refreshSlaHours;
        const violations = enforceSourcePolicy(s.id);

        let status: string;
        if (violations.some(v => v.severity === 'BLOCK')) {
          status = 'GATED';
        } else if (latest) {
          status = isStale ? 'STALE' : 'CHECKED';
        } else if (!s.liveAvailable && process.env[s.envFlag] !== 'true') {
          status = 'UNAVAILABLE';
        } else {
          status = 'PENDING';
        }

        return {
          sourceId:           s.id,
          name:               s.name,
          tier:               s.tier,
          status,
          lastChecked:        latest?.verifiedAt.toISOString() ?? null,
          ageHours,
          isStale,
          slaHours:           s.refreshSlaHours,
          automationSafe:     isAutomationSafe(s.id),
          termsRisk:          gov?.termsRiskLevel ?? 'green',
          accessBoundary:     gov?.accessBoundary ?? 'public',
          whyNotUsed:         status === 'GATED' ? violations[0]?.message
                            : status === 'UNAVAILABLE' ? `Source not enabled — set ${s.envFlag}=true`
                            : status === 'PENDING' ? 'Not yet ingested — POST /api/identity/:npi/ingest'
                            : null,
          confidenceImpact:   status === 'CHECKED' ? null
                            : `Missing ${s.id} may reduce trust confidence for ${s.claimTypes.join(', ')}`,
          nextRecommended:    status === 'PENDING' || status === 'STALE'
                            ? `POST /api/identity/${npi}/ingest with sources=[${s.id}]`
                            : null,
        };
      });

      const checked  = coverage.filter(c => c.status === 'CHECKED').length;
      const pending  = coverage.filter(c => c.status === 'PENDING').length;
      const stale    = coverage.filter(c => c.status === 'STALE').length;
      const gated    = coverage.filter(c => c.status === 'GATED').length;
      const unavail  = coverage.filter(c => c.status === 'UNAVAILABLE').length;

      const goldChecked = coverage.filter(c => c.tier === 'GOLD' && c.status === 'CHECKED').length;
      const goldTotal   = coverage.filter(c => c.tier === 'GOLD').length;

      res.json({
        schema: 'https://vitalcv.com/identity-coverage/v1',
        npi,
        summary: {
          totalSources: coverage.length,
          checked, pending, stale, gated, unavailable: unavail,
          goldCoverage: `${goldChecked}/${goldTotal}`,
          coverageScore: Math.round((checked / coverage.length) * 100),
        },
        coverage,
        recommendations: [
          ...(stale > 0 ? [`${stale} source(s) are stale — re-ingest recommended`] : []),
          ...(goldChecked < goldTotal ? [`${goldTotal - goldChecked} Gold source(s) not yet checked — higher trust band possible with full Gold coverage`] : []),
          ...(gated > 0 ? [`${gated} source(s) are gated — institutional access or API key needed`] : []),
        ],
      });
    } catch (err) {
      log('error', 'identity: coverage failed', { npi, error: String(err) });
      res.status(500).json({ error: 'Coverage check failed' });
    }
  });

  /**
   * GET /api/identity/:npi/trust-explanation
   *
   * Why this clinician's trust is at a certain level — what sources
   * were used, what's missing, what the confidence limitations are.
   */
  app.get('/api/identity/:npi([0-9]{10})/trust-explanation', async (req: Request, res: Response) => {
    const { npi } = req.params;

    try {
      const claims = await getClaimsForNpi(npi);
      if (claims.length === 0) {
        res.json({
          npi,
          explanation: 'No identity claims have been ingested for this NPI.',
          trustLimitations: ['No data — cannot compute trust band'],
          recommendation: `POST /api/identity/${npi}/ingest to begin verification`,
        });
        return;
      }

      const tiers = claims.map(c => c.tier);
      const hasGold   = tiers.includes('GOLD');
      const hasSilver = tiers.includes('SILVER');
      const goldCount = claims.filter(c => c.tier === 'GOLD').length;
      const silverCount = claims.filter(c => c.tier === 'SILVER').length;
      const reviewPending = claims.filter(c => c.reviewRequired && !c.humanReviewAt).length;
      const uncertainClaims = claims.filter(c => c.confidence === 'UNCERTAIN');

      const limitations: string[] = [];
      if (!hasGold) limitations.push('No Gold-tier claims — trust band capped at L1');
      if (uncertainClaims.length > 0) limitations.push(`${uncertainClaims.length} claim(s) have UNCERTAIN confidence — manual review needed`);
      if (reviewPending > 0) limitations.push(`${reviewPending} claim(s) awaiting human review`);

      const exclusionClaim = claims.find(c => c.claimType === 'EXCLUSION_STATUS');
      if (!exclusionClaim) limitations.push('OIG exclusion status not checked — trust band capped at L1');
      if (exclusionClaim?.confidence === 'UNCERTAIN') limitations.push('OIG check returned uncertain result — trust band capped at L1');

      const sources = [...new Set(claims.map(c => c.sourceId))];
      const tierExplanation = hasGold
        ? TRUST_TIER_COPY.GOLD.description
        : hasSilver
        ? TRUST_TIER_COPY.SILVER.description
        : TRUST_TIER_COPY.BRONZE.description;

      res.json({
        npi,
        highestTier: hasGold ? 'GOLD' : hasSilver ? 'SILVER' : 'BRONZE',
        tierExplanation,
        claimBreakdown: {
          gold: goldCount,
          silver: silverCount,
          bronze: claims.filter(c => c.tier === 'BRONZE').length,
          total: claims.length,
        },
        sourcesUsed: sources,
        trustLimitations: limitations,
        reviewPending,
        provenance: `${claims.length} claims derived from ${sources.length} source(s). Every claim traces to a source artifact with timestamp, checksum, and parser version.`,
      });
    } catch (err) {
      log('error', 'identity: trust-explanation failed', { npi, error: String(err) });
      res.status(500).json({ error: 'Trust explanation failed' });
    }
  });
}
