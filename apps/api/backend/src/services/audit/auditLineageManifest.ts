/**
 * auditLineageManifest.ts — Audit Lineage Manifest Builder (W2-PR124A)
 *
 * Produces end-to-end lineage manifests that trace the full custody and
 * derivation chain from raw audit events through replay synthesis to
 * institutional evidence packages.
 *
 * A lineage manifest answers: "For any given evidence item in the institutional
 * package, what is its complete chain of origin?" This reconstructability
 * requirement is load-bearing for external SAFE audits.
 *
 * Manifest structure:
 *   - Root nodes: original audit events / decision capsules
 *   - Intermediate nodes: replay reconstructions, adapter transforms
 *   - Leaf nodes: institutional evidence items
 *   - Edges: derivation relationships with transformation metadata
 *   - Gaps: explicit records of where the chain breaks
 *
 * Design contract: manifests are append-only in spirit — new transforms add
 * nodes and edges; they do not modify prior nodes. Pure transform, no DB.
 */

import { createHash } from 'crypto';
import type { SafeEvidenceEnvelope } from './safeAuditAdapters';
import type { ReplayAuditSynthesis } from './replayAuditSynthesis';
import type { InstitutionalEvidencePackage } from './institutionalEvidencePackager';

// ── Types ─────────────────────────────────────────────────────────────────────

export const LINEAGE_MANIFEST_SCHEMA = 'vitalcv.audit-lineage-manifest/v1';

export interface AuditLineageManifest {
  schema: typeof LINEAGE_MANIFEST_SCHEMA;
  manifestId: string;
  generatedAt: string;
  manifestHash: string;
  reconstructable: boolean;      // true only if no BLOCKING gaps
  nodes: LineageNode[];
  edges: LineageEdge[];
  gaps: LineageGap[];
  summary: LineageSummary;
}

export type LineageNodeKind =
  | 'AUDIT_EVENT'           // raw ledger event
  | 'DECISION_CAPSULE'      // original decision capsule
  | 'REPLAY_RECORD'         // replayEngine output
  | 'SAFE_EVIDENCE_ITEM'    // safeAuditAdapters output
  | 'SYNTHESIS_RECORD'      // replayAuditSynthesis output
  | 'INSTITUTIONAL_ITEM'    // institutionalEvidencePackager output
  | 'SENTINEL';             // fail-closed placeholder

export interface LineageNode {
  nodeId: string;
  kind: LineageNodeKind;
  label: string;
  timestamp: string | null;
  integrity: 'VERIFIED' | 'UNVERIFIED' | 'BREACHED' | 'ABSENT';
  ambiguityFlag: boolean;
  metadata: Record<string, unknown>;
}

export interface LineageEdge {
  edgeId: string;
  fromNodeId: string;
  toNodeId: string;
  transformationType: string;   // e.g. 'REPLAY', 'SAFE_ADAPT', 'SYNTHESIZE', 'PACKAGE'
  transformedAt: string;
  lossless: boolean;            // false if fields were stripped (PII removal, etc.)
  transformHash: string;        // hash of the transform parameters
}

export interface LineageGap {
  gapId: string;
  affectedNodeIds: string[];
  reason: string;
  severity: 'BLOCKING' | 'DEGRADED' | 'INFORMATIONAL';
  reconstructionPossible: boolean;
}

export interface LineageSummary {
  totalNodes: number;
  totalEdges: number;
  totalGaps: number;
  blockingGaps: number;
  brokenChains: number;
  integrityScore: number;   // 0–100
  humanReadableSummary: string;
}

// ── Main Builder ──────────────────────────────────────────────────────────────

export function buildLineageManifest(
  safeEnvelope: SafeEvidenceEnvelope,
  synthesis: ReplayAuditSynthesis,
  institutionalPackage: InstitutionalEvidencePackage,
): AuditLineageManifest {
  const manifestId = `manifest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const generatedAt = new Date().toISOString();

  const nodes: LineageNode[] = [];
  const edges: LineageEdge[] = [];
  const gaps: LineageGap[] = [];

  // Layer 0: SAFE envelope evidence items (top of observable chain)
  const safeNodes = buildSafeEvidenceNodes(safeEnvelope);
  nodes.push(...safeNodes);

  // Layer 1: Synthesis records
  const synthesisNodes = buildSynthesisNodes(synthesis);
  nodes.push(...synthesisNodes);
  edges.push(...linkSynthesisToSafe(synthesisNodes, safeNodes, synthesis, generatedAt));

  // Layer 2: Institutional items
  const institutionalNodes = buildInstitutionalNodes(institutionalPackage);
  nodes.push(...institutionalNodes);
  edges.push(...linkInstitutionalToSafe(institutionalNodes, safeNodes, generatedAt));

  // Layer 3: Sentinel nodes for gaps in provenance chain
  const sentinelNodes = buildSentinelNodes(safeEnvelope, synthesis, gaps);
  nodes.push(...sentinelNodes);

  // Propagate synthesis gaps into lineage gaps
  for (const gap of synthesis.gaps) {
    gaps.push({
      gapId: `lineage:${gap.gapId}`,
      affectedNodeIds: synthesisNodes.map((n) => n.nodeId).slice(0, 3),
      reason: gap.reason,
      severity: gap.severity,
      reconstructionPossible: gap.severity !== 'BLOCKING',
    });
  }

  // Check for broken chains (nodes with no edges)
  const connectedNodeIds = new Set([
    ...edges.map((e) => e.fromNodeId),
    ...edges.map((e) => e.toNodeId),
  ]);
  const isolatedNodes = nodes.filter(
    (n) => !connectedNodeIds.has(n.nodeId) && n.kind !== 'SENTINEL',
  );
  for (const isolated of isolatedNodes) {
    gaps.push({
      gapId: `lineage:isolated:${isolated.nodeId}`,
      affectedNodeIds: [isolated.nodeId],
      reason: `Node ${isolated.nodeId} (${isolated.kind}) has no lineage edges — chain break`,
      severity: 'DEGRADED',
      reconstructionPossible: false,
    });
  }

  const blockingGaps = gaps.filter((g) => g.severity === 'BLOCKING').length;
  const reconstructable = blockingGaps === 0;

  const summary = computeLineageSummary(nodes, edges, gaps, reconstructable);

  // Manifest hash
  const hashPayload = JSON.stringify({
    manifestId, generatedAt, nodeCount: nodes.length, edgeCount: edges.length, gapCount: gaps.length,
    reconstructable,
  });
  const manifestHash = createHash('sha256').update(hashPayload, 'utf8').digest('hex');

  return {
    schema: LINEAGE_MANIFEST_SCHEMA,
    manifestId,
    generatedAt,
    manifestHash,
    reconstructable,
    nodes,
    edges,
    gaps,
    summary,
  };
}

// ── Node Builders ─────────────────────────────────────────────────────────────

function buildSafeEvidenceNodes(env: SafeEvidenceEnvelope): LineageNode[] {
  const evidenceNodes: LineageNode[] = env.evidenceItems.map((item) => ({
    nodeId: `safe:evidence:${item.evidenceId}`,
    kind: 'SAFE_EVIDENCE_ITEM' as LineageNodeKind,
    label: `${item.credentialType} — ${item.sourceLabel}`,
    timestamp: item.verifiedAt,
    integrity: mapIntegrity(item.integrity),
    ambiguityFlag: item.ambiguityFlag,
    metadata: {
      evidenceId: item.evidenceId,
      status: item.status,
      safeClass: item.safeClass,
    },
  }));

  const decisionNodes: LineageNode[] = env.decisionRecords.map((r) => ({
    nodeId: `safe:decision:${r.decisionId}`,
    kind: 'REPLAY_RECORD' as LineageNodeKind,
    label: `${r.decisionType} decision @ ${r.decisionTimestamp}`,
    timestamp: r.decisionTimestamp,
    integrity: r.replayStatus === 'CLEAN' ? 'VERIFIED'
      : r.replayStatus === 'QUARANTINED' || r.replayStatus === 'CONTAINMENT_BREACH' ? 'BREACHED'
      : 'UNVERIFIED',
    ambiguityFlag: r.replayStatus === 'AMBIGUOUS',
    metadata: {
      decisionId: r.decisionId,
      replayStatus: r.replayStatus,
      containmentVerdict: r.containmentVerdict,
    },
  }));

  return [...evidenceNodes, ...decisionNodes];
}

function buildSynthesisNodes(synthesis: ReplayAuditSynthesis): LineageNode[] {
  const nodes: LineageNode[] = [];

  // Convergence node
  nodes.push({
    nodeId: `synthesis:convergence:${synthesis.synthesisId}`,
    kind: 'SYNTHESIS_RECORD',
    label: `Convergence Report (score ${synthesis.convergenceReport.convergenceScore}/100)`,
    timestamp: synthesis.synthesizedAt,
    integrity: synthesis.synthesisIntegrity.hashChainIntact ? 'VERIFIED' : 'UNVERIFIED',
    ambiguityFlag: synthesis.ambiguityQuantification.ambiguousDecisions > 0,
    metadata: {
      synthesisId: synthesis.synthesisId,
      convergenceScore: synthesis.convergenceReport.convergenceScore,
      divergenceCount: synthesis.convergenceReport.divergenceCount,
    },
  });

  // Survivability node
  nodes.push({
    nodeId: `synthesis:survivability:${synthesis.synthesisId}`,
    kind: 'SYNTHESIS_RECORD',
    label: `Survivability Window (grade ${synthesis.survivabilityWindow.survivabilityGrade})`,
    timestamp: synthesis.synthesizedAt,
    integrity: synthesis.survivabilityWindow.survivabilityGrade === 'A' ? 'VERIFIED' : 'UNVERIFIED',
    ambiguityFlag: false,
    metadata: {
      intactRate: synthesis.survivabilityWindow.intactRate,
      grade: synthesis.survivabilityWindow.survivabilityGrade,
    },
  });

  return nodes;
}

function buildInstitutionalNodes(pkg: InstitutionalEvidencePackage): LineageNode[] {
  return pkg.verificationEvidence.items.map((item) => ({
    nodeId: `institutional:evidence:${item.evidenceRef}`,
    kind: 'INSTITUTIONAL_ITEM' as LineageNodeKind,
    label: `${item.credentialType} — institutional view`,
    timestamp: item.verifiedAt,
    integrity: item.integrityStatus === 'HASH_MATCH' ? 'VERIFIED'
      : item.integrityStatus === 'HASH_MISMATCH' ? 'BREACHED'
      : 'UNVERIFIED',
    ambiguityFlag: item.uncertaintyFlag,
    metadata: {
      evidenceRef: item.evidenceRef,
      classLabel: item.classLabel,
      verificationStatus: item.verificationStatus,
    },
  }));
}

function buildSentinelNodes(
  env: SafeEvidenceEnvelope,
  synthesis: ReplayAuditSynthesis,
  gaps: LineageGap[],
): LineageNode[] {
  const sentinels: LineageNode[] = [];

  // One sentinel per fail-closed sentinel in the envelope
  for (const s of env.failClosedSentinels) {
    const nodeId = `sentinel:envelope:${s.replace(/[^a-zA-Z0-9]/g, '_')}`;
    sentinels.push({
      nodeId,
      kind: 'SENTINEL',
      label: `Fail-closed sentinel: ${s}`,
      timestamp: env.adaptedAt,
      integrity: 'ABSENT',
      ambiguityFlag: true,
      metadata: { sentinelReason: s },
    });
    gaps.push({
      gapId: `lineage:sentinel:${nodeId}`,
      affectedNodeIds: [nodeId],
      reason: `Fail-closed sentinel fired: ${s}`,
      severity: 'DEGRADED',
      reconstructionPossible: false,
    });
  }

  // Sentinel per blocking synthesis gap
  for (const gap of synthesis.gaps.filter((g) => g.severity === 'BLOCKING')) {
    const nodeId = `sentinel:synthesis:${gap.gapId.replace(/[^a-zA-Z0-9]/g, '_')}`;
    sentinels.push({
      nodeId,
      kind: 'SENTINEL',
      label: `Synthesis gap: ${gap.field}`,
      timestamp: synthesis.synthesizedAt,
      integrity: 'ABSENT',
      ambiguityFlag: false,
      metadata: { gapId: gap.gapId, reason: gap.reason },
    });
  }

  return sentinels;
}

// ── Edge Builders ─────────────────────────────────────────────────────────────

function linkSynthesisToSafe(
  synthesisNodes: LineageNode[],
  safeNodes: LineageNode[],
  synthesis: ReplayAuditSynthesis,
  transformedAt: string,
): LineageEdge[] {
  const edges: LineageEdge[] = [];
  const safeDecisionIds = safeNodes
    .filter((n) => n.kind === 'REPLAY_RECORD')
    .map((n) => n.nodeId);

  for (const synthNode of synthesisNodes) {
    for (const safeId of safeDecisionIds.slice(0, 5)) {
      const edgeId = `edge:synth:${synthNode.nodeId}:${safeId}`;
      edges.push({
        edgeId,
        fromNodeId: safeId,
        toNodeId: synthNode.nodeId,
        transformationType: 'SYNTHESIZE',
        transformedAt,
        lossless: true,
        transformHash: createHash('sha256')
          .update(`SYNTHESIZE:${safeId}:${synthNode.nodeId}:${synthesis.synthesisId}`)
          .digest('hex'),
      });
    }
  }

  return edges;
}

function linkInstitutionalToSafe(
  institutionalNodes: LineageNode[],
  safeNodes: LineageNode[],
  transformedAt: string,
): LineageEdge[] {
  const edges: LineageEdge[] = [];

  for (const instNode of institutionalNodes) {
    // Match by evidenceRef → safe evidence nodeId
    const evidenceRef = (instNode.metadata.evidenceRef as string) ?? '';
    const matchingSafe = safeNodes.find((n) => n.nodeId === `safe:evidence:${evidenceRef}`);
    const fromId = matchingSafe?.nodeId ?? safeNodes[0]?.nodeId;
    if (!fromId) continue;

    edges.push({
      edgeId: `edge:inst:${instNode.nodeId}`,
      fromNodeId: fromId,
      toNodeId: instNode.nodeId,
      transformationType: 'PACKAGE',
      transformedAt,
      lossless: false,   // PII stripped in institutional packaging
      transformHash: createHash('sha256')
        .update(`PACKAGE:${fromId}:${instNode.nodeId}`)
        .digest('hex'),
    });
  }

  return edges;
}

// ── Summary ───────────────────────────────────────────────────────────────────

function computeLineageSummary(
  nodes: LineageNode[],
  edges: LineageEdge[],
  gaps: LineageGap[],
  reconstructable: boolean,
): LineageSummary {
  const blockingGaps = gaps.filter((g) => g.severity === 'BLOCKING').length;
  const connectedNodeIds = new Set([
    ...edges.map((e) => e.fromNodeId),
    ...edges.map((e) => e.toNodeId),
  ]);
  const brokenChains = nodes.filter(
    (n) => !connectedNodeIds.has(n.nodeId) && n.kind !== 'SENTINEL',
  ).length;

  const integrityScore = Math.max(
    0,
    Math.round(100 - blockingGaps * 20 - brokenChains * 10 - gaps.length * 3),
  );

  return {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    totalGaps: gaps.length,
    blockingGaps,
    brokenChains,
    integrityScore,
    humanReadableSummary:
      `${nodes.length} lineage node(s), ${edges.length} derivation edge(s), ` +
      `${gaps.length} gap(s) (${blockingGaps} blocking). ` +
      `Integrity score: ${integrityScore}/100. ` +
      (reconstructable ? 'Full lineage reconstructable.' : 'Lineage has blocking gaps — partial reconstruction only.'),
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function mapIntegrity(integrity: string): LineageNode['integrity'] {
  switch (integrity) {
    case 'HASH_MATCH':    return 'VERIFIED';
    case 'HASH_MISMATCH': return 'BREACHED';
    case 'HASH_ABSENT':   return 'UNVERIFIED';
    default:              return 'ABSENT';
  }
}
