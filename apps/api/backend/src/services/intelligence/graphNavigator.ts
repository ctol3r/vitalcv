/**
 * graphNavigator.ts — Wave 46: Authority-Bound Knowledge Graph
 *
 * Graph traversal engine for the AKG (Authority-Bound Knowledge Graph).
 *
 * Provides three core operations:
 *   1. evaluateReadinessPath — determines if a clinician meets all facility requirements
 *      by walking: Facility → REQUIRED_BY → Policy → COMPLIES_WITH → Credential → VERIFIED_BY
 *   2. getNodeNeighborhood — retrieves the N-depth neighborhood around any node
 *   3. findPathBetween — BFS shortest-path between two nodes
 */

import prisma from '../../graphql/prisma_client';
import { log } from '../../obs/logger';

// ── Types ─────────────────────────────────────────────────────────────────

export interface PathResult {
  policyNodeId: string;
  policyLabel: string;
  credentialNodeId: string | null;
  credentialLabel: string | null;
  verified: boolean;
  reasoningStep: string;
}

export interface ReadinessResult {
  ready: boolean;
  satisfiedPaths: PathResult[];
  missingPaths: PathResult[];
  reasoningTrace: string[];
}

export interface NeighborhoodNode {
  id: string;
  entityType: string;
  entityId: string;
  label: string;
  attributes: unknown;
  depth: number;
}

export interface NeighborhoodEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationType: string;
  weight: number;
  cryptographicProof: string | null;
  metadata: unknown;
}

export interface NeighborhoodResult {
  rootNodeId: string;
  nodes: NeighborhoodNode[];
  edges: NeighborhoodEdge[];
  depth: number;
}

export interface PathSegment {
  nodeId: string;
  label: string;
  entityType: string;
}

export interface PathBetweenResult {
  found: boolean;
  path: PathSegment[];
  edgeCount: number;
}

// ── GraphNavigator ────────────────────────────────────────────────────────

export class GraphNavigator {
  /**
   * Evaluate whether a clinician has all required, verified credentials
   * to work at a specific facility by traversing the AKG.
   *
   * Walk: Facility → REQUIRED_BY → Policy nodes
   *       Policy → (reverse COMPLIES_WITH) → Credential nodes
   *       Credential → (has VERIFIED_BY edge?) → verified
   */
  async evaluateReadinessPath(
    clinicianNodeId: string,
    facilityNodeId: string,
  ): Promise<ReadinessResult> {
    const trace: string[] = [];
    const satisfiedPaths: PathResult[] = [];
    const missingPaths: PathResult[] = [];

    // ── Step 1: Resolve both nodes ──────────────────────────────────
    trace.push(`[AKG] Resolving clinician node: ${clinicianNodeId}`);
    const clinicianNode = await prisma.knowledgeNode.findUnique({
      where: { id: clinicianNodeId },
    });

    if (!clinicianNode) {
      trace.push(`[AKG] ✗ Clinician node not found`);
      return { ready: false, satisfiedPaths, missingPaths, reasoningTrace: trace };
    }
    trace.push(`[AKG] ✓ Clinician: ${clinicianNode.label} (${clinicianNode.entityType})`);

    trace.push(`[AKG] Resolving facility node: ${facilityNodeId}`);
    const facilityNode = await prisma.knowledgeNode.findUnique({
      where: { id: facilityNodeId },
    });

    if (!facilityNode) {
      trace.push(`[AKG] ✗ Facility node not found`);
      return { ready: false, satisfiedPaths, missingPaths, reasoningTrace: trace };
    }
    trace.push(`[AKG] ✓ Facility: ${facilityNode.label} (${facilityNode.entityType})`);

    // ── Step 2: Find all REQUIRED_BY edges from facility → policy nodes ──
    trace.push(`[AKG] Querying REQUIRED_BY edges from facility`);
    const requiredEdges = await prisma.authorityEdge.findMany({
      where: { sourceNodeId: facilityNodeId, relationType: 'REQUIRED_BY' },
      include: { target: true },
    });

    trace.push(`[AKG] Found ${requiredEdges.length} requirement(s)`);

    if (requiredEdges.length === 0) {
      trace.push(`[AKG] No requirements defined for this facility — clinician is ready by default`);
      return { ready: true, satisfiedPaths, missingPaths, reasoningTrace: trace };
    }

    // ── Step 3: For each required policy, check compliance ───────────
    for (const reqEdge of requiredEdges) {
      const policyNode = reqEdge.target;
      trace.push(`[AKG] Checking policy: ${policyNode.label} (${policyNode.id})`);

      // Walk backward: find COMPLIES_WITH edges pointing TO this policy
      // where the source is a CREDENTIAL node linked to our clinician
      const complianceEdges = await prisma.authorityEdge.findMany({
        where: { targetNodeId: policyNode.id, relationType: 'COMPLIES_WITH' },
        include: { source: true },
      });

      // Filter: only credentials that belong to this clinician
      // A credential belongs to a clinician via an ISSUED_TO edge: credential → clinician
      let foundCompliant = false;

      for (const compEdge of complianceEdges) {
        const credentialNode = compEdge.source;

        // Verify this credential is linked to our clinician via ISSUED_TO
        const issuedToEdge = await prisma.authorityEdge.findFirst({
          where: {
            sourceNodeId: credentialNode.id,
            targetNodeId: clinicianNodeId,
            relationType: 'ISSUED_TO',
          },
        });

        if (!issuedToEdge) {
          continue; // This credential belongs to another clinician
        }

        // ── Step 4: Check for VERIFIED_BY edge on this credential ──
        const verifiedEdge = await prisma.authorityEdge.findFirst({
          where: { sourceNodeId: credentialNode.id, relationType: 'VERIFIED_BY' },
        });

        if (verifiedEdge) {
          trace.push(`[AKG] ✓ Policy "${policyNode.label}" satisfied by credential "${credentialNode.label}" (verified)`);
          satisfiedPaths.push({
            policyNodeId: policyNode.id,
            policyLabel: policyNode.label,
            credentialNodeId: credentialNode.id,
            credentialLabel: credentialNode.label,
            verified: true,
            reasoningStep: `Credential "${credentialNode.label}" complies with "${policyNode.label}" and has verification proof`,
          });
          foundCompliant = true;
          break;
        } else {
          trace.push(`[AKG] ⚠ Credential "${credentialNode.label}" complies but lacks verification`);
        }
      }

      if (!foundCompliant) {
        trace.push(`[AKG] ✗ Policy "${policyNode.label}" NOT satisfied — no verified, compliant credential found`);
        missingPaths.push({
          policyNodeId: policyNode.id,
          policyLabel: policyNode.label,
          credentialNodeId: null,
          credentialLabel: null,
          verified: false,
          reasoningStep: `No verified credential found that complies with "${policyNode.label}"`,
        });
      }
    }

    const ready = missingPaths.length === 0;
    trace.push(
      ready
        ? `[AKG] RESULT: READY — All ${requiredEdges.length} requirements satisfied`
        : `[AKG] RESULT: NOT READY — ${missingPaths.length} of ${requiredEdges.length} requirements unsatisfied`,
    );

    log('info', 'GraphNavigator: readiness evaluation complete', {
      clinicianNodeId,
      facilityNodeId,
      ready,
      satisfied: satisfiedPaths.length,
      missing: missingPaths.length,
    });

    return { ready, satisfiedPaths, missingPaths, reasoningTrace: trace };
  }

  /**
   * Retrieve the neighborhood of a node up to the specified depth.
   * Follows both outgoing and incoming edges at each level.
   */
  async getNodeNeighborhood(nodeId: string, depth: number = 1): Promise<NeighborhoodResult> {
    const visitedNodeIds = new Set<string>();
    const resultNodes: NeighborhoodNode[] = [];
    const resultEdges: NeighborhoodEdge[] = [];
    const visitedEdgeIds = new Set<string>();

    // Seed the BFS with the root node
    const rootNode = await prisma.knowledgeNode.findUnique({ where: { id: nodeId } });
    if (!rootNode) {
      return { rootNodeId: nodeId, nodes: [], edges: [], depth };
    }

    visitedNodeIds.add(rootNode.id);
    resultNodes.push({
      id: rootNode.id,
      entityType: rootNode.entityType,
      entityId: rootNode.entityId,
      label: rootNode.label,
      attributes: rootNode.attributes,
      depth: 0,
    });

    let frontier = [rootNode.id];

    for (let d = 1; d <= depth; d++) {
      if (frontier.length === 0) break;

      const nextFrontier: string[] = [];

      // Fetch all edges touching the current frontier in both directions
      const [outEdges, inEdges] = await Promise.all([
        prisma.authorityEdge.findMany({
          where: { sourceNodeId: { in: frontier } },
          include: { target: true },
        }),
        prisma.authorityEdge.findMany({
          where: { targetNodeId: { in: frontier } },
          include: { source: true },
        }),
      ]);

      for (const edge of outEdges) {
        if (!visitedEdgeIds.has(edge.id)) {
          visitedEdgeIds.add(edge.id);
          resultEdges.push({
            id: edge.id,
            sourceNodeId: edge.sourceNodeId,
            targetNodeId: edge.targetNodeId,
            relationType: edge.relationType,
            weight: edge.weight,
            cryptographicProof: edge.cryptographicProof,
            metadata: edge.metadata,
          });
        }

        if (!visitedNodeIds.has(edge.target.id)) {
          visitedNodeIds.add(edge.target.id);
          nextFrontier.push(edge.target.id);
          resultNodes.push({
            id: edge.target.id,
            entityType: edge.target.entityType,
            entityId: edge.target.entityId,
            label: edge.target.label,
            attributes: edge.target.attributes,
            depth: d,
          });
        }
      }

      for (const edge of inEdges) {
        if (!visitedEdgeIds.has(edge.id)) {
          visitedEdgeIds.add(edge.id);
          resultEdges.push({
            id: edge.id,
            sourceNodeId: edge.sourceNodeId,
            targetNodeId: edge.targetNodeId,
            relationType: edge.relationType,
            weight: edge.weight,
            cryptographicProof: edge.cryptographicProof,
            metadata: edge.metadata,
          });
        }

        if (!visitedNodeIds.has(edge.source.id)) {
          visitedNodeIds.add(edge.source.id);
          nextFrontier.push(edge.source.id);
          resultNodes.push({
            id: edge.source.id,
            entityType: edge.source.entityType,
            entityId: edge.source.entityId,
            label: edge.source.label,
            attributes: edge.source.attributes,
            depth: d,
          });
        }
      }

      frontier = nextFrontier;
    }

    return { rootNodeId: nodeId, nodes: resultNodes, edges: resultEdges, depth };
  }

  /**
   * BFS shortest path between two nodes in the AKG.
   * Follows edges in both directions (undirected traversal).
   */
  async findPathBetween(
    sourceId: string,
    targetId: string,
    maxDepth: number = 6,
  ): Promise<PathBetweenResult> {
    // parentMap: nodeId → { parentNodeId, edgeId }
    const parentMap = new Map<string, string | null>();
    parentMap.set(sourceId, null);

    let frontier = [sourceId];

    for (let d = 0; d < maxDepth; d++) {
      if (frontier.length === 0) break;

      // Check if target is already in the frontier
      if (parentMap.has(targetId)) break;

      const nextFrontier: string[] = [];

      const [outEdges, inEdges] = await Promise.all([
        prisma.authorityEdge.findMany({
          where: { sourceNodeId: { in: frontier } },
          select: { sourceNodeId: true, targetNodeId: true },
        }),
        prisma.authorityEdge.findMany({
          where: { targetNodeId: { in: frontier } },
          select: { sourceNodeId: true, targetNodeId: true },
        }),
      ]);

      for (const edge of outEdges) {
        if (!parentMap.has(edge.targetNodeId)) {
          parentMap.set(edge.targetNodeId, edge.sourceNodeId);
          nextFrontier.push(edge.targetNodeId);
        }
      }

      for (const edge of inEdges) {
        if (!parentMap.has(edge.sourceNodeId)) {
          parentMap.set(edge.sourceNodeId, edge.targetNodeId);
          nextFrontier.push(edge.sourceNodeId);
        }
      }

      frontier = nextFrontier;
    }

    // Reconstruct path
    if (!parentMap.has(targetId)) {
      return { found: false, path: [], edgeCount: 0 };
    }

    const pathIds: string[] = [];
    let current: string | null = targetId;
    while (current !== null) {
      pathIds.unshift(current);
      current = parentMap.get(current) ?? null;
    }

    // Hydrate the path with node details
    const pathNodes = await prisma.knowledgeNode.findMany({
      where: { id: { in: pathIds } },
    });

    const nodeMap = new Map(pathNodes.map((n) => [n.id, n]));
    const path: PathSegment[] = pathIds.map((id) => {
      const node = nodeMap.get(id);
      return {
        nodeId: id,
        label: node?.label ?? 'unknown',
        entityType: node?.entityType ?? 'unknown',
      };
    });

    return { found: true, path, edgeCount: path.length - 1 };
  }
}

export const graphNavigator = new GraphNavigator();
