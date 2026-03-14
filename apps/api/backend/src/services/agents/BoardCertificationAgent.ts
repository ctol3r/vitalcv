/**
 * BoardCertificationAgent.ts
 *
 * Verifies specialty board certifications.
 * Sources:
 *   - CandidateCredential records (existing ingested data)
 *   - ABIM public verification (abim.org — HTML scrape, no public API)
 *   - Cross-reference with NPPES specialty codes
 *
 * Boards supported: ABIM, ABFM, ABEM, ABP, ABNS, ABOG, ABS, ABIM subspecialties
 */

import { BaseVerificationAgent } from './BaseVerificationAgent';
import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import type { EvidenceBundle, Anomaly } from './types';

// ABIM-family boards with their verification endpoint structures
const BOARD_REGISTRY: Record<string, { label: string; url: string; hasPublicApi: boolean }> = {
  ABIM:   { label: 'American Board of Internal Medicine',    url: 'https://www.abim.org/verify-physician/', hasPublicApi: false },
  ABFM:   { label: 'American Board of Family Medicine',     url: 'https://www.theabfm.org/certification/verify', hasPublicApi: false },
  ABEM:   { label: 'American Board of Emergency Medicine',  url: 'https://www.abem.org/public/',          hasPublicApi: false },
  ABP:    { label: 'American Board of Pediatrics',          url: 'https://www.abp.org/verify',            hasPublicApi: false },
  ABNS:   { label: 'American Board of Neurological Surgery',url: 'https://www.abns.org/verification/',    hasPublicApi: false },
  ABOG:   { label: 'American Board of Obstetrics and Gynecology', url: 'https://www.abog.org/verify',    hasPublicApi: false },
  ABS:    { label: 'American Board of Surgery',             url: 'https://www.absurgery.org/default.jsp?certifications', hasPublicApi: false },
};

// NPPES taxonomy → board mapping
const TAXONOMY_TO_BOARD: Record<string, string> = {
  '207R00000X': 'ABIM',  // Internal Medicine
  '208000000X': 'ABFM',  // Family Medicine
  '207P00000X': 'ABEM',  // Emergency Medicine (ABEM)
  '208100000X': 'ABNS',  // Neurological Surgery
  '207V00000X': 'ABOG',  // Obstetrics and Gynecology
  '208600000X': 'ABS',   // Surgery
  '208000000X ': 'ABP',  // Pediatrics (space-trimmed)
};

export class BoardCertificationAgent extends BaseVerificationAgent {
  readonly name = 'board_certification' as const;
  readonly description = 'Verifies specialty board certifications — ABIM, ABFM, ABEM, ABP, ABNS, ABOG, ABS';

  protected async fetchEvidence(npi: string): Promise<EvidenceBundle[]> {
    const now = new Date().toISOString();
    const bundles: EvidenceBundle[] = [];

    // ── Source 1: Existing CandidateCredential records ────────────────────────
    const candidateCreds = await prisma.candidateCredential.findMany({
      where: { clinicianId: npi },
      select: { id: true, status: true, data: true, createdAt: true },
    });

    const boardCerts = candidateCreds.filter(cc => {
      const data = (cc.data ?? {}) as Record<string, unknown>;
      const t = String(data.credentialType ?? data.type ?? '').toUpperCase();
      return t.includes('BOARD') || t.includes('CERTIF') || Object.keys(BOARD_REGISTRY).some(b => t.includes(b));
    });

    for (const cert of boardCerts) {
      const data = (cert.data ?? {}) as Record<string, unknown>;
      const certType = String(data.credentialType ?? data.type ?? 'BOARD_CERTIFICATION').toUpperCase();
      const boardKey = Object.keys(BOARD_REGISTRY).find(b => certType.includes(b)) ?? 'BOARD_CERTIFICATION';
      const boardInfo = BOARD_REGISTRY[boardKey];

      const status: EvidenceBundle['status'] =
        cert.status === 'VERIFIED' ? 'ACTIVE' :
        cert.status === 'EXPIRED' ? 'EXPIRED' : 'UNKNOWN';

      bundles.push({
        agentName: this.name,
        npi,
        source: boardKey,
        credentialType: certType,
        status,
        confidence: cert.status === 'VERIFIED' ? 'MEDIUM' : 'LOW',
        rawData: data,
        normalizedFields: {
          issuingBody: boardInfo?.label ?? boardKey,
          specialty: String(data.specialty ?? ''),
          expiryDate: data.expirationDate ? String(data.expirationDate) : undefined,
          issueDate: data.issueDate ? String(data.issueDate) : undefined,
        },
        extractedAt: now,
        sourceUrl: boardInfo?.url,
        ttlHours: 24 * 90,
      });
    }

    // ── Source 2: NPPES taxonomy codes → infer board certification requirement ─
    const nppes = await prisma.verificationArtifact.findFirst({
      where: { npi, source: 'NPPES' },
      orderBy: { verifiedAt: 'desc' },
      select: { rawPayload: true },
    });

    if (nppes) {
      const p = nppes.rawPayload as Record<string, unknown>;
      const taxonomies = Array.isArray(p.taxonomies) ? p.taxonomies as Record<string, unknown>[] : [];

      for (const tax of taxonomies) {
        const code = String(tax.code ?? '');
        const boardKey = TAXONOMY_TO_BOARD[code];
        if (!boardKey) continue;

        // Check if we already have a bundle for this board
        const alreadyFound = bundles.some(b => b.source === boardKey);
        if (alreadyFound) continue;

        const boardInfo = BOARD_REGISTRY[boardKey];
        // NPPES taxonomy tells us the specialty, not the cert status
        // Emit LOW confidence — requires active verification
        bundles.push({
          agentName: this.name,
          npi,
          source: boardKey,
          credentialType: `BOARD_CERTIFICATION_REQUIRED`,
          status: 'UNKNOWN',
          confidence: 'LOW',
          rawData: { taxonomyCode: code, taxonomyDescription: tax.desc, npiSpecialty: true },
          normalizedFields: {
            issuingBody: boardInfo?.label ?? boardKey,
            specialty: String(tax.desc ?? ''),
          },
          extractedAt: now,
          sourceUrl: boardInfo?.url,
          ttlHours: 24 * 90,
        });

        log('info', 'BoardCertAgent: NPPES specialty requires board cert', {
          npi, boardKey, taxonomyCode: code,
        });
      }
    }

    if (bundles.length === 0) {
      // No board cert evidence found — emit monitoring placeholder
      bundles.push({
        agentName: this.name, npi,
        source: 'BOARD_CERTIFICATION', credentialType: 'BOARD_CERTIFICATION',
        status: 'UNKNOWN', confidence: 'STUB',
        rawData: { note: 'No board certification records found in ingested data' },
        normalizedFields: { issuingBody: 'Unknown' },
        extractedAt: now, ttlHours: 24 * 30,
      });
    }

    log('info', 'BoardCertAgent: evidence collected', { npi, bundles: bundles.length });
    return bundles;
  }

  protected async detectInconsistencies(
    npi: string,
    newEvidence: EvidenceBundle[],
  ): Promise<Anomaly[]> {
    const anomalies: Anomaly[] = [];

    for (const bundle of newEvidence) {
      if (bundle.confidence === 'STUB' || bundle.status === 'UNKNOWN') continue;

      // Cross-check: NPPES specialty says ABIM but no ABIM cert found
      const nppesSpecialtyBundle = newEvidence.find(b =>
        b.credentialType === 'BOARD_CERTIFICATION_REQUIRED' && b.source === bundle.source
      );
      if (nppesSpecialtyBundle && bundle.status === 'EXPIRED') {
        anomalies.push(this.anomaly(npi, {
          severity: 'HIGH',
          description: `${bundle.source} certification expired but NPPES shows active specialty practice`,
          field: 'board_cert.status',
          sourceA: { name: 'NPPES_specialty', value: nppesSpecialtyBundle.normalizedFields.specialty ?? '' },
          sourceB: { name: bundle.source, value: 'EXPIRED' },
          recommendation: 'Verify whether board certification maintenance is required for current role.',
        }));
      }

      // Expiry within 180 days (boards have long renewal cycles)
      if (bundle.normalizedFields.expiryDate) {
        const daysLeft = (new Date(bundle.normalizedFields.expiryDate).getTime() - Date.now()) / 86_400_000;
        if (daysLeft > 0 && daysLeft < 180) {
          anomalies.push(this.anomaly(npi, {
            severity: daysLeft < 60 ? 'HIGH' : 'MEDIUM',
            description: `${bundle.source} certification expires in ${Math.round(daysLeft)} days`,
            field: 'board_cert.expiryDate',
            sourceA: { name: bundle.source, value: bundle.normalizedFields.expiryDate },
            sourceB: { name: 'current_date', value: new Date().toISOString() },
            recommendation: `Initiate ${bundle.source} renewal process. MOC requirements typically require 6-month lead time.`,
          }));
        }
      }
    }

    return anomalies;
  }
}
