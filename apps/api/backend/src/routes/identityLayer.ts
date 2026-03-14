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
 */

import type { Express, Request, Response } from 'express';
import {
  ingestClinicianIdentity,
  getClaimsForNpi,
  type IngestionSources,
} from '../services/identity/identityIngestionPipeline';
import { buildIdentitySummary } from '../services/identity/evidenceModel';
import { listSources, getSource } from '../services/identity/sourceCatalog';
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
      const artifacts = await prisma.verificationArtifact.findMany({
        where: { npi, lifecycleState: 'active', source: { not: 'TRUST_STATE_ENGINE' } },
        select: { rawPayload: true, source: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      const receipts = artifacts.flatMap(a =>
        ((a.rawPayload as Record<string, unknown>)?._receipts ?? []) as unknown[]
      );

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
}
