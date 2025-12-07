/**
 * Comprehensive Smoke Test Suite
 * Tests all Batch 37 endpoints for basic functionality
 */

import fetch from 'node-fetch';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

interface TestResult {
  name: string;
  endpoint: string;
  passed: boolean;
  status?: number;
  error?: string;
  responseTime?: number;
}

const results: TestResult[] = [];

async function testEndpoint(
  name: string,
  endpoint: string,
  method: string = 'GET',
  body?: any
): Promise<void> {
  const startTime = Date.now();

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });

    const responseTime = Date.now() - startTime;
    const passed = response.ok;

    results.push({
      name,
      endpoint,
      passed,
      status: response.status,
      responseTime,
    });

    console.log(
      `${passed ? '✓' : '✗'} ${name} (${response.status}) - ${responseTime}ms`
    );
  } catch (error: any) {
    const responseTime = Date.now() - startTime;

    results.push({
      name,
      endpoint,
      passed: false,
      error: error.message,
      responseTime,
    });

    console.log(`✗ ${name} - ERROR: ${error.message}`);
  }
}

async function runSmokeTests() {
  console.log('🔥 Running Batch 37 Smoke Tests...\n');
  console.log(`Target: ${BASE_URL}\n`);

  // Core health
  await testEndpoint('Health Check', '/health');
  await testEndpoint('Asset Hub Canary', '/ops/anchor-canary');
  await testEndpoint('Chain Status', '/status/chain');

  // Compacts
  await testEndpoint('Get All Compacts', '/api/compacts');
  await testEndpoint('Get NLC States', '/api/compacts?compact=nlc');
  await testEndpoint('APRN Compact TX', '/api/aprn/compact/TX');
  await testEndpoint('Check NLC TX', '/api/compacts/nlc/TX');

  // PSYPACT
  await testEndpoint('PSYPACT Smoke', '/api/psych/psypact/smoke');

  // Telehealth
  await testEndpoint(
    'Telehealth AuthZ',
    '/api/telehealth/authz?npi=1234567890&profession=nurse&patient=TX'
  );

  // PECOS
  await testEndpoint('PECOS Calendar ICS', '/api/pecos/calendar.ics');

  // ETL
  await testEndpoint('Get Programs', '/api/etl/programs?limit=10');

  // ALITA-G
  await testEndpoint('ALITA-G Smoke', '/api/alitag/smoke');
  await testEndpoint('Search MCPs', '/api/alitag/mcps?domain=compliance&limit=5');

  // Exam versioning
  await testEndpoint('Exam Cutovers', '/api/exams/cutovers');
  await testEndpoint(
    'NAPLEX Version',
    '/api/exams/version/naplex?date=2025-05-01'
  );

  // Playbooks
  await testEndpoint('List Playbooks', '/api/playbook');
  await testEndpoint('NLC Playbook', '/api/playbook/compliance/nlc');

  // Admin
  await testEndpoint('Exam Stats', '/api/admin/exams/stats');

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SMOKE TEST SUMMARY');
  console.log('='.repeat(60));

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;
  const avgResponseTime =
    results.reduce((sum, r) => sum + (r.responseTime || 0), 0) / total;

  console.log(`Total Tests:      ${total}`);
  console.log(`Passed:           ${passed} ✓`);
  console.log(`Failed:           ${failed} ✗`);
  console.log(`Success Rate:     ${((passed / total) * 100).toFixed(1)}%`);
  console.log(`Avg Response:     ${avgResponseTime.toFixed(0)}ms`);

  if (failed > 0) {
    console.log('\nFailed Tests:');
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  ✗ ${r.name}: ${r.error || `Status ${r.status}`}`);
      });
  }

  console.log('='.repeat(60));

  process.exit(failed > 0 ? 1 : 0);
}

runSmokeTests();

