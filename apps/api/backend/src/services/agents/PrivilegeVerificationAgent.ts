/**
 * PrivilegeVerificationAgent.ts
 *
 * Verifies hospital/facility privileges via DecisionCapsule records.
 * Source: DecisionCapsule.decisionType === 'PRIVILEGING'
 * Monitors: privilege status (VALID → AT_RISK → INVALID), expiry, revocation cascade.
 *
 * Note: No public hospital credentialing API exists. The source of truth is
 * the VitalCV DecisionCapsule which is created when a verifier grants privileges.
 */

import { BaseVerificationAgent } from './BaseVerificationAgent';
import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import type { EvidenceBundle, Anomaly } from './types';

export class PrivilegeVerificationAgent extends BaseVerificationAgent {
  readonly name = 'privilege_verification' as const;
  readonly description = 'Verifies hospital/facility privileges via DecisionCapsule records — monitors status and expiry';

  protected async fetchEvidence(npi: string): Promise<EvidenceBundle[]> {
    const now = new Date().toISOString();
    const bundles: EvidenceBundle[] = [];

    // Query PRIVILEGING decision capsules
    const privilegeCapsules = await prisma.decisionCapsule.findMany({
      where: {
        subjectNpi: npi,
        decisionType: { in: ['PRIVILEGING', 'DEPLOYMENT'] },
      },
      orderBy: { decisionTimestamp: 'desc' },
      take: 20,
      select: {
        id: true, decisionType: true, status: true,
        artifactHash: true, decisionTimestamp: true,
        credentialIds: true, metadata: true,
      },
    });

    for (const capsule of privilegeCapsules) {
      const meta = (capsule.metadata ?? {}) as Record<string, unknown>;
      const orgName = String(meta.organizationName ?? meta.facilityName ?? meta.employerId ?? 'Unknown Facility');
      const privType = String(meta.privilegeType ?? 'Clinical Privileges');
      const expiryDate = meta.expiryDate ? String(meta.expiryDate) : undefined;
      const decisionAction = String(meta.decisionAction ?? 'APPROVE');

      const status: EvidenceBundle['status'] =
        capsule.status === 'VALID' ? 'ACTIVE' :
        capsule.status === 'AT_RISK' ? 'UNKNOWN' :
        capsule.status === 'INVALID' ? 'REVOKED' : 'UNKNOWN';

      if (decisionAction !== 'APPROVE') continue; // Only track approved privileges

      bundles.push({
        agentName: this.name,
        npi,
        source: 'DECISION_CAPSULE',
        credentialType: `PRIVILEGE_${capsule.decisionType}`,
        status,
        confidence: 'HIGH',
        rawData: {
          capsuleId: capsule.id,
          decisionType: capsule.decisionType,
          capsuleStatus: capsule.status,
          artifactHash: capsule.artifactHash,
          decisionTimestamp: capsule.decisionTimestamp?.toISOString(),
          ...meta,
        },
        normalizedFields: {
          privilegeType: privType,
          facility: orgName,
          issuingBody: orgName,
          expiryDate,
          issueDate: capsule.decisionTimestamp?.toISOString(),
        },
        extractedAt: now,
        ttlHours: 24 * 14,
      });
    }

    // If no privileges — emit awareness bundle
    if (bundles.length === 0) {
      bundles.push({
        agentName: this.name, npi,
        source: 'DECISION_CAPSULE', credentialType: 'PRIVILEGE_NONE',
        status: 'NOT_FOUND', confidence: 'HIGH',
        rawData: { note: 'No privilege grants found in DecisionCapsule records' },
        normalizedFields: {},
        extractedAt: now, ttlHours: 24 * 14,
      });
    }

    log('info', 'PrivilegeAgent: evidence collected', { npi, bundles: bundles.length });
    return bundles;
  }

  protected async detectInconsistencies(
    npi: string,
    newEvidence: EvidenceBundle[],
  ): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];

    for (const bundle of newEvidence) {
      if (bundle.credentialType === 'PRIVILEGE_NONE') continue;

      // AT_RISK privilege: escalate
      if (bundle.status === 'UNKNOWN') {
        anomalies.push(this.anomaly(npi, {
          severity: 'HIGH',
          description: `Privilege AT_RISK at ${bundle.normalizedFields.facility}: ${bundle.normalizedFields.privilegeType}`,
          field: 'privilege.status',
          sourceA: { name: 'DecisionCapsule', value: 'AT_RISK' },
          sourceB: { name: 'expected', value: 'VALID' },
          recommendation: 'Notify privilege-granting institution. Suspend dependent deployment placements.',
        }));
      }

      // Revoked privilege
      if (bundle.status === 'REVOKED') {
        anomalies.push(this.anomaly(npi, {
          severity: 'CRITICAL',
          description: `Privilege REVOKED at ${bundle.normalizedFields.facility}: ${bundle.normalizedFields.privilegeType}`,
          field: 'privilege.status',
          sourceA: { name: 'DecisionCapsule', value: 'INVALID' },
          sourceB: { name: 'expected', value: 'VALID' },
          recommendation: 'IMMEDIATE ACTION: Remove all active placements at this facility. Update trust state.',
        }));
      }

      // Privilege expiry within 30 days
      if (bundle.normalizedFields.expiryDate) {
        const daysLeft = (new Date(bundle.normalizedFields.expiryDate).getTime() - Date.now()) / 86_400_000;
        if (daysLeft > 0 && daysLeft < 30) {
          anomalies.push(this.anomaly(npi, {
            severity: daysLeft < 7 ? 'CRITICAL' : 'HIGH',
            description: `Privilege at ${bundle.normalizedFields.facility} expires in ${Math.round(daysLeft)} days`,
            field: 'privilege.expiryDate',
            sourceA: { name: 'DecisionCapsule', value: bundle.normalizedFields.expiryDate },
            sourceB: { name: 'current_date', value: new Date().toISOString() },
            recommendation: 'Initiate privilege renewal with the facility credentialing office.',
          }));
        }
      }

      // Cross-check: privilege exists but no valid state license found
      const stateLicense = await prisma.verificationArtifact.findFirst({
        where: {
          npi,
          source: { in: ['STATE_BOARD', 'NURSYS'] },
          status: 'VERIFIED',
        },
        select: { source: true },
      });

      if (!stateLicense && bundle.status === 'ACTIVE') {
        anomalies.push(this.anomaly(npi, {
          severity: 'HIGH',
          description: `Active privilege at ${bundle.normalizedFields.facility} but no verified state license found`,
          field: 'privilege.license_dependency',
          sourceA: { name: 'privilege_status', value: 'ACTIVE' },
          sourceB: { name: 'state_license', value: 'NOT_VERIFIED' },
          recommendation: 'Verify state license via LicenseVerificationAgent. Privileges require active licensure.',
        }));
      }
    }

    return anomalies;
  }
}
