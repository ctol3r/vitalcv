// ── Source Adapter Contract Tests ────────────────────────────────

import { SourceStatus } from './types';
import {
  NppesAdapter,
  OigLeieAdapter,
  PecosOrderingAdapter,
  PecosEnrollmentAdapter,
  CaPaBoardAdapter,
  SOURCE_REGISTRY,
  getDecisionGradeSources,
  getRegistryEntry,
} from './index';
import type { SourceCheckResult, SourceAdapter } from './types';

// ── Interface Contract Validation ────────────────────────────────

const adapters: SourceAdapter[] = [
  new NppesAdapter(),
  new OigLeieAdapter(),
  new PecosOrderingAdapter(),
  new PecosEnrollmentAdapter(),
  new CaPaBoardAdapter(),
];

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) { passed++; console.log(`✓ ${msg}`); }
  else { failed++; console.error(`✗ ${msg}`); }
}

// ── 1. All adapters implement the full interface ─────────────────

for (const adapter of adapters) {
  assert(typeof adapter.sourceId === 'string', `${adapter.sourceId}: sourceId is string`);
  assert(typeof adapter.laneType === 'string', `${adapter.sourceId}: laneType is string`);
  assert(typeof adapter.cadence === 'number' && adapter.cadence > 0, `${adapter.sourceId}: cadence > 0`);
  assert(typeof adapter.freshnessTtl === 'number' && adapter.freshnessTtl > 0, `${adapter.sourceId}: freshnessTtl > 0`);
  assert(typeof adapter.authMode === 'string', `${adapter.sourceId}: authMode is string`);
  assert(typeof adapter.matchMode === 'string', `${adapter.sourceId}: matchMode is string`);
  assert(typeof adapter.parserVersion === 'string', `${adapter.sourceId}: parserVersion is string`);
  assert(typeof adapter.fetch === 'function', `${adapter.sourceId}: fetch is function`);
  assert(typeof adapter.normalize === 'function', `${adapter.sourceId}: normalize is function`);
  assert(typeof adapter.classify === 'function', `${adapter.sourceId}: classify is function`);
  assert(typeof adapter.buildClaims === 'function', `${adapter.sourceId}: buildClaims is function`);
  assert(typeof adapter.buildLimitations === 'function', `${adapter.sourceId}: buildLimitations is function`);
  assert(typeof adapter.buildReceiptPayload === 'function', `${adapter.sourceId}: buildReceiptPayload is function`);
  assert(typeof adapter.healthcheck === 'function', `${adapter.sourceId}: healthcheck is function`);
}

// ── 2. Source Registry completeness ──────────────────────────────

assert(SOURCE_REGISTRY.length === 5, `Registry has 5 entries (got ${SOURCE_REGISTRY.length})`);

const requiredSources = ['NPPES', 'OIG_LEIE', 'PECOS_ORDERING', 'PECOS_ENROLLMENT', 'CA_PA_BOARD'];
for (const id of requiredSources) {
  assert(getRegistryEntry(id) !== undefined, `Registry contains ${id}`);
}

const dgSources = getDecisionGradeSources();
assert(dgSources.length === 2, `Decision grade requires 2 sources (got ${dgSources.length})`);
assert(dgSources.some(s => s.sourceId === 'NPPES'), 'NPPES is required for decision grade');
assert(dgSources.some(s => s.sourceId === 'OIG_LEIE'), 'OIG_LEIE is required for decision grade');

// ── 3. NPPES normalization ──────────────────────────────────────

const nppes = new NppesAdapter();
const mockNppesRaw = {
  result_count: 1,
  results: [{
    number: '1487664858',
    enumeration_type: 'Individual',
    basic: {
      first_name: 'MACIE',
      last_name: 'MILLER',
      name: 'MILLER, MACIE',
      status: 'A',
      last_updated: '2026-04-14',
      enumeration_date: '2011-07-22',
    },
    taxonomies: [{ code: '363A00000X', desc: 'Physician Assistant', primary: true, state: 'CA' }],
    addresses: [{ address_1: '123 MAIN ST', city: 'LOS ANGELES', state: 'CA', postal_code: '90001', telephone_number: '555-123-4567' }],
    identifiers: [],
  }],
};

const normalized = nppes.normalize(mockNppesRaw);
assert((normalized as any).basic.number === '1487664858', 'NPPES normalizes NPI correctly');
assert((normalized as any).basic.status === 'A', 'NPPES normalizes status correctly');
assert((normalized as any).taxonomy.length === 1, 'NPPES normalizes taxonomy correctly');

const nppesStatus = nppes.classify(normalized);
assert(nppesStatus === SourceStatus.CHECKED, `NPPES classifies active NPI as CHECKED (got ${nppesStatus})`);

const nppesClaims = nppes.buildClaims(normalized);
assert(nppesClaims.length === 11, `NPPES builds 11 claims (got ${nppesClaims.length})`);
assert(nppesClaims[0].key === 'npi', 'First claim is NPI');
assert(nppesClaims[0].present === true, 'NPI claim is present');

const nppesLimitations = nppes.buildLimitations(normalized);
assert(nppesLimitations.length === 0, `Active NPPES has 0 limitations (got ${nppesLimitations.length})`);

// Deactivated NPI should be REVIEW_REQUIRED, not BLOCKED
const deactivated = nppes.classify({ basic: { number: '123', status: 'D' } });
assert(deactivated === SourceStatus.REVIEW_REQUIRED, `Deactivated NPI is REVIEW_REQUIRED (got ${deactivated})`);

// ── 4. OIG classification ────────────────────────────────────────

const oig = new OigLeieAdapter();

// 0 exclusions → CHECKED (never defaults to unavailable)
const oigClear = oig.classify({ exclusions: [], exclusionCount: 0 });
assert(oigClear === SourceStatus.CHECKED, `OIG with 0 exclusions is CHECKED (got ${oigClear})`);

// Active exclusion → BLOCKED_SIGNAL
const oigBlocked = oig.classify({
  exclusions: [{ npi: '123', exclusionType: 'Section 1128(a)(1)', excludedDate: '2020-01-01', reinstatedDate: null }],
  exclusionCount: 1,
});
assert(oigBlocked === SourceStatus.BLOCKED_SIGNAL, `OIG active exclusion is BLOCKED_SIGNAL (got ${oigBlocked})`);

// Reinstated exclusion → REVIEW_REQUIRED
const oigReinstated = oig.classify({
  exclusions: [{ npi: '123', exclusionType: 'Section 1128(a)(1)', excludedDate: '2020-01-01', reinstatedDate: '2025-01-01' }],
  exclusionCount: 1,
});
assert(oigReinstated === SourceStatus.REVIEW_REQUIRED, `OIG reinstated exclusion is REVIEW_REQUIRED (got ${oigReinstated})`);

const oigLimitations = oig.buildLimitations({
  exclusions: [{ npi: '123', exclusionType: '1128(a)(1)', excludedDate: '2020-01-01', reinstatedDate: null, exclusionReason: 'Patient abuse' }],
  exclusionCount: 1,
});
assert(oigLimitations.length === 1, `OIG active exclusion has 1 limitation (got ${oigLimitations.length})`);
assert(oigLimitations[0].adverse === true, `OIG active exclusion limitation is adverse`);

// ── 5. CA PA Board is ACCESS_REQUIRED ────────────────────────────

const caBoard = new CaPaBoardAdapter();
assert(caBoard.authMode === 'manual', 'CA PA Board auth mode is manual');

// CA PA classify — license status mapping
const caActive = caBoard.classify({ found: true, license: { status: 'ACTIVE' } });
assert(caActive === SourceStatus.CHECKED, `CA PA active license is CHECKED (got ${caActive})`);

const caRevoked = caBoard.classify({ found: true, license: { status: 'REVOKED' } });
assert(caRevoked === SourceStatus.BLOCKED_SIGNAL, `CA PA revoked license is BLOCKED_SIGNAL (got ${caRevoked})`);

// ── 6. Output structure validation ───────────────────────────────

const caResult = caBoard.fetch('1487664858');
caResult.then((result: SourceCheckResult) => {
  assert(result.sourceId === 'CA_PA_BOARD', 'CA PA result has correct sourceId');
  assert(result.status === SourceStatus.ACCESS_REQUIRED, 'CA PA result status is ACCESS_REQUIRED');
  assert(result.claims.length >= 0, 'CA PA result has claims array');
  assert(result.limitations.length >= 0, 'CA PA result has limitations array');
  assert(result.matchBasis.confidence === 'unresolved', 'CA PA match is unresolved');
  assert(result.checkedAt !== null, 'CA PA result has checkedAt');
  assert(result.parserVersion === 'ca-pa-board-v1', 'CA PA result has parserVersion');
  assert(result.errorClass === null, 'CA PA errorClass is null (not a fetch failure)');

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) throw new Error("tests failed");
});
