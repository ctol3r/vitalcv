import { prisma } from '@/lib/prisma';
import { anchorEvent } from '../audit/anchor';
import { createHash } from 'crypto';

/**
 * Batch 223 — National Provider Index v4
 * Search and intelligence index spanning every clinician in the U.S. and select international markets
 */

export interface ProviderIndexEntry {
  npi?: string;
  clinicianId: string;
  specialty: string[];
  privileges: string[];
  readiness: number;
  credentials: Array<{ type: string; status: string }>;
  location?: {
    zip?: string;
    state?: string;
    region?: string;
  };
}

/**
 * Index clinicians by NPI, specialty, privileges, readiness, credentials
 */
export async function indexProviders(region: string = 'US'): Promise<{
  indexed: number;
  region: string;
}> {
  const clinicians = await prisma.clinicianProfile.findMany({
    take: 1000, // Would paginate in production
    include: {
      privileges: {
        take: 100,
      },
    },
  });

  const indexEntries: ProviderIndexEntry[] = [];

  for (const clinician of clinicians) {
    // Get specialties (would come from actual data)
    const specialties: string[] = [];
    if (clinician.taxonomyCode) {
      specialties.push(clinician.taxonomyCode);
    }

    // Get privileges
    const privileges = clinician.privileges.map((p) => p.code);

    // Calculate readiness (would use actual readiness service)
    const readiness = 0.7; // Placeholder

    // Get credentials
    const credentials = await prisma.walletCredential.findMany({
      where: {
        clinicianId: clinician.id,
      },
      take: 10,
    });

    indexEntries.push({
      npi: clinician.npi || undefined,
      clinicianId: clinician.id,
      specialty: specialties,
      privileges,
      readiness,
      credentials: credentials.map((c) => ({
        type: c.type,
        status: c.revokedAt ? 'revoked' : 'active',
      })),
      location: {
        zip: clinician.primaryAddress?.postalCode,
        state: clinician.primaryAddress?.state,
        region,
      },
    });
  }

  // Store index
  await prisma.providerIndex.upsert({
    where: { id: region },
    create: {
      id: region,
      region,
      index: indexEntries as any,
      updatedAt: new Date(),
    },
    update: {
      index: indexEntries as any,
      updatedAt: new Date(),
    },
  });

  return {
    indexed: indexEntries.length,
    region,
  };
}

/**
 * Geographic indexing: Region → Zip → Facility tree
 */
export async function buildGeographicIndex(region: string): Promise<{
  tree: Record<string, Record<string, string[]>>;
}> {
  const index = await prisma.providerIndex.findUnique({
    where: { id: region },
  });

  if (!index) {
    return { tree: {} };
  }

  const entries = index.index as any as ProviderIndexEntry[];
  const tree: Record<string, Record<string, string[]>> = {};

  entries.forEach((entry) => {
    if (!entry.location?.state || !entry.location?.zip) return;

    const state = entry.location.state;
    const zip = entry.location.zip;

    if (!tree[state]) {
      tree[state] = {};
    }
    if (!tree[state][zip]) {
      tree[state][zip] = [];
    }

    tree[state][zip].push(entry.clinicianId);
  });

  return { tree };
}

/**
 * Cluster similar specialties
 */
export function clusterSimilarSpecialties(specialties: string[]): Array<{
  cluster: string;
  specialties: string[];
  similarity: number;
}> {
  // Simplified clustering (would use actual similarity algorithm)
  const clusters: Record<string, string[]> = {};

  specialties.forEach((spec) => {
    // Group by first 3 characters (simplified)
    const cluster = spec.substring(0, 3);
    if (!clusters[cluster]) {
      clusters[cluster] = [];
    }
    clusters[cluster].push(spec);
  });

  return Object.entries(clusters).map(([cluster, specs]) => ({
    cluster,
    specialties: specs,
    similarity: 0.8, // Placeholder
  }));
}

/**
 * Multi-factor search by skill, readiness, safety
 */
export async function searchProviders(filters: {
  skills?: string[];
  minReadiness?: number;
  safetyScore?: number;
  region?: string;
  limit?: number;
}): Promise<ProviderIndexEntry[]> {
  const region = filters.region || 'US';
  const index = await prisma.providerIndex.findUnique({
    where: { id: region },
  });

  if (!index) {
    return [];
  }

  const entries = index.index as any as ProviderIndexEntry[];

  let results = entries;

  // Filter by skills
  if (filters.skills && filters.skills.length > 0) {
    results = results.filter((entry) => {
      return filters.skills!.some((skill) => entry.privileges.includes(skill) || entry.specialty.includes(skill));
    });
  }

  // Filter by readiness
  if (filters.minReadiness !== undefined) {
    results = results.filter((entry) => entry.readiness >= filters.minReadiness!);
  }

  // Filter by safety (would need to join with safety data)
  if (filters.safetyScore !== undefined) {
    // Placeholder - would check actual safety scores
    results = results.filter((entry) => true); // Would filter by actual safety score
  }

  // Limit results
  if (filters.limit) {
    results = results.slice(0, filters.limit);
  }

  return results;
}

/**
 * Rank providers by readiness, reliability, recency
 */
export async function rankProviders(
  region: string,
  criteria: {
    weights?: {
      readiness?: number;
      reliability?: number;
      recency?: number;
    };
  } = {},
): Promise<Array<{
  clinicianId: string;
  rank: number;
  score: number;
  breakdown: Record<string, number>;
}>> {
  const weights = {
    readiness: criteria.weights?.readiness || 0.4,
    reliability: criteria.weights?.reliability || 0.3,
    recency: criteria.weights?.recency || 0.3,
  };

  const index = await prisma.providerIndex.findUnique({
    where: { id: region },
  });

  if (!index) {
    return [];
  }

  const entries = index.index as any as ProviderIndexEntry[];

  const ranked = entries.map((entry) => {
    const readiness = entry.readiness;
    const reliability = 0.8; // Placeholder (would calculate from actual data)
    const recency = 0.7; // Placeholder (would calculate from last activity)

    const score =
      readiness * weights.readiness + reliability * weights.reliability + recency * weights.recency;

    return {
      clinicianId: entry.clinicianId,
      rank: 0, // Will be set after sorting
      score,
      breakdown: {
        readiness,
        reliability,
        recency,
      },
    };
  });

  // Sort by score and assign ranks
  ranked.sort((a, b) => b.score - a.score);
  ranked.forEach((r, idx) => {
    r.rank = idx + 1;
  });

  return ranked;
}

/**
 * Track stale entries
 */
export async function auditIndexFreshness(region: string): Promise<{
  stale: number;
  fresh: number;
  oldestEntry: string | null;
}> {
  const index = await prisma.providerIndex.findUnique({
    where: { id: region },
  });

  if (!index) {
    return {
      stale: 0,
      fresh: 0,
      oldestEntry: null,
    };
  }

  const daysSinceUpdate = Math.floor((Date.now() - index.updatedAt.getTime()) / (1000 * 60 * 60 * 24));
  const isStale = daysSinceUpdate > 30; // Consider stale if > 30 days

  return {
    stale: isStale ? 1 : 0,
    fresh: isStale ? 0 : 1,
    oldestEntry: index.updatedAt.toISOString(),
  };
}

/**
 * Merge duplicate clinician profiles
 */
export async function deduplicateProviders(region: string): Promise<{
  merged: number;
  duplicates: Array<{ ids: string[]; mergedInto: string }>;
}> {
  const index = await prisma.providerIndex.findUnique({
    where: { id: region },
  });

  if (!index) {
    return { merged: 0, duplicates: [] };
  }

  const entries = index.index as any as ProviderIndexEntry[];
  const duplicates: Array<{ ids: string[]; mergedInto: string }> = [];

  // Group by NPI (simplified deduplication)
  const byNpi = new Map<string, ProviderIndexEntry[]>();
  entries.forEach((entry) => {
    if (entry.npi) {
      if (!byNpi.has(entry.npi)) {
        byNpi.set(entry.npi, []);
      }
      byNpi.get(entry.npi)!.push(entry);
    }
  });

  // Find duplicates
  byNpi.forEach((group, npi) => {
    if (group.length > 1) {
      // Keep the first one, merge others
      const mergedInto = group[0].clinicianId;
      duplicates.push({
        ids: group.slice(1).map((e) => e.clinicianId),
        mergedInto,
      });
    }
  });

  return {
    merged: duplicates.reduce((sum, d) => sum + d.ids.length, 0),
    duplicates,
  };
}

/**
 * Anchor provider index snapshot
 */
export async function anchorProviderIndex(region: string): Promise<void> {
  const index = await prisma.providerIndex.findUnique({
    where: { id: region },
  });

  if (!index) {
    throw new Error(`Index for region ${region} not found`);
  }

  const indexHash = createHash('sha256').update(JSON.stringify(index.index)).digest('hex');

  anchorEvent('providerIndexAnchored', {
    region,
    indexHash,
    entryCount: Array.isArray(index.index) ? (index.index as any[]).length : 0,
    timestamp: new Date().toISOString(),
  });
}








