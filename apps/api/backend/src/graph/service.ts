import { neo4jConfigured, neo4jRunCypher } from './neo4jHttp';
export { neo4jConfigured };
import { GRAPH_SCHEMA_CYPHER } from './schema';

export type GraphView = {
  nodes: Array<{ id: string; label: string; group: string }>;
  links: Array<{ source: string; target: string; weight: number; type?: string }>;
};

export async function ensureGraphSchema(): Promise<{ ok: boolean; applied: number }> {
  if (!neo4jConfigured()) return { ok: false, applied: 0 };
  let applied = 0;
  for (const stmt of GRAPH_SCHEMA_CYPHER) {
    await neo4jRunCypher(stmt, {});
    applied++;
  }
  return { ok: true, applied };
}

export async function graphHealth(): Promise<{ ok: boolean; info?: unknown }> {
  if (!neo4jConfigured()) return { ok: false };
  const res = await neo4jRunCypher('CALL dbms.components() YIELD name, versions RETURN name, versions', {});
  return { ok: true, info: res.data.map((d) => d.row) };
}

export async function seedDemoGraph(): Promise<{ ok: boolean }> {
  if (!neo4jConfigured()) return { ok: false };

  // Deterministic demo identities (non-PHI)
  const cypher = `
MERGE (issuer:Institution {id: $issuerId})
  SET issuer.name = $issuerName
MERGE (stanford:Institution {id: $inst1})
  SET stanford.name = $inst1Name
MERGE (kaiser:Institution {id: $inst2})
  SET kaiser.name = $inst2Name

MERGE (alice:Clinician {id: $c1})
  SET alice.name = $c1Name, alice.email = $c1Email
MERGE (bob:Clinician {id: $c2})
  SET bob.name = $c2Name, bob.email = $c2Email

MERGE (cardio:Specialty {id: $s1}) SET cardio.name = $s1Name
MERGE (pharm:Specialty {id: $s2}) SET pharm.name = $s2Name

MERGE (alice)-[:SPECIALTY]->(cardio)
MERGE (bob)-[:SPECIALTY]->(pharm)

MERGE (lic1:License {id: $l1})
  SET lic1.state = 'CA', lic1.number = 'CA-12345', lic1.status = 'Active'
MERGE (bc1:BoardCert {id: $b1})
  SET bc1.name = 'Cardiology Board Certification'

MERGE (alice)-[:HAS_LICENSE]->(lic1)
MERGE (alice)-[:HAS_BOARDCERT]->(bc1)
MERGE (alice)-[:AFFILIATED_WITH {since: date('2020-01-01')}]->(stanford)
MERGE (bob)-[:AFFILIATED_WITH {since: date('2022-06-01')}]->(kaiser)

MERGE (cred1:Credential {id: $cred1})
  SET cred1.type = 'Nursing License', cred1.issuer = $issuerName, cred1.issuedAt = datetime()
MERGE (cred2:Credential {id: $cred2})
  SET cred2.type = 'Pharmacy Certification', cred2.issuer = $issuerName, cred2.issuedAt = datetime()

MERGE (alice)-[:HAS_CREDENTIAL]->(cred1)
MERGE (bob)-[:HAS_CREDENTIAL]->(cred2)
MERGE (cred1)-[:ISSUED_BY]->(issuer)
MERGE (cred2)-[:ISSUED_BY]->(issuer)
RETURN 1 as ok
`;

  await ensureGraphSchema();
  await neo4jRunCypher(cypher, {
    issuerId: 'issuer:vitalcv-demo',
    issuerName: 'VitalCV Demo Issuer (Non-PHI)',
    inst1: 'inst:stanford',
    inst1Name: 'Stanford Health',
    inst2: 'inst:kaiser',
    inst2Name: 'Kaiser Permanente',
    c1: 'clinician:alice',
    c1Name: 'Alice Example',
    c1Email: 'alice@example.com',
    c2: 'clinician:bob',
    c2Name: 'Bob Example',
    c2Email: 'bob@example.com',
    s1: 'spec:cardiology',
    s1Name: 'Cardiology',
    s2: 'spec:pharmacy',
    s2Name: 'Pharmacy',
    l1: 'license:alice:ca',
    b1: 'boardcert:alice:cardio',
    cred1: 'cred:demo:alice:1',
    cred2: 'cred:demo:bob:1',
  });

  return { ok: true };
}

export async function upsertIssuanceToGraph(input: {
  credentialId: string;
  credentialType: string;
  issuer: string;
  subjectEmail?: string | null;
  subjectName?: string | null;
}): Promise<{ ok: boolean }> {
  if (!neo4jConfigured()) return { ok: false };

  const clinicianId = input.subjectEmail ? `email:${input.subjectEmail}` : `subject:${input.credentialId}`;
  const credentialNodeId = `cred:${input.credentialId}`;
  const issuerId = `issuer:${input.issuer}`;

  const cypher = `
MERGE (issuer:Institution {id: $issuerId})
  SET issuer.name = $issuerName
MERGE (c:Clinician {id: $clinicianId})
  SET c.email = $email, c.name = coalesce($name, c.name, $email)
MERGE (cred:Credential {id: $credId})
  SET cred.type = $credType, cred.issuer = $issuerName, cred.issuedAt = datetime()
MERGE (c)-[:HAS_CREDENTIAL]->(cred)
MERGE (cred)-[:ISSUED_BY]->(issuer)
RETURN 1 as ok
`;

  await neo4jRunCypher(cypher, {
    issuerId,
    issuerName: input.issuer,
    clinicianId,
    email: input.subjectEmail ?? null,
    name: input.subjectName ?? null,
    credId: credentialNodeId,
    credType: input.credentialType,
  });

  return { ok: true };
}

export async function getReadinessScore(clinicianId: string): Promise<{
  clinicianId: string;
  score: number;
  factors: Record<string, unknown>;
}> {
  if (!neo4jConfigured()) {
    throw new Error('Neo4j not configured');
  }

  const cypher = `
MATCH (c:Clinician {id: $id})
OPTIONAL MATCH (c)-[:HAS_LICENSE]->(l:License)
WITH c, sum(CASE WHEN coalesce(l.status,'') = 'Active' THEN 1 ELSE 0 END) AS activeLicenses
OPTIONAL MATCH (c)-[:HAS_BOARDCERT]->(b:BoardCert)
WITH c, activeLicenses, count(b) AS boardCerts
OPTIONAL MATCH (c)-[:HAS_SANCTION]->(s:Sanction)
WITH c, activeLicenses, boardCerts, count(s) AS sanctions
OPTIONAL MATCH (c)-[a:AFFILIATED_WITH]->(:Institution)
WITH c, activeLicenses, boardCerts, sanctions, min(a.since) AS since
RETURN
  activeLicenses AS activeLicenses,
  boardCerts AS boardCerts,
  sanctions AS sanctions,
  since AS since
`;

  const res = await neo4jRunCypher(cypher, { id: clinicianId });
  const row = (res.data[0]?.row || {}) as any;

  const activeLicenses = Number(row.activeLicenses || 0);
  const boardCerts = Number(row.boardCerts || 0);
  const sanctions = Number(row.sanctions || 0);
  const since = row.since as { year: number; month: number; day: number } | null | undefined;

  let score = 50;
  if (activeLicenses > 0) score += 20;
  if (boardCerts > 0) score += 20;
  if (sanctions > 0) score -= 30;

  let tenureYears = 0;
  if (since?.year) {
    const sinceDate = new Date(Date.UTC(since.year, (since.month || 1) - 1, since.day || 1));
    tenureYears = Math.max(0, (Date.now() - sinceDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    score += Math.min(10, Math.floor(tenureYears));
  }

  score = Math.max(0, Math.min(100, score));
  return {
    clinicianId,
    score,
    factors: { activeLicenses, boardCerts, sanctions, tenureYears: Math.round(tenureYears * 10) / 10 },
  };
}

export async function getSpecialtyDensity(limit = 10): Promise<Array<{ specialty: string; clinicians: number }>> {
  if (!neo4jConfigured()) {
    throw new Error('Neo4j not configured');
  }

  const cypher = `
MATCH (:Clinician)-[:SPECIALTY]->(s:Specialty)
RETURN s.name AS specialty, count(*) AS clinicians
ORDER BY clinicians DESC
LIMIT $limit
`;

  const res = await neo4jRunCypher(cypher, { limit });
  return res.data.map((d) => {
    const row = d.row as any;
    return { specialty: String(row.specialty || 'unknown'), clinicians: Number(row.clinicians || 0) };
  });
}

export async function getGraphView(limit = 200): Promise<GraphView> {
  if (!neo4jConfigured()) {
    throw new Error('Neo4j not configured');
  }

  const cypher = `
MATCH (a)-[r]->(b)
RETURN
  labels(a)[0] AS aLabel,
  coalesce(a.id, a.email, a.name) AS aId,
  coalesce(a.name, a.id, a.email) AS aName,
  labels(b)[0] AS bLabel,
  coalesce(b.id, b.email, b.name) AS bId,
  coalesce(b.name, b.id, b.email) AS bName,
  type(r) AS relType
LIMIT $limit
`;

  const res = await neo4jRunCypher(cypher, { limit });
  const nodes = new Map<string, { id: string; label: string; group: string }>();
  const links: Array<{ source: string; target: string; weight: number; type?: string }> = [];

  const groupFor = (label: string) => {
    if (label === 'Clinician') return 'holder';
    if (label === 'Institution') return 'verifier';
    if (label === 'Credential' || label === 'License' || label === 'BoardCert') return 'cred';
    if (label === 'Specialty') return 'specialty';
    return label.toLowerCase();
  };

  for (const d of res.data) {
    const row = d.row as any;
    const aId = String(row.aId);
    const bId = String(row.bId);
    const aLabel = String(row.aLabel || 'Node');
    const bLabel = String(row.bLabel || 'Node');
    if (!nodes.has(aId)) nodes.set(aId, { id: aId, label: String(row.aName || aId), group: groupFor(aLabel) });
    if (!nodes.has(bId)) nodes.set(bId, { id: bId, label: String(row.bName || bId), group: groupFor(bLabel) });
    links.push({ source: aId, target: bId, weight: 1, type: String(row.relType || '') || undefined });
  }

  return { nodes: Array.from(nodes.values()), links };
}


