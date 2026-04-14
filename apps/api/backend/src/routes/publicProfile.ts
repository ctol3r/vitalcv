/**
 * publicProfile.ts — Wave 251 (re-shimmed via strangler pattern)
 *
 * Public, redacted clinician passport profile keyed by NPI. Trust-state
 * internals are now sourced from the canonical pipeline
 * (buildPassportDataByNpi). Legacy response shape is preserved; canonical
 * fields (decision, coverage, claims, limitations) are added additively.
 */

import type { Express, Request, Response } from 'express';
import prisma from '../graphql/prisma_client';
import { log } from '../obs/logger';
import { publicApiRateLimit } from '../middleware/publicSafety';
import { ReadinessEvaluator } from '../services/intelligence/graphRagEvaluator';
import { buildCanonicalClaimsFromArtifact, buildClaimDigests, buildSelectiveDisclosurePlaceholder } from '../services/auditBundleClaims';
import type { PredictionSummaryContract } from '../services/predictions/contracts';
import { getPredictionSummaryForEntity } from '../services/predictions/predictionEngineService';
import { buildPassportDataByNpi } from '../services/passport/npiPassportContract';
import type { Decision } from '../services/entity/passportService';
import type { CanonicalSourceCoverageReport, CanonicalTruthSet } from '@vitalcv/trust-state';

const NPI_RE = /^\d{10}$/;
const evaluator = new ReadinessEvaluator();
const MAX_EVENTS = 5;
const MAX_ARTIFACTS = 8;

type TrustBand = 'L0' | 'L1' | 'L2' | 'L3';

export interface NpiProfileResponse {
  npi: string;
  status: 'CLEARED' | 'PENDING';
  trustBand: TrustBand;
  readinessScore: number;
  lastAnchored: string | null;
  activeCredentials: string[];
  readiness: {
    evaluated: boolean;
    isEligible: boolean | null;
    missingRequirements: string[];
    traceCount: number;
  };
  artifactSummaries: Array<{
    artifactId: string;
    issuer: string;
    status: string;
    lifecycleState: string;
    verifiedAt: string;
    expiresAt: string | null;
    monitoring: boolean;
    checksum: string;
    claimCount: number;
    claimHashes: string[];
    selectiveDisclosure: {
      algorithm: 'SD-JWT';
      hashAlgorithm: 'sha-256';
      claimCount: number;
    } | null;
  }>;
  issuerProvenance: Array<{
    issuer: string;
    artifactCount: number;
    latestVerifiedAt: string;
    monitored: boolean;
    statuses: string[];
  }>;
  monitoringSummary: {
    monitoredArtifactCount: number;
    totalArtifactCount: number;
    coverageRate: number;
    activeAlertCount: number;
    latestAlertAt: string | null;
  };
  proof: {
    jsonUrl: string;
    pdfUrl: string;
    auditBundleJson: string;
    auditBundleDownload: string;
  };
  predictionSummary: PredictionSummaryContract;
  events: Array<{
    type: string;
    hash: string;
    createdAt: string;
  }>;
  generatedAt: string;
  // Canonical additive fields — new employer-facing pipeline
  decision: Decision;
  coverage: CanonicalSourceCoverageReport;
  claims: CanonicalTruthSet;
  limitations: {
    blockers: string[];
    gaps: string[];
  };
}

function inferStateFromSource(source: string): string | null {
  const match = /^([A-Z]{2})-/.exec(source);
  return match ? match[1] : null;
}

function safeRate(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }
  return Number((numerator / denominator).toFixed(4));
}

function deriveTrustBand(level: string): TrustBand {
  return level === 'L0' || level === 'L1' || level === 'L2' || level === 'L3' ? level : 'L0';
}

export function registerPublicProfileRoutes(app: Express): void {
  app.get(
    '/api/public/profile/npi/:npi',
    publicApiRateLimit,
    async (req: Request, res: Response) => {
      const { npi } = req.params;

      if (!npi || !NPI_RE.test(npi)) {
        return res.status(400).json({
          error: 'invalid_npi',
          error_description: 'NPI must be a 10-digit string.',
        });
      }

      const generatedAt = new Date().toISOString();

      const [passportData, artifacts, anchoredEvents, alertSummary, predictionSummary] = await Promise.all([
        buildPassportDataByNpi(npi),
        prisma.verificationArtifact.findMany({
          where: {
            npi,
            source: { not: 'TRUST_STATE_ENGINE' },
            lifecycleState: { notIn: ['revoked', 'suspended'] },
            status: { notIn: ['REVOKED', 'SUSPENDED', 'Expired'] },
          },
          select: {
            id: true,
            source: true,
            status: true,
            lifecycleState: true,
            verifiedAt: true,
            expiresAt: true,
            checksum: true,
            monitoring: true,
            rawPayload: true,
            merkleRoot: true,
          },
          orderBy: { verifiedAt: 'desc' },
          take: MAX_ARTIFACTS,
        }),
        prisma.auditEvent.findMany({
          where: { clinicianId: npi, anchored: true },
          orderBy: { createdAt: 'desc' },
          take: MAX_EVENTS,
          select: { type: true, hash: true, createdAt: true },
        }),
        prisma.trustAlertRecord.aggregate({
          where: { subject: npi },
          _count: { _all: true },
          _max: { createdAt: true },
        }),
        getPredictionSummaryForEntity('provider', npi),
      ]);

      if (!passportData) {
        return res.status(404).json({
          error: 'passport_not_found',
          error_description: 'No passport data available for the provided NPI.',
        });
      }

      const trustBand = deriveTrustBand(passportData.readiness.level);
      const readinessScore = passportData.readiness.score;

      const activeCredentials: string[] = [];
      for (const artifact of artifacts) {
        if (!activeCredentials.includes(artifact.source)) {
          activeCredentials.push(artifact.source);
        }
      }

      let readiness: NpiProfileResponse['readiness'] = {
        evaluated: false,
        isEligible: null,
        missingRequirements: [],
        traceCount: 0,
      };

      const stateSource = artifacts.find((artifact) => inferStateFromSource(artifact.source) !== null);
      const inferredState = stateSource ? inferStateFromSource(stateSource.source) : null;
      if (inferredState) {
        try {
          const evalResult = await evaluator.evaluateCandidate(npi, inferredState, 'general');
          readiness = {
            evaluated: true,
            isEligible: evalResult.isEligible,
            missingRequirements: evalResult.missingRequirements,
            traceCount: evalResult.reasoningTrace.length,
          };
        } catch (error) {
          log('warn', 'public_profile_evaluator_failed', {
            npi: npi.slice(0, 4) + '····',
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      const artifactSummaries = artifacts.map((artifact) => {
        const claimDigests = buildClaimDigests(buildCanonicalClaimsFromArtifact({
          npi,
          status: artifact.status,
          rawPayload: artifact.rawPayload,
        }));
        const selectiveDisclosure = artifact.merkleRoot
          ? buildSelectiveDisclosurePlaceholder(buildCanonicalClaimsFromArtifact({
              npi,
              status: artifact.status,
              rawPayload: artifact.rawPayload,
            }))
          : null;

        return {
          artifactId: artifact.id,
          issuer: artifact.source,
          status: artifact.status,
          lifecycleState: artifact.lifecycleState,
          verifiedAt: artifact.verifiedAt.toISOString(),
          expiresAt: artifact.expiresAt?.toISOString() ?? null,
          monitoring: artifact.monitoring,
          checksum: artifact.checksum,
          claimCount: claimDigests.length,
          claimHashes: claimDigests.map((claim) => claim.hash),
          selectiveDisclosure: selectiveDisclosure
            ? {
                algorithm: selectiveDisclosure.algorithm,
                hashAlgorithm: selectiveDisclosure.hashAlgorithm,
                claimCount: selectiveDisclosure.claims.length,
              }
            : null,
        };
      });

      const provenanceMap = new Map<string, {
        artifactCount: number;
        latestVerifiedAt: string;
        monitored: boolean;
        statuses: Set<string>;
      }>();
      for (const artifact of artifactSummaries) {
        const current = provenanceMap.get(artifact.issuer) ?? {
          artifactCount: 0,
          latestVerifiedAt: artifact.verifiedAt,
          monitored: false,
          statuses: new Set<string>(),
        };
        current.artifactCount += 1;
        if (artifact.verifiedAt > current.latestVerifiedAt) {
          current.latestVerifiedAt = artifact.verifiedAt;
        }
        current.monitored = current.monitored || artifact.monitoring;
        current.statuses.add(artifact.status);
        provenanceMap.set(artifact.issuer, current);
      }

      const issuerProvenance = [...provenanceMap.entries()].map(([issuer, details]) => ({
        issuer,
        artifactCount: details.artifactCount,
        latestVerifiedAt: details.latestVerifiedAt,
        monitored: details.monitored,
        statuses: [...details.statuses].sort(),
      })).sort((left, right) => left.issuer.localeCompare(right.issuer));

      const hasActiveCredentials = activeCredentials.length > 0;
      const evaluatorPass = !readiness.evaluated || readiness.isEligible !== false;
      // Canonical: CLEARED is the projection of decision === 'PROCEED' constrained
      // by presence of active credentials and (when evaluated) eligibility pass.
      const decisionPass = passportData.decision.decision === 'PROCEED';
      const status: 'CLEARED' | 'PENDING' = hasActiveCredentials && evaluatorPass && decisionPass
        ? 'CLEARED'
        : 'PENDING';

      const events = anchoredEvents.map((event) => ({
        type: event.type,
        hash: event.hash,
        createdAt: event.createdAt.toISOString(),
      }));

      const monitoredArtifactCount = artifactSummaries.filter((artifact) => artifact.monitoring).length;

      const body: NpiProfileResponse = {
        npi,
        status,
        trustBand,
        readinessScore,
        lastAnchored: anchoredEvents[0]?.createdAt.toISOString() ?? null,
        activeCredentials,
        readiness,
        artifactSummaries,
        issuerProvenance,
        monitoringSummary: {
          monitoredArtifactCount,
          totalArtifactCount: artifactSummaries.length,
          coverageRate: safeRate(monitoredArtifactCount, artifactSummaries.length),
          activeAlertCount: alertSummary._count._all,
          latestAlertAt: alertSummary._max.createdAt?.toISOString() ?? null,
        },
        proof: {
          jsonUrl: `/api/trust-proof/${encodeURIComponent(npi)}`,
          pdfUrl: `/api/trust-proof/${encodeURIComponent(npi)}?format=pdf`,
          auditBundleJson: `/api/artifact/bundle/${encodeURIComponent(npi)}`,
          auditBundleDownload: `/api/artifact/bundle/${encodeURIComponent(npi)}/download`,
        },
        predictionSummary,
        events,
        generatedAt,
        // Canonical additive fields
        decision: passportData.decision,
        coverage: passportData.sourceCoverage,
        claims: passportData.truth,
        limitations: {
          blockers: passportData.readiness.blockers,
          gaps: passportData.readiness.gaps,
        },
      };

      log('info', 'public_profile_npi_served', {
        npi_prefix: npi.slice(0, 4) + '····',
        status,
        trustBand,
        readinessScore,
        decision: passportData.decision.decision,
        artifactCount: artifactSummaries.length,
      });

      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      res.setHeader('Vary', 'Accept-Encoding');
      return res.status(200).json(body);
    },
  );
}
