/**
 * conformanceRunner.ts — VitalCV Trust Protocol Conformance Test Runner
 *
 * Runs CONFORMANCE_TESTS against any target URL and produces a report.
 * A passing implementation must score >= 80% on REQUIRED tests.
 *
 * Usage:
 *   POST /api/protocol/conformance/run { targetUrl: "https://my-implementation.com" }
 */

import {
  CONFORMANCE_TESTS,
  updateConformanceResult,
  type ConformanceTest,
} from './protocolSpec';
import { log } from '../../obs/logger';

// ── Types ─────────────────────────────────────────────────────────────────────

export type TestStatus = 'PASS' | 'FAIL' | 'SKIP' | 'ERROR';

export interface TestResult {
  testId: string;
  name: string;
  level: ConformanceTest['level'];
  group: ConformanceTest['group'];
  status: TestStatus;
  statusCode: number | null;
  latencyMs: number;
  failReason: string | null;
  responseFields: string[];
  missingFields: string[];
}

export interface ConformanceReport {
  targetUrl: string;
  implementerId: string | null;
  ranAt: string;
  durationMs: number;
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  score: number;           // % of REQUIRED tests passed
  verdict: 'CONFORMANT' | 'NON_CONFORMANT' | 'PARTIAL';
  results: TestResult[];
  byGroup: Record<string, { passed: number; total: number }>;
  requiredPassed: number;
  requiredTotal: number;
  badge: string;
}

// ── Runner ────────────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 8000;

async function runSingleTest(
  baseUrl: string,
  test: ConformanceTest,
): Promise<TestResult> {
  const start = Date.now();
  const url   = `${baseUrl.replace(/\/$/, '')}${test.path}`;

  try {
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const resp = await fetch(url, {
      method:  test.method,
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body:    test.body ? JSON.stringify(test.body) : undefined,
      signal:  controller.signal,
    }).finally(() => clearTimeout(timer));

    const latencyMs  = Date.now() - start;
    const statusCode = resp.status;

    // Status code check
    if (!test.requiredStatusCodes.includes(statusCode)) {
      return {
        testId: test.id, name: test.name, level: test.level, group: test.group,
        status: 'FAIL', statusCode, latencyMs,
        failReason: `Expected status ${test.requiredStatusCodes.join('|')}, got ${statusCode}`,
        responseFields: [], missingFields: test.requiredResponseFields,
      };
    }

    // Field check on JSON responses
    if (test.requiredResponseFields.length === 0) {
      return { testId: test.id, name: test.name, level: test.level, group: test.group, status: 'PASS', statusCode, latencyMs, failReason: null, responseFields: [], missingFields: [] };
    }

    let body: unknown;
    try {
      body = await resp.json();
    } catch {
      return { testId: test.id, name: test.name, level: test.level, group: test.group, status: 'FAIL', statusCode, latencyMs, failReason: 'Response is not valid JSON', responseFields: [], missingFields: test.requiredResponseFields };
    }

    const responseFields = typeof body === 'object' && body !== null ? Object.keys(body as object) : [];
    const missingFields  = test.requiredResponseFields.filter(f => !(f in (body as object)));

    if (missingFields.length > 0) {
      return { testId: test.id, name: test.name, level: test.level, group: test.group, status: 'FAIL', statusCode, latencyMs, failReason: `Missing required fields: ${missingFields.join(', ')}`, responseFields, missingFields };
    }

    return { testId: test.id, name: test.name, level: test.level, group: test.group, status: 'PASS', statusCode, latencyMs, failReason: null, responseFields, missingFields: [] };

  } catch (err) {
    const latencyMs = Date.now() - start;
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    return {
      testId: test.id, name: test.name, level: test.level, group: test.group,
      status: 'ERROR', statusCode: null, latencyMs,
      failReason: isTimeout ? `Timeout after ${FETCH_TIMEOUT_MS}ms` : String(err),
      responseFields: [], missingFields: test.requiredResponseFields,
    };
  }
}

export async function runConformanceTests(
  targetUrl: string,
  options: {
    implementerId?: string;
    groups?: string[];
    levels?: ConformanceTest['level'][];
    parallel?: boolean;
  } = {},
): Promise<ConformanceReport> {
  const start = Date.now();
  const ranAt = new Date().toISOString();

  let tests = CONFORMANCE_TESTS;
  if (options.groups?.length)  tests = tests.filter(t => options.groups!.includes(t.group));
  if (options.levels?.length)  tests = tests.filter(t => options.levels!.includes(t.level));

  log('info', 'conformanceRunner: starting', {
    targetUrl, testCount: tests.length, implementerId: options.implementerId,
  });

  // Run tests (sequentially to avoid hammering the target)
  const results: TestResult[] = [];
  if (options.parallel) {
    const settled = await Promise.allSettled(tests.map(t => runSingleTest(targetUrl, t)));
    for (const r of settled) {
      results.push(r.status === 'fulfilled' ? r.value : {
        testId: 'unknown', name: 'unknown', level: 'OPTIONAL', group: 'IDENTITY',
        status: 'ERROR', statusCode: null, latencyMs: 0,
        failReason: String((r as PromiseRejectedResult).reason),
        responseFields: [], missingFields: [],
      });
    }
  } else {
    for (const test of tests) {
      results.push(await runSingleTest(targetUrl, test));
    }
  }

  const passed  = results.filter(r => r.status === 'PASS').length;
  const failed  = results.filter(r => r.status === 'FAIL' || r.status === 'ERROR').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;

  const requiredResults = results.filter(r => r.level === 'REQUIRED');
  const requiredPassed  = requiredResults.filter(r => r.status === 'PASS').length;
  const requiredTotal   = requiredResults.length;

  const score   = requiredTotal > 0 ? Math.round((requiredPassed / requiredTotal) * 100) : 0;
  const verdict: ConformanceReport['verdict'] = score >= 100 ? 'CONFORMANT' : score >= 60 ? 'PARTIAL' : 'NON_CONFORMANT';

  // Group summary
  const byGroup: Record<string, { passed: number; total: number }> = {};
  for (const r of results) {
    if (!byGroup[r.group]) byGroup[r.group] = { passed: 0, total: 0 };
    byGroup[r.group]!.total++;
    if (r.status === 'PASS') byGroup[r.group]!.passed++;
  }

  if (options.implementerId) {
    updateConformanceResult(options.implementerId, score, requiredPassed, requiredTotal);
  }

  log('info', 'conformanceRunner: complete', {
    targetUrl, score, verdict, requiredPassed, requiredTotal,
  });

  return {
    targetUrl,
    implementerId: options.implementerId ?? null,
    ranAt,
    durationMs:     Date.now() - start,
    total:          results.length,
    passed, failed, skipped,
    score,
    verdict,
    results,
    byGroup,
    requiredPassed,
    requiredTotal,
    badge: verdict === 'CONFORMANT'
      ? 'https://vitalcv.com/badges/protocol-conformant.svg'
      : 'https://vitalcv.com/badges/protocol-implementer.svg',
  };
}
