import { Prisma } from '@prisma/client';
import prisma from '../graphql/prisma_client';
import { log } from '../obs/logger';
import { validateGraphIntegrity } from '../services/integrity/trustSpine';
import { createDataSanityFinding, type DataSanityFinding } from '../../../../../core/qa/types';

interface DataSanityAgentOptions {
  targetNpi?: string;
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function normalizeSpacing(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFC')
    .trim()
    .replace(/\s+/g, ' ');
}

export async function runDataSanityAgents(
  options: DataSanityAgentOptions = {},
): Promise<DataSanityFinding[]> {
  const findings: DataSanityFinding[] = [];

  findings.push(...await scanMissingNpis(options));
  findings.push(...await scanPotentialDuplicateProviders(options));
  findings.push(...await scanConflictingSpecialties(options));
  findings.push(...await scanGraphProblems());
  findings.push(...await scanInvalidTimestamps(options));
  findings.push(...await scanMalformedEntityNames(options));
  findings.push(...await scanDuplicateEdgeRecords());

  log('info', 'qa_data_sanity_complete', {
    event: 'qa_data_sanity_complete',
    findingCount: findings.length,
    targetNpi: options.targetNpi ?? null,
  });

  return findings;
}

async function scanMissingNpis(options: DataSanityAgentOptions): Promise<DataSanityFinding[]> {
  if (options.targetNpi) {
    return [];
  }

  const profiles = await prisma.personProfile.findMany({
    where: {
      OR: [
        { npi: null },
        { npi: '' },
      ],
    },
    select: {
      id: true,
      userId: true,
      firstName: true,
      lastName: true,
      specialty: true,
      stateOfPractice: true,
    },
    take: 100,
  });

  if (profiles.length === 0) {
    return [];
  }

  return [
    createDataSanityFinding({
      category: 'MISSING_NPI',
      code: 'missing_person_profile_npi',
      severity: 'warning',
      summary: `${profiles.length} person profile record(s) are missing NPI values.`,
      entityIds: profiles.map((profile) => profile.id),
      metadata: {
        sampleProfiles: profiles.slice(0, 5),
      },
    }),
  ];
}

async function scanPotentialDuplicateProviders(
  options: DataSanityAgentOptions,
): Promise<DataSanityFinding[]> {
  if (options.targetNpi) {
    return [];
  }

  const profiles = await prisma.personProfile.findMany({
    where: {
      npi: null,
      firstName: { not: null },
      lastName: { not: null },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      specialty: true,
      stateOfPractice: true,
    },
    take: 300,
  });

  const byKey = new Map<string, typeof profiles>();
  for (const profile of profiles) {
    const dedupeKey = [
      normalizeText(profile.firstName),
      normalizeText(profile.lastName),
      normalizeText(profile.stateOfPractice),
    ].join('|');
    if (!byKey.has(dedupeKey)) {
      byKey.set(dedupeKey, []);
    }
    byKey.get(dedupeKey)!.push(profile);
  }

  const findings: DataSanityFinding[] = [];
  for (const group of byKey.values()) {
    if (group.length < 2) {
      continue;
    }

    findings.push(
      createDataSanityFinding({
        category: 'POTENTIAL_DUPLICATE_PROVIDER',
        code: 'potential_duplicate_provider_identity',
        severity: 'warning',
        summary: `Detected ${group.length} probable duplicate provider identities with matching names and state.`,
        entityIds: group.map((profile) => profile.id),
        metadata: {
          profiles: group,
        },
      }),
    );
  }

  return findings;
}

async function scanConflictingSpecialties(
  options: DataSanityAgentOptions,
): Promise<DataSanityFinding[]> {
  if (options.targetNpi) {
    return [];
  }

  const profiles = await prisma.personProfile.findMany({
    where: {
      specialty: { not: null },
      firstName: { not: null },
      lastName: { not: null },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      specialty: true,
      stateOfPractice: true,
    },
    take: 300,
  });

  const byIdentity = new Map<string, typeof profiles>();
  for (const profile of profiles) {
    const key = [
      normalizeText(profile.firstName),
      normalizeText(profile.lastName),
      normalizeText(profile.stateOfPractice),
    ].join('|');
    if (!byIdentity.has(key)) {
      byIdentity.set(key, []);
    }
    byIdentity.get(key)!.push(profile);
  }

  const findings: DataSanityFinding[] = [];
  for (const group of byIdentity.values()) {
    const specialties = [...new Set(
      group
        .map((profile) => normalizeText(profile.specialty))
        .filter((value) => value.length > 0),
    )];

    if (group.length < 2 || specialties.length < 2) {
      continue;
    }

    findings.push(
      createDataSanityFinding({
        category: 'CONFLICTING_SPECIALTY',
        code: 'conflicting_specialty_values',
        severity: 'warning',
        summary: `Probable duplicate provider identities disagree on specialty values: ${specialties.join(', ')}.`,
        entityIds: group.map((profile) => profile.id),
        metadata: {
          specialties,
          profiles: group,
        },
      }),
    );
  }

  return findings;
}

async function scanGraphProblems(): Promise<DataSanityFinding[]> {
  const findings: DataSanityFinding[] = [];
  const report = await validateGraphIntegrity();

  if (report.orphanedNodes.length > 0) {
    findings.push(
      createDataSanityFinding({
        category: 'ORPHANED_GRAPH_NODE',
        code: 'orphaned_graph_nodes',
        severity: 'warning',
        summary: `Detected ${report.orphanedNodes.length} orphaned graph node(s).`,
        entityIds: report.orphanedNodes,
        repairable: true,
        suggestedFixes: ['REBUILD_GRAPH_INDEXES', 'REPAIR_BROKEN_EDGES'],
        metadata: {
          orphanedNodeIds: report.orphanedNodes,
        },
      }),
    );
  }

  if (report.invalidEdges.length > 0 || report.missingCapsuleEdges.length > 0) {
    findings.push(
      createDataSanityFinding({
        category: 'BROKEN_RELATIONSHIP',
        code: 'broken_graph_relationships',
        severity: 'critical',
        summary: `Detected ${report.invalidEdges.length} invalid edge(s) and ${report.missingCapsuleEdges.length} missing capsule relationship(s).`,
        entityIds: [...report.invalidEdges, ...report.missingCapsuleEdges],
        repairable: true,
        suggestedFixes: ['REPAIR_BROKEN_EDGES', 'REBUILD_GRAPH_INDEXES'],
        metadata: {
          invalidEdgeIds: report.invalidEdges,
          capsuleIds: report.missingCapsuleEdges,
        },
      }),
    );
  }

  return findings;
}

async function scanInvalidTimestamps(
  options: DataSanityAgentOptions,
): Promise<DataSanityFinding[]> {
  const npiClause = options.targetNpi
    ? Prisma.sql`AND va.npi = ${options.targetNpi}`
    : Prisma.empty;

  const artifactRows = await prisma.$queryRaw<Array<{ id: string; npi: string }>>`
    SELECT va.id::text AS id, va.npi
    FROM "VerificationArtifact" va
    WHERE (
      (va."expiresAt" IS NOT NULL AND va."verifiedAt" > va."expiresAt")
      OR (
        va."psvWindowDeadline" IS NOT NULL
        AND va."psvWindowStart" IS NOT NULL
        AND va."psvWindowDeadline" < va."psvWindowStart"
      )
    )
    ${npiClause}
    LIMIT 100
  `;

  const capsuleRows = await prisma.$queryRaw<Array<{ id: string; npi: string }>>`
    SELECT dc.id::text AS id, dc."subjectNpi" AS npi
    FROM "DecisionCapsule" dc
    WHERE dc."decisionTimestamp" > NOW() + INTERVAL '5 minutes'
    ${options.targetNpi ? Prisma.sql`AND dc."subjectNpi" = ${options.targetNpi}` : Prisma.empty}
    LIMIT 100
  `;

  if (artifactRows.length === 0 && capsuleRows.length === 0) {
    return [];
  }

  return [
    createDataSanityFinding({
      category: 'INVALID_TIMESTAMP',
      code: 'invalid_temporal_relationships',
      severity: 'warning',
      summary: `Detected ${artifactRows.length} verification artifact(s) and ${capsuleRows.length} decision capsule(s) with invalid timestamps.`,
      entityIds: [...artifactRows.map((row) => row.id), ...capsuleRows.map((row) => row.id)],
      metadata: {
        artifactIds: artifactRows.map((row) => row.id),
        capsuleIds: capsuleRows.map((row) => row.id),
        npis: [...new Set([...artifactRows.map((row) => row.npi), ...capsuleRows.map((row) => row.npi)])],
      },
      repairable: true,
      suggestedFixes: ['RECOMPUTE_TRUST_SCORES'],
    }),
  ];
}

async function scanMalformedEntityNames(
  options: DataSanityAgentOptions,
): Promise<DataSanityFinding[]> {
  const [providers, profiles] = await Promise.all([
    prisma.provider.findMany({
      where: options.targetNpi ? { npi: options.targetNpi } : undefined,
      select: {
        id: true,
        npi: true,
        fullName: true,
      },
      take: options.targetNpi ? 5 : 100,
    }),
    prisma.personProfile.findMany({
      where: options.targetNpi ? { npi: options.targetNpi } : undefined,
      select: {
        id: true,
        npi: true,
        firstName: true,
        lastName: true,
      },
      take: options.targetNpi ? 5 : 100,
    }),
  ]);

  const malformedProviderIds = providers
    .filter((provider) => normalizeSpacing(provider.fullName) !== provider.fullName)
    .map((provider) => provider.id);

  const malformedProfileIds = profiles
    .filter((profile) => {
      const first = profile.firstName ?? '';
      const last = profile.lastName ?? '';
      return first !== normalizeSpacing(first)
        || last !== normalizeSpacing(last);
    })
    .map((profile) => profile.id);

  if (malformedProviderIds.length === 0 && malformedProfileIds.length === 0) {
    return [];
  }

  return [
    createDataSanityFinding({
      category: 'MALFORMED_ENTITY_NAME',
      code: 'malformed_entity_names',
      severity: 'warning',
      summary: `Detected malformed entity names on ${malformedProviderIds.length} provider record(s) and ${malformedProfileIds.length} person profile record(s).`,
      entityIds: [...malformedProviderIds, ...malformedProfileIds],
      repairable: true,
      suggestedFixes: ['NORMALIZE_ENTITY_NAMES'],
      metadata: {
        providerIds: malformedProviderIds,
        personProfileIds: malformedProfileIds,
      },
    }),
  ];
}

async function scanDuplicateEdgeRecords(): Promise<DataSanityFinding[]> {
  const rows = await prisma.$queryRaw<Array<{ ids: string[] }>>`
    SELECT ARRAY_AGG(id::text ORDER BY "createdAt" ASC) AS ids
    FROM "AuthorityEdge"
    GROUP BY
      "sourceNodeId",
      "targetNodeId",
      "relationType",
      weight,
      COALESCE("cryptographicProof", ''),
      COALESCE(metadata::text, '{}')
    HAVING COUNT(*) > 1
    LIMIT 50
  `;

  const duplicateIds = rows.flatMap((row) => row.ids.slice(1));
  if (duplicateIds.length === 0) {
    return [];
  }

  return [
    createDataSanityFinding({
      category: 'DUPLICATE_EDGE_RECORD',
      code: 'duplicate_authority_edge_records',
      severity: 'warning',
      summary: `Detected ${duplicateIds.length} duplicate graph edge record(s).`,
      entityIds: duplicateIds,
      repairable: true,
      suggestedFixes: ['DEDUPLICATE_RECORDS'],
      metadata: {
        duplicateIds,
      },
    }),
  ];
}
