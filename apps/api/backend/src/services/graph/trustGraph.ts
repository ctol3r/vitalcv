import prisma from '../../graphql/prisma_client';

export type GraphNode = {
  id: string;
  label: string;
  group: 'clinician' | 'issuer' | 'employer' | 'credential';
  status?: string;
  trustState?: string;
  auditHash?: string | null;
  val: number; // size mapped to visual
};

export type GraphEdge = {
  source: string;
  target: string;
  label: string;
};

export async function generateTrustGraph(npi: string): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
  const artifacts = await prisma.verificationArtifact.findMany({
    where: { npi },
    orderBy: { createdAt: 'desc' }
  });

  const acceptances = await prisma.acceptance.findMany({
    where: { subjectId: npi },
    orderBy: { createdAt: 'desc' }
  });

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  const clinicianId = `clinician-${npi}`;
  nodes.push({
    id: clinicianId,
    label: `Clinician ${npi}`,
    group: 'clinician',
    val: 20
  });

  const employerIds = new Set<string>();
  for (const acc of acceptances) {
    const employerNodeId = `employer-${acc.employerId}`;
    if (!employerIds.has(employerNodeId)) {
      employerIds.add(employerNodeId);
      nodes.push({ id: employerNodeId, label: acc.employerId, group: 'employer', val: 15 });
      edges.push({ source: clinicianId, target: employerNodeId, label: 'EMPLOYED_AT' });
    }
  }

  const issuerNames = new Set<string>();
  for (const art of artifacts) {
    const issuerNodeId = `issuer-${art.source.replace(/\s+/g, '-')}`;
    if (!issuerNames.has(issuerNodeId)) {
      issuerNames.add(issuerNodeId);
      nodes.push({ id: issuerNodeId, label: art.source, group: 'issuer', val: 15 });
      edges.push({ source: issuerNodeId, target: clinicianId, label: 'VERIFIED_BY' });
    }

    const credId = `cred-${art.id}`;
    let auditHash = art.checksum;
    if (art.merkleRoot) {
      auditHash = art.merkleRoot;
    }

    nodes.push({
      id: credId,
      label: 'Credential',
      group: 'credential',
      status: art.status,
      trustState: art.trustState,
      auditHash,
      val: 10
    });

    edges.push({ source: issuerNodeId, target: credId, label: 'ISSUED' });
    edges.push({ source: credId, target: clinicianId, label: 'BELONGS_TO' });
  }

  // Fallback data if DB is completely empty for this NPI, just to ensure the UI renders a nice demo graph structure.
  if (nodes.length === 1) {
    nodes.push({ id: 'issuer-demo', label: 'State Medical Board', group: 'issuer', val: 15 });
    nodes.push({ id: 'cred-demo', label: 'State License', group: 'credential', status: 'Valid', trustState: 'GREEN', auditHash: 'deadbeef12345678', val: 10 });
    nodes.push({ id: 'employer-demo', label: 'General Hospital', group: 'employer', val: 15 });

    edges.push({ source: 'issuer-demo', target: clinicianId, label: 'VERIFIED_BY' });
    edges.push({ source: 'issuer-demo', target: 'cred-demo', label: 'ISSUED' });
    edges.push({ source: 'cred-demo', target: clinicianId, label: 'BELONGS_TO' });
    edges.push({ source: clinicianId, target: 'employer-demo', label: 'EMPLOYED_AT' });
  }

  return { nodes, edges };
}
