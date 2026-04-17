// ── Claim Engine Tests ───────────────────────────────────────────

import type { SourceCheckResult } from './types';
import { SourceStatus } from '../../trust-contract/src/index';
import { extractClaims, hashClaims, type Claim, type ClaimBatch } from './claim-engine';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) { passed++; console.log(`✓ ${msg}`); }
  else { failed++; console.error(`✗ ${msg}`); }
}

// ── 1. NPPES produces identity claims ────────────────────────────

const nppesResult: SourceCheckResult = {
  sourceId: 'NPPES',
  laneType: 'identity',
  status: SourceStatus.CHECKED,
  claims: [
    { key: 'npi', value: '1487664858', present: true },
    { key: 'credentialed_name', value: 'MILLER, MACIE', present: true },
    { key: 'active_status', value: true, present: true },
    { key: 'entity_type', value: 'Individual', present: true },
    { key: 'taxonomy', value: [{ code: '363A00000X', desc: 'Physician Assistant', primary: true }], present: true },
    { key: 'address', value: [{ city: 'LOS ANGELES', state: 'CA' }], present: true },
    { key: 'identifiers', value: [], present: true },
    { key: 'enumeration_date', value: '2011-07-22', present: true },
  ],
  limitations: [],
  matchBasis: { mode: 'npi_exact', confidence: 'exact', explanation: 'NPI matched exactly' },
  observedAt: '2026-04-14T00:00:00Z',
  checkedAt: '2026-04-14T18:00:00Z',
  rawHash: 'abc123',
  parserVersion: 'nppes-v2',
  errorClass: null,
};

const oigResult: SourceCheckResult = {
  sourceId: 'OIG_LEIE',
  laneType: 'exclusion',
  status: SourceStatus.CHECKED,
  claims: [
    { key: 'oig_exclusion_check', value: 'performed', present: true },
    { key: 'exclusion_count', value: 0, present: true },
    { key: 'has_active_exclusion', value: false, present: true },
    { key: 'exclusions', value: [], present: false },
  ],
  limitations: [],
  matchBasis: { mode: 'npi_exact', confidence: 'exact', explanation: '0 exclusion records' },
  observedAt: '2026-04-14T00:00:00Z',
  checkedAt: '2026-04-14T18:00:00Z',
  rawHash: 'def456',
  parserVersion: 'oig-leie-v1',
  errorClass: null,
};

const batch = extractClaims([nppesResult, oigResult], '1487664858');

// ── 2. Batch structure ──────────────────────────────────────────

assert(batch.subjectNpi === '1487664858', 'Batch has correct subjectNpi');
assert(batch.claims.length > 0, 'Batch has claims');
assert(!isNaN(Date.parse(batch.generatedAt)), 'Batch has valid generatedAt timestamp');
assert(batch.auditEvent !== null, 'Batch has audit event');

// ── 3. Claim atomicity ──────────────────────────────────────────

for (const claim of batch.claims) {
  assert(typeof claim.claimId === 'string' && claim.claimId.length === 36, `Claim ${claim.claimType} has UUID`);
  assert(typeof claim.claimType === 'string', `Claim has valid claimType`);
  assert(claim.source === 'NPPES' || claim.source === 'OIG_LEIE', `Claim ${claim.claimType} has valid source`);
  assert(typeof claim.matchBasis === 'string', `Claim ${claim.claimType} has matchBasis`);
  assert(Array.isArray(claim.limitations), `Claim ${claim.claimType} has limitations array`);
}

// ── 4. Specific NPPES claims extracted ───────────────────────────

const nameClaim = batch.claims.find(c => c.claimType === 'identity.name');
assert(nameClaim !== undefined, 'identity.name claim extracted');
assert(nameClaim!.value === 'MILLER, MACIE', 'identity.name has correct value');
assert(nameClaim!.confidence === 'exact', 'identity.name has exact confidence');
assert(nameClaim!.limitations.length === 0, 'identity.name has no limitations (clean check)');

const statusClaim = batch.claims.find(c => c.claimType === 'identity.npi_status');
assert(statusClaim !== undefined, 'identity.npi_status claim extracted');
assert(statusClaim!.value === true, 'identity.npi_status is true (active)');

const entityClaim = batch.claims.find(c => c.claimType === 'identity.entity_type');
assert(entityClaim !== undefined, 'identity.entity_type claim extracted');
assert(entityClaim!.value === 'Individual', 'identity.entity_type has correct value');

// ── 5. Specific OIG claims extracted ─────────────────────────────

const exclusionClaim = batch.claims.find(c => c.claimType === 'oig.exclusion');
assert(exclusionClaim !== undefined, 'oig.exclusion claim extracted');
assert(exclusionClaim!.value === false, 'oig.exclusion is false (clear)');

const matchClaim = batch.claims.find(c => c.claimType === 'oig.match_confidence');
assert(matchClaim !== undefined, 'oig.match_confidence claim extracted');
assert(matchClaim!.value === 0, 'oig.match_confidence is 0 (no exclusions)');

// ── 6. Missing claims produce limitations ────────────────────────

const emptyNppesResult: SourceCheckResult = {
  sourceId: 'NPPES',
  laneType: 'identity',
  status: SourceStatus.UNAVAILABLE,
  claims: [],
  limitations: [{ code: 'FETCH_FAILED', description: 'Network error', adverse: false }],
  matchBasis: { mode: 'npi_exact', confidence: 'unresolved', explanation: 'NPPES check failed' },
  observedAt: null,
  checkedAt: '2026-04-14T18:00:00Z',
  rawHash: null,
  parserVersion: 'nppes-v2',
  errorClass: 'NETWORK_ERROR',
};

const emptyBatch = extractClaims([emptyNppesResult], '0000000000');
const emptyNameClaim = emptyBatch.claims.find(c => c.claimType === 'identity.name');
assert(emptyNameClaim !== undefined, 'Missing NPPES still produces identity.name claim');
assert(emptyNameClaim!.value === null, 'Missing NPPES claim value is null');
assert(emptyNameClaim!.limitations.some(l => l.code === 'CLAIM_NOT_PRESENT'), 'Missing NPPES has CLAIM_NOT_PRESENT limitation');
assert(emptyNameClaim!.limitations.some(l => l.code === 'MATCH_NOT_EXACT'), 'Unresolved match produces MATCH_NOT_EXACT limitation');
assert(emptyNameClaim!.limitations.some(l => l.code === 'ACCESS_REQUIRED'), 'Error class produces ACCESS_REQUIRED limitation');

// ── 7. Adverse detection ─────────────────────────────────────────

const blockedOigResult: SourceCheckResult = {
  sourceId: 'OIG_LEIE',
  laneType: 'exclusion',
  status: SourceStatus.BLOCKED_SIGNAL,
  claims: [
    { key: 'oig_exclusion_check', value: 'performed', present: true },
    { key: 'exclusion_count', value: 1, present: true },
    { key: 'has_active_exclusion', value: true, present: true },
    { key: 'exclusions', value: [{ npi: '123', type: '1128(a)(1)' }], present: true },
  ],
  limitations: [{ code: 'OIG_EXCLUSION_ACTIVE', description: 'Active exclusion', adverse: true }],
  matchBasis: { mode: 'npi_exact', confidence: 'exact', explanation: 'Exclusion found' },
  observedAt: '2026-04-14T00:00:00Z',
  checkedAt: '2026-04-14T18:00:00Z',
  rawHash: 'ghi789',
  parserVersion: 'oig-leie-v1',
  errorClass: null,
};

const blockedBatch = extractClaims([blockedOigResult], '1234567890');
assert(blockedBatch.hasAdverse === true, 'Blocked OIG produces hasAdverse=true');
assert(blockedBatch.limitations.some(l => l.adverse === true), 'Blocked batch has adverse limitation');

// ── 8. Deterministic hash ────────────────────────────────────────

const hash1 = hashClaims(batch.claims);
const hash2 = hashClaims(batch.claims);
assert(hash1 === hash2, 'Same claims produce same hash');
assert(typeof hash1 === 'string' && hash1.length > 0, 'Hash is non-empty string');

// ── 9. SourceCheckId links claim back to check ───────────────────

for (const claim of batch.claims) {
  assert(claim.sourceCheckId.includes('NPPES') || claim.sourceCheckId.includes('OIG_LEIE'),
    `Claim ${claim.claimType} sourceCheckId references source adapter`);
  assert(claim.sourceCheckId.includes('2026-04-14'),
    `Claim ${claim.claimType} sourceCheckId includes checkedAt date`);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) throw new Error('Claim engine tests failed');
