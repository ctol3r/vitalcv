/**
 * cascadeEngine.ts — Wave A (Phase 1 Hardening)
 * Salvaged from feature/interoperability-wave65, upgraded for main.
 *
 * Deeper blast-radius analysis using a memoized graph traversal.
 * Tracks impacted decisions, employers, and deployments separately
 * for use in the verifier command center blast-radius surface.
 *
 * This is a READ-ONLY analytical service. It does not mutate capsule state.
 * For mutation, use revocationCascade.propagateRevocation().
 */

import prisma from '../../graphql/prisma_client';

// ── Types ─────────────────────────────────────────────────────────────────

export interface CredentialScopeContext {
  credentialId: string;
  subjectNpi: string;
  organizationId: string | null;
}

export interface ImpactedDecision {
  decisionId: string;
  decisionType: string;
  status: string;
  subjectNpi: string;
  subjectDid: string;
  decisionTimestamp: string;
  employerId: string | null;
  deploymentRef: string | null;
}

export interface ImpactedEmployer {
  employerId: string;
  impactedDecisionIds: string[];
  impactedDeploymentIds: string[];
  impactedDecisionCount: number;
  impactedDeploymentCount: number;
}

export interface ImpactedDeployment {
  deploymentRef: string;
  decisionId: string;
  status: string;
  subjectNpi: string;
  decisionTimestamp: string;
  employerId: string | null;
}

export interface RevocationCascadeReport {
  credentialId: string;
  impactedDecisions: ImpactedDecision[];
  impactedEmployers: ImpactedEmployer[];
  impactedDeployments: ImpactedDeployment[];
  generatedAt: string;
}

type GraphAdjacency = ReadonlyMap<string, ReadonlySet<string>>;

// ── Graph node prefixes ───────────────────────────────────────────────────

const CREDENTIAL_NODE_PREFIX = 'credential:';
const DECISION_NODE_PREFIX = 'decision:';
const EMPLOYER_NODE_PREFIX = 'employer:';
const DEPLOYMENT_NODE_PREFIX = 'deployment:';

// ── Error types ───────────────────────────────────────────────────────────

export class CredentialNotFoundError extends Error {
  constructor(credentialId: string) {
    super(`VerificationArtifact ${credentialId} not found.`);
    this.name = 'CredentialNotFoundError';
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────

function parseNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const s = value.trim();
  return s.length > 0 ? s : null;
}

function toJsonObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function parseEmployerId(metadata: unknown): string | null {
  const obj = toJsonObject(metadata);
  if (!obj) return null;
  return parseNonEmptyString(obj.employerId);
}

function resolveDeploymentRef(metadata: unknown, decisionId: string): string {
  const obj = toJsonObject(metadata);
  if (obj) {
    const ref =
      parseNonEmptyString(obj.deploymentRef) ??
      parseNonEmptyString(obj.deploymentId) ??
      parseNonEmptyString(obj.deployment);
    if (ref) return ref;
  }
  return `decision-${decisionId}`;
}

function ensureNode(graph: Map<string, Set<string>>, nodeId: string): void {
  if (!graph.has(nodeId)) graph.set(nodeId, new Set<string>());
}

function addEdge(graph: Map<string, Set<string>>, src: string, dst: string): void {
  ensureNode(graph, src);
  ensureNode(graph, dst);
  graph.get(src)?.add(dst);
}

// ── Memoized graph reachability ───────────────────────────────────────────

export function computeReachableNodesMemoized(
  startNodeId: string,
  graph: GraphAdjacency,
  memo: Map<string, Set<string>> = new Map(),
): Set<string> {
  const visiting = new Set<string>();

  const visit = (nodeId: string): Set<string> => {
    const cached = memo.get(nodeId);
    if (cached) return new Set(cached);
    if (visiting.has(nodeId)) return new Set<string>([nodeId]);

    visiting.add(nodeId);
    const reachable = new Set<string>([nodeId]);
    for (const neighbor of graph.get(nodeId) ?? new Set()) {
      for (const child of visit(neighbor)) reachable.add(child);
    }
    visiting.delete(nodeId);
    memo.set(nodeId, new Set(reachable));
    return new Set(reachable);
  };

  return visit(startNodeId);
}

// ── Core API ──────────────────────────────────────────────────────────────

export async function resolveCredentialScope(
  credentialId: string,
): Promise<CredentialScopeContext> {
  const artifact = await prisma.verificationArtifact.findUnique({
    where: { id: credentialId },
    select: { id: true, npi: true, organizationId: true },
  });
  if (!artifact) throw new CredentialNotFoundError(credentialId);
  return { credentialId: artifact.id, subjectNpi: artifact.npi, organizationId: artifact.organizationId };
}

export async function generateRevocationCascadeReport(
  scope: CredentialScopeContext,
): Promise<RevocationCascadeReport> {
  const rows = await prisma.decisionCapsule.findMany({
    where: {
      subjectNpi: scope.subjectNpi,
      credentialIds: { has: scope.credentialId },
    },
    orderBy: [{ decisionTimestamp: 'desc' }, { id: 'asc' }],
    select: {
      id: true,
      decisionType: true,
      status: true,
      subjectNpi: true,
      subjectDid: true,
      decisionTimestamp: true,
      metadata: true,
    },
  });

  const impactGraph = new Map<string, Set<string>>();
  const decisionByNodeId = new Map<string, ImpactedDecision>();
  const memo = new Map<string, Set<string>>();

  const credentialNodeId = `${CREDENTIAL_NODE_PREFIX}${scope.credentialId}`;
  ensureNode(impactGraph, credentialNodeId);

  for (const row of rows) {
    const employerId = parseEmployerId(row.metadata);
    const deploymentRef =
      row.decisionType === 'DEPLOYMENT' ? resolveDeploymentRef(row.metadata, row.id) : null;

    const decisionNodeId = `${DECISION_NODE_PREFIX}${row.id}`;
    decisionByNodeId.set(decisionNodeId, {
      decisionId: row.id,
      decisionType: row.decisionType,
      status: row.status,
      subjectNpi: row.subjectNpi,
      subjectDid: row.subjectDid,
      decisionTimestamp: row.decisionTimestamp.toISOString(),
      employerId,
      deploymentRef,
    });

    addEdge(impactGraph, credentialNodeId, decisionNodeId);
    if (employerId) addEdge(impactGraph, decisionNodeId, `${EMPLOYER_NODE_PREFIX}${encodeURIComponent(employerId)}`);
    if (deploymentRef) addEdge(impactGraph, decisionNodeId, `${DEPLOYMENT_NODE_PREFIX}${encodeURIComponent(deploymentRef)}`);
  }

  const reachable = computeReachableNodesMemoized(credentialNodeId, impactGraph, memo);

  const impactedDecisions = [...decisionByNodeId.entries()]
    .filter(([nodeId]) => reachable.has(nodeId))
    .map(([, d]) => d)
    .sort((a, b) => new Date(b.decisionTimestamp).getTime() - new Date(a.decisionTimestamp).getTime());

  // Employer rollup
  const byEmployer = new Map<string, { decisionIds: Set<string>; deploymentIds: Set<string> }>();
  for (const d of impactedDecisions) {
    if (!d.employerId) continue;
    const e = byEmployer.get(d.employerId) ?? { decisionIds: new Set(), deploymentIds: new Set() };
    e.decisionIds.add(d.decisionId);
    if (d.decisionType === 'DEPLOYMENT' && d.deploymentRef) e.deploymentIds.add(d.deploymentRef);
    byEmployer.set(d.employerId, e);
  }

  const impactedEmployers: ImpactedEmployer[] = [...byEmployer.entries()].map(([employerId, v]) => ({
    employerId,
    impactedDecisionIds: [...v.decisionIds].sort(),
    impactedDeploymentIds: [...v.deploymentIds].sort(),
    impactedDecisionCount: v.decisionIds.size,
    impactedDeploymentCount: v.deploymentIds.size,
  })).sort((a, b) => a.employerId.localeCompare(b.employerId));

  const impactedDeployments: ImpactedDeployment[] = impactedDecisions
    .filter((d) => d.decisionType === 'DEPLOYMENT' && d.deploymentRef)
    .map((d) => ({
      deploymentRef: d.deploymentRef as string,
      decisionId: d.decisionId,
      status: d.status,
      subjectNpi: d.subjectNpi,
      decisionTimestamp: d.decisionTimestamp,
      employerId: d.employerId,
    }));

  return {
    credentialId: scope.credentialId,
    impactedDecisions,
    impactedEmployers,
    impactedDeployments,
    generatedAt: new Date().toISOString(),
  };
}

export const revocationCascadeEngine = {
  resolveCredentialScope,
  generateRevocationCascadeReport,
};
