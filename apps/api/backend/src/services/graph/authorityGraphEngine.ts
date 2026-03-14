/**
 * authorityGraphEngine.ts — Wave 500: Authority Graph Engine
 *
 * Transforms credential data into a structured authority graph that AI systems
 * can query to resolve a clinician's full capability and authority chain.
 *
 * Node types:
 *   CLINICIAN          — the subject clinician (NPI-keyed)
 *   LICENSE_BOARD      — state medical/nursing/pharmacy boards
 *   CERTIFICATION_BOARD — specialty boards (ABIM, ABFM, ABNS, etc.)
 *   INSTITUTION        — hospitals, health systems, employers
 *   TRAINING_PROGRAM   — residency, fellowship, CME programs
 *   PRIVILEGE          — granted hospital/facility privileges
 *   SANCTION_EVENT     — OIG/LEIE exclusion or disciplinary action
 *   DECISION_CAPSULE   — hiring or privileging decision artifact
 *   CREDENTIAL         — individual verified credential (DEA, NPI, etc.)
 *
 * Edge types:
 *   ISSUED_BY          — credential/license → authority that issued it
 *   VERIFIED_BY        — credential → source that verified it
 *   TRAINED_AT         — clinician → training program
 *   PRIVILEGED_AT      — clinician → institution (privilege granted)
 *   ACCEPTED_BY        — clinician → institution (hiring decision)
 *   DEPENDS_ON         — decision capsule → credential
 *   SANCTIONED_BY      — clinician → sanction event
 *   ATTESTED_BY        — credential → attesting authority
 */

import { createHash } from 'crypto';
import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';
import { getCachedTrustState } from '../trust/trustStateEngine';

// ── Constants ─────────────────────────────────────────────────────────────────

export const AUTHORITY_GRAPH_SCHEMA = 'https://vitalcv.com/authority-graph/v1';
export const AUTHORITY_GRAPH_VERSION = '500.1';

// Source → node type mapping
const SOURCE_BOARD_MAP: Record<string, { type: NodeType; label: string }> = {
  STATE_BOARD:          { type: 'LICENSE_BOARD',        label: 'State Medical Board'          },
  NURSYS:               { type: 'LICENSE_BOARD',        label: 'Nursys (State Nursing Boards)' },
  ABIM:                 { type: 'CERTIFICATION_BOARD',  label: 'American Board of Internal Medicine' },
  ABFM:                 { type: 'CERTIFICATION_BOARD',  label: 'American Board of Family Medicine'   },
  ABNS:                 { type: 'CERTIFICATION_BOARD',  label: 'American Board of Neurological Surgery' },
  ABEM:                 { type: 'CERTIFICATION_BOARD',  label: 'American Board of Emergency Medicine'  },
  ABP:                  { type: 'CERTIFICATION_BOARD',  label: 'American Board of Pediatrics'          },
  BOARD_CERTIFICATION:  { type: 'CERTIFICATION_BOARD',  label: 'Board Certification Authority' },
  NPI_ENROLLMENT:       { type: 'INSTITUTION',          label: 'CMS National Provider Registry' },
  DEA:                  { type: 'CREDENTIAL',           label: 'DEA Registration'               },
};

// ── Types ─────────────────────────────────────────────────────────────────────

export type NodeType =
  | 'CLINICIAN'
  | 'LICENSE_BOARD'
  | 'CERTIFICATION_BOARD'
  | 'INSTITUTION'
  | 'TRAINING_PROGRAM'
  | 'PRIVILEGE'
  | 'SANCTION_EVENT'
  | 'DECISION_CAPSULE'
  | 'CREDENTIAL';

export type EdgeRelation =
  | 'ISSUED_BY'
  | 'VERIFIED_BY'
  | 'TRAINED_AT'
  | 'PRIVILEGED_AT'
  | 'ACCEPTED_BY'
  | 'DEPENDS_ON'
  | 'SANCTIONED_BY'
  | 'ATTESTED_BY'
  | 'ISSUED_TO';

export interface AuthorityNode {
  id: string;                           // "{TYPE}:{entityId}"
  type: NodeType;
  label: string;
  status: 'active' | 'revoked' | 'expired' | 'cleared' | 'unknown';
  attributes: Record<string, unknown>;
}

export interface AuthorityEdgeItem {
  id: string;
  source: string;                       // AuthorityNode.id
  target: string;
  relation: EdgeRelation;
  weight: number;
  metadata: Record<string, unknown>;
}

export interface AuthorityGraphSummary {
  trustBand: string;
  readinessScore: number;
  readinessStatus: string;
  activeCredentials: number;
  licenseBoards: string[];
  certificationBoards: string[];
  institutions: string[];
  trainingPrograms: string[];
  activePrivileges: number;
  activeSanctions: number;
  decisions: { total: number; byType: Record<string, number> };
  networkReach: number;                 // total connected nodes
  computedAt: string;
}

export interface AuthorityGraph {
  schema: string;
  version: string;
  npi: string;
  computedAt: string;
  subject: AuthorityNode;
  nodes: AuthorityNode[];
  edges: AuthorityEdgeItem[];
  summary: AuthorityGraphSummary;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function nodeId(type: NodeType, entityId: string): string {
  return `${type}:${entityId}`;
}

/** Deterministic edge ID — stable for upsert operations */
function edgeId(source: string, relation: EdgeRelation, target: string): string {
  return createHash('sha256')
    .update(`${source}|${relation}|${target}`)
    .digest('hex')
    .slice(0, 32);
}

function sanitize(val: unknown, fallback: string): string {
  return typeof val === 'string' && val.trim() ? val.trim() : fallback;
}

function statusFromArtifact(
  trustState: string | null | undefined,
  status: string | null | undefined,
): AuthorityNode['status'] {
  const s = (trustState ?? status ?? '').toUpperCase();
  if (s === 'REVOKED') return 'revoked';
  if (s === 'EXPIRED') return 'expired';
  if (s === 'TRUSTED' || s === 'VERIFIED' || s === 'ACTIVE') return 'active';
  return 'unknown';
}

// ── Core builder ──────────────────────────────────────────────────────────────

/**
 * Build a complete authority graph for a clinician from source tables.
 * This is the authoritative, always-fresh version. Materialization to
 * KnowledgeNode/AuthorityEdge runs as a fire-and-forget side effect.
 */
export async function buildAuthorityGraph(npi: string): Promise<AuthorityGraph> {
  const computedAt = new Date().toISOString();

  const nodeMap = new Map<string, AuthorityNode>();
  const edgeMap = new Map<string, AuthorityEdgeItem>();

  // ── Subject node ────────────────────────────────────────────────────────────
  let trustBand = 'L0';
  let readinessScore = 0;
  let readinessStatus = 'Unverified';

  try {
    const ts = await getCachedTrustState(npi);
    if (ts) {
      trustBand = ts.readiness_level ?? ts.trustBand ?? 'L0';
      readinessScore = ts.readiness_score ?? ts.trustScore ?? 0;
      readinessStatus = ts.readiness_status ?? '';
    }
  } catch {
    log('warn', 'authorityGraph: trust state unavailable', { npi });
  }

  const subjectId = nodeId('CLINICIAN', npi);
  const subjectNode: AuthorityNode = {
    id: subjectId,
    type: 'CLINICIAN',
    label: `NPI ${npi}`,
    status: 'active',
    attributes: { npi, trustBand, readinessScore, readinessStatus },
  };
  nodeMap.set(subjectId, subjectNode);

  // ── VerificationArtifacts → license boards, certification boards, credentials ─
  const artifacts = await prisma.verificationArtifact.findMany({
    where: { npi, source: { not: 'TRUST_STATE_ENGINE' } },
    orderBy: { verifiedAt: 'desc' },
    take: 100,
    select: {
      id: true, source: true, status: true, trustState: true,
      rawPayload: true, verifiedAt: true, expiresAt: true,
    },
  });

  const issuersSeen = new Set<string>();

  for (const art of artifacts) {
    const payload = (art.rawPayload ?? {}) as Record<string, unknown>;
    const artStatus = statusFromArtifact(art.trustState, art.status);

    // Update clinician label from NPPES
    if (art.source === 'NPPES') {
      const name = sanitize(payload.providerName ?? payload.name, '');
      if (name) {
        const existing = nodeMap.get(subjectId);
        if (existing) existing.label = name;
      }
    }

    // OIG/LEIE → SANCTION_EVENT node
    if (art.source === 'OIG' || art.source === 'OIG_LEIE' || art.source === 'LEIE') {
      const sanctionId = nodeId('SANCTION_EVENT', art.id);
      const matchType = sanitize(payload.matchType, 'NONE');
      const isActive = matchType !== 'NONE';
      nodeMap.set(sanctionId, {
        id: sanctionId,
        type: 'SANCTION_EVENT',
        label: isActive ? `OIG Exclusion — ${matchType}` : 'OIG Exclusion Check — Clear',
        status: isActive ? 'active' : 'cleared',
        attributes: {
          source: art.source,
          matchType,
          verifiedAt: art.verifiedAt?.toISOString(),
          details: payload,
        },
      });
      edgeMap.set(edgeId(subjectId, 'SANCTIONED_BY', sanctionId), {
        id: edgeId(subjectId, 'SANCTIONED_BY', sanctionId),
        source: subjectId,
        target: sanctionId,
        relation: 'SANCTIONED_BY',
        weight: isActive ? 0.1 : 0.9,
        metadata: { matchType, cleared: !isActive },
      });
      continue;
    }

    // License board / certification board / credential node
    const boardConfig = SOURCE_BOARD_MAP[art.source];
    if (boardConfig) {
      const boardKey = boardConfig.type === 'CREDENTIAL'
        ? art.id
        : art.source.toLowerCase();
      const boardNId = nodeId(boardConfig.type, boardKey);

      if (!issuersSeen.has(boardNId)) {
        issuersSeen.add(boardNId);
        const stateCode = sanitize(payload.state ?? payload.licenseState, '');
        const label = stateCode
          ? `${boardConfig.label} (${stateCode})`
          : boardConfig.label;
        nodeMap.set(boardNId, {
          id: boardNId,
          type: boardConfig.type,
          label,
          status: 'active',
          attributes: {
            source: art.source,
            stateCode: stateCode || undefined,
            licenseNumber: payload.licenseNumber,
          },
        });
      }

      // Credential node (represents the issued credential/license)
      const credId = nodeId('CREDENTIAL', art.id);
      const credLabel = sanitize(
        payload.credentialType ?? payload.licenseType ?? payload.certificationType,
        `${art.source} Credential`,
      );
      nodeMap.set(credId, {
        id: credId,
        type: 'CREDENTIAL',
        label: credLabel,
        status: artStatus,
        attributes: {
          source: art.source,
          verifiedAt: art.verifiedAt?.toISOString(),
          expiresAt: art.expiresAt?.toISOString(),
          licenseNumber: payload.licenseNumber,
          state: payload.state ?? payload.licenseState,
        },
      });

      // clinician → ISSUED_TO → credential
      edgeMap.set(edgeId(subjectId, 'ISSUED_TO', credId), {
        id: edgeId(subjectId, 'ISSUED_TO', credId),
        source: subjectId,
        target: credId,
        relation: 'ISSUED_TO',
        weight: artStatus === 'active' ? 0.9 : 0.4,
        metadata: { source: art.source, verifiedAt: art.verifiedAt?.toISOString() },
      });

      // credential → ISSUED_BY → board
      const boardNId2 = nodeId(boardConfig.type, boardConfig.type === 'CREDENTIAL' ? art.id : art.source.toLowerCase());
      edgeMap.set(edgeId(credId, 'ISSUED_BY', boardNId2), {
        id: edgeId(credId, 'ISSUED_BY', boardNId2),
        source: credId,
        target: boardNId2,
        relation: 'ISSUED_BY',
        weight: 1.0,
        metadata: { source: art.source },
      });

      // credential → VERIFIED_BY → board (also signals verification)
      edgeMap.set(edgeId(credId, 'VERIFIED_BY', boardNId2), {
        id: edgeId(credId, 'VERIFIED_BY', boardNId2),
        source: credId,
        target: boardNId2,
        relation: 'VERIFIED_BY',
        weight: artStatus === 'active' ? 0.95 : 0.5,
        metadata: { verifiedAt: art.verifiedAt?.toISOString() },
      });
    }
  }

  // ── CandidateCredentials → training programs ─────────────────────────────
  const candidateCreds = await prisma.candidateCredential.findMany({
    where: { clinicianId: npi },
    take: 30,
    select: { id: true, status: true, data: true, createdAt: true },
  });

  for (const cc of candidateCreds) {
    const data = (cc.data ?? {}) as Record<string, unknown>;
    const credType = sanitize(data.credentialType ?? data.type, '').toUpperCase();
    const isTraining = credType.includes('RESIDENCY') || credType.includes('FELLOWSHIP') ||
      credType.includes('TRAINING') || credType.includes('INTERNSHIP') || credType.includes('CME');

    if (isTraining) {
      const programName = sanitize(data.institutionName ?? data.programName, credType);
      const programId = nodeId('TRAINING_PROGRAM', `${programName.toLowerCase().replace(/\s+/g, '-')}`);

      if (!nodeMap.has(programId)) {
        nodeMap.set(programId, {
          id: programId,
          type: 'TRAINING_PROGRAM',
          label: programName,
          status: 'active',
          attributes: {
            credentialType: credType,
            graduationYear: data.graduationYear,
            specialty: data.specialty,
          },
        });
      }

      edgeMap.set(edgeId(subjectId, 'TRAINED_AT', programId), {
        id: edgeId(subjectId, 'TRAINED_AT', programId),
        source: subjectId,
        target: programId,
        relation: 'TRAINED_AT',
        weight: 0.8,
        metadata: { credentialType: credType, completedAt: data.completedAt ?? cc.createdAt.toISOString() },
      });
    }
  }

  // ── DecisionCapsules → institutions, privileges, decision nodes ───────────
  const capsules = await prisma.decisionCapsule.findMany({
    where: { subjectNpi: npi },
    orderBy: { decisionTimestamp: 'desc' },
    take: 30,
    select: {
      id: true, decisionType: true, status: true,
      artifactHash: true, decisionTimestamp: true,
      credentialIds: true, metadata: true,
    },
  });

  for (const capsule of capsules) {
    const meta = (capsule.metadata ?? {}) as Record<string, unknown>;
    const decisionAction = sanitize(meta.decisionAction, 'APPROVE');
    const orgName = sanitize(meta.organizationName ?? meta.employerId ?? meta.facilityName, '');

    // Decision capsule node
    const capId = nodeId('DECISION_CAPSULE', capsule.id);
    nodeMap.set(capId, {
      id: capId,
      type: 'DECISION_CAPSULE',
      label: `${capsule.decisionType} — ${decisionAction}`,
      status: capsule.status === 'VALID' ? 'active' : capsule.status === 'AT_RISK' ? 'unknown' : 'revoked',
      attributes: {
        decisionType: capsule.decisionType,
        decisionAction,
        status: capsule.status,
        artifactHash: capsule.artifactHash,
        decisionTimestamp: capsule.decisionTimestamp?.toISOString(),
        trustStateHash: meta.trustStateHash,
        verifierOrgId: meta.verifierOrgId,
      },
    });

    // capsule → DEPENDS_ON → each credential
    for (const credId of capsule.credentialIds) {
      const credNId = nodeId('CREDENTIAL', credId);
      if (nodeMap.has(credNId)) {
        edgeMap.set(edgeId(capId, 'DEPENDS_ON', credNId), {
          id: edgeId(capId, 'DEPENDS_ON', credNId),
          source: capId,
          target: credNId,
          relation: 'DEPENDS_ON',
          weight: 1.0,
          metadata: { capsuleId: capsule.id },
        });
      }
    }

    if (orgName) {
      const orgSlug = orgName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

      if (capsule.decisionType === 'PRIVILEGING') {
        // PRIVILEGE node
        const privId = nodeId('PRIVILEGE', `${orgSlug}-${capsule.id.slice(0, 8)}`);
        const privType = sanitize(meta.privilegeType, 'Clinical Privileges');
        nodeMap.set(privId, {
          id: privId,
          type: 'PRIVILEGE',
          label: `${privType} at ${orgName}`,
          status: capsule.status === 'VALID' ? 'active' : 'revoked',
          attributes: {
            privilegeType: privType,
            organization: orgName,
            grantedAt: capsule.decisionTimestamp?.toISOString(),
            capsuleId: capsule.id,
          },
        });

        // capsule → granted → privilege
        edgeMap.set(edgeId(capId, 'ATTESTED_BY', privId), {
          id: edgeId(capId, 'ATTESTED_BY', privId),
          source: capId,
          target: privId,
          relation: 'ATTESTED_BY',
          weight: capsule.status === 'VALID' ? 0.9 : 0.3,
          metadata: { organization: orgName },
        });

        // clinician → PRIVILEGED_AT → institution
        const instId = nodeId('INSTITUTION', orgSlug);
        if (!nodeMap.has(instId)) {
          nodeMap.set(instId, {
            id: instId,
            type: 'INSTITUTION',
            label: orgName,
            status: 'active',
            attributes: { name: orgName, verifierId: meta.verifierOrgId },
          });
        }
        edgeMap.set(edgeId(subjectId, 'PRIVILEGED_AT', instId), {
          id: edgeId(subjectId, 'PRIVILEGED_AT', instId),
          source: subjectId,
          target: instId,
          relation: 'PRIVILEGED_AT',
          weight: capsule.status === 'VALID' ? 0.95 : 0.3,
          metadata: { privilegeNodeId: privId, capsuleId: capsule.id },
        });

      } else if (capsule.decisionType === 'HIRING' || capsule.decisionType === 'DEPLOYMENT') {
        // INSTITUTION node for employer
        const instId = nodeId('INSTITUTION', orgSlug);
        if (!nodeMap.has(instId)) {
          nodeMap.set(instId, {
            id: instId,
            type: 'INSTITUTION',
            label: orgName,
            status: 'active',
            attributes: { name: orgName, verifierId: meta.verifierOrgId },
          });
        }

        edgeMap.set(edgeId(subjectId, 'ACCEPTED_BY', instId), {
          id: edgeId(subjectId, 'ACCEPTED_BY', instId),
          source: subjectId,
          target: instId,
          relation: 'ACCEPTED_BY',
          weight: capsule.status === 'VALID' ? 0.9 : 0.4,
          metadata: { capsuleId: capsule.id, decisionTimestamp: capsule.decisionTimestamp?.toISOString() },
        });

        // capsule → DEPENDS_ON → institution
        edgeMap.set(edgeId(capId, 'DEPENDS_ON', instId), {
          id: edgeId(capId, 'DEPENDS_ON', instId),
          source: capId,
          target: instId,
          relation: 'DEPENDS_ON',
          weight: 0.8,
          metadata: {},
        });
      }
    }
  }

  // ── Assemble ─────────────────────────────────────────────────────────────────
  const allNodes = Array.from(nodeMap.values());
  const allEdges = Array.from(edgeMap.values());
  const nodeIds = new Set(allNodes.map(n => n.id));

  // Drop edges referencing nodes that don't exist (safety)
  const validEdges = allEdges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));

  // ── Summary ──────────────────────────────────────────────────────────────────
  const licenseBoards = allNodes
    .filter(n => n.type === 'LICENSE_BOARD').map(n => n.label);
  const certBoards = allNodes
    .filter(n => n.type === 'CERTIFICATION_BOARD').map(n => n.label);
  const institutions = allNodes
    .filter(n => n.type === 'INSTITUTION').map(n => n.label);
  const trainingPrograms = allNodes
    .filter(n => n.type === 'TRAINING_PROGRAM').map(n => n.label);
  const activePrivileges = allNodes
    .filter(n => n.type === 'PRIVILEGE' && n.status === 'active').length;
  const activeSanctions = allNodes
    .filter(n => n.type === 'SANCTION_EVENT' && n.status === 'active').length;
  const activeCredentials = allNodes
    .filter(n => n.type === 'CREDENTIAL' && n.status === 'active').length;

  const decisionsByType = capsules.reduce<Record<string, number>>((acc, c) => {
    acc[c.decisionType] = (acc[c.decisionType] ?? 0) + 1;
    return acc;
  }, {});

  const summary: AuthorityGraphSummary = {
    trustBand,
    readinessScore,
    readinessStatus,
    activeCredentials,
    licenseBoards,
    certificationBoards: certBoards,
    institutions,
    trainingPrograms,
    activePrivileges,
    activeSanctions,
    decisions: { total: capsules.length, byType: decisionsByType },
    networkReach: allNodes.length,
    computedAt,
  };

  const graph: AuthorityGraph = {
    schema: AUTHORITY_GRAPH_SCHEMA,
    version: AUTHORITY_GRAPH_VERSION,
    npi,
    computedAt,
    subject: subjectNode,
    nodes: allNodes,
    edges: validEdges,
    summary,
  };

  // ── Background materialization → KnowledgeNode / AuthorityEdge ───────────
  setImmediate(() => {
    materializeToAKG(graph).catch(err =>
      log('warn', 'authorityGraph: materialization failed', { npi, error: String(err) })
    );
  });

  log('info', 'authorityGraph: built', {
    npi,
    nodes: allNodes.length,
    edges: validEdges.length,
    trustBand,
  });

  return graph;
}

// ── AKG Materialization ───────────────────────────────────────────────────────

/**
 * Upsert authority graph nodes and edges into the KnowledgeNode/AuthorityEdge
 * Prisma tables so that graphNavigator.ts traversals can use them.
 */
async function materializeToAKG(graph: AuthorityGraph): Promise<void> {
  // Upsert nodes
  const nodeDbIds = new Map<string, string>(); // authorityNode.id → KnowledgeNode.id (UUID)

  for (const node of graph.nodes) {
    try {
      const [entityType, ...entityIdParts] = node.id.split(':');
      const entityId = entityIdParts.join(':');
      const row = await prisma.knowledgeNode.upsert({
        where: { entityType_entityId: { entityType, entityId } },
        create: {
          entityType,
          entityId,
          label: node.label,
          attributes: JSON.parse(JSON.stringify(node.attributes)),
        },
        update: {
          label: node.label,
          attributes: JSON.parse(JSON.stringify(node.attributes)),
        },
        select: { id: true },
      });
      nodeDbIds.set(node.id, row.id);
    } catch (err) {
      log('warn', 'authorityGraph: node upsert failed', { nodeId: node.id, error: String(err) });
    }
  }

  // Upsert edges
  for (const edge of graph.edges) {
    const sourceDbId = nodeDbIds.get(edge.source);
    const targetDbId = nodeDbIds.get(edge.target);
    if (!sourceDbId || !targetDbId) continue;

    try {
      // Check if edge exists by source+relation+target
      const existing = await prisma.authorityEdge.findFirst({
        where: { sourceNodeId: sourceDbId, targetNodeId: targetDbId, relationType: edge.relation },
        select: { id: true },
      });
      if (!existing) {
        await prisma.authorityEdge.create({
          data: {
            sourceNodeId: sourceDbId,
            targetNodeId: targetDbId,
            relationType: edge.relation,
            weight: edge.weight,
            metadata: JSON.parse(JSON.stringify(edge.metadata)),
          },
        });
      }
    } catch {
      // P2002 / constraint violations are benign — another request materialized first
    }
  }
}

// ── Network query (uses materialized AKG) ─────────────────────────────────────

/**
 * Resolve the KnowledgeNode UUID for a clinician NPI (after materialization).
 * Returns null if not yet materialized.
 */
export async function resolveClinicianNodeId(npi: string): Promise<string | null> {
  try {
    const node = await prisma.knowledgeNode.findUnique({
      where: { entityType_entityId: { entityType: 'CLINICIAN', entityId: npi } },
      select: { id: true },
    });
    return node?.id ?? null;
  } catch {
    return null;
  }
}
