type CheckStatus = 'PASS' | 'FAIL';

type CheckRow = {
  check: string;
  status: CheckStatus;
  detail: string;
};

const DEFAULT_PASSPORT_URL = 'https://vitalcv.com/api/passport/npi/1346053246';

const EXPECTED_TOP_LEVEL_KEYS = [
  'entityId',
  'npi',
  'identity',
  'authority',
  'training',
  'standing',
  'readiness',
  'sources',
  'sourceCoverage',
  'trustPosture',
  'lastCheckedAt',
  'checkedAt',
  'lineageKey',
  'replayPosture',
  'continuityPosture',
  'issuerPosture',
  '_degraded',
  'truth',
];

const EXPECTED_POSTURE_KEYS = ['status', 'label', 'detail'];
const EXPECTED_READINESS_KEYS = [
  'status',
  'score',
  'level',
  'blockers',
  'gaps',
  'estimatedStartDays',
  'nextActions',
];
const EXPECTED_SOURCE_SUMMARY_KEYS = [
  'checked',
  'stale',
  'pending',
  'gated',
  'unavailable',
  'accessRequired',
  'reviewRequired',
  'notDecisionGrade',
  'previewOnly',
];
const EXPECTED_TRUTH_KEYS = ['identity', 'safety', 'authority', 'eligibility'];
const POSTURE_STATUSES = new Set(['verified', 'degraded', 'pending', 'unavailable', 'unverifiable']);
const LEAKAGE_PATTERNS = [
  'fetch failed',
  'backend_url',
  'backend unavailable',
  'localhost:4000',
  'typeerror',
  'upstream',
  'proxy',
];

function row(check: string, passed: boolean, detail: string): CheckRow {
  return {
    check,
    status: passed ? 'PASS' : 'FAIL',
    detail,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sameOrder(actual: string[], expected: string[]): boolean {
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
}

function hasRuntimePosture(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (!sameOrder(Object.keys(value), EXPECTED_POSTURE_KEYS)) return false;
  return typeof value.label === 'string'
    && typeof value.detail === 'string'
    && typeof value.status === 'string'
    && POSTURE_STATUSES.has(value.status);
}

function validatePassportContract(body: unknown): CheckRow[] {
  if (!isRecord(body)) {
    return [row('passport json object', false, 'Response body is not a JSON object.')];
  }

  const readiness = isRecord(body.readiness) ? body.readiness : {};
  const sourceCoverage = isRecord(body.sourceCoverage) ? body.sourceCoverage : {};
  const sourceSummary = isRecord(sourceCoverage.summary) ? sourceCoverage.summary : {};
  const trustPosture = isRecord(body.trustPosture) ? body.trustPosture : {};
  const truth = isRecord(body.truth) ? body.truth : {};
  const serialized = JSON.stringify(body).toLowerCase();
  const leakage = LEAKAGE_PATTERNS.filter((pattern) => serialized.includes(pattern));

  return [
    row(
      'stable top-level ordering',
      sameOrder(Object.keys(body), EXPECTED_TOP_LEVEL_KEYS),
      Object.keys(body).join(', '),
    ),
    row(
      'checkedAt stability',
      typeof body.checkedAt === 'string' && !Number.isNaN(Date.parse(body.checkedAt)),
      typeof body.checkedAt === 'string' ? body.checkedAt : 'missing',
    ),
    row(
      'lineageKey stability',
      typeof body.lineageKey === 'string' && body.lineageKey.startsWith('passport:'),
      typeof body.lineageKey === 'string' ? body.lineageKey : 'missing',
    ),
    row('replay posture stability', hasRuntimePosture(body.replayPosture), 'status, label, detail required'),
    row('continuity posture stability', hasRuntimePosture(body.continuityPosture), 'status, label, detail required'),
    row('issuer posture stability', hasRuntimePosture(body.issuerPosture), 'status, label, detail required'),
    row(
      'readiness ordering',
      sameOrder(Object.keys(readiness), EXPECTED_READINESS_KEYS),
      Object.keys(readiness).join(', '),
    ),
    row(
      'source coverage ordering',
      sameOrder(Object.keys(sourceSummary), EXPECTED_SOURCE_SUMMARY_KEYS),
      Object.keys(sourceSummary).join(', '),
    ),
    row(
      'truth ordering',
      sameOrder(Object.keys(truth), EXPECTED_TRUTH_KEYS),
      Object.keys(truth).join(', '),
    ),
    row(
      'degraded semantics',
      typeof body._degraded === 'boolean'
        && typeof trustPosture.band === 'string'
        && Array.isArray(readiness.blockers),
      `_degraded=${String(body._degraded)} trustPosture.band=${String(trustPosture.band)}`,
    ),
    row(
      'leakage scan',
      leakage.length === 0,
      leakage.length === 0 ? 'No localhost/fetch/backend leakage found.' : `Found: ${leakage.join(', ')}`,
    ),
  ];
}

async function main() {
  const url = process.env.PASSPORT_RUNTIME_URL ?? DEFAULT_PASSPORT_URL;
  const matrix: CheckRow[] = [];

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    matrix.push(row(
      'passport route reachable',
      false,
      error instanceof Error ? error.message : String(error),
    ));
    printMatrix(url, matrix);
    process.exit(1);
    return;
  }

  matrix.push(row(
    'passport route reachable',
    response.ok,
    `HTTP ${response.status}`,
  ));

  const contentType = response.headers.get('content-type') ?? '';
  matrix.push(row(
    'json content-type',
    contentType.includes('application/json'),
    contentType || 'missing',
  ));

  let body: unknown = null;
  try {
    body = await response.json();
    matrix.push(row('json parse', true, 'Response parsed as JSON.'));
  } catch (error) {
    matrix.push(row(
      'json parse',
      false,
      error instanceof Error ? error.message : String(error),
    ));
  }

  matrix.push(...validatePassportContract(body));
  printMatrix(url, matrix);

  if (matrix.some((item) => item.status === 'FAIL')) {
    process.exit(1);
  }
}

function printMatrix(url: string, matrix: CheckRow[]) {
  console.log(`Passport runtime smoke: ${url}`);
  console.table(matrix);
  const verdict = matrix.every((item) => item.status === 'PASS') ? 'PASS' : 'FAIL';
  console.log(`Passport runtime verdict: ${verdict}`);
}

void main();
