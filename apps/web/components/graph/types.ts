export type NodeGroup = 'clinician' | 'issuer' | 'employer' | 'credential' | 'decision';
export type EdgeType = 'ISSUED_BY' | 'VERIFIED_BY' | 'DEPENDS_ON' | 'ACCEPTED_BY';

export type GraphNode = {
  id: string;
  label: string;
  group: NodeGroup | string;
  status?: string;
  trustState?: string;
  auditHash?: string | null;
  val: number;
};

export type GraphEdge = {
  source: string;
  target: string;
  label: string;
  type?: EdgeType | string;
};
