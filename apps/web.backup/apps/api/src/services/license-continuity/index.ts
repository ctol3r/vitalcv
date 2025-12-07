import { PrismaClient } from '@prisma/client';
import { anchorEvent } from '../audit/anchor';

const prisma = new PrismaClient();

export interface LicenseContinuityData {
  states: Array<{
    state: string;
    licenseNumber: string;
    status: 'active' | 'expired' | 'suspended' | 'revoked';
    expirationDate?: string;
    renewalDate?: string;
    compactEligible: boolean;
  }>;
  international: Array<{
    country: string;
    authority: string;
    licenseNumber: string;
    status: string;
    equivalency?: string;
  }>;
  continuityScore: number;
  gaps: Array<{
    type: 'renewal' | 'sanction' | 'lapse' | 'expiration';
    state?: string;
    country?: string;
    predictedDate: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }>;
  lastUpdated: string;
}

/**
 * Get license continuity for a clinician
 */
export async function getLicenseContinuity(clinicianId: string): Promise<LicenseContinuityData | null> {
  const record = await prisma.licenseContinuity.findUnique({
    where: { clinicianId },
  });

  if (!record) {
    return null;
  }

  return record.continuity as LicenseContinuityData;
}

/**
 * Update license continuity for a clinician
 */
export async function updateLicenseContinuity(
  clinicianId: string,
  continuity: LicenseContinuityData,
): Promise<void> {
  await prisma.licenseContinuity.upsert({
    where: { clinicianId },
    create: {
      clinicianId,
      continuity: continuity as any,
      updatedAt: new Date(),
    },
    update: {
      continuity: continuity as any,
      updatedAt: new Date(),
    },
  });
}

/**
 * Check cross-state license continuity (NLC/IMLC/PSYPACT)
 */
export async function checkCrossStateContinuity(clinicianId: string): Promise<{
  nlcEligible: boolean;
  imlcEligible: boolean;
  psypactEligible: boolean;
  states: string[];
}> {
  const continuity = await getLicenseContinuity(clinicianId);
  if (!continuity) {
    return {
      nlcEligible: false,
      imlcEligible: false,
      psypactEligible: false,
      states: [],
    };
  }

  const activeStates = continuity.states
    .filter((s) => s.status === 'active')
    .map((s) => s.state);

  // NLC (Nurse Licensure Compact) - 39 states
  const nlcStates = [
    'AL', 'AZ', 'AR', 'CO', 'DE', 'FL', 'GA', 'ID', 'IN', 'IA', 'KS', 'KY',
    'LA', 'ME', 'MD', 'MS', 'MO', 'MT', 'NE', 'NH', 'NM', 'NC', 'ND', 'OK',
    'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WV', 'WI', 'WY',
  ];
  const nlcEligible = activeStates.some((state) => nlcStates.includes(state));

  // IMLC (Interstate Medical Licensure Compact) - 37 states
  const imlcStates = [
    'AL', 'AZ', 'CO', 'CT', 'DE', 'GA', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY',
    'LA', 'ME', 'MD', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NM',
    'NC', 'ND', 'OH', 'OK', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'WA', 'WV', 'WI',
  ];
  const imlcEligible = activeStates.some((state) => imlcStates.includes(state));

  // PSYPACT (Psychology Interjurisdictional Compact) - 40 states
  const psypactStates = [
    'AL', 'AZ', 'AR', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'ID', 'IL', 'IN',
    'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MI', 'MN', 'MS', 'MO', 'NE', 'NV',
    'NH', 'NJ', 'NM', 'NC', 'ND', 'OH', 'OK', 'PA', 'SC', 'SD', 'TN', 'TX',
    'UT', 'VA', 'WA', 'WV', 'WI', 'WY',
  ];
  const psypactEligible = activeStates.some((state) => psypactStates.includes(state));

  return {
    nlcEligible,
    imlcEligible,
    psypactEligible,
    states: activeStates,
  };
}

/**
 * Validate international license continuity (US→UK/AU/SG equivalencies)
 */
export async function validateInternationalContinuity(clinicianId: string): Promise<{
  uk: { eligible: boolean; equivalency?: string };
  au: { eligible: boolean; equivalency?: string };
  sg: { eligible: boolean; equivalency?: string };
}> {
  const continuity = await getLicenseContinuity(clinicianId);
  if (!continuity) {
    return {
      uk: { eligible: false },
      au: { eligible: false },
      sg: { eligible: false },
    };
  }

  const usLicense = continuity.states.find((s) => s.status === 'active');
  if (!usLicense) {
    return {
      uk: { eligible: false },
      au: { eligible: false },
      sg: { eligible: false },
    };
  }

  // UK: GMC registration typically requires US board certification + equivalency
  const ukEligible = usLicense.status === 'active';
  const ukEquivalency = ukEligible ? 'GMC_Registration_Required' : undefined;

  // AU: AHPRA registration requires US license + equivalency assessment
  const auEligible = usLicense.status === 'active';
  const auEquivalency = auEligible ? 'AHPRA_Registration_Required' : undefined;

  // SG: SMC registration requires US board certification
  const sgEligible = usLicense.status === 'active';
  const sgEquivalency = sgEligible ? 'SMC_Registration_Required' : undefined;

  return {
    uk: { eligible: ukEligible, equivalency: ukEquivalency },
    au: { eligible: auEligible, equivalency: auEquivalency },
    sg: { eligible: sgEligible, equivalency: sgEquivalency },
  };
}

/**
 * Predict continuity risks (renewal, sanctions, lapses)
 */
export async function predictContinuityRisks(clinicianId: string): Promise<Array<{
  type: 'renewal' | 'sanction' | 'lapse' | 'expiration';
  state?: string;
  country?: string;
  predictedDate: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
}>> {
  const continuity = await getLicenseContinuity(clinicianId);
  if (!continuity) {
    return [];
  }

  const risks: Array<{
    type: 'renewal' | 'sanction' | 'lapse' | 'expiration';
    state?: string;
    country?: string;
    predictedDate: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    confidence: number;
  }> = [];

  // Check for upcoming expirations
  const now = new Date();
  for (const license of continuity.states) {
    if (license.expirationDate) {
      const expDate = new Date(license.expirationDate);
      const daysUntilExp = Math.floor((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntilExp > 0 && daysUntilExp <= 90) {
        risks.push({
          type: 'expiration',
          state: license.state,
          predictedDate: license.expirationDate,
          severity: daysUntilExp <= 30 ? 'critical' : daysUntilExp <= 60 ? 'high' : 'medium',
          confidence: 0.95,
        });
      }
    }

    if (license.renewalDate) {
      const renewalDate = new Date(license.renewalDate);
      const daysUntilRenewal = Math.floor((renewalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntilRenewal > 0 && daysUntilRenewal <= 60) {
        risks.push({
          type: 'renewal',
          state: license.state,
          predictedDate: license.renewalDate,
          severity: daysUntilRenewal <= 30 ? 'high' : 'medium',
          confidence: 0.85,
        });
      }
    }
  }

  // Add existing gaps
  for (const gap of continuity.gaps) {
    risks.push({
      type: gap.type,
      state: gap.state,
      country: gap.country,
      predictedDate: gap.predictedDate,
      severity: gap.severity,
      confidence: 0.8,
    });
  }

  return risks.sort((a, b) => {
    const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    return severityOrder[b.severity] - severityOrder[a.severity];
  });
}

/**
 * Calculate continuity decay score (0-100)
 */
export async function calculateContinuityDecayScore(clinicianId: string): Promise<number> {
  const continuity = await getLicenseContinuity(clinicianId);
  if (!continuity) {
    return 0;
  }

  let score = 100;

  // Deduct for gaps
  for (const gap of continuity.gaps) {
    const severityPenalty = {
      critical: 20,
      high: 10,
      medium: 5,
      low: 2,
    };
    score -= severityPenalty[gap.severity];
  }

  // Deduct for expired licenses
  const expiredCount = continuity.states.filter((s) => s.status === 'expired').length;
  score -= expiredCount * 15;

  // Deduct for suspended/revoked licenses
  const suspendedCount = continuity.states.filter((s) => s.status === 'suspended' || s.status === 'revoked').length;
  score -= suspendedCount * 25;

  // Deduct for low continuity score
  if (continuity.continuityScore < 70) {
    score -= (70 - continuity.continuityScore) * 0.5;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Reconcile conflicting license updates
 */
export async function reconcileLicenseEvents(
  clinicianId: string,
  events: Array<{
    type: 'issued' | 'renewed' | 'expired' | 'suspended' | 'revoked';
    state: string;
    licenseNumber: string;
    timestamp: string;
    source: string;
  }>,
): Promise<{
  resolved: Array<{
    state: string;
    licenseNumber: string;
    status: string;
    resolvedAt: string;
  }>;
  conflicts: Array<{
    state: string;
    licenseNumber: string;
    conflictingEvents: string[];
  }>;
}> {
  const resolved: Array<{
    state: string;
    licenseNumber: string;
    status: string;
    resolvedAt: string;
  }> = [];

  const conflicts: Array<{
    state: string;
    licenseNumber: string;
    conflictingEvents: string[];
  }> = [];

  // Group events by state and license number
  const eventMap = new Map<string, typeof events>();
  for (const event of events) {
    const key = `${event.state}:${event.licenseNumber}`;
    if (!eventMap.has(key)) {
      eventMap.set(key, []);
    }
    eventMap.get(key)!.push(event);
  }

  // Resolve each group
  for (const [key, groupEvents] of eventMap.entries()) {
    const [state, licenseNumber] = key.split(':');

    // Sort by timestamp (most recent first)
    groupEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Check for conflicts
    const statuses = groupEvents.map((e) => e.type);
    const uniqueStatuses = new Set(statuses);

    if (uniqueStatuses.size > 1) {
      conflicts.push({
        state,
        licenseNumber,
        conflictingEvents: groupEvents.map((e) => `${e.type}@${e.timestamp} (${e.source})`),
      });
    }

    // Resolve using most recent event
    const latestEvent = groupEvents[0];
    resolved.push({
      state,
      licenseNumber,
      status: latestEvent.type === 'issued' || latestEvent.type === 'renewed' ? 'active' : latestEvent.type,
      resolvedAt: latestEvent.timestamp,
    });
  }

  return { resolved, conflicts };
}

/**
 * Evaluate global reciprocity rules
 */
export async function evaluateGlobalReciprocity(clinicianId: string): Promise<{
  eligibleStates: string[];
  eligibleCountries: string[];
  requirements: Array<{
    jurisdiction: string;
    requirements: string[];
    status: 'eligible' | 'partial' | 'not_eligible';
  }>;
}> {
  const continuity = await getLicenseContinuity(clinicianId);
  if (!continuity) {
    return {
      eligibleStates: [],
      eligibleCountries: [],
      requirements: [],
    };
  }

  const activeStates = continuity.states.filter((s) => s.status === 'active').map((s) => s.state);
  const activeCountries = continuity.international.filter((i) => i.status === 'active').map((i) => i.country);

  const requirements: Array<{
    jurisdiction: string;
    requirements: string[];
    status: 'eligible' | 'partial' | 'not_eligible';
  }> = [];

  // Check compact eligibility
  for (const state of activeStates) {
    const compactEligible = continuity.states.find((s) => s.state === state)?.compactEligible ?? false;
    requirements.push({
      jurisdiction: state,
      requirements: compactEligible ? ['Compact eligible'] : ['Standard reciprocity required'],
      status: compactEligible ? 'eligible' : 'partial',
    });
  }

  // Check international equivalencies
  for (const intl of continuity.international) {
    requirements.push({
      jurisdiction: intl.country,
      requirements: intl.equivalency ? [`Equivalency: ${intl.equivalency}`] : ['Equivalency assessment required'],
      status: intl.equivalency ? 'eligible' : 'partial',
    });
  }

  return {
    eligibleStates: activeStates,
    eligibleCountries: activeCountries,
    requirements,
  };
}

/**
 * Generate continuity renewal pack (checklist to avoid interruptions)
 */
export async function generateRenewalPack(clinicianId: string): Promise<{
  checklist: Array<{
    item: string;
    state?: string;
    country?: string;
    dueDate: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    completed: boolean;
  }>;
  estimatedCost: number;
  timeline: Array<{
    phase: string;
    startDate: string;
    endDate: string;
    tasks: string[];
  }>;
}> {
  const continuity = await getLicenseContinuity(clinicianId);
  if (!continuity) {
    return {
      checklist: [],
      estimatedCost: 0,
      timeline: [],
    };
  }

  const checklist: Array<{
    item: string;
    state?: string;
    country?: string;
    dueDate: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    completed: boolean;
  }> = [];

  const now = new Date();

  // Add renewal items
  for (const license of continuity.states) {
    if (license.renewalDate) {
      const renewalDate = new Date(license.renewalDate);
      const daysUntilRenewal = Math.floor((renewalDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntilRenewal > 0 && daysUntilRenewal <= 90) {
        checklist.push({
          item: `Renew ${license.state} license (${license.licenseNumber})`,
          state: license.state,
          dueDate: license.renewalDate,
          priority: daysUntilRenewal <= 30 ? 'critical' : daysUntilRenewal <= 60 ? 'high' : 'medium',
          completed: false,
        });
      }
    }

    if (license.expirationDate) {
      const expDate = new Date(license.expirationDate);
      const daysUntilExp = Math.floor((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntilExp > 0 && daysUntilExp <= 60) {
        checklist.push({
          item: `Prevent expiration of ${license.state} license (${license.licenseNumber})`,
          state: license.state,
          dueDate: license.expirationDate,
          priority: daysUntilExp <= 30 ? 'critical' : 'high',
          completed: false,
        });
      }
    }
  }

  // Add gap mitigation items
  for (const gap of continuity.gaps) {
    checklist.push({
      item: `Mitigate ${gap.type} gap in ${gap.state || gap.country || 'unknown'}`,
      state: gap.state,
      country: gap.country,
      dueDate: gap.predictedDate,
      priority: gap.severity === 'critical' ? 'critical' : gap.severity === 'high' ? 'high' : 'medium',
      completed: false,
    });
  }

  // Estimate cost (average $200 per renewal)
  const estimatedCost = checklist.length * 200;

  // Generate timeline
  const timeline: Array<{
    phase: string;
    startDate: string;
    endDate: string;
    tasks: string[];
  }> = [];

  if (checklist.length > 0) {
    const sortedChecklist = [...checklist].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    const firstDue = sortedChecklist[0].dueDate;
    const lastDue = sortedChecklist[sortedChecklist.length - 1].dueDate;

    timeline.push({
      phase: 'Renewal Preparation',
      startDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: firstDue,
      tasks: ['Gather required documents', 'Complete renewal applications', 'Submit renewals'],
    });

    timeline.push({
      phase: 'Renewal Execution',
      startDate: firstDue,
      endDate: lastDue,
      tasks: ['Track renewal status', 'Address any issues', 'Confirm renewals'],
    });
  }

  return {
    checklist,
    estimatedCost,
    timeline,
  };
}

/**
 * Anchor continuity snapshot
 */
export async function anchorContinuitySnapshot(clinicianId: string): Promise<void> {
  const continuity = await getLicenseContinuity(clinicianId);
  if (!continuity) {
    return;
  }

  const decayScore = await calculateContinuityDecayScore(clinicianId);
  const risks = await predictContinuityRisks(clinicianId);

  anchorEvent('licenseContinuityAnchored', {
    clinicianId,
    continuityScore: continuity.continuityScore,
    decayScore,
    activeStates: continuity.states.filter((s) => s.status === 'active').length,
    activeCountries: continuity.international.filter((i) => i.status === 'active').length,
    riskCount: risks.length,
    criticalRisks: risks.filter((r) => r.severity === 'critical').length,
    timestamp: new Date().toISOString(),
  });
}

