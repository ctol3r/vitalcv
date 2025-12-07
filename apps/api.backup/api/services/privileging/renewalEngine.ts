/**
 * B135A-PRIV-007: Renewal Criteria Engine
 *
 * Re-evaluates privilege requirements against current evidence set
 * Returns PASS/FAIL with detailed reasons for renewal decisions
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface RenewalCriteriaResult {
  passed: boolean;
  score: number; // 0-100
  criteria: CriterionEvaluation[];
  summary: string;
  recommendations: string[];
}

export interface CriterionEvaluation {
  name: string;
  required: boolean;
  met: boolean;
  details: string;
  weight: number; // For scoring
}

export interface PrivilegeRequirements {
  minTrainingHours?: number;
  boardCertRequired?: boolean;
  licenseActive?: boolean;
  npdbClean?: boolean;
  minYearsExperience?: number;
  requiredCredentials?: string[]; // VC types required
  fppeRequired?: boolean;
  oppeRequired?: boolean;
}

/**
 * Main renewal criteria engine
 * Evaluates whether a privilege should be renewed based on current evidence
 */
export async function evaluateRenewalCriteria(
  privilegeGrantedId: string,
  currentEvidenceIds: string[]
): Promise<RenewalCriteriaResult> {
  // Fetch the privilege and its requirements
  const privilegeGranted = await prisma.privilegeGranted.findUnique({
    where: { id: privilegeGrantedId },
    include: {
      privilegeRequest: {
        include: {
          privilegeSet: true
        }
      }
    }
  });

  if (!privilegeGranted) {
    throw new Error(`PrivilegeGranted ${privilegeGrantedId} not found`);
  }

  const requirements = privilegeGranted.privilegeRequest.privilegeSet.requirements as PrivilegeRequirements;
  const criteria: CriterionEvaluation[] = [];

  // Fetch evidence VCs (mocked for now - would integrate with VC store)
  const evidenceVCs = await fetchEvidenceVCs(currentEvidenceIds);

  // Evaluate each requirement
  let totalWeight = 0;
  let earnedScore = 0;

  // 1. Board certification check
  if (requirements.boardCertRequired) {
    const weight = 30;
    totalWeight += weight;
    const hasBoardCert = evidenceVCs.some(vc =>
      vc.type === 'BoardCertification' && vc.status === 'active'
    );

    if (hasBoardCert) earnedScore += weight;

    criteria.push({
      name: 'Board Certification',
      required: true,
      met: hasBoardCert,
      details: hasBoardCert ? 'Valid board certification found' : 'No valid board certification',
      weight
    });
  }

  // 2. Active license check with PSV freshness
  if (requirements.licenseActive) {
    const weight = 40;
    totalWeight += weight;

    const licenseVCs = evidenceVCs.filter(vc => vc.type === 'MedicalLicense');
    const hasActiveLicense = licenseVCs.some(vc =>
      vc.status === 'active' && !isExpired(vc.expiresAt)
    );

    // Check PSV freshness (should be within last 180 days for renewal)
    let psvFresh = true;
    let psvDetails = '';
    if (hasActiveLicense) {
      const latestLicense = licenseVCs
        .filter(vc => vc.status === 'active' && !isExpired(vc.expiresAt))
        .sort((a, b) => {
          const dateA = a.issuedAt ? new Date(a.issuedAt).getTime() : 0;
          const dateB = b.issuedAt ? new Date(b.issuedAt).getTime() : 0;
          return dateB - dateA;
        })[0];

      if (latestLicense && latestLicense.issuedAt) {
        const issuedDate = new Date(latestLicense.issuedAt);
        const daysSincePSV = Math.floor((Date.now() - issuedDate.getTime()) / (1000 * 60 * 60 * 24));
        psvFresh = daysSincePSV <= 180; // PSV should be within 180 days

        if (!psvFresh) {
          psvDetails = `PSV stale (${daysSincePSV} days old, max 180 days)`;
        } else {
          psvDetails = `PSV fresh (${daysSincePSV} days old)`;
        }
      } else {
        // No issuance date, assume PSV might be stale
        psvFresh = false;
        psvDetails = 'PSV date not available';
      }
    }

    const licenseMet = hasActiveLicense && psvFresh;
    if (licenseMet) earnedScore += weight;

    criteria.push({
      name: 'Active Medical License (with PSV Freshness)',
      required: true,
      met: licenseMet,
      details: hasActiveLicense
        ? (psvFresh ? `Active license verified. ${psvDetails}` : `License active but ${psvDetails}`)
        : 'No active license found',
      weight
    });
  }

  // 3. NPDB clean check with freshness requirement
  if (requirements.npdbClean) {
    const weight = 20;
    totalWeight += weight;

    // Check NPDB monitoring results (should be within last 90 days for renewal)
    const npdbCheck = await prisma.npdbOigMonitor.findFirst({
      where: {
        clinicianDid: privilegeGranted.clinicianDid,
        monitorType: 'NPDB',
        checkDate: {
          gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // Last 90 days
        }
      },
      orderBy: { checkDate: 'desc' }
    });

    const isClean = npdbCheck?.status === 'CLEAN';
    const isFresh = !!npdbCheck; // Check exists and is recent

    let npdbDetails = '';
    if (!npdbCheck) {
      npdbDetails = 'NPDB check not performed in last 90 days (stale)';
    } else if (!isClean) {
      npdbDetails = 'Adverse NPDB actions present';
    } else {
      const daysSinceCheck = Math.floor((Date.now() - npdbCheck.checkDate.getTime()) / (1000 * 60 * 60 * 24));
      npdbDetails = `NPDB check clean (${daysSinceCheck} days ago)`;
    }

    const npdbMet = isClean && isFresh;
    if (npdbMet) earnedScore += weight;

    criteria.push({
      name: 'NPDB Clean (with Freshness)',
      required: true,
      met: npdbMet,
      details: npdbDetails,
      weight
    });
  }

  // 5. PSV Freshness Check (general - check all evidence VCs)
  const psvFreshnessCheck = checkPSVFreshness(evidenceVCs);
  if (psvFreshnessCheck.needsCheck) {
    const weight = 10;
    totalWeight += weight;

    if (psvFreshnessCheck.isFresh) earnedScore += weight;

    criteria.push({
      name: 'PSV Freshness (All Evidence)',
      required: false, // Informational but not always required
      met: psvFreshnessCheck.isFresh,
      details: psvFreshnessCheck.details,
      weight
    });
  }

  // 4. Expired license check
  const expiredLicenses = evidenceVCs.filter(vc =>
    vc.type === 'MedicalLicense' && vc.expiresAt && isExpired(vc.expiresAt)
  );
  if (expiredLicenses.length > 0 && requirements.licenseActive) {
    const weight = 0; // Already accounted for in license check
    criteria.push({
      name: 'Expired License Check',
      required: true,
      met: false,
      details: `Found ${expiredLicenses.length} expired license(s): ${expiredLicenses.map(vc => vc.id).join(', ')}`,
      weight: 0
    });
  }

  // 5. FPPE/OPPE requirements
  if (requirements.fppeRequired || requirements.oppeRequired) {
    const weight = 10;
    totalWeight += weight;

    const fppeOppeRecord = await prisma.fppeOppe.findFirst({
      where: {
        clinicianDid: privilegeGranted.clinicianDid,
        orgId: privilegeGranted.orgId
      },
      orderBy: { updatedAt: 'desc' }
    });

    let fppeOppeMet = false;
    let fppeOppeDetails = '';

    if (requirements.fppeRequired) {
      fppeOppeMet = fppeOppeRecord?.fppeStatus === 'COMPLETED';
      fppeOppeDetails = fppeOppeMet ? 'FPPE completed successfully' : 'FPPE not completed';
    } else if (requirements.oppeRequired) {
      fppeOppeMet = fppeOppeRecord?.oppeStatus === 'ACTIVE';
      fppeOppeDetails = fppeOppeMet ? 'OPPE active and current' : 'OPPE not current';
    }

    if (fppeOppeMet) earnedScore += weight;

    criteria.push({
      name: 'FPPE/OPPE Status',
      required: requirements.fppeRequired || requirements.oppeRequired,
      met: fppeOppeMet,
      details: fppeOppeDetails,
      weight
    });
  }

  // Calculate final score
  const finalScore = totalWeight > 0 ? Math.round((earnedScore / totalWeight) * 100) : 0;
  const allRequiredMet = criteria.filter(c => c.required).every(c => c.met);

  // Generate summary and recommendations
  const failedRequired = criteria.filter(c => c.required && !c.met);
  const summary = allRequiredMet
    ? `Renewal criteria PASSED with score ${finalScore}/100`
    : `Renewal criteria FAILED. ${failedRequired.length} required criteria not met.`;

  const recommendations: string[] = [];
  if (!allRequiredMet) {
    failedRequired.forEach(criterion => {
      recommendations.push(`Address: ${criterion.name} - ${criterion.details}`);
    });
  }

  return {
    passed: allRequiredMet,
    score: finalScore,
    criteria,
    summary,
    recommendations
  };
}

/**
 * Fetch evidence VCs from credential store
 * TODO: Integrate with actual VC storage/retrieval system
 */
async function fetchEvidenceVCs(evidenceIds: string[]): Promise<any[]> {
  // Mock implementation - replace with actual VC fetching
  const credentials = await prisma.credential.findMany({
    where: {
      id: {
        in: evidenceIds
      }
    }
  });

  return credentials.map(cred => ({
    id: cred.id,
    type: cred.type,
    status: cred.status,
    expiresAt: cred.expiresAt,
    issuedAt: cred.issuedAt // Include issuedAt for PSV freshness check
  }));
}

/**
 * Check if a credential is expired
 */
function isExpired(expiresAt: Date | null | undefined): boolean {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}

/**
 * Check PSV freshness for all evidence VCs
 * PSV should be within 180 days for renewal
 */
function checkPSVFreshness(evidenceVCs: any[]): {
  needsCheck: boolean;
  isFresh: boolean;
  details: string;
  staleCount: number;
  totalChecked: number;
} {
  if (evidenceVCs.length === 0) {
    return {
      needsCheck: false,
      isFresh: false,
      details: 'No evidence VCs to check',
      staleCount: 0,
      totalChecked: 0,
    };
  }

  const now = Date.now();
  const maxAgeDays = 180; // PSV should be within 180 days
  let staleCount = 0;
  let totalChecked = 0;
  const staleVCs: string[] = [];

  for (const vc of evidenceVCs) {
    if (vc.issuedAt) {
      totalChecked++;
      const issuedDate = new Date(vc.issuedAt);
      const daysSincePSV = Math.floor((now - issuedDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysSincePSV > maxAgeDays) {
        staleCount++;
        staleVCs.push(`${vc.type} (${daysSincePSV} days old)`);
      }
    }
  }

  const isFresh = staleCount === 0 && totalChecked > 0;
  let details = '';
  if (totalChecked === 0) {
    details = 'No PSV dates available in evidence VCs';
  } else if (staleCount === 0) {
    details = `All PSV checks fresh (${totalChecked} VCs checked, all within ${maxAgeDays} days)`;
  } else {
    details = `${staleCount} of ${totalChecked} PSV checks stale: ${staleVCs.join(', ')}`;
  }

  return {
    needsCheck: true,
    isFresh,
    details,
    staleCount,
    totalChecked,
  };
}

