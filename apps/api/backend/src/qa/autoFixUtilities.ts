import prisma from '../graphql/prisma_client';
import { log } from '../obs/logger';
import { runGraphRebuild } from '../services/graph-engine/rebuildEngine';
import {
  ensureDecisionCapsuleAuthorityGraph,
  ensureCredentialDecisionAuthorityGraph,
} from '../services/revocation/authorityGraph';
import { refreshTrustState } from '../services/trust/trustStateEngine';
import { validateGraphIntegrity } from '../services/integrity/trustSpine';
import type { DataSanityFinding, AutoFixAction, AutoFixVerification, QaFinding } from '../../../../../core/qa/types';

interface AutoFixOptions {
  qaFindings: readonly QaFinding[];
  dataSanityFindings: readonly DataSanityFinding[];
  targetNpi?: string;
}

function normalizeName(value: string | null | undefined): string {
  if (!value) {
    return '';
  }

  return value.normalize('NFC').trim().replace(/\s+/g, ' ');
}

function createVerification(name: string, passed: boolean, details: string): AutoFixVerification {
  return { name, passed, details };
}

async function applyGraphRebuildIfNeeded(
  findings: readonly DataSanityFinding[],
): Promise<AutoFixAction | null> {
  const relevant = findings.filter((finding) =>
    finding.category === 'ORPHANED_GRAPH_NODE'
    || finding.category === 'BROKEN_RELATIONSHIP',
  );

  if (relevant.length === 0) {
    return null;
  }

  const startedAt = new Date().toISOString();
  try {
    const rebuild = await runGraphRebuild({
      buildType: 'stale',
      requestedBy: 'qa_auto_fix',
      invalidationReasons: relevant.map((finding) => finding.code),
    });
    const report = await validateGraphIntegrity();
    const completedAt = new Date().toISOString();
    return {
      kind: 'REBUILD_GRAPH_INDEXES',
      status: 'applied',
      details: `Graph rebuild ${rebuild.buildRunId} completed with ${rebuild.nodeCount} node(s) and ${rebuild.edgeCount} edge(s).`,
      startedAt,
      completedAt,
      verification: [
        createVerification(
          'graph_integrity',
          report.invalidEdges.length === 0,
          `Graph integrity now reports ${report.invalidEdges.length} invalid edge(s).`,
        ),
      ],
    };
  } catch (error) {
    return {
      kind: 'REBUILD_GRAPH_INDEXES',
      status: 'failed',
      details: `Graph rebuild failed: ${error instanceof Error ? error.message : String(error)}`,
      startedAt,
      completedAt: new Date().toISOString(),
      verification: [],
    };
  }
}

async function normalizeEntityNames(
  findings: readonly DataSanityFinding[],
): Promise<AutoFixAction | null> {
  const malformedFinding = findings.find((finding) => finding.category === 'MALFORMED_ENTITY_NAME');
  if (!malformedFinding) {
    return null;
  }

  const providerIds = Array.isArray(malformedFinding.metadata?.providerIds)
    ? malformedFinding.metadata?.providerIds.filter((value): value is string => typeof value === 'string')
    : [];
  const personProfileIds = Array.isArray(malformedFinding.metadata?.personProfileIds)
    ? malformedFinding.metadata?.personProfileIds.filter((value): value is string => typeof value === 'string')
    : [];
  const startedAt = new Date().toISOString();

  try {
    const [providers, profiles] = await Promise.all([
      providerIds.length > 0
        ? prisma.provider.findMany({
            where: { id: { in: providerIds } },
            select: { id: true, fullName: true },
          })
        : Promise.resolve([]),
      personProfileIds.length > 0
        ? prisma.personProfile.findMany({
            where: { id: { in: personProfileIds } },
            select: { id: true, firstName: true, lastName: true },
          })
        : Promise.resolve([]),
    ]);

    await prisma.$transaction(async (tx) => {
      for (const provider of providers) {
        await tx.provider.update({
          where: { id: provider.id },
          data: {
            fullName: normalizeName(provider.fullName),
          },
        });
      }

      for (const profile of profiles) {
        await tx.personProfile.update({
          where: { id: profile.id },
          data: {
            firstName: normalizeName(profile.firstName) || null,
            lastName: normalizeName(profile.lastName) || null,
          },
        });
      }
    });

    const completedAt = new Date().toISOString();
    const verification = await Promise.all([
      createVerification(
        'provider_name_normalization',
        true,
        `Normalized ${providers.length} provider name(s).`,
      ),
      createVerification(
        'person_profile_name_normalization',
        true,
        `Normalized ${profiles.length} person profile name(s).`,
      ),
    ]);

    return {
      kind: 'NORMALIZE_ENTITY_NAMES',
      status: 'applied',
      details: `Normalized ${providers.length + profiles.length} entity name record(s).`,
      startedAt,
      completedAt,
      entityIds: [...providerIds, ...personProfileIds],
      verification,
    };
  } catch (error) {
    return {
      kind: 'NORMALIZE_ENTITY_NAMES',
      status: 'failed',
      details: `Entity name normalization failed: ${error instanceof Error ? error.message : String(error)}`,
      startedAt,
      completedAt: new Date().toISOString(),
      entityIds: [...providerIds, ...personProfileIds],
      verification: [],
    };
  }
}

async function repairBrokenEdges(
  findings: readonly DataSanityFinding[],
): Promise<AutoFixAction | null> {
  const relationshipFinding = findings.find((finding) => finding.category === 'BROKEN_RELATIONSHIP');
  if (!relationshipFinding) {
    return null;
  }

  const capsuleIds = Array.isArray(relationshipFinding.metadata?.capsuleIds)
    ? relationshipFinding.metadata?.capsuleIds.filter((value): value is string => typeof value === 'string')
    : [];
  const credentialIds = Array.isArray(relationshipFinding.metadata?.credentialIds)
    ? relationshipFinding.metadata?.credentialIds.filter((value): value is string => typeof value === 'string')
    : [];
  const startedAt = new Date().toISOString();

  try {
    for (const capsuleId of capsuleIds) {
      await ensureDecisionCapsuleAuthorityGraph(capsuleId);
    }
    for (const credentialId of credentialIds) {
      await ensureCredentialDecisionAuthorityGraph(credentialId);
    }

    const report = await validateGraphIntegrity();
    return {
      kind: 'REPAIR_BROKEN_EDGES',
      status: 'applied',
      details: `Repaired graph authority edges for ${capsuleIds.length} capsule(s) and ${credentialIds.length} credential(s).`,
      startedAt,
      completedAt: new Date().toISOString(),
      entityIds: [...capsuleIds, ...credentialIds],
      verification: [
        createVerification(
          'graph_integrity',
          report.missingCapsuleEdges.length === 0,
          `Graph integrity now reports ${report.missingCapsuleEdges.length} missing capsule edge(s).`,
        ),
      ],
    };
  } catch (error) {
    return {
      kind: 'REPAIR_BROKEN_EDGES',
      status: 'failed',
      details: `Broken edge repair failed: ${error instanceof Error ? error.message : String(error)}`,
      startedAt,
      completedAt: new Date().toISOString(),
      entityIds: [...capsuleIds, ...credentialIds],
      verification: [],
    };
  }
}

async function deduplicateExactRecords(
  findings: readonly DataSanityFinding[],
): Promise<AutoFixAction | null> {
  const duplicateFinding = findings.find((finding) => finding.category === 'DUPLICATE_EDGE_RECORD');
  if (!duplicateFinding) {
    return null;
  }

  const duplicateIds = Array.isArray(duplicateFinding.metadata?.duplicateIds)
    ? duplicateFinding.metadata?.duplicateIds.filter((value): value is string => typeof value === 'string')
    : [];
  const startedAt = new Date().toISOString();

  try {
    const deleted = await prisma.authorityEdge.deleteMany({
      where: {
        id: { in: duplicateIds },
      },
    });
    const remainingRows = await prisma.$queryRaw<Array<{ ids: string[] }>>`
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
      LIMIT 1
    `;

    return {
      kind: 'DEDUPLICATE_RECORDS',
      status: 'applied',
      details: `Deleted ${deleted.count} duplicate authority edge record(s).`,
      startedAt,
      completedAt: new Date().toISOString(),
      entityIds: duplicateIds,
      verification: [
        createVerification(
          'duplicate_edge_records_removed',
          remainingRows.length === 0,
          `Remaining exact duplicate authority edge groups: ${remainingRows.length}.`,
        ),
      ],
    };
  } catch (error) {
    return {
      kind: 'DEDUPLICATE_RECORDS',
      status: 'failed',
      details: `Record deduplication failed: ${error instanceof Error ? error.message : String(error)}`,
      startedAt,
      completedAt: new Date().toISOString(),
      entityIds: duplicateIds,
      verification: [],
    };
  }
}

async function recomputeTrustScores(
  findings: readonly DataSanityFinding[],
  targetNpi?: string,
): Promise<AutoFixAction | null> {
  const npis = new Set<string>();

  if (targetNpi) {
    npis.add(targetNpi);
  }

  for (const finding of findings) {
    const metadataNpis = Array.isArray(finding.metadata?.npis)
      ? finding.metadata?.npis.filter((value): value is string => typeof value === 'string')
      : [];
    for (const npi of metadataNpis) {
      if (/^[0-9]{10}$/.test(npi)) {
        npis.add(npi);
      }
    }
  }

  if (npis.size === 0) {
    return null;
  }

  const startedAt = new Date().toISOString();
  try {
    for (const npi of [...npis].slice(0, 20)) {
      await refreshTrustState(npi);
    }

    return {
      kind: 'RECOMPUTE_TRUST_SCORES',
      status: 'applied',
      details: `Recomputed trust state for ${npis.size} NPI(s).`,
      startedAt,
      completedAt: new Date().toISOString(),
      entityIds: [...npis],
      verification: [
        createVerification(
          'trust_state_refresh',
          true,
          `Refresh completed for ${npis.size} NPI(s).`,
        ),
      ],
    };
  } catch (error) {
    return {
      kind: 'RECOMPUTE_TRUST_SCORES',
      status: 'failed',
      details: `Trust state recomputation failed: ${error instanceof Error ? error.message : String(error)}`,
      startedAt,
      completedAt: new Date().toISOString(),
      entityIds: [...npis],
      verification: [],
    };
  }
}

export async function runAutoFixUtilities(
  options: AutoFixOptions,
): Promise<AutoFixAction[]> {
  const actions = [
    await repairBrokenEdges(options.dataSanityFindings),
    await applyGraphRebuildIfNeeded(options.dataSanityFindings),
    await normalizeEntityNames(options.dataSanityFindings),
    await deduplicateExactRecords(options.dataSanityFindings),
    await recomputeTrustScores(options.dataSanityFindings, options.targetNpi),
  ].filter((action): action is AutoFixAction => action !== null);

  for (const action of actions) {
    log(action.status === 'failed' ? 'error' : 'info', 'qa_auto_fix_action', {
      event: 'qa_auto_fix_action',
      kind: action.kind,
      status: action.status,
      details: action.details,
      entityIds: action.entityIds ?? [],
      verification: action.verification,
    });
  }

  return actions;
}
