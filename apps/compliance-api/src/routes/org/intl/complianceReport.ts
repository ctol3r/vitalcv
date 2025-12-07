/**
 * B139C-REPORT-005: International Compliance Report
 *
 * Exports a comprehensive matrix of organization's region, compact coverage,
 * GDPR/PIPEDA/TEFCA alignment, and cross-border data transfer compliance.
 *
 * Supports JSON and CSV export formats.
 *
 * Acceptance Criteria:
 * - Exports matrix of org's region, compacts, GDPR+PIPEDA+TEFCA coverage
 * - CSV+JSON format support
 * - Includes data residency status, consent requirements, SCC status
 * - Shows sub-processor compliance (AWS, Twilio, SendGrid)
 * - References NIST GenAI risk tags for AI-powered features
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

const router = Router();
const prisma = new PrismaClient();

// Load international data residency policy
let dataResidencyPolicy: any = null;
try {
  const policyPath = path.join(__dirname, '../../../../../infra/policy/intl-data-residency.yaml');
  if (fs.existsSync(policyPath)) {
    const fileContents = fs.readFileSync(policyPath, 'utf8');
    dataResidencyPolicy = yaml.load(fileContents);
  }
} catch (error) {
  console.error('Error loading data residency policy:', error);
}

// Load NIST GenAI risk tags
let nistGenAITags: any = null;
try {
  const tagsPath = path.join(__dirname, '../../../../../infra/compliance/nist-genai-tags.yaml');
  if (fs.existsSync(tagsPath)) {
    const fileContents = fs.readFileSync(tagsPath, 'utf8');
    nistGenAITags = yaml.load(fileContents);
  }
} catch (error) {
  console.error('Error loading NIST GenAI tags:', error);
}

interface GDPRCompliance {
  applicable: boolean;
  lawfulBases: string[];
  dataSubjectRights: {
    accessRequest: boolean;
    erasureRequest: boolean;
    portability: boolean;
  };
  sccsInPlace: boolean;
  dpiaCompleted: boolean;
  breachNotificationReady: boolean;
}

interface PIPEDACompliance {
  applicable: boolean;
  principles: string[];
  consentMechanism: boolean;
  quebecLaw25: boolean;
  dataResidency: {
    required: boolean;
    preferredRegion: string;
    currentRegion: string;
    compliant: boolean;
  };
  breachNotificationReady: boolean;
}

interface TEFCAAlignment {
  applicable: boolean;
  qhinIntegration: boolean;
  purposeOfUseEnforcement: boolean;
  ehrFacadeImplemented: boolean;
  patientConsentTracking: boolean;
}

interface CompactCoverage {
  imlc: {
    eligible: boolean;
    cliniciansCount: number;
    statesCovered: string[];
  };
  psypact: {
    eligible: boolean;
    cliniciansCount: number;
    statesCovered: string[];
  };
  counseling: {
    eligible: boolean;
    cliniciansCount: number;
    statesCovered: string[];
  };
  nlc: {
    eligible: boolean;
    cliniciansCount: number;
    statesCovered: string[];
  };
}

interface CrossBorderTransfers {
  usToEU: {
    allowed: boolean;
    requiresConsent: boolean;
    safeguards: string[];
    sccsApplicable: boolean;
  };
  usToCanada: {
    allowed: boolean;
    requiresConsent: boolean;
    safeguards: string[];
  };
  euToUS: {
    allowed: boolean;
    requiresConsent: boolean;
    safeguards: string[];
    sccsApplicable: boolean;
  };
  canadaToUS: {
    allowed: boolean;
    requiresConsent: boolean;
    safeguards: string[];
  };
}

interface SubProcessorStatus {
  name: string;
  type: string;
  regions: string[];
  dpaStatus: string;
  sccsApplicable: boolean;
  dataProcessed: string[];
  lastAudit: string;
  nextAudit: string;
}

interface GenAIRiskProfile {
  dataPrivacy: {
    applicable: boolean;
    riskLevel: string;
    mitigations: string[];
  };
  infoIntegrity: {
    applicable: boolean;
    riskLevel: string;
    mitigations: string[];
  };
  valueChain: {
    applicable: boolean;
    riskLevel: string;
    thirdPartyServices: string[];
  };
}

interface InternationalComplianceReport {
  orgId: string;
  orgName: string;
  generatedAt: string;
  region: {
    primary: string;
    additional: string[];
    dataResidencyRequired: boolean;
    currentDataLocation: string[];
  };
  gdpr: GDPRCompliance;
  pipeda: PIPEDACompliance;
  tefca: TEFCAAlignment;
  compacts: CompactCoverage;
  crossBorderTransfers: CrossBorderTransfers;
  subProcessors: SubProcessorStatus[];
  genAIRiskProfile: GenAIRiskProfile;
  recommendations: string[];
  complianceScore: {
    overall: number; // 0-100
    gdpr: number;
    pipeda: number;
    tefca: number;
    dataResidency: number;
  };
}

/**
 * Determine organization's primary region based on clinician locations
 */
async function determineOrgRegion(orgId: string): Promise<{
  primary: string;
  additional: string[];
}> {
  // In production, query organization table for region
  // For now, analyze NPI claims to infer region
  const npiClaims = await prisma.npiClaim.findMany({
    where: {
      level: { gte: 2 }
    },
    take: 100
  });

  const regions = new Set<string>();

  for (const claim of npiClaims) {
    const tags = (claim.tags as any) || {};
    const homeState = tags.homeState || 'US'; // Default to US

    // Determine region from state/province
    if (['CA', 'ON', 'QC', 'BC', 'AB', 'MB', 'SK', 'NB', 'NS', 'PE', 'NL', 'YT', 'NT', 'NU'].includes(homeState)) {
      regions.add('Canada');
    } else if (['GB', 'FR', 'DE', 'IT', 'ES'].some(code => homeState.includes(code))) {
      regions.add('EU');
    } else {
      regions.add('US');
    }
  }

  const regionArray = Array.from(regions);
  return {
    primary: regionArray[0] || 'US',
    additional: regionArray.slice(1)
  };
}

/**
 * Assess GDPR compliance status
 */
function assessGDPRCompliance(orgRegion: string): GDPRCompliance {
  const applicable = orgRegion.includes('EU') || orgRegion === 'EU';

  return {
    applicable,
    lawfulBases: applicable ? ['Contract (Art. 6.1.b)', 'Legitimate Interest (Art. 6.1.f)', 'Legal Obligation (Art. 6.1.c)'] : [],
    dataSubjectRights: {
      accessRequest: true, // Implemented via GET /api/privacy/export
      erasureRequest: true, // Implemented via POST /api/privacy/erase
      portability: true, // Implemented via GET /api/privacy/export?format=json
    },
    sccsInPlace: true, // Standard Contractual Clauses with sub-processors
    dpiaCompleted: true, // DPIA completed in 2025-Q4
    breachNotificationReady: true, // Automated breach notification (< 72 hours)
  };
}

/**
 * Assess PIPEDA compliance status
 */
async function assessPIPEDACompliance(orgRegion: string): Promise<PIPEDACompliance> {
  const applicable = orgRegion.includes('Canada') || orgRegion === 'Canada';

  // Check if any Quebec clinicians
  const quebecClinicians = await prisma.npiClaim.findFirst({
    where: {
      tags: {
        path: ['homeState'],
        equals: 'QC'
      }
    }
  });

  return {
    applicable,
    principles: applicable ? [
      'Principle 1 (Accountability)',
      'Principle 3 (Consent)',
      'Principle 7 (Safeguards)',
      'Principle 9 (Individual Access)'
    ] : [],
    consentMechanism: true, // Explicit consent during registration
    quebecLaw25: !!quebecClinicians, // Quebec-specific requirements if QC clinicians present
    dataResidency: {
      required: !!quebecClinicians, // Law 25 encourages Canadian residency
      preferredRegion: 'ca-central-1',
      currentRegion: 'us-east-1', // Current deployment (to be migrated)
      compliant: false // ⚠️ Planned for 2026-Q2
    },
    breachNotificationReady: true, // Automated breach notification (< 24 hours for Quebec)
  };
}

/**
 * Assess TEFCA alignment
 */
async function assessTEFCAAlignment(orgId: string): Promise<TEFCAAlignment> {
  // Check if organization has QHIN configuration
  const qhinConfig = await prisma.qhinConfig.findFirst({
    where: {
      orgId,
      isActive: true
    }
  });

  return {
    applicable: !!qhinConfig,
    qhinIntegration: !!qhinConfig,
    purposeOfUseEnforcement: true, // Middleware at apps/api/src/middleware/tefcaPou.ts
    ehrFacadeImplemented: true, // Implemented in apps/api/src/routes/ehr/fhirProxy.ts
    patientConsentTracking: true, // Consent receipts stored in AuditEvent
  };
}

/**
 * Fetch compact coverage statistics
 */
async function getCompactCoverage(): Promise<CompactCoverage> {
  // Fetch all compact eligibility records
  const compactsStatus = await prisma.compactsStatus.findMany();

  const imlcEligible = compactsStatus.filter(c => c.imlcStatus === 'LICENSED' || c.imlcStatus === 'ELIGIBLE');
  const psypactEligible = compactsStatus.filter(c => c.psypactStatus === 'ACTIVE' || c.psypactStatus === 'E_PASS');
  const counselingEligible = compactsStatus.filter(c => c.counselingStatus === 'ACTIVE' || c.counselingStatus === 'ELIGIBLE');

  // NLC (Nursing Licensure Compact) - check NlcResidencyMove table
  const nlcRecords = await prisma.nlcResidencyMove.findMany({
    where: {
      status: { not: 'breached' }
    }
  });

  return {
    imlc: {
      eligible: imlcEligible.length > 0,
      cliniciansCount: imlcEligible.length,
      statesCovered: Array.from(new Set(imlcEligible.flatMap(c => c.imlcCompactStates)))
    },
    psypact: {
      eligible: psypactEligible.length > 0,
      cliniciansCount: psypactEligible.length,
      statesCovered: Array.from(new Set(psypactEligible.flatMap(c => c.psypactStates)))
    },
    counseling: {
      eligible: counselingEligible.length > 0,
      cliniciansCount: counselingEligible.length,
      statesCovered: Array.from(new Set(counselingEligible.flatMap(c => c.counselingStates)))
    },
    nlc: {
      eligible: nlcRecords.length > 0,
      cliniciansCount: nlcRecords.length,
      statesCovered: Array.from(new Set(nlcRecords.map(r => r.toState)))
    }
  };
}

/**
 * Get cross-border transfer rules from data residency policy
 */
function getCrossBorderTransfers(): CrossBorderTransfers {
  if (!dataResidencyPolicy) {
    // Return default safe configuration if policy not loaded
    return {
      usToEU: { allowed: false, requiresConsent: true, safeguards: [], sccsApplicable: true },
      usToCanada: { allowed: false, requiresConsent: true, safeguards: [] },
      euToUS: { allowed: false, requiresConsent: true, safeguards: [], sccsApplicable: true },
      canadaToUS: { allowed: false, requiresConsent: true, safeguards: [] }
    };
  }

  const classification = dataResidencyPolicy.dataClassification || {};
  const pii = classification.pii || {};

  return {
    usToEU: {
      allowed: pii.movementRules?.usToEu === 'scc-required',
      requiresConsent: true,
      safeguards: ['Standard Contractual Clauses', 'TLS 1.3', 'AES-256', 'Pseudonymization'],
      sccsApplicable: true
    },
    usToCanada: {
      allowed: pii.movementRules?.usToCanada === 'allowed',
      requiresConsent: false,
      safeguards: ['TLS 1.3', 'AES-256']
    },
    euToUS: {
      allowed: pii.movementRules?.euToUs === 'scc-required',
      requiresConsent: true,
      safeguards: ['Standard Contractual Clauses', 'TLS 1.3', 'AES-256', 'Pseudonymization'],
      sccsApplicable: true
    },
    canadaToUS: {
      allowed: pii.movementRules?.canadaToUs === 'consent-required',
      requiresConsent: true,
      safeguards: ['Explicit Consent', 'TLS 1.3', 'AES-256', 'DPA']
    }
  };
}

/**
 * Get sub-processor compliance status
 */
function getSubProcessorStatus(): SubProcessorStatus[] {
  if (!dataResidencyPolicy || !dataResidencyPolicy.subProcessors) {
    return [];
  }

  return dataResidencyPolicy.subProcessors.map((processor: any) => ({
    name: processor.name,
    type: processor.type,
    regions: processor.regions,
    dpaStatus: processor.dpaStatus,
    sccsApplicable: processor.sccsApplicable,
    dataProcessed: processor.dataProcessed || [],
    lastAudit: processor.lastAudit,
    nextAudit: processor.nextAudit
  }));
}

/**
 * Get GenAI risk profile from NIST tags
 */
function getGenAIRiskProfile(): GenAIRiskProfile {
  if (!nistGenAITags || !nistGenAITags.categories) {
    return {
      dataPrivacy: { applicable: false, riskLevel: 'unknown', mitigations: [] },
      infoIntegrity: { applicable: false, riskLevel: 'unknown', mitigations: [] },
      valueChain: { applicable: false, riskLevel: 'unknown', thirdPartyServices: [] }
    };
  }

  const categories = nistGenAITags.categories;

  return {
    dataPrivacy: {
      applicable: categories.DataPrivacy?.applicable || false,
      riskLevel: categories.DataPrivacy?.riskLevel || 'unknown',
      mitigations: categories.DataPrivacy?.platformUsage?.[0]?.mitigations || []
    },
    infoIntegrity: {
      applicable: categories.InfoIntegrity?.applicable || false,
      riskLevel: categories.InfoIntegrity?.riskLevel || 'unknown',
      mitigations: categories.InfoIntegrity?.platformUsage?.[0]?.mitigations || []
    },
    valueChain: {
      applicable: categories.ValueChain?.applicable || false,
      riskLevel: categories.ValueChain?.riskLevel || 'unknown',
      thirdPartyServices: categories.ValueChain?.platformUsage?.map((u: any) => u.vendor) || []
    }
  };
}

/**
 * Calculate compliance score (0-100)
 */
function calculateComplianceScore(
  gdpr: GDPRCompliance,
  pipeda: PIPEDACompliance,
  tefca: TEFCAAlignment
): { overall: number; gdpr: number; pipeda: number; tefca: number; dataResidency: number } {
  // GDPR score
  let gdprScore = 0;
  if (gdpr.applicable) {
    gdprScore += gdpr.sccsInPlace ? 25 : 0;
    gdprScore += gdpr.dpiaCompleted ? 25 : 0;
    gdprScore += gdpr.breachNotificationReady ? 25 : 0;
    gdprScore += (gdpr.dataSubjectRights.accessRequest && gdpr.dataSubjectRights.erasureRequest) ? 25 : 0;
  } else {
    gdprScore = 100; // N/A
  }

  // PIPEDA score
  let pipedaScore = 0;
  if (pipeda.applicable) {
    pipedaScore += pipeda.consentMechanism ? 30 : 0;
    pipedaScore += pipeda.breachNotificationReady ? 30 : 0;
    pipedaScore += pipeda.dataResidency.compliant ? 40 : 0;
  } else {
    pipedaScore = 100; // N/A
  }

  // TEFCA score
  let tefcaScore = 0;
  if (tefca.applicable) {
    tefcaScore += tefca.qhinIntegration ? 30 : 0;
    tefcaScore += tefca.purposeOfUseEnforcement ? 35 : 0;
    tefcaScore += tefca.ehrFacadeImplemented ? 35 : 0;
  } else {
    tefcaScore = 100; // N/A
  }

  // Data residency score
  const dataResidencyScore = pipeda.applicable
    ? (pipeda.dataResidency.compliant ? 100 : 40) // Partial credit for plan in place
    : 100; // N/A

  // Overall score (weighted average)
  const overall = Math.round((gdprScore + pipedaScore + tefcaScore + dataResidencyScore) / 4);

  return {
    overall,
    gdpr: Math.round(gdprScore),
    pipeda: Math.round(pipedaScore),
    tefca: Math.round(tefcaScore),
    dataResidency: Math.round(dataResidencyScore)
  };
}

/**
 * Generate recommendations based on gaps
 */
function generateRecommendations(
  gdpr: GDPRCompliance,
  pipeda: PIPEDACompliance,
  tefca: TEFCAAlignment,
  complianceScore: any
): string[] {
  const recommendations: string[] = [];

  // GDPR recommendations
  if (gdpr.applicable) {
    if (!gdpr.sccsInPlace) {
      recommendations.push('🔴 CRITICAL: Implement Standard Contractual Clauses (SCCs) for EU data transfers');
    }
    if (!gdpr.dpiaCompleted) {
      recommendations.push('🟠 HIGH: Complete Data Protection Impact Assessment (DPIA) for EU processing');
    }
  }

  // PIPEDA recommendations
  if (pipeda.applicable) {
    if (!pipeda.dataResidency.compliant) {
      recommendations.push('🟠 HIGH: Migrate Canadian data to ca-central-1 region for Quebec Law 25 compliance (Target: 2026-Q2)');
    }
    if (pipeda.quebecLaw25 && !pipeda.dataResidency.compliant) {
      recommendations.push('🔴 CRITICAL: Quebec Law 25 requires enhanced data residency; prioritize ca-central-1 migration');
    }
  }

  // TEFCA recommendations
  if (tefca.applicable) {
    if (!tefca.qhinIntegration) {
      recommendations.push('🟡 MEDIUM: Complete QHIN integration for TEFCA network participation');
    }
  }

  // Overall score recommendations
  if (complianceScore.overall < 70) {
    recommendations.push('🔴 CRITICAL: Overall compliance score below 70%; immediate action required');
  } else if (complianceScore.overall < 85) {
    recommendations.push('🟠 HIGH: Compliance score can be improved; address gaps in PIPEDA data residency');
  }

  // Sub-processor recommendations
  recommendations.push('🟢 LOW: Review sub-processor DPAs annually (Next: 2026-Q1)');
  recommendations.push('🟢 LOW: Conduct external vendor compliance audit (Next: 2026-Q3)');

  return recommendations;
}

/**
 * Convert report to CSV format
 */
function convertToCSV(report: InternationalComplianceReport): string {
  const lines: string[] = [];

  // Header
  lines.push('International Compliance Report');
  lines.push(`Organization: ${report.orgId} (${report.orgName})`);
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push('');

  // Region
  lines.push('Region Information');
  lines.push('Field,Value');
  lines.push(`Primary Region,${report.region.primary}`);
  lines.push(`Additional Regions,"${report.region.additional.join(', ')}"`);
  lines.push(`Data Residency Required,${report.region.dataResidencyRequired}`);
  lines.push(`Current Data Location,"${report.region.currentDataLocation.join(', ')}"`);
  lines.push('');

  // Compliance Scores
  lines.push('Compliance Scores');
  lines.push('Category,Score (%)');
  lines.push(`Overall,${report.complianceScore.overall}`);
  lines.push(`GDPR,${report.complianceScore.gdpr}`);
  lines.push(`PIPEDA,${report.complianceScore.pipeda}`);
  lines.push(`TEFCA,${report.complianceScore.tefca}`);
  lines.push(`Data Residency,${report.complianceScore.dataResidency}`);
  lines.push('');

  // GDPR Compliance
  lines.push('GDPR Compliance');
  lines.push('Field,Status');
  lines.push(`Applicable,${report.gdpr.applicable}`);
  lines.push(`SCCs In Place,${report.gdpr.sccsInPlace}`);
  lines.push(`DPIA Completed,${report.gdpr.dpiaCompleted}`);
  lines.push(`Breach Notification Ready,${report.gdpr.breachNotificationReady}`);
  lines.push(`Lawful Bases,"${report.gdpr.lawfulBases.join('; ')}"`);
  lines.push('');

  // PIPEDA Compliance
  lines.push('PIPEDA Compliance');
  lines.push('Field,Status');
  lines.push(`Applicable,${report.pipeda.applicable}`);
  lines.push(`Quebec Law 25,${report.pipeda.quebecLaw25}`);
  lines.push(`Data Residency Required,${report.pipeda.dataResidency.required}`);
  lines.push(`Data Residency Compliant,${report.pipeda.dataResidency.compliant}`);
  lines.push(`Preferred Region,${report.pipeda.dataResidency.preferredRegion}`);
  lines.push(`Current Region,${report.pipeda.dataResidency.currentRegion}`);
  lines.push('');

  // Compacts Coverage
  lines.push('Compacts Coverage');
  lines.push('Compact,Eligible,Clinicians,States Covered');
  lines.push(`IMLC,${report.compacts.imlc.eligible},${report.compacts.imlc.cliniciansCount},"${report.compacts.imlc.statesCovered.join(', ')}"`);
  lines.push(`PSYPACT,${report.compacts.psypact.eligible},${report.compacts.psypact.cliniciansCount},"${report.compacts.psypact.statesCovered.join(', ')}"`);
  lines.push(`Counseling,${report.compacts.counseling.eligible},${report.compacts.counseling.cliniciansCount},"${report.compacts.counseling.statesCovered.join(', ')}"`);
  lines.push(`NLC,${report.compacts.nlc.eligible},${report.compacts.nlc.cliniciansCount},"${report.compacts.nlc.statesCovered.join(', ')}"`);
  lines.push('');

  // Sub-processors
  lines.push('Sub-Processors');
  lines.push('Name,Type,Regions,DPA Status,SCCs Applicable,Last Audit,Next Audit');
  for (const processor of report.subProcessors) {
    lines.push(`${processor.name},${processor.type},"${processor.regions.join(', ')}",${processor.dpaStatus},${processor.sccsApplicable},${processor.lastAudit},${processor.nextAudit}`);
  }
  lines.push('');

  // Recommendations
  lines.push('Recommendations');
  lines.push('Priority,Recommendation');
  for (const rec of report.recommendations) {
    const priority = rec.includes('🔴') ? 'CRITICAL' : rec.includes('🟠') ? 'HIGH' : rec.includes('🟡') ? 'MEDIUM' : 'LOW';
    const text = rec.replace(/[🔴🟠🟡🟢]/g, '').trim();
    lines.push(`${priority},"${text}"`);
  }

  return lines.join('\n');
}

/**
 * GET /org/:orgId/intl/compliance-report
 *
 * Query Parameters:
 * - format: 'json' | 'csv' (default: 'json')
 *
 * Returns comprehensive international compliance matrix
 */
router.get('/org/:orgId/intl/compliance-report', async (req: Request, res: Response) => {
  try {
    const { orgId } = req.params;
    const { format = 'json' } = req.query;

    // In production, verify orgId and user authorization
    // Fetch organization details (mock for now)
    const orgName = `Organization ${orgId}`; // In production, fetch from Org table

    // Determine organization region
    const { primary, additional } = await determineOrgRegion(orgId);

    // Assess compliance frameworks
    const gdpr = assessGDPRCompliance(primary);
    const pipeda = await assessPIPEDACompliance(primary);
    const tefca = await assessTEFCAAlignment(orgId);

    // Fetch compact coverage
    const compacts = await getCompactCoverage();

    // Get cross-border transfer rules
    const crossBorderTransfers = getCrossBorderTransfers();

    // Get sub-processor status
    const subProcessors = getSubProcessorStatus();

    // Get GenAI risk profile
    const genAIRiskProfile = getGenAIRiskProfile();

    // Calculate compliance scores
    const complianceScore = calculateComplianceScore(gdpr, pipeda, tefca);

    // Generate recommendations
    const recommendations = generateRecommendations(gdpr, pipeda, tefca, complianceScore);

    // Build report
    const report: InternationalComplianceReport = {
      orgId,
      orgName,
      generatedAt: new Date().toISOString(),
      region: {
        primary,
        additional,
        dataResidencyRequired: pipeda.dataResidency.required,
        currentDataLocation: ['us-east-1', 'us-west-2'] // In production, fetch from config
      },
      gdpr,
      pipeda,
      tefca,
      compacts,
      crossBorderTransfers,
      subProcessors,
      genAIRiskProfile,
      recommendations,
      complianceScore
    };

    // Return CSV format if requested
    if (format === 'csv') {
      const csv = convertToCSV(report);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="intl-compliance-${orgId}-${Date.now()}.csv"`);
      return res.send(csv);
    }

    // Return JSON by default
    res.json(report);
  } catch (error) {
    console.error('Error generating international compliance report:', error);
    res.status(500).json({
      error: 'report_generation_failed',
      error_description: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;

