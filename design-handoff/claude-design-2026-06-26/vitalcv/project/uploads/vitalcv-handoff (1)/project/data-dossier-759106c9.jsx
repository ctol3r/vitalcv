// WAVE 17 · Cryptographic Proof Dossier data

const DOSSIER_META = {
  subject: 'Macie Miller, PA-C',
  npi: '1346053246',
  fileId: 'VCV-CF-2026-000841',
  generatedAt: '2026-04-18 14:32:51 UTC',
  generatedBy: 'auditor.cedar@cedarhealth.org',
  rootHash: '0x8a41f0b9e2f67d4c1a3e9b0a2c7d2e5f3910ab77c06de91f',
  signingKey: 'did:web:vitalcv.health#cvo-2026-q1',
  algorithm: 'EdDSA · Ed25519',
  receiptCount: 47,
  checkpointCount: 11,
};
window.DOSSIER_META = DOSSIER_META;

// Forensic ledger — one row per primary-source check
const CUSTODY_LEDGER = [
  { id: 'r-001', ts: '2026-04-18 14:31:08.214 UTC', actor: 'vc:engine:cvo-2', kind: 'NPI · NPPES',          source: 'https://npiregistry.cms.hhs.gov/api/?version=2.1&number=1346053246', method: 'GET', status: 200, latencyMs: 124, hash: '0x3f9d71cb2e40a6f18c4b01d33b12a',  prev: '0x000000000000000000000000000000', verb: 'verified' },
  { id: 'r-002', ts: '2026-04-18 14:31:09.402 UTC', actor: 'vc:engine:cvo-2', kind: 'OIG · LEIE',           source: 'https://oig.hhs.gov/exclusions/exclusions_list.asp · LEIE-2026-04', method: 'DATASET', status: 200, latencyMs: 88,  hash: '0xa12fe9d44b1c0772ee45b318a2e10', prev: '0x3f9d71cb2e40a6f18c4b01d33b12a', verb: 'no-match' },
  { id: 'r-003', ts: '2026-04-18 14:31:10.018 UTC', actor: 'vc:engine:cvo-2', kind: 'SAM · Exclusions',     source: 'https://api.sam.gov/entity/exclusions/v4',                          method: 'GET', status: 200, latencyMs: 312, hash: '0x71b4ae0c8b2d35e9b86c1f1e44002', prev: '0xa12fe9d44b1c0772ee45b318a2e10', verb: 'no-match' },
  { id: 'r-004', ts: '2026-04-18 14:31:11.443 UTC', actor: 'vc:engine:cvo-2', kind: 'CA Board · License',    source: 'https://search.dca.ca.gov/details/8003/PA/58129',                  method: 'GET', status: 200, latencyMs: 902, hash: '0xc0fe21a7b9384e10c4a1b0998fd60', prev: '0x71b4ae0c8b2d35e9b86c1f1e44002', verb: 'verified' },
  { id: 'r-005', ts: '2026-04-18 14:31:12.118 UTC', actor: 'vc:engine:cvo-2', kind: 'DEA · Registration',    source: 'DEA Active Registration File · 2026-04-15 cut',                    method: 'DATASET', status: 200, latencyMs: 64,  hash: '0x4d2e10ab59c87632fe14a23bb12cd', prev: '0xc0fe21a7b9384e10c4a1b0998fd60', verb: 'verified' },
  { id: 'r-006', ts: '2026-04-18 14:31:13.005 UTC', actor: 'vc:engine:cvo-2', kind: 'NPDB · Continuous',     source: 'https://www.npdb.hrsa.gov/api/cq/v2',                              method: 'POST', status: 200, latencyMs: 1421, hash: '0x9be027c8a1d2f3e455718a02bb904', prev: '0x4d2e10ab59c87632fe14a23bb12cd', verb: 'no-actions' },
  { id: 'r-007', ts: '2026-04-18 14:31:15.880 UTC', actor: 'vc:engine:cvo-2', kind: 'AAMC · GME',            source: 'https://services.aamc.org/eras/gme/verify',                        method: 'POST', status: 200, latencyMs: 612, hash: '0xe18f44a02bb73c1d59006fce771a8', prev: '0x9be027c8a1d2f3e455718a02bb904', verb: 'verified' },
  { id: 'r-008', ts: '2026-04-18 14:31:17.221 UTC', actor: 'vc:engine:cvo-2', kind: 'NCCPA · Cert',          source: 'https://www.nccpa.net/verify-pa',                                  method: 'GET', status: 200, latencyMs: 488, hash: '0x55ab04920ec33b1f7d0a91bbf44e2', prev: '0xe18f44a02bb73c1d59006fce771a8', verb: 'verified' },
  { id: 'r-009', ts: '2026-04-18 14:31:19.033 UTC', actor: 'human:vivian.chen@cedarhealth.org', kind: 'Reviewer · attestation', source: 'console.vitalcv.health/files/VCV-CF-2026-000841', method: 'PATCH', status: 200, latencyMs: 22, hash: '0x10ab39bf6c7d8e290011aa55cf0287', prev: '0x55ab04920ec33b1f7d0a91bbf44e2', verb: 'attested' },
  { id: 'r-010', ts: '2026-04-22 16:00:00.000 UTC', actor: 'committee:cedar.cred-cmte', kind: 'Committee · vote',          source: 'CED Bylaws §IV · agenda CCMTG-2026-0488',                           method: 'COMMIT', status: 200, latencyMs: 0,   hash: '0xc742a89ee01f55b32d11ae41bf11a2', prev: '0x10ab39bf6c7d8e290011aa55cf0287', verb: 'committed' },
  { id: 'r-011', ts: '2026-04-23 09:14:02.114 UTC', actor: 'vc:engine:cvo-2', kind: 'Anchor · checkpoint',  source: 'vitalcv-trust-anchor-2026-q2 · vc-merkle-31',                       method: 'ANCHOR', status: 200, latencyMs: 41,  hash: '0x8a41f0b9e2f67d4c1a3e9b0a2c7d2e', prev: '0xc742a89ee01f55b32d11ae41bf11a2', verb: 'anchored' },
];
window.CUSTODY_LEDGER = CUSTODY_LEDGER;

const VERB_META = {
  verified:    { label: 'VERIFIED',    cls: 'text-emerald-700 ring-emerald-600/20 bg-emerald-50' },
  'no-match':  { label: 'NO MATCH',    cls: 'text-emerald-700 ring-emerald-600/20 bg-emerald-50' },
  'no-actions':{ label: 'NO ACTIONS',  cls: 'text-emerald-700 ring-emerald-600/20 bg-emerald-50' },
  attested:    { label: 'ATTESTED',    cls: 'text-indigo-700 ring-indigo-600/20 bg-indigo-50' },
  committed:   { label: 'COMMITTED',   cls: 'text-purple-700 ring-purple-600/20 bg-purple-50' },
  anchored:    { label: 'ANCHORED',    cls: 'text-slate-700 ring-slate-300 bg-slate-100' },
};
window.VERB_META = VERB_META;

// Mapping evidence → standard
const REG_MAPPING = [
  { receiptId: 'r-002', authority: 'NCQA',  std: 'CR-3 · Element A',  topic: 'Sanctions screen within 180 days', satisfied: true,  detail: 'OIG/LEIE checked 0 days ago · cohort window 30d (well within 180d)' },
  { receiptId: 'r-003', authority: 'NCQA',  std: 'CR-3 · Element A',  topic: 'Federal exclusions screen',         satisfied: true,  detail: 'SAM exclusions API · live · current as of intake' },
  { receiptId: 'r-004', authority: 'NCQA',  std: 'CR-3 · Element B',  topic: 'License · primary source',          satisfied: true,  detail: 'CA DCA license search · authoritative source' },
  { receiptId: 'r-005', authority: 'NCQA',  std: 'CR-3 · Element D',  topic: 'DEA · primary source',              satisfied: true,  detail: 'DEA Active Registration File · 3-day-old dataset' },
  { receiptId: 'r-006', authority: 'NCQA',  std: 'CR-7',              topic: 'Ongoing monitoring',                satisfied: true,  detail: 'NPDB continuous query enabled · nightly poll' },
  { receiptId: 'r-007', authority: 'NCQA',  std: 'CR-3 · Element F',  topic: 'Education / training PSV',          satisfied: true,  detail: 'AAMC GME verification · structured response' },
  { receiptId: 'r-008', authority: 'NCQA',  std: 'CR-3 · Element E',  topic: 'Board cert PSV',                    satisfied: true,  detail: 'NCCPA primary source · structured response' },
  { receiptId: 'r-010', authority: 'TJC',   std: 'MS.06.01.05',       topic: 'Privilege grant requires PSV',      satisfied: true,  detail: 'Committee acted on file with all required PSVs · minutes attached' },
  { receiptId: 'r-009', authority: 'TJC',   std: 'MS.08.01.01',       topic: 'FPPE plan documented',              satisfied: true,  detail: 'Reviewer attestation references FPPE Plan v2.4' },
  { receiptId: 'r-011', authority: 'CMS',   std: 'CoP §482.22',        topic: 'Process documented + auditable',    satisfied: true,  detail: 'Anchored Merkle checkpoint · external time-stamped' },
];
window.REG_MAPPING = REG_MAPPING;

// Single receipt drilldown (modal payload)
const RECEIPT_DETAIL = {
  id: 'r-002',
  envelope: {
    type: 'vc2.psv.receipt',
    version: '2.0',
    issued_at: '2026-04-18T14:31:09.402Z',
    issuer: 'did:web:vitalcv.health#cvo-2026-q1',
    subject: { npi: '1346053246', name: 'Macie Miller, PA-C' },
    check: 'oig.leie',
    method: 'DATASET',
    dataset: { name: 'LEIE Monthly', version: '2026-04', published_at: '2026-04-04T00:00:00Z' },
    request: { query: 'NPI=1346053246', match_strategy: 'name+npi+dob' },
    result: { matches: 0, status: 'no-match' },
    evidence_url: 'https://oig.hhs.gov/exclusions/exclusions_list.asp',
    evidence_sha256: 'b7e1c9f2…2c41',
    chain_index: 2,
    prev: '0x3f9d71cb2e40a6f18c4b01d33b12a',
    hash: '0xa12fe9d44b1c0772ee45b318a2e10',
  },
  signature: {
    alg: 'EdDSA',
    kid: 'did:web:vitalcv.health#cvo-2026-q1',
    sig: 'eyJhbGciOiJFZERTQSJ9..tQ8b1nIzjN3gVwHkk7wG2pFqjV4Q9nC5P3xYbR1ufEkLsZx0qmZpKa7sH2RjQZkX-G',
  },
};
window.RECEIPT_DETAIL = RECEIPT_DETAIL;
