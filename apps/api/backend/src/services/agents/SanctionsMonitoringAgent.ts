/**
 * SanctionsMonitoringAgent.ts
 *
 * Continuously monitors OIG/LEIE exclusion lists for sanction events.
 * Runs daily. CRITICAL severity on any new match.
 *
 * Sources: OIG LEIE database (via oigLeieChecker.ts)
 * Monitors: new exclusions, exclusion type changes, re-instatements
 */

import { BaseVerificationAgent } from './BaseVerificationAgent';
import { checkExclusion } from '../psv/oigLeieChecker';
import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import type { EvidenceBundle, Anomaly } from './types';

export class SanctionsMonitoringAgent extends BaseVerificationAgent {
  readonly name = 'sanctions_monitoring' as const;
  readonly description = 'Daily OIG/LEIE exclusion list monitoring — detects new sanctions and reinstatements';

  protected async fetchEvidence(npi: string): Promise<EvidenceBundle[]> {
    const now = new Date().toISOString();

    // Resolve clinician name from NPPES for OIG name match
    let firstName = '';
    let lastName = '';
    try {
      const nppes = await prisma.verificationArtifact.findFirst({
        where: { npi, source: 'NPPES' },
        orderBy: { verifiedAt: 'desc' },
        select: { rawPayload: true },
      });
      if (nppes) {
        const p = nppes.rawPayload as Record<string, unknown>;
        firstName = String(p.firstName ?? p.first_name ?? '');
        lastName = String(p.lastName ?? p.last_name ?? p.providerLastName ?? '');
      }
    } catch { /* best effort name lookup */ }

    try {
      const result = await checkExclusion({ npi, firstName, lastName });
      const isExcluded = result.matchType !== 'NONE';

      return [{
        agentName: this.name,
        npi,
        source: 'OIG_LEIE',
        credentialType: 'EXCLUSION_CHECK',
        status: isExcluded ? 'SUSPENDED' : 'ACTIVE',
        confidence: 'HIGH',
        rawData: result as unknown as Record<string, unknown>,
        normalizedFields: {
          sanctionType: isExcluded ? result.matchType : 'NONE',
          issuingBody: 'OIG/LEIE',
        },
        extractedAt: now,
        sourceUrl: 'https://exclusions.oig.hhs.gov',
        ttlHours: 24, // re-check daily
      }];
    } catch (err) {
      log('warn', 'SanctionsAgent: OIG check failed', { npi, error: String(err) });
      return [{
        agentName: this.name, npi,
        source: 'OIG_LEIE', credentialType: 'EXCLUSION_CHECK',
        status: 'UNKNOWN', confidence: 'LOW',
        rawData: { error: String(err) },
        normalizedFields: { issuingBody: 'OIG/LEIE', sanctionType: 'CHECK_FAILED' },
        extractedAt: now, ttlHours: 6,
      }];
    }
  }

  protected async detectInconsistencies(
    npi: string,
    newEvidence: EvidenceBundle[],
  ): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];

    for (const bundle of newEvidence) {
      const prev = await prisma.verificationArtifact.findFirst({
        where: { npi, source: 'OIG_LEIE' },
        orderBy: { verifiedAt: 'desc' },
        select: { status: true, rawPayload: true, verifiedAt: true },
      });

      // New exclusion detected (previously clear)
      if (bundle.status === 'SUSPENDED') {
        const wasClear = !prev || (prev.status ?? '').toUpperCase() !== 'SUSPENDED';
        if (wasClear) {
          anomalies.push(this.anomaly(npi, {
            severity: 'CRITICAL',
            description: `NEW OIG/LEIE exclusion detected — match type: ${bundle.normalizedFields.sanctionType}`,
            field: 'exclusion.status',
            sourceA: { name: 'previous_check', value: 'CLEAR' },
            sourceB: { name: 'OIG_LEIE', value: bundle.normalizedFields.sanctionType ?? 'MATCH' },
            recommendation: 'IMMEDIATE ACTION REQUIRED. Suspend all active placements. Notify compliance team and all verifiers.',
          }));
        }
      }

      // Reinstatement detected (previously excluded, now clear)
      if (bundle.status === 'ACTIVE' && prev) {
        const prevStatus = (prev.status ?? '').toUpperCase();
        if (prevStatus === 'SUSPENDED' || prevStatus === 'REVOKED') {
          anomalies.push(this.anomaly(npi, {
            severity: 'MEDIUM',
            description: 'OIG/LEIE exclusion resolved — clinician reinstated',
            field: 'exclusion.status',
            sourceA: { name: 'previous_check', value: prevStatus },
            sourceB: { name: 'OIG_LEIE', value: 'CLEAR' },
            recommendation: 'Review reinstatement documentation. Re-run full verification swarm before resuming placements.',
          }));
        }
      }

      // OIG check failed (API error) — flag as monitoring gap
      if (bundle.confidence === 'LOW' && bundle.normalizedFields.sanctionType === 'CHECK_FAILED') {
        const lastSuccessful = await prisma.verificationArtifact.findFirst({
          where: { npi, source: 'OIG_LEIE', status: { not: 'UNKNOWN' } },
          orderBy: { verifiedAt: 'desc' },
          select: { verifiedAt: true },
        });
        const hoursSinceCheck = lastSuccessful
          ? (Date.now() - lastSuccessful.verifiedAt.getTime()) / 3_600_000
          : Infinity;

        if (hoursSinceCheck > 48) {
          anomalies.push(this.anomaly(npi, {
            severity: 'HIGH',
            description: `OIG check failed — no successful verification in ${Math.round(hoursSinceCheck)}h`,
            field: 'exclusion.monitoring_gap',
            sourceA: { name: 'last_check', value: lastSuccessful?.verifiedAt.toISOString() ?? 'never' },
            sourceB: { name: 'current_check', value: 'FAILED' },
            recommendation: 'Investigate OIG API connectivity. Cap trust band at L1 until check succeeds.',
          }));
        }
      }
    }

    return anomalies;
  }
}
