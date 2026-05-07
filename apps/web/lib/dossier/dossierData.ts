/**
 * Wave E Phase 2 — Cryptographic Proof Dossier data shape + demo fixture.
 *
 * Pure types + a single demoDossier() fixture. No fetch, no DB, no DOM.
 *
 * Truth contract:
 *   - All values returned by demoDossier() are demonstrative. They do
 *     NOT describe a real cryptographic dossier and the hashes /
 *     signatures are obviously stub strings, NOT real EdDSA outputs.
 *   - The page that renders this data always carries a "Demo dossier
 *     — illustrative only" banner; data-is-demo is the literal
 *     `true`. The signing-key id contains "demo" so it cannot be
 *     mistaken for a production DID.
 *   - Verb labels are operational ("Source-confirmed",
 *     "No match", "Attested", "Committed", "Anchored") — never the
 *     bare status label that CLAUDE.md bans for status copy.
 *   - Real upstream credentialing sources are vendor-gated and out
 *     of scope; the demo describes the *shape* of the proof chain,
 *     not active integrations. Source urls are vendor-neutral
 *     placeholders ("source: home-state-board · live ping").
 *   - The chain-of-custody hash chain is a self-consistent demo
 *     (each row's prev = previous row's hash), but the hashes
 *     themselves are constructed strings, not real cryptographic
 *     outputs.
 */

export interface DossierMeta {
  subject: string;
  npi: string;
  fileId: string;
  generatedAt: string;
  generatedBy: string;
  rootHash: string;
  signingKey: string;
  algorithm: string;
  receiptCount: number;
  checkpointCount: number;
  /** Always true in Phase 1 — drives the demo banner. */
  isDemo: true;
}

export type LedgerVerb =
  | 'source_confirmed'
  | 'no_match'
  | 'no_actions'
  | 'attested'
  | 'committed'
  | 'anchored';

export interface CustodyRow {
  id: string;
  ts: string;
  /** Vendor-neutral actor id, e.g. 'demo:engine:cvo-2'. */
  actor: string;
  kind: string;
  source: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DATASET' | 'COMMIT' | 'ANCHOR';
  status: number;
  latencyMs: number;
  hash: string;
  prev: string;
  verb: LedgerVerb;
}

export type RegAuthority = 'NCQA' | 'TJC' | 'CMS';

export interface RegMappingRow {
  receiptId: string;
  authority: RegAuthority;
  std: string;
  topic: string;
  satisfied: boolean;
  detail: string;
}

export interface ReceiptDetailEnvelope {
  type: string;
  version: string;
  issuedAt: string;
  issuer: string;
  subject: { npi: string; name: string };
  check: string;
  method: string;
  request: { query: string; matchStrategy: string };
  result: { matches: number; status: 'no_match' | 'match' };
  evidenceUrl: string;
  evidenceSha256: string;
  chainIndex: number;
  prev: string;
  hash: string;
}

export interface ReceiptDetailSignature {
  alg: string;
  kid: string;
  /** Demo signature blob — clearly stub, NOT a real EdDSA output. */
  sig: string;
}

export interface ReceiptDetail {
  id: string;
  envelope: ReceiptDetailEnvelope;
  signature: ReceiptDetailSignature;
}

export interface DossierState {
  meta: DossierMeta;
  ledger: ReadonlyArray<CustodyRow>;
  regMapping: ReadonlyArray<RegMappingRow>;
  receiptDetail: ReceiptDetail;
}

/* ---------- Verb meta — pure label/tone maps ---------- */

export const VERB_META: Record<
  LedgerVerb,
  { label: string; tone: 'emerald' | 'indigo' | 'purple' | 'slate' }
> = {
  source_confirmed: { label: 'Source-confirmed', tone: 'emerald' },
  no_match:         { label: 'No match',         tone: 'emerald' },
  no_actions:       { label: 'No actions',       tone: 'emerald' },
  attested:         { label: 'Attested',         tone: 'indigo'  },
  committed:        { label: 'Committed',        tone: 'purple'  },
  anchored:         { label: 'Anchored',         tone: 'slate'   },
};

/* ---------- Pure derived helpers ---------- */

export interface DossierCounts {
  total: number;
  byVerb: Record<LedgerVerb, number>;
  satisfiedStandards: number;
  totalStandards: number;
}

export function computeDossierCounts(d: DossierState): DossierCounts {
  const byVerb: Record<LedgerVerb, number> = {
    source_confirmed: 0,
    no_match: 0,
    no_actions: 0,
    attested: 0,
    committed: 0,
    anchored: 0,
  };
  for (const r of d.ledger) byVerb[r.verb]++;
  return {
    total: d.ledger.length,
    byVerb,
    satisfiedStandards: d.regMapping.filter((m) => m.satisfied).length,
    totalStandards: d.regMapping.length,
  };
}

/**
 * Verify the prev/hash chain is self-consistent: every row's `prev`
 * must equal the previous row's `hash`. Returns true when the chain
 * is consistent or empty; false on the first break.
 */
export function isChainConsistent(ledger: ReadonlyArray<CustodyRow>): boolean {
  for (let i = 1; i < ledger.length; i++) {
    if (ledger[i].prev !== ledger[i - 1].hash) return false;
  }
  return true;
}

/* ---------- Demo fixture ---------- */

export function demoDossier(): DossierState {
  // Hashes are deliberately readable demo strings (32 hex chars each)
  // so a test can verify chain consistency. They are not real
  // cryptographic outputs.
  const h0 = '0x' + '0'.repeat(48);
  const h1 = '0x' + '1'.padStart(48, '1');
  const h2 = '0x' + '2'.padStart(48, '2');
  const h3 = '0x' + '3'.padStart(48, '3');
  const h4 = '0x' + '4'.padStart(48, '4');
  const h5 = '0x' + '5'.padStart(48, '5');
  const h6 = '0x' + '6'.padStart(48, '6');
  const h7 = '0x' + '7'.padStart(48, '7');
  const h8 = '0x' + '8'.padStart(48, '8');
  const h9 = '0x' + '9'.padStart(48, '9');
  const hA = '0x' + 'a'.repeat(48);
  const hB = '0x' + 'b'.repeat(48);

  return {
    meta: {
      subject: 'Demo Clinician, PA-C',
      npi: '0000000000',
      fileId: 'VCV-CF-DEMO-000841',
      generatedAt: '2026-04-18T14:32:51Z',
      generatedBy: 'demo-auditor@example.test',
      rootHash: hB,
      signingKey: 'did:web:demo.example#cvo-demo-key',
      algorithm: 'EdDSA · Ed25519 (demo)',
      receiptCount: 11,
      checkpointCount: 1,
      isDemo: true,
    },
    ledger: [
      { id: 'r-001', ts: '2026-04-18T14:31:08.214Z', actor: 'demo:engine:cvo-2',          kind: 'Provider directory · identity',  source: 'demo-provider-directory · live ping',     method: 'GET',     status: 200, latencyMs: 124,  hash: h1, prev: h0, verb: 'source_confirmed' },
      { id: 'r-002', ts: '2026-04-18T14:31:09.402Z', actor: 'demo:engine:cvo-2',          kind: 'Sanctions screen · primary',     source: 'demo-sanctions-monitor · 2026-04 cut',    method: 'DATASET', status: 200, latencyMs: 88,  hash: h2, prev: h1, verb: 'no_match' },
      { id: 'r-003', ts: '2026-04-18T14:31:10.018Z', actor: 'demo:engine:cvo-2',          kind: 'Federal exclusions screen',      source: 'demo-federal-exclusions-api',             method: 'GET',     status: 200, latencyMs: 312, hash: h3, prev: h2, verb: 'no_match' },
      { id: 'r-004', ts: '2026-04-18T14:31:11.443Z', actor: 'demo:engine:cvo-2',          kind: 'License · primary source',       source: 'home-state-board · license search',       method: 'GET',     status: 200, latencyMs: 902, hash: h4, prev: h3, verb: 'source_confirmed' },
      { id: 'r-005', ts: '2026-04-18T14:31:12.118Z', actor: 'demo:engine:cvo-2',          kind: 'Controlled-substance · primary', source: 'federal-controlled-substance · 2026-04',   method: 'DATASET', status: 200, latencyMs: 64,  hash: h5, prev: h4, verb: 'source_confirmed' },
      { id: 'r-006', ts: '2026-04-18T14:31:13.005Z', actor: 'demo:engine:cvo-2',          kind: 'Adverse-event continuous',       source: 'demo-adverse-event-monitor',              method: 'POST',    status: 200, latencyMs: 1421,hash: h6, prev: h5, verb: 'no_actions' },
      { id: 'r-007', ts: '2026-04-18T14:31:15.880Z', actor: 'demo:engine:cvo-2',          kind: 'Education · primary',            source: 'issuing-program · verification',         method: 'POST',    status: 200, latencyMs: 612, hash: h7, prev: h6, verb: 'source_confirmed' },
      { id: 'r-008', ts: '2026-04-18T14:31:17.221Z', actor: 'demo:engine:cvo-2',          kind: 'Board cert · primary',            source: 'issuing-board · verification',           method: 'GET',     status: 200, latencyMs: 488, hash: h8, prev: h7, verb: 'source_confirmed' },
      { id: 'r-009', ts: '2026-04-18T14:31:19.033Z', actor: 'human:demo-reviewer@example.test', kind: 'Reviewer · attestation',  source: 'demo-console · file action',              method: 'PATCH',   status: 200, latencyMs: 22,  hash: h9, prev: h8, verb: 'attested' },
      { id: 'r-010', ts: '2026-04-22T16:00:00.000Z', actor: 'committee:demo.cred-cmte',   kind: 'Committee · vote',               source: 'demo-bylaws §IV · agenda CCMTG-DEMO',     method: 'COMMIT',  status: 200, latencyMs: 0,   hash: hA, prev: h9, verb: 'committed' },
      { id: 'r-011', ts: '2026-04-23T09:14:02.114Z', actor: 'demo:engine:cvo-2',          kind: 'Anchor · checkpoint',             source: 'demo-trust-anchor · merkle-checkpoint',   method: 'ANCHOR',  status: 200, latencyMs: 41,  hash: hB, prev: hA, verb: 'anchored' },
    ],
    regMapping: [
      { receiptId: 'r-002', authority: 'NCQA', std: 'CR-3 · Element A', topic: 'Sanctions screen within 180 days',         satisfied: true, detail: 'Sanctions controls run at intake · cohort window 30d' },
      { receiptId: 'r-003', authority: 'NCQA', std: 'CR-3 · Element A', topic: 'Federal exclusions screen',                satisfied: true, detail: 'Live federal exclusions API · current as of intake' },
      { receiptId: 'r-004', authority: 'NCQA', std: 'CR-3 · Element B', topic: 'License · primary source',                 satisfied: true, detail: 'Home-state board search · authoritative source' },
      { receiptId: 'r-005', authority: 'NCQA', std: 'CR-3 · Element D', topic: 'Controlled-substance · primary source',    satisfied: true, detail: 'Federal controlled-substance dataset · 3-day-old cut' },
      { receiptId: 'r-006', authority: 'NCQA', std: 'CR-7',             topic: 'Ongoing monitoring',                       satisfied: true, detail: 'Adverse-event continuous query enabled · nightly poll' },
      { receiptId: 'r-007', authority: 'NCQA', std: 'CR-3 · Element F', topic: 'Education / training PSV',                  satisfied: true, detail: 'Issuing program verification · structured response' },
      { receiptId: 'r-008', authority: 'NCQA', std: 'CR-3 · Element E', topic: 'Board cert PSV',                            satisfied: true, detail: 'Issuing board primary source · structured response' },
      { receiptId: 'r-010', authority: 'TJC',  std: 'MS.06.01.05',      topic: 'Privilege grant requires PSV',              satisfied: true, detail: 'Committee acted on file with all required PSVs · minutes attached' },
      { receiptId: 'r-009', authority: 'TJC',  std: 'MS.08.01.01',      topic: 'FPPE plan documented',                      satisfied: true, detail: 'Reviewer attestation references FPPE plan' },
      { receiptId: 'r-011', authority: 'CMS',  std: 'CoP §482.22',       topic: 'Process documented + auditable',            satisfied: true, detail: 'Anchored Merkle checkpoint · external time-stamped (demo)' },
    ],
    receiptDetail: {
      id: 'r-002',
      envelope: {
        type: 'vc2.psv.receipt',
        version: '2.0',
        issuedAt: '2026-04-18T14:31:09.402Z',
        issuer: 'did:web:demo.example#cvo-demo-key',
        subject: { npi: '0000000000', name: 'Demo Clinician, PA-C' },
        check: 'sanctions.screen',
        method: 'DATASET',
        request: { query: 'NPI=0000000000', matchStrategy: 'name+npi+dob' },
        result: { matches: 0, status: 'no_match' },
        evidenceUrl: 'demo-sanctions-monitor · 2026-04 cut',
        evidenceSha256: 'demo-evidence-sha256-stub',
        chainIndex: 2,
        prev: '0x' + '1'.padStart(48, '1'),
        hash: '0x' + '2'.padStart(48, '2'),
      },
      signature: {
        alg: 'EdDSA',
        kid: 'did:web:demo.example#cvo-demo-key',
        // Stub signature — NOT a real EdDSA output. The 'demo-signature'
        // prefix and the obvious filler base64 make this clear.
        sig: 'demo-signature.eyJhbGciOiJFZERTQSJ9.AAAAAAAAAA-stub-not-real-signature',
      },
    },
  };
}
