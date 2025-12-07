import { PrismaClient } from '@prisma/client';
import { ChainClient } from '../chain/client';

const prisma = new PrismaClient();

const chainClient = new ChainClient();

export interface RoutingRegion {
  state: string;
  country?: string;
  eligible: boolean;
  method: 'direct' | 'compact' | 'reciprocity' | 'emergency';
  restrictions?: string[];
  expirationDate?: string;
}

export interface RoutingRoute {
  from: string;
  to: string;
  method: string;
  eligible: boolean;
  requirements?: string[];
}

export interface RoutingEligibility {
  regions: RoutingRegion[];
  routes: RoutingRoute[];
  conflicts: Array<{
    type: string;
    description: string;
  }>;
}

/**
 * Calculate where clinician can legally practice today
 */
export async function calculateRoutingEligibility(
  clinicianId: string,
): Promise<RoutingEligibility> {
  // Fetch licenses
  const licenses = await prisma.globalLicense.findMany({
    where: { clinicianId, status: 'active' },
  });

  // Fetch compact memberships
  const compacts = await prisma.compactEligibility.findMany({
    where: { clinicianId, eligible: true },
  });

  // Fetch mobility passport
  const mobility = await prisma.mobilityPassport.findUnique({
    where: { clinicianId },
  });

  const regions: RoutingRegion[] = [];
  const routes: RoutingRoute[] = [];
  const conflicts: Array<{ type: string; description: string }> = [];

  // Add direct license states
  licenses.forEach((license) => {
    if (license.state && license.country === 'US') {
      regions.push({
        state: license.state,
        country: 'US',
        eligible: true,
        method: 'direct',
        expirationDate: license.expiresAt?.toISOString(),
      });
    }
  });

  // Add compact-eligible states
  compacts.forEach((compact) => {
    // Simplified: assume compact covers multiple states
    const compactStates = getCompactStates(compact.compact);
    compactStates.forEach((state) => {
      if (!regions.find((r) => r.state === state)) {
        regions.push({
          state,
          country: 'US',
          eligible: true,
          method: 'compact',
        });
      }
    });
  });

  // Add mobility passport states
  if (mobility) {
    mobility.statesEligible.forEach((state) => {
      if (!regions.find((r) => r.state === state)) {
        regions.push({
          state,
          country: 'US',
          eligible: true,
          method: 'compact', // Assume from compact
        });
      }
    });
  }

  // Build routes between regions
  regions.forEach((from) => {
    regions.forEach((to) => {
      if (from.state !== to.state) {
        routes.push({
          from: from.state,
          to: to.state,
          method: from.method === 'direct' ? 'direct' : 'compact',
          eligible: true,
        });
      }
    });
  });

  // Detect conflicts
  const stateCounts = new Map<string, number>();
  regions.forEach((r) => {
    stateCounts.set(r.state, (stateCounts.get(r.state) || 0) + 1);
  });

  stateCounts.forEach((count, state) => {
    if (count > 1) {
      conflicts.push({
        type: 'duplicate_eligibility',
        description: `Multiple eligibility methods for ${state}`,
      });
    }
  });

  // Save routing snapshot
  await prisma.workforceRouting.upsert({
    where: { clinicianId },
    create: {
      clinicianId,
      regions: regions as any,
      routes: routes as any,
    },
    update: {
      regions: regions as any,
      routes: routes as any,
    },
  });

  return { regions, routes, conflicts };
}

/**
 * Route cross-border (UK→US, AU→US, SG→US)
 */
export async function calculateCrossBorderRouting(
  clinicianId: string,
  sourceCountry: string,
  targetCountry: string = 'US',
): Promise<{
  eligible: boolean;
  method: string;
  requirements: string[];
  equivalency?: string;
}> {
  // Fetch foreign credentials
  const foreignCreds = await prisma.foreignCredential.findMany({
    where: { clinicianId, country: sourceCountry },
  });

  if (foreignCreds.length === 0) {
    return {
      eligible: false,
      method: 'none',
      requirements: ['No foreign credentials found'],
    };
  }

  // Check equivalency rules
  const equivalency = await prisma.countryEquivalencyRule.findFirst({
    where: {
      country: sourceCountry,
      usEquivalent: targetCountry,
    },
  });

  if (!equivalency) {
    return {
      eligible: false,
      method: 'none',
      requirements: [`No equivalency rule found for ${sourceCountry} → ${targetCountry}`],
    };
  }

  return {
    eligible: true,
    method: equivalency.level,
    requirements: [],
    equivalency: equivalency.usEquivalent,
  };
}

/**
 * Surge routing mode (emergencies/disaster waivers)
 */
export async function calculateSurgeRouting(
  clinicianId: string,
  targetState: string,
  emergencyType: 'disaster' | 'pandemic' | 'shortage',
): Promise<{
  eligible: boolean;
  waiverType?: string;
  expirationDate?: string;
  restrictions?: string[];
}> {
  // Check if clinician has emergency privileges
  const emergencyPrivs = await prisma.emergencyPrivilege.findMany({
    where: {
      clinicianId,
      expiresAt: { gt: new Date() },
      revokedAt: null,
    },
  });

  // Check for active emergency waivers
  const hasActiveWaiver = emergencyPrivs.some((ep) => {
    // Simplified: check if waiver covers target state
    return true; // In production, check org location vs target state
  });

  if (!hasActiveWaiver) {
    return {
      eligible: false,
    };
  }

  const earliestExpiration = emergencyPrivs
    .map((ep) => ep.expiresAt)
    .sort()[0];

  return {
    eligible: true,
    waiverType: emergencyType,
    expirationDate: earliestExpiration?.toISOString(),
    restrictions: ['Temporary practice only', 'Subject to state emergency declaration'],
  };
}

/**
 * Detect routing conflicts
 */
export async function detectRoutingConflicts(clinicianId: string): Promise<{
  conflicts: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
  }>;
}> {
  const routing = await prisma.workforceRouting.findUnique({
    where: { clinicianId },
  });

  if (!routing) {
    return { conflicts: [] };
  }

  const regions = routing.regions as RoutingRegion[];
  const conflicts: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
  }> = [];

  // Check for conflicting restrictions
  regions.forEach((region) => {
    if (region.restrictions && region.restrictions.length > 0) {
      conflicts.push({
        type: 'restrictions',
        severity: 'medium',
        description: `${region.state} has restrictions: ${region.restrictions.join(', ')}`,
      });
    }
  });

  // Check for expired eligibility
  const expired = regions.filter((r) => {
    if (!r.expirationDate) return false;
    return new Date(r.expirationDate) < new Date();
  });

  if (expired.length > 0) {
    conflicts.push({
      type: 'expired_eligibility',
      severity: 'high',
      description: `${expired.length} region(s) with expired eligibility`,
    });
  }

  return { conflicts };
}

/**
 * Suggest next states to activate (compacts, exams)
 */
export async function suggestNextStates(clinicianId: string): Promise<{
  suggestions: Array<{
    state: string;
    method: 'compact' | 'exam' | 'reciprocity';
    priority: 'low' | 'medium' | 'high';
    requirements: string[];
  }>;
}> {
  const routing = await prisma.workforceRouting.findUnique({
    where: { clinicianId },
  });

  const suggestions: Array<{
    state: string;
    method: 'compact' | 'exam' | 'reciprocity';
    priority: 'low' | 'medium' | 'high';
    requirements: string[];
  }> = [];

  // Simplified: suggest states based on demand
  const highDemandStates = ['CA', 'TX', 'FL', 'NY'];

  highDemandStates.forEach((state) => {
    const hasEligibility = (routing?.regions as RoutingRegion[])?.some(
      (r) => r.state === state,
    );

    if (!hasEligibility) {
      suggestions.push({
        state,
        method: 'compact',
        priority: 'high',
        requirements: ['Check compact eligibility', 'Verify license status'],
      });
    }
  });

  return { suggestions };
}

/**
 * Anchor routing snapshot
 */
export async function anchorRoutingSnapshot(clinicianId: string): Promise<string | null> {
  try {
    const routing = await prisma.workforceRouting.findUnique({
      where: { clinicianId },
    });

    if (!routing) {
      return null;
    }

    const receipt = await chainClient.submitAuditEvent({
      eventType: 'routingSnapshotAnchored',
      payload: {
        clinicianId,
        regions: routing.regions,
        routes: routing.routes,
      },
    });

    return receipt.txHash;
  } catch (error) {
    console.error('[WorkforceRouting] Failed to anchor routing snapshot', error);
    return null;
  }
}

// Helper function to get compact states (simplified)
function getCompactStates(compact: string): string[] {
  // Simplified mapping - in production, query actual compact data
  const compactMap: Record<string, string[]> = {
    'Nurse Licensure Compact': ['AL', 'AZ', 'AR', 'CO', 'DE', 'FL', 'GA', 'ID', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MS', 'MO', 'MT', 'NE', 'NH', 'NM', 'NC', 'ND', 'OK', 'SC', 'SD', 'TN', 'TX', 'UT', 'VA', 'WV', 'WI', 'WY'],
    'Physician Compact': ['AL', 'AZ', 'AR', 'CO', 'DE', 'FL', 'GA', 'ID', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MS', 'MO', 'MT', 'NE', 'NH', 'NM', 'NC', 'ND', 'OK', 'SC', 'SD', 'TN', 'TX', 'UT', 'VA', 'WV', 'WI', 'WY'],
  };

  return compactMap[compact] || [];
}

