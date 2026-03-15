/**
 * trustStateBridge.ts — Bridge between Identity Layer claims and Trust State Engine
 *
 * The trust state engine reads VerificationArtifacts and does source-string
 * matching to classify facts. This bridge enriches trust state computation
 * with the identity layer's structured, typed, confidence-scored claims.
 *
 * Integration points:
 *   1. enrichTrustStateWithClaims() — called after trust state computation
 *      to augment facts with identity layer provenance
 *   2. getIdentityEnrichedTrustState() — full pipeline: ingest → claims → trust state
 *   3. preflightIdentityCheck() — fast check if identity layer data is fresh enough
 *      to skip re-ingestion before trust state computation
 */

import { getClaimsForNpi, ingestClinicianIdentity } from './identityIngestionPipeline';
import { monitorClinicianIdentity, type MonitorReport } from './changeMonitor';
import type { NormalizedClaim, ExclusionValue, LicenseValue, EnrollmentValue, BoardCertValue } from './evidenceModel';
import { getSource } from './sourceCatalog';
import { log } from '../../obs/logger';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface IdentityEnrichment {
  /** Structured identity claims available for this NPI */
  claimCount:         number;
  goldClaimCount:     number;
  silverClaimCount:   number;

  /** Key verdicts derived from claims */
  exclusionVerdict:   'CLEAR' | 'EXCLUDED' | 'UNCERTAIN' | 'NOT_CHECKED';
  licensureVerdict:   'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'SUSPENDED' | 'UNKNOWN';
  enrollmentVerdict:  'ENROLLED' | 'NOT_ENROLLED' | 'UNKNOWN';
  boardCertVerdict:   'CERTIFIED' | 'LAPSED' | 'NOT_CERTIFIED' | 'UNKNOWN';

  /** Confidence scores (from Gold-tier sources) */
  identityConfidence: number;    // 0.0–1.0, from NPPES NPI verification
  exclusionConfidence: number;   // 0.0–1.0, from OIG/LEIE check
  licensureConfidence: number;   // 0.0–1.0, from state board / Nursys

  /** Freshness */
  oldestClaimAge:     number;    // hours since oldest active claim was observed
  newestClaimAge:     number;    // hours since newest claim
  staleSources:       string[];  // sources past their SLA

  /** Monitoring */
  overallHealth:      'HEALTHY' | 'DEGRADED' | 'CRITICAL';
  activeAlerts:       number;
  criticalAlerts:     number;
}

// ── Enrichment builder ────────────────────────────────────────────────────────

export function buildEnrichmentFromClaims(
  claims: NormalizedClaim[],
  monitor: MonitorReport | null,
): IdentityEnrichment {
  const now = Date.now();

  const activeClaims = claims.filter(c => c.status === 'ACTIVE' || c.status === 'UNVERIFIED');

  // Exclusion verdict
  const exclusionClaims = claims.filter(c =>
    c.claimType === 'EXCLUSION_STATUS' || c.claimType === 'FEDERAL_EXCLUSION'
  );
  let exclusionVerdict: IdentityEnrichment['exclusionVerdict'] = 'NOT_CHECKED';
  let exclusionConfidence = 0;
  if (exclusionClaims.length > 0) {
    const best = exclusionClaims.sort((a, b) => b.confidenceScore - a.confidenceScore)[0]!;
    const val = best.value as ExclusionValue;
    if (best.confidence === 'UNCERTAIN') {
      exclusionVerdict = 'UNCERTAIN';
    } else if (val.excluded) {
      exclusionVerdict = 'EXCLUDED';
    } else {
      exclusionVerdict = 'CLEAR';
    }
    exclusionConfidence = best.confidenceScore;
  }

  // Licensure verdict
  const licenseClaims = claims.filter(c =>
    c.claimType === 'LICENSE' || c.claimType === 'NURSING_LICENSE'
  );
  let licensureVerdict: IdentityEnrichment['licensureVerdict'] = 'UNKNOWN';
  let licensureConfidence = 0;
  if (licenseClaims.length > 0) {
    const active = licenseClaims.filter(c => {
      const v = c.value as LicenseValue;
      return v.licenseStatus === 'ACTIVE';
    });
    const revoked = licenseClaims.filter(c => {
      const v = c.value as LicenseValue;
      return v.licenseStatus === 'REVOKED' || v.licenseStatus === 'SUSPENDED';
    });
    if (revoked.length > 0) {
      licensureVerdict = (revoked[0]!.value as LicenseValue).licenseStatus as 'REVOKED' | 'SUSPENDED';
    } else if (active.length > 0) {
      licensureVerdict = 'ACTIVE';
    } else {
      licensureVerdict = 'EXPIRED';
    }
    licensureConfidence = Math.max(...licenseClaims.map(c => c.confidenceScore));
  }

  // Enrollment verdict
  const enrollmentClaims = claims.filter(c => c.claimType === 'ENROLLMENT_STATUS');
  let enrollmentVerdict: IdentityEnrichment['enrollmentVerdict'] = 'UNKNOWN';
  if (enrollmentClaims.length > 0) {
    const val = enrollmentClaims[0]!.value as EnrollmentValue;
    enrollmentVerdict = val.enrolled ? 'ENROLLED' : 'NOT_ENROLLED';
  }

  // Board cert verdict
  const boardClaims = claims.filter(c =>
    c.claimType === 'BOARD_CERTIFICATION' || c.claimType === 'BOARD_CERT_FLAG'
  );
  let boardCertVerdict: IdentityEnrichment['boardCertVerdict'] = 'UNKNOWN';
  if (boardClaims.length > 0) {
    const val = boardClaims[0]!.value as BoardCertValue;
    boardCertVerdict = val.certificationStatus === 'CERTIFIED' ? 'CERTIFIED'
      : val.certificationStatus === 'LAPSED' ? 'LAPSED' : 'NOT_CERTIFIED';
  }

  // Identity confidence from NPI claim
  const npiClaim = claims.find(c => c.claimType === 'NPI_IDENTITY');
  const identityConfidence = npiClaim?.confidenceScore ?? 0;

  // Freshness
  const observedTimes = claims.map(c => new Date(c.observedAt).getTime()).filter(t => !isNaN(t));
  const oldestAge = observedTimes.length > 0 ? (now - Math.min(...observedTimes)) / (1000 * 60 * 60) : Infinity;
  const newestAge = observedTimes.length > 0 ? (now - Math.max(...observedTimes)) / (1000 * 60 * 60) : Infinity;

  return {
    claimCount:         claims.length,
    goldClaimCount:     claims.filter(c => c.tier === 'GOLD').length,
    silverClaimCount:   claims.filter(c => c.tier === 'SILVER').length,
    exclusionVerdict,
    licensureVerdict,
    enrollmentVerdict,
    boardCertVerdict,
    identityConfidence,
    exclusionConfidence,
    licensureConfidence,
    oldestClaimAge:     Math.round(oldestAge),
    newestClaimAge:     Math.round(newestAge),
    staleSources:       monitor?.staleSources ?? [],
    overallHealth:      monitor?.overallHealth ?? 'HEALTHY',
    activeAlerts:       monitor?.alerts.length ?? 0,
    criticalAlerts:     monitor?.alerts.filter(a => a.severity === 'CRITICAL').length ?? 0,
  };
}

// ── Full enriched trust state ─────────────────────────────────────────────────

export interface EnrichedTrustState {
  npi:            string;
  enrichment:     IdentityEnrichment;
  monitor:        MonitorReport;
  claimSummary:   {
    byType:       Record<string, number>;
    byTier:       Record<string, number>;
    reviewPending: number;
  };
  recommendations: string[];
}

/**
 * Get identity-enriched trust intelligence for a clinician.
 * This does NOT re-compute the trust band — it provides the identity layer's
 * structured view that can inform trust state decisions.
 *
 * @param ingestIfStale - if true, will re-ingest sources past their SLA before reporting
 */
export async function getEnrichedTrustIntelligence(
  npi: string,
  options?: { ingestIfStale?: boolean },
): Promise<EnrichedTrustState> {
  let claims = await getClaimsForNpi(npi);

  // If no claims and ingestIfStale, run initial ingestion
  if (claims.length === 0 && options?.ingestIfStale) {
    log('info', 'trustStateBridge: no claims, triggering initial ingest', { npi });
    await ingestClinicianIdentity(npi, ['ALL']);
    claims = await getClaimsForNpi(npi);
  }

  const monitor = await monitorClinicianIdentity(npi);

  // If stale sources found and re-ingest requested, refresh them
  if (options?.ingestIfStale && monitor.staleSources.length > 0) {
    log('info', 'trustStateBridge: re-ingesting stale sources', { npi, stale: monitor.staleSources });
    for (const sourceId of monitor.staleSources) {
      try {
        await ingestClinicianIdentity(npi, [sourceId as 'NPPES_API' | 'OIG_LEIE' | 'PECOS_PUBLIC']);
      } catch {
        // Non-fatal — monitor already flagged the SLA breach
      }
    }
    claims = await getClaimsForNpi(npi);
  }

  const enrichment = buildEnrichmentFromClaims(claims, monitor);

  // Claim distribution
  const byType: Record<string, number> = {};
  const byTier: Record<string, number> = {};
  for (const c of claims) {
    byType[c.claimType] = (byType[c.claimType] ?? 0) + 1;
    byTier[c.tier]      = (byTier[c.tier] ?? 0) + 1;
  }
  const reviewPending = claims.filter(c => c.reviewRequired && !c.humanReviewAt).length;

  // Generate recommendations
  const recommendations: string[] = [];
  if (enrichment.exclusionVerdict === 'UNCERTAIN') {
    recommendations.push('OIG exclusion check returned uncertain result — manual verification required before trust band can exceed L1');
  }
  if (enrichment.exclusionVerdict === 'EXCLUDED') {
    recommendations.push('CRITICAL: Active OIG exclusion — trust band must remain L0. Immediate review required.');
  }
  if (enrichment.licensureVerdict === 'EXPIRED') {
    recommendations.push('License expired — clinician should renew before deployment');
  }
  if (enrichment.licensureVerdict === 'REVOKED' || enrichment.licensureVerdict === 'SUSPENDED') {
    recommendations.push(`License ${enrichment.licensureVerdict.toLowerCase()} — trust band degraded. Investigation required.`);
  }
  if (enrichment.enrollmentVerdict === 'NOT_ENROLLED') {
    recommendations.push('Not enrolled in Medicare (PECOS) — may limit deployment to Medicare-accepting facilities');
  }
  if (enrichment.boardCertVerdict === 'LAPSED') {
    recommendations.push('Board certification lapsed — verify if facility requires active board cert');
  }
  if (enrichment.staleSources.length > 0) {
    recommendations.push(`${enrichment.staleSources.length} source(s) past SLA: ${enrichment.staleSources.join(', ')} — re-ingest recommended`);
  }
  if (reviewPending > 0) {
    recommendations.push(`${reviewPending} claim(s) awaiting human review — check /api/identity/${npi}/claims?reviewRequired=true`);
  }
  if (claims.length === 0) {
    recommendations.push(`No identity claims ingested — POST /api/identity/${npi}/ingest to begin`);
  }

  return {
    npi,
    enrichment,
    monitor,
    claimSummary: { byType, byTier, reviewPending },
    recommendations,
  };
}
