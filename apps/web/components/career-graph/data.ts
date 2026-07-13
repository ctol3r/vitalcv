/**
 * Career-evidence network — curated, illustrative dataset for the public graph
 * explorer. Three actor GROUPS per the doctrine: holder (clinician), verifier
 * (= employer), issuer. Shared evidence artifacts (credentials, sources,
 * opportunities, recognitions) are neutral nodes that connect the actors.
 *
 * Edges are BIDIRECTIONAL: every explicit link carries an implied backlink, so
 * a selected node can show both what it points to and what points back at it
 * (Obsidian/Roam-style). `kind: 'backlink'` edges are the recognition/acceptance
 * return paths that make the network compound.
 *
 * This is illustrative structure, not live data — the surface labels it so.
 */

export type GraphGroup = 'holder' | 'verifier' | 'issuer' | 'evidence';
export type NodeKind =
  | 'holder' | 'verifier' | 'issuer'
  | 'credential' | 'source' | 'opportunity' | 'recognition' | 'specialty';
export type EdgeKind = 'explicit' | 'backlink' | 'source' | 'recognition';

export interface CareerNode {
  id: string;
  label: string;
  group: GraphGroup;
  kind: NodeKind;
}

export interface CareerEdge {
  id: string;
  source: string;
  target: string;
  kind: EdgeKind;
}

const nodes: CareerNode[] = [];
const edges: CareerEdge[] = [];
const seen = new Set<string>();

function node(n: CareerNode) {
  if (!seen.has(n.id)) { seen.add(n.id); nodes.push(n); }
  return n.id;
}
function link(source: string, target: string, kind: EdgeKind) {
  edges.push({ id: `${source}~${target}~${kind}`, source, target, kind });
}

// ---- shared sources (the primary sources every credential reads from) ----
const SOURCES: Array<[string, string]> = [
  ['src-nppes', 'NPPES'],
  ['src-oig', 'OIG LEIE'],
  ['src-pecos', 'CMS PECOS'],
  ['src-abms', 'ABMS'],
  ['src-cmb', 'CA Medical Board'],
  ['src-tmb', 'TX Medical Board'],
  ['src-nysdoh', 'NY State Board'],
  ['src-dea', 'DEA registry'],
];
SOURCES.forEach(([id, label]) => node({ id, label, group: 'evidence', kind: 'source' }));

// ---- issuers (sign artifacts once; travel with the clinician) ----
const ISSUERS: Array<[string, string]> = [
  ['iss-abms', 'ABMS'],
  ['iss-stanford', 'Stanford GME'],
  ['iss-aoa', 'AOA'],
  ['iss-ucsf', 'UCSF Fellowship'],
];
ISSUERS.forEach(([id, label]) => node({ id, label, group: 'issuer', kind: 'issuer' }));

// ---- verifiers / employers (one group: they read AND accept) ----
const VERIFIERS: Array<[string, string]> = [
  ['ver-mercy', 'Mercy General Health'],
  ['ver-bay', 'Bay Area Health'],
  ['ver-sutter', 'Sutter Network'],
  ['ver-locum', 'Locum Partners'],
  ['ver-valley', 'Valley Physicians Grp'],
];
VERIFIERS.forEach(([id, label]) => node({ id, label, group: 'verifier', kind: 'verifier' }));

// specialties (shared connective tissue between holders and opportunities)
const SPECIALTIES: Array<[string, string]> = [
  ['sp-fm', 'Family Medicine'],
  ['sp-em', 'Emergency Medicine'],
  ['sp-im', 'Internal Medicine'],
  ['sp-cards', 'Cardiology'],
];
SPECIALTIES.forEach(([id, label]) => node({ id, label, group: 'evidence', kind: 'specialty' }));

// ---- holders (clinicians) and their credential fans ----
interface HolderSpec {
  id: string; name: string; specialty: string;
  creds: Array<{ id: string; label: string; source: string; issuer?: string }>;
  verifiers: string[];      // who accepted / is reviewing
  recognitions: string[];   // verifiers who recorded a recognition (backlink path)
}

const HOLDERS: HolderSpec[] = [
  {
    id: 'h-okafor', name: 'Dr. A. Okafor', specialty: 'sp-fm',
    creds: [
      { id: 'c-ok-npi', label: 'NPI', source: 'src-nppes' },
      { id: 'c-ok-ca', label: 'CA License', source: 'src-cmb', issuer: 'iss-stanford' },
      { id: 'c-ok-board', label: 'Board Cert', source: 'src-abms', issuer: 'iss-abms' },
      { id: 'c-ok-excl', label: 'Exclusion check', source: 'src-oig' },
      { id: 'c-ok-dea', label: 'DEA', source: 'src-dea' },
    ],
    verifiers: ['ver-mercy', 'ver-bay'],
    recognitions: ['ver-mercy'],
  },
  {
    id: 'h-chen', name: 'Dr. L. Chen', specialty: 'sp-cards',
    creds: [
      { id: 'c-ch-npi', label: 'NPI', source: 'src-nppes' },
      { id: 'c-ch-ca', label: 'CA License', source: 'src-cmb' },
      { id: 'c-ch-ny', label: 'NY License', source: 'src-nysdoh' },
      { id: 'c-ch-board', label: 'Board Cert', source: 'src-abms', issuer: 'iss-abms' },
      { id: 'c-ch-fellow', label: 'Cards Fellowship', source: 'src-abms', issuer: 'iss-ucsf' },
      { id: 'c-ch-pecos', label: 'Medicare enrollment', source: 'src-pecos' },
    ],
    verifiers: ['ver-sutter', 'ver-bay', 'ver-valley'],
    recognitions: ['ver-sutter', 'ver-bay'],
  },
  {
    id: 'h-ruiz', name: 'Dr. M. Ruiz', specialty: 'sp-em',
    creds: [
      { id: 'c-rz-npi', label: 'NPI', source: 'src-nppes' },
      { id: 'c-rz-tx', label: 'TX License', source: 'src-tmb' },
      { id: 'c-rz-board', label: 'Board Cert', source: 'src-abms', issuer: 'iss-aoa' },
      { id: 'c-rz-excl', label: 'Exclusion check', source: 'src-oig' },
    ],
    verifiers: ['ver-locum', 'ver-valley'],
    recognitions: ['ver-locum'],
  },
  {
    id: 'h-idris', name: 'Dr. S. Idris', specialty: 'sp-im',
    creds: [
      { id: 'c-id-npi', label: 'NPI', source: 'src-nppes' },
      { id: 'c-id-ca', label: 'CA License', source: 'src-cmb' },
      { id: 'c-id-board', label: 'Board Cert', source: 'src-abms', issuer: 'iss-abms' },
      { id: 'c-id-pecos', label: 'Medicare enrollment', source: 'src-pecos' },
    ],
    verifiers: ['ver-mercy', 'ver-valley'],
    recognitions: ['ver-mercy'],
  },
];

let oppCount = 0;
for (const h of HOLDERS) {
  node({ id: h.id, label: h.name, group: 'holder', kind: 'holder' });
  link(h.id, h.specialty, 'explicit');
  link(h.specialty, h.id, 'backlink');

  for (const c of h.creds) {
    node({ id: c.id, label: c.label, group: 'evidence', kind: 'credential' });
    // holder <-> credential (bidirectional)
    link(h.id, c.id, 'explicit');
    link(c.id, h.id, 'backlink');
    // credential -> source (what it reads from)
    link(c.id, c.source, 'source');
    // credential -> issuer (signed artifact), if any
    if (c.issuer) {
      link(c.id, c.issuer, 'explicit');
      link(c.issuer, c.id, 'backlink');
    }
  }

  // holder <-> verifier (a verifier is reviewing / accepted a shared snapshot)
  for (const v of h.verifiers) {
    const oppId = `opp-${++oppCount}`;
    node({ id: oppId, label: 'Opportunity', group: 'evidence', kind: 'opportunity' });
    link(h.id, oppId, 'explicit');
    link(oppId, v, 'explicit');
    link(v, oppId, 'backlink');
    link(v, h.specialty, 'explicit'); // verifiers hire into specialties
  }

  // recognitions — the return path that makes acceptance compound (backlink kind)
  for (const v of h.recognitions) {
    const recId = `rec-${h.id}-${v}`;
    node({ id: recId, label: 'Recognition', group: 'evidence', kind: 'recognition' });
    link(v, recId, 'recognition');
    link(recId, h.id, 'recognition');  // recognition attaches to the holder's record
    link(h.id, recId, 'backlink');
  }
}

export const CAREER_NODES: CareerNode[] = nodes;
export const CAREER_EDGES: CareerEdge[] = edges;

export const GROUP_META: Record<GraphGroup, { label: string; hint: string }> = {
  holder: { label: 'Holder · clinician', hint: 'Owns the record; claims and shares snapshots' },
  verifier: { label: 'Verifier · employer', hint: 'Reads shared snapshots and accepts them as a head start' },
  issuer: { label: 'Issuer', hint: 'Signs artifacts once; they travel with the clinician' },
  evidence: { label: 'Evidence & sources', hint: 'Credentials, primary sources, opportunities, recognitions' },
};

export const EDGE_META: Record<EdgeKind, { label: string }> = {
  explicit: { label: 'Link' },
  backlink: { label: 'Backlink' },
  source: { label: 'Reads source' },
  recognition: { label: 'Recognition' },
};
