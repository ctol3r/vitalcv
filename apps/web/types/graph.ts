// ── Knowledge Graph Type Contracts ──────────────────────────────────────
// Types for the knowledge graph visualization and API responses.
// ────────────────────────────────────────────────────────────────────────

export type NodeGroup = 'clinician' | 'issuer' | 'employer' | 'credential' | 'policy' | 'decision';

export interface KnowledgeGraphNode {
  id: string;
  label: string;
  group: NodeGroup;
  status?: string;
  trustState?: string;
  auditHash?: string | null;
  val: number;
  metadata?: Record<string, unknown>;
}

export interface KnowledgeGraphEdge {
  source: string;
  target: string;
  label: string;
  weight?: number;
}

export interface KnowledgeGraphData {
  npi: string;
  graph: {
    nodes: KnowledgeGraphNode[];
    edges: KnowledgeGraphEdge[];
  };
  crs: {
    overallBand: string;
    overallScore: number;
    evaluations: CrsEvaluation[];
  };
  credentials: GraphCredential[];
  audit: {
    events: AuditEntry[];
    totalCount: number;
  };
}

export interface CrsEvaluation {
  policyId: string;
  facilityName: string;
  roleName: string;
  crsScore: number;
  crsBand: string;
  isCleared: boolean;
  matchedCount: number;
  missingCount: number;
}

export interface GraphCredential {
  id: string;
  source: string;
  status: string;
  lifecycleState: string;
  verifiedAt: string;
  expiresAt: string | null;
}

export interface AuditEntry {
  id: string;
  type: string;
  hash: string;
  createdAt: string;
}

// ── Fallback ───────────────────────────────────────────────────────────

export const EMPTY_GRAPH_DATA: KnowledgeGraphData = {
  npi: '',
  graph: { nodes: [], edges: [] },
  crs: { overallBand: 'RED', overallScore: 0, evaluations: [] },
  credentials: [],
  audit: { events: [], totalCount: 0 },
};
