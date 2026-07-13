/**
 * Career-evidence network — curated, illustrative dataset for the public graph
 * explorer, modeled the Roam/Obsidian way: EVERY NODE IS A UNIQUE ENTITY.
 *
 * There is no repeated "NPI" or "Board Cert" node. Instead the shared concepts —
 * the primary sources (NPPES, OIG LEIE, state boards…), the issuers, and the
 * specialties — are single nodes that many clinicians link to, so they become
 * the high-degree hubs (exactly the shape of a knowledge graph). A clinician's
 * individual credentials are the EDGES to those hubs, not duplicate nodes.
 *
 * Edges are BIDIRECTIONAL: every link carries an implied backlink, so selecting
 * any node shows both what it points to (Links →) and what points back at it
 * (Backlinks ←). The three actor groups per doctrine: holder (clinician),
 * verifier (= employer), issuer. Sources + specialties are neutral evidence hubs.
 *
 * Illustrative structure, not live data — the surface labels it so.
 */

export type GraphGroup = 'holder' | 'verifier' | 'issuer' | 'evidence';
export type NodeKind = 'holder' | 'verifier' | 'issuer' | 'source' | 'specialty';
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
const nodeIds = new Set<string>();
const edgeIds = new Set<string>();

function addNode(id: string, label: string, group: GraphGroup, kind: NodeKind) {
  if (!nodeIds.has(id)) { nodeIds.add(id); nodes.push({ id, label, group, kind }); }
  return id;
}
/** Add a directed link plus its implied backlink (the reverse is ALWAYS a
 * plain `backlink`, so degree/physics count each relationship once and the
 * reverse renders dashed; the selection panel derives Links→/Backlinks← from
 * the forward edge's direction). */
function link(source: string, target: string, kind: EdgeKind) {
  const fwd = `${source}~${target}~${kind}`;
  if (!edgeIds.has(fwd)) { edgeIds.add(fwd); edges.push({ id: fwd, source, target, kind }); }
  const back = `${target}~${source}~backlink`;
  if (!edgeIds.has(back)) { edgeIds.add(back); edges.push({ id: back, source: target, target: source, kind: 'backlink' }); }
}

/* ---------- shared HUB nodes (each unique; many clinicians link in) ---------- */
// Primary sources
const SRC = {
  nppes: addNode('src-nppes', 'NPPES', 'evidence', 'source'),
  oig: addNode('src-oig', 'OIG LEIE', 'evidence', 'source'),
  pecos: addNode('src-pecos', 'CMS PECOS', 'evidence', 'source'),
  dea: addNode('src-dea', 'DEA Registry', 'evidence', 'source'),
  ca: addNode('src-ca', 'CA Medical Board', 'evidence', 'source'),
  tx: addNode('src-tx', 'TX Medical Board', 'evidence', 'source'),
  ny: addNode('src-ny', 'NY State Board', 'evidence', 'source'),
  fl: addNode('src-fl', 'FL Board of Medicine', 'evidence', 'source'),
} as const;
const STATE_SRC: Record<string, string> = { CA: SRC.ca, TX: SRC.tx, NY: SRC.ny, FL: SRC.fl };

// Specialties
const SP = {
  fm: addNode('sp-fm', 'Family Medicine', 'evidence', 'specialty'),
  em: addNode('sp-em', 'Emergency Medicine', 'evidence', 'specialty'),
  im: addNode('sp-im', 'Internal Medicine', 'evidence', 'specialty'),
  card: addNode('sp-card', 'Cardiology', 'evidence', 'specialty'),
  psy: addNode('sp-psy', 'Psychiatry', 'evidence', 'specialty'),
} as const;

// Issuers (sign artifacts once; they travel with the clinician)
const ISS = {
  abms: addNode('iss-abms', 'ABMS', 'issuer', 'issuer'),
  stanford: addNode('iss-stanford', 'Stanford GME', 'issuer', 'issuer'),
  ucsf: addNode('iss-ucsf', 'UCSF Fellowship', 'issuer', 'issuer'),
  aoa: addNode('iss-aoa', 'AOA', 'issuer', 'issuer'),
  mayo: addNode('iss-mayo', 'Mayo Clinic GME', 'issuer', 'issuer'),
} as const;

// Verifiers / employers (one group: they read AND accept)
const VER = {
  mercy: addNode('ver-mercy', 'Mercy General Health', 'verifier', 'verifier'),
  bay: addNode('ver-bay', 'Bay Area Health', 'verifier', 'verifier'),
  sutter: addNode('ver-sutter', 'Sutter Network', 'verifier', 'verifier'),
  locum: addNode('ver-locum', 'Locum Partners', 'verifier', 'verifier'),
  valley: addNode('ver-valley', 'Valley Physicians Grp', 'verifier', 'verifier'),
  cedar: addNode('ver-cedar', 'Cedars Network', 'verifier', 'verifier'),
  kaiser: addNode('ver-kaiser', 'Kaiser Regional', 'verifier', 'verifier'),
  hca: addNode('ver-hca', 'HCA Staffing', 'verifier', 'verifier'),
} as const;

// Employers hire into specialties (connects the verifier group to the evidence hubs)
const EMPLOYER_FOCUS: Array<[string, string]> = [
  [VER.mercy, SP.fm], [VER.mercy, SP.im], [VER.bay, SP.card], [VER.bay, SP.im],
  [VER.sutter, SP.card], [VER.locum, SP.em], [VER.valley, SP.em], [VER.valley, SP.im],
  [VER.cedar, SP.psy], [VER.kaiser, SP.fm], [VER.hca, SP.im], [VER.hca, SP.psy],
];
for (const [v, sp] of EMPLOYER_FOCUS) link(v, sp, 'explicit');

/* ---------- holders (each unique) — credentials are EDGES to the hubs ---------- */
interface Holder {
  id: string; name: string; state: keyof typeof STATE_SRC; specialty: string; issuer: string;
  pecos?: boolean; dea?: boolean; employers: string[]; recognitions?: string[];
}
const HOLDERS: Holder[] = [
  { id: 'h-okafor', name: 'Dr. A. Okafor', state: 'CA', specialty: SP.fm, issuer: ISS.stanford, dea: true, employers: [VER.mercy, VER.bay], recognitions: [VER.mercy] },
  { id: 'h-chen', name: 'Dr. L. Chen', state: 'CA', specialty: SP.card, issuer: ISS.ucsf, pecos: true, employers: [VER.sutter, VER.bay], recognitions: [VER.sutter, VER.bay] },
  { id: 'h-ruiz', name: 'Dr. M. Ruiz', state: 'TX', specialty: SP.em, issuer: ISS.aoa, dea: true, employers: [VER.locum, VER.valley], recognitions: [VER.locum] },
  { id: 'h-idris', name: 'Dr. S. Idris', state: 'CA', specialty: SP.im, issuer: ISS.abms, pecos: true, employers: [VER.mercy, VER.valley], recognitions: [VER.mercy] },
  { id: 'h-nguyen', name: 'Dr. T. Nguyen', state: 'NY', specialty: SP.psy, issuer: ISS.mayo, employers: [VER.cedar], recognitions: [VER.cedar] },
  { id: 'h-patel', name: 'Dr. R. Patel', state: 'TX', specialty: SP.im, issuer: ISS.abms, dea: true, employers: [VER.hca, VER.locum] },
  { id: 'h-santos', name: 'Dr. J. Santos', state: 'FL', specialty: SP.fm, issuer: ISS.stanford, employers: [VER.kaiser] },
  { id: 'h-kim', name: 'Dr. H. Kim', state: 'CA', specialty: SP.card, issuer: ISS.ucsf, pecos: true, employers: [VER.sutter, VER.kaiser], recognitions: [VER.sutter] },
  { id: 'h-alvarez', name: 'Dr. C. Alvarez', state: 'CA', specialty: SP.em, issuer: ISS.aoa, dea: true, employers: [VER.valley, VER.hca] },
  { id: 'h-obrien', name: "Dr. K. O'Brien", state: 'NY', specialty: SP.im, issuer: ISS.mayo, employers: [VER.cedar, VER.bay] },
  { id: 'h-wright', name: 'Dr. D. Wright', state: 'TX', specialty: SP.psy, issuer: ISS.abms, employers: [VER.hca], recognitions: [VER.hca] },
  { id: 'h-flores', name: 'Dr. P. Flores', state: 'FL', specialty: SP.fm, issuer: ISS.stanford, employers: [VER.kaiser, VER.valley] },
  { id: 'h-hassan', name: 'Dr. N. Hassan', state: 'CA', specialty: SP.im, issuer: ISS.abms, pecos: true, employers: [VER.mercy], recognitions: [VER.mercy] },
  { id: 'h-lee', name: 'Dr. E. Lee', state: 'CA', specialty: SP.card, issuer: ISS.stanford, employers: [VER.sutter, VER.bay] },
];

for (const h of HOLDERS) {
  addNode(h.id, h.name, 'holder', 'holder');
  // credentials as edges to shared source hubs (every clinician: NPI + exclusion + state license)
  link(h.id, SRC.nppes, 'source');
  link(h.id, SRC.oig, 'source');
  link(h.id, STATE_SRC[h.state], 'source');
  if (h.pecos) link(h.id, SRC.pecos, 'source');
  if (h.dea) link(h.id, SRC.dea, 'source');
  // issuer-signed artifact (board cert / fellowship) + specialty
  link(h.id, h.issuer, 'explicit');
  link(h.id, h.specialty, 'explicit');
  // opportunities: clinician ↔ employer
  for (const v of h.employers) link(h.id, v, 'explicit');
  // recognitions: employer records acceptance back onto the clinician's record
  for (const v of (h.recognitions ?? [])) link(v, h.id, 'recognition');
}

export const CAREER_NODES: CareerNode[] = nodes;
// Only forward edges are the "real" links; backlinks are derived. Both are in
// the array (the renderer draws backlinks dashed and lists them in the panel).
export const CAREER_EDGES: CareerEdge[] = edges;

export const GROUP_META: Record<GraphGroup, { label: string; hint: string }> = {
  holder: { label: 'Holder · clinician', hint: 'Owns the record; claims and shares snapshots' },
  verifier: { label: 'Verifier · employer', hint: 'Reads shared snapshots and accepts them as a head start' },
  issuer: { label: 'Issuer', hint: 'Signs artifacts once; they travel with the clinician' },
  evidence: { label: 'Sources & specialties', hint: 'Primary sources and specialties every clinician links to' },
};

export const EDGE_META: Record<EdgeKind, { label: string }> = {
  explicit: { label: 'Link' },
  backlink: { label: 'Backlink' },
  source: { label: 'Reads source' },
  recognition: { label: 'Recognition' },
};
