// ── Manifest Engine Tests ────────────────────────────────────────

import { buildManifest } from './manifest-engine';
import { SourceStatus, ReadinessPosture, ProofAvailability } from '../../trust-contract/src/index';
import type { CoverageLane, SourceReceipt } from './manifest-engine';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) { passed++; console.log(`✓ ${msg}`); }
  else { failed++; console.error(`✗ ${msg}`); }
}

const nppesLane: CoverageLane = {
  source: 'NPPES',
  laneType: 'identity',
  status: SourceStatus.CHECKED,
  checkedAt: '2026-04-14T18:00:00Z',
  observedAt: '2026-04-14T00:00:00Z',
  ttl: 7 * 24 * 60 * 60 * 1000,
  errorClass: null,
};

const oigLane: CoverageLane = {
  source: 'OIG_LEIE',
  laneType: 'exclusion',
  status: SourceStatus.CHECKED,
  checkedAt: '2026-04-14T18:00:05Z',
  observedAt: '2026-04-14T00:00:00Z',
  ttl: 24 * 60 * 60 * 1000,
  errorClass: null,
};

const nppesReceipt: SourceReceipt = {
  receiptId: 'r-1',
  source: 'NPPES',
  version: '1',
  payload: { npi: '123' },
  rawHash: 'hash',
};

const oigReceipt: SourceReceipt = {
  receiptId: 'r-2',
  source: 'OIG_LEIE',
  version: '1',
  payload: { count: 0 },
  rawHash: 'hash',
};

// ── 1. Valid Decision Grade Manifest ─────────────────────────────

const manifest = buildManifest({
  subjectNpi: '1487664858',
  coverageLanes: [nppesLane, oigLane],
  claims: [
    {
      claimId: 'c-1',
      claimType: 'identity.name',
      value: 'MILLER, MACIE',
      source: 'NPPES',
      observedAt: null,
      confidence: 'exact',
      matchBasis: 'test',
      limitations: [],
      sourceCheckId: 'NPPES:1',
    }
  ],
  receipts: [nppesReceipt, oigReceipt],
  limitations: [],
});

assert(manifest.manifestId.length === 36, 'Manifest has UUID');
assert(manifest.subject.npi === '1487664858', 'Subject NPI correct');
assert(manifest.subject.credentialedName === 'MILLER, MACIE', 'Subject name hydrated from claim');
assert(manifest.readinessPosture === ReadinessPosture.DECISION_GRADE, 'Posture is DECISION_GRADE');
assert(manifest.proofAvailability === ProofAvailability.DECISION_GRADE, 'Proof is DECISION_GRADE');
assert(manifest.limitations.length === 0, 'No limitations');

// ── 2. Partial Manifest (Missing OIG) ────────────────────────────

const partial = buildManifest({
  subjectNpi: '1487664858',
  coverageLanes: [nppesLane, { ...oigLane, status: SourceStatus.UNAVAILABLE, errorClass: 'TIMEOUT' }],
  claims: [],
  receipts: [nppesReceipt], // Only NPPES receipt
  limitations: [],
});

assert(partial.readinessPosture === ReadinessPosture.PARTIAL, 'Posture is PARTIAL');
assert(partial.proofAvailability === ProofAvailability.PARTIAL, 'Proof is PARTIAL (1 receipt, but not all DG sources)');
assert(partial.limitations.some(l => l.code === 'SOURCE_UNAVAILABLE'), 'Auto-injects SOURCE_UNAVAILABLE limitation');

// ── 3. Zero Receipts ─────────────────────────────────────────────

const noProof = buildManifest({
  subjectNpi: '1487664858',
  coverageLanes: [{ ...nppesLane, status: SourceStatus.UNAVAILABLE }],
  claims: [],
  receipts: [],
  limitations: [],
});

assert(noProof.proofAvailability === ProofAvailability.NONE, 'Proof is NONE with 0 receipts');

// ── 4. Contract Violation Throws ─────────────────────────────────

try {
  buildManifest({
    subjectNpi: '123',
    coverageLanes: [nppesLane],
    claims: [],
    receipts: [], // Missing NPPES receipt while status is CHECKED
    limitations: [],
  });
  console.error('✗ Should have thrown for missing receipt');
  failed++;
} catch (e: any) {
  assert(e.message.includes('Missing receipt'), 'Throws when CHECKED source lacks receipt');
}

try {
  buildManifest({
    subjectNpi: '123',
    coverageLanes: [nppesLane],
    claims: [{ claimId: '1', claimType: 'identity.name', value: 'x', source: 'BOGUS', observedAt: null, confidence: 'exact', matchBasis: '', limitations: [], sourceCheckId: '1' }],
    receipts: [nppesReceipt],
    limitations: [],
  });
  console.error('✗ Should have thrown for invalid claim source');
  failed++;
} catch (e: any) {
  assert(e.message.includes('references unknown source'), 'Throws when claim references unknown source');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) throw new Error('Manifest tests failed');
