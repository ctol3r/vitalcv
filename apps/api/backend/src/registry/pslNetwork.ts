export type PslIssuerNode = {
  id: string;
  label: string;
  trustTier: 1 | 2 | 3;
  volume: number;
};

export type PslInclusionEdge = {
  source: string;
  target: string;
  relation: 'psl_inclusion';
};

export type PslNetworkMap = {
  nodes: PslIssuerNode[];
  edges: PslInclusionEdge[];
  generatedAt: string;
};

const pslNodes: PslIssuerNode[] = [
  { id: 'did:web:issuer.psl.vitalcv', label: 'VitalCV PSL Authority', trustTier: 1, volume: 1200 },
  { id: 'did:web:issuer.compact.vitalcv', label: 'Compact Licensing Council', trustTier: 1, volume: 640 },
  { id: 'did:web:issuer.stateboard.vitalcv', label: 'State Board Issuer', trustTier: 2, volume: 480 },
  { id: 'did:web:issuer.partner.vitalcv', label: 'Partner Issuer', trustTier: 3, volume: 210 },
];

const pslEdges: PslInclusionEdge[] = [
  { source: 'did:web:issuer.psl.vitalcv', target: 'did:web:issuer.compact.vitalcv', relation: 'psl_inclusion' },
  { source: 'did:web:issuer.psl.vitalcv', target: 'did:web:issuer.stateboard.vitalcv', relation: 'psl_inclusion' },
  { source: 'did:web:issuer.psl.vitalcv', target: 'did:web:issuer.partner.vitalcv', relation: 'psl_inclusion' },
];

export function getPslNetworkMap(minTier?: number): PslNetworkMap {
  const tier = Number.isFinite(minTier) ? Number(minTier) : undefined;
  const filteredNodes = tier
    ? pslNodes.filter((node) => node.trustTier <= tier)
    : [...pslNodes];
  const nodeIds = new Set(filteredNodes.map((node) => node.id));
  const filteredEdges = pslEdges.filter((edge) => nodeIds.has(edge.target));

  return {
    nodes: filteredNodes,
    edges: filteredEdges,
    generatedAt: new Date().toISOString(),
  };
}

export function resolvePslTier(issuerDid: string | null | undefined): number | null {
  if (!issuerDid) return null;
  const node = pslNodes.find((item) => item.id === issuerDid);
  return node ? node.trustTier : null;
}

export function isPslIssuer(issuerDid: string | null | undefined): boolean {
  return resolvePslTier(issuerDid) !== null;
}
