/**
 * TrainingVerificationAgent.ts
 *
 * Verifies training records — residency, fellowship, CME.
 * Sources:
 *   - CandidateCredential (ingested training records)
 *   - NPPES provider data (graduation year inference)
 *   - ACGME program registry (stub — no public API, but structures for future integration)
 *
 * Detects: training gaps, unverified residency claims, CME deficits.
 */

import { BaseVerificationAgent } from './BaseVerificationAgent';
import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import type { EvidenceBundle, Anomaly } from './types';

const TRAINING_KEYWORDS = ['RESIDENCY', 'FELLOWSHIP', 'INTERNSHIP', 'TRAINING', 'CME', 'CE', 'GRADUATE', 'ACGME', 'AOA'];

function isTrainingCredential(type: string): boolean {
  const upper = type.toUpperCase();
  return TRAINING_KEYWORDS.some(k => upper.includes(k));
}

export class TrainingVerificationAgent extends BaseVerificationAgent {
  readonly name = 'training_verification' as const;
  readonly description = 'Verifies residency, fellowship, and CME training records via CandidateCredential data and ACGME registry';

  protected async fetchEvidence(npi: string): Promise<EvidenceBundle[]> {
    const now = new Date().toISOString();
    const bundles: EvidenceBundle[] = [];

    // ── Source 1: CandidateCredential training records ────────────────────────
    const candidateCreds = await prisma.candidateCredential.findMany({
      where: { clinicianId: npi },
      select: { id: true, status: true, data: true, createdAt: true },
    });

    for (const cc of candidateCreds) {
      const data = (cc.data ?? {}) as Record<string, unknown>;
      const credType = String(data.credentialType ?? data.type ?? '');
      if (!isTrainingCredential(credType)) continue;

      const programName = String(data.programName ?? data.institutionName ?? data.institution ?? 'Unknown Program');
      const specialty = String(data.specialty ?? data.specialization ?? '');
      const completedAt = data.completedAt ?? data.graduationDate ?? data.endDate;

      const status: EvidenceBundle['status'] =
        cc.status === 'VERIFIED' ? 'ACTIVE' :
        cc.status === 'PENDING' ? 'UNKNOWN' : 'UNKNOWN';

      bundles.push({
        agentName: this.name,
        npi,
        source: 'TRAINING_RECORD',
        credentialType: credType.toUpperCase(),
        status,
        confidence: cc.status === 'VERIFIED' ? 'MEDIUM' : 'LOW',
        rawData: data,
        normalizedFields: {
          programName,
          specialty,
          issuingBody: programName,
          issueDate: completedAt ? String(completedAt) : undefined,
        },
        extractedAt: now,
        ttlHours: 24 * 180,
      });
    }

    // ── Source 2: NPPES provider data for graduation year ─────────────────────
    const nppes = await prisma.verificationArtifact.findFirst({
      where: { npi, source: 'NPPES' },
      orderBy: { verifiedAt: 'desc' },
      select: { rawPayload: true },
    });

    if (nppes) {
      const p = nppes.rawPayload as Record<string, unknown>;
      const gradYear = p.graduationYear ?? p.gradYear ?? p.medical_school_year;
      if (gradYear) {
        const alreadyHasResidency = bundles.some(b =>
          b.credentialType.includes('RESIDENCY') || b.credentialType.includes('MD') || b.credentialType.includes('DO')
        );
        if (!alreadyHasResidency) {
          bundles.push({
            agentName: this.name,
            npi,
            source: 'NPPES',
            credentialType: 'MEDICAL_EDUCATION',
            status: 'ACTIVE',
            confidence: 'LOW',
            rawData: { graduationYear: gradYear, source: 'NPPES' },
            normalizedFields: {
              issuingBody: 'Medical School (via NPPES)',
              issueDate: String(gradYear),
              programName: String(p.medicalSchool ?? p.medical_school ?? 'Unknown'),
            },
            extractedAt: now,
            ttlHours: 24 * 180,
          });
        }
      }
    }

    // ── Source 3: ACGME stub (structure for future integration) ───────────────
    const acgmeKey = process.env['ACGME_API_KEY'];
    if (acgmeKey) {
      try {
        const resp = await fetch(
          `https://apps.acgme.org/ads/Public/api/trainee/${npi}`,
          {
            headers: { Authorization: `Bearer ${acgmeKey}` },
            signal: AbortSignal.timeout(8000),
          },
        );
        if (resp.ok) {
          const data = await resp.json() as Record<string, unknown>;
          const programs = Array.isArray(data.programs) ? data.programs as Record<string, unknown>[] : [];
          for (const prog of programs) {
            bundles.push({
              agentName: this.name,
              npi,
              source: 'ACGME',
              credentialType: 'RESIDENCY',
              status: prog.completionStatus === 'Completed' ? 'ACTIVE' : 'UNKNOWN',
              confidence: 'HIGH',
              rawData: prog,
              normalizedFields: {
                programName: String(prog.programName ?? ''),
                specialty: String(prog.specialty ?? ''),
                issuingBody: 'ACGME',
                issueDate: prog.completionDate ? String(prog.completionDate) : undefined,
              },
              extractedAt: now,
              sourceUrl: 'https://apps.acgme.org',
              ttlHours: 24 * 180,
            });
          }
        }
      } catch (err) {
        log('warn', 'TrainingAgent: ACGME lookup failed', { npi, error: String(err) });
      }
    }

    if (bundles.length === 0) {
      bundles.push({
        agentName: this.name, npi,
        source: 'TRAINING_RECORD', credentialType: 'TRAINING_UNVERIFIED',
        status: 'UNKNOWN', confidence: 'STUB',
        rawData: { note: 'No training records found in ingested data' },
        normalizedFields: { issuingBody: 'Unknown' },
        extractedAt: now, ttlHours: 24 * 30,
      });
    }

    log('info', 'TrainingAgent: evidence collected', { npi, bundles: bundles.length });
    return bundles;
  }

  protected async detectInconsistencies(
    npi: string,
    newEvidence: EvidenceBundle[],
  ): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];

    // Check: clinician has board cert claims but no residency record
    const hasBoardCert = await prisma.verificationArtifact.findFirst({
      where: { npi, source: { in: ['ABIM', 'ABFM', 'ABEM', 'ABP', 'ABNS', 'BOARD_CERTIFICATION'] } },
      select: { source: true },
    });

    const hasResidency = newEvidence.some(b =>
      b.credentialType.includes('RESIDENCY') || b.credentialType.includes('FELLOWSHIP')
    );

    if (hasBoardCert && !hasResidency) {
      anomalies.push(this.anomaly(npi, {
        severity: 'MEDIUM',
        description: 'Board certification found but no residency training record in VitalCV',
        field: 'training.residency',
        sourceA: { name: hasBoardCert.source, value: 'BOARD_CERT_EXISTS' },
        sourceB: { name: 'training_records', value: 'NO_RESIDENCY_FOUND' },
        recommendation: 'Request residency completion documentation from clinician for ingestion.',
      }));
    }

    // Check: unverified training claims
    for (const bundle of newEvidence) {
      if (bundle.confidence === 'LOW' && bundle.status === 'UNKNOWN' && bundle.source === 'TRAINING_RECORD') {
        anomalies.push(this.anomaly(npi, {
          severity: 'LOW',
          description: `Unverified training record: ${bundle.credentialType} at ${bundle.normalizedFields.programName ?? 'unknown'}`,
          field: 'training.verification_status',
          sourceA: { name: 'CandidateCredential', value: 'PENDING_VERIFICATION' },
          sourceB: { name: 'verification_target', value: 'VERIFIED_REQUIRED' },
          recommendation: 'Contact training institution to verify program completion.',
        }));
      }
    }

    return anomalies;
  }
}
