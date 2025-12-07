/**
 * VitalCV Widget Load Test (k6)
 * Tagged: run: next-batch-20251031-2
 * Agent: CURSOR • AGENT
 *
 * Tests widget initiation under various load scenarios
 *
 * Usage:
 *   k6 run widget-initiation.k6.js
 *   k6 run --vus 500 --duration 5m widget-initiation.k6.js
 *   k6 run --out json=results.json widget-initiation.k6.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

// Custom metrics
const widgetLoadTime = new Trend('widget_load_time');
const widgetInitErrors = new Counter('widget_init_errors');
const widgetSuccessRate = new Rate('widget_success_rate');
const npiLookupTime = new Trend('npi_lookup_time');
const credentialIssueTime = new Trend('credential_issue_time');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const API_URL = __ENV.API_URL || 'http://localhost:4000';

// Test scenarios
export const options = {
  stages: [
    // Ramp up
    { duration: '30s', target: 50 },   // Ramp to 50 users over 30s
    { duration: '1m', target: 100 },   // Ramp to 100 users over 1 min
    { duration: '2m', target: 500 },   // Ramp to 500 users over 2 min

    // Sustain
    { duration: '5m', target: 500 },   // Hold 500 users for 5 min

    // Spike test
    { duration: '30s', target: 1000 }, // Spike to 1000 users
    { duration: '1m', target: 1000 },  // Hold spike for 1 min

    // Ramp down
    { duration: '1m', target: 0 },     // Ramp down to 0
  ],

  thresholds: {
    // HTTP request duration must be < 2000ms for 95% of requests
    'http_req_duration': ['p(95)<2000'],

    // Widget load time must be < 3000ms for 90% of requests
    'widget_load_time': ['p(90)<3000'],

    // NPI lookup must be < 1000ms for 95% of requests
    'npi_lookup_time': ['p(95)<1000'],

    // Success rate must be > 95%
    'widget_success_rate': ['rate>0.95'],

    // Error rate must be < 5%
    'http_req_failed': ['rate<0.05'],
  },

  // Extended timeout for spike scenarios
  httpDebug: 'full',
  noConnectionReuse: false,

  // Tags for filtering
  tags: {
    test_run: 'next-batch-20251031-2',
    component: 'widget',
  },
};

// Sample NPIs for testing
const SAMPLE_NPIS = [
  '1801921148',
  '1538102066',
  '1234567893',
  '1003000126',
  '1992768352',
];

/**
 * Setup function - runs once per VU
 */
export function setup() {
  console.log('🚀 Starting VitalCV Widget Load Test');
  console.log(`   Base URL: ${BASE_URL}`);
  console.log(`   API URL: ${API_URL}`);

  // Health check
  const healthCheck = http.get(`${API_URL}/health`);
  if (healthCheck.status !== 200) {
    console.error('❌ Backend health check failed!');
  } else {
    console.log('✅ Backend health check passed');
  }

  return {
    startTime: new Date().toISOString(),
    baseUrl: BASE_URL,
    apiUrl: API_URL,
  };
}

/**
 * Main test scenario
 */
export default function (data) {
  const npi = SAMPLE_NPIS[Math.floor(Math.random() * SAMPLE_NPIS.length)];

  // Scenario 1: Widget Load
  const widgetLoadStart = new Date();
  const widgetResponse = http.get(`${BASE_URL}/widget/vitalcv-apply.js`, {
    tags: { scenario: 'widget_load' },
  });
  const widgetLoadDuration = new Date() - widgetLoadStart;

  widgetLoadTime.add(widgetLoadDuration);

  const widgetLoadSuccess = check(widgetResponse, {
    'widget loads successfully': (r) => r.status === 200,
    'widget JS is valid': (r) => r.body.includes('VitalCV'),
  });

  widgetSuccessRate.add(widgetLoadSuccess);
  if (!widgetLoadSuccess) widgetInitErrors.add(1);

  sleep(0.5);

  // Scenario 2: NPI Lookup
  const npiLookupStart = new Date();
  const npiResponse = http.get(`${API_URL}/api/npi/lookup?npi=${npi}`, {
    tags: { scenario: 'npi_lookup' },
  });
  const npiLookupDuration = new Date() - npiLookupStart;

  npiLookupTime.add(npiLookupDuration);

  check(npiResponse, {
    'NPI lookup succeeds': (r) => r.status === 200,
    'NPI data returned': (r) => r.json('success') === true,
  });

  sleep(1);

  // Scenario 3: Email Verification (Level 1)
  const emailPayload = JSON.stringify({
    npi: npi,
    email: `test-${__VU}-${__ITER}@loadtest.com`,
  });

  const emailResponse = http.post(`${API_URL}/api/claim/basic`, emailPayload, {
    headers: { 'Content-Type': 'application/json' },
    tags: { scenario: 'email_verification' },
  });

  check(emailResponse, {
    'Email verification initiated': (r) => r.status === 200,
    'OTP generated': (r) => r.json('success') === true,
  });

  sleep(0.5);

  // Scenario 4: OTP Verification
  const otpPayload = JSON.stringify({
    npi: npi,
    pin: '123456', // Mock OTP
    otpId: emailResponse.json('otpId'),
  });

  const otpResponse = http.post(`${API_URL}/api/claim/verify-pin`, otpPayload, {
    headers: { 'Content-Type': 'application/json' },
    tags: { scenario: 'otp_verification' },
  });

  check(otpResponse, {
    'OTP verification succeeds': (r) => r.status === 200,
    'Claim created': (r) => r.json('success') === true,
  });

  sleep(2);

  // Scenario 5: Credential Issuance (simulated)
  const issueStart = new Date();
  const issuePayload = JSON.stringify({
    npi: npi,
    holderDid: `did:vitalcv:loadtest-${__VU}`,
  });

  const issueResponse = http.post(`${API_URL}/api/issuer/attest-request`, issuePayload, {
    headers: { 'Content-Type': 'application/json' },
    tags: { scenario: 'credential_issue' },
  });
  const issueDuration = new Date() - issueStart;

  credentialIssueTime.add(issueDuration);

  check(issueResponse, {
    'Credential issuance initiated': (r) => r.status === 200 || r.status === 201,
  });

  // Think time before next iteration
  sleep(Math.random() * 3 + 1); // 1-4 seconds
}

/**
 * Teardown function - runs once at end
 */
export function teardown(data) {
  console.log('🏁 Load test complete');
  console.log(`   Started: ${data.startTime}`);
  console.log(`   Ended: ${new Date().toISOString()}`);
}

/**
 * Custom summary with HTML report
 */
export function handleSummary(data) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  return {
    // Text summary to stdout
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),

    // JSON results for further processing
    [`results/widget-load-test-${timestamp}.json`]: JSON.stringify(data),

    // HTML report
    [`results/widget-load-test-${timestamp}.html`]: htmlReport(data),

    // CSV summary for dashboards
    [`results/widget-load-test-${timestamp}.csv`]: generateCSVSummary(data),
  };
}

/**
 * Generate CSV summary for dashboard import
 */
function generateCSVSummary(data) {
  const metrics = data.metrics;

  const rows = [
    ['Metric', 'Min', 'Max', 'Avg', 'P90', 'P95', 'P99'].join(','),
    [
      'HTTP Request Duration (ms)',
      metrics.http_req_duration.values.min,
      metrics.http_req_duration.values.max,
      metrics.http_req_duration.values.avg,
      metrics.http_req_duration.values['p(90)'],
      metrics.http_req_duration.values['p(95)'],
      metrics.http_req_duration.values['p(99)'],
    ].join(','),
    [
      'Widget Load Time (ms)',
      metrics.widget_load_time.values.min,
      metrics.widget_load_time.values.max,
      metrics.widget_load_time.values.avg,
      metrics.widget_load_time.values['p(90)'],
      metrics.widget_load_time.values['p(95)'],
      metrics.widget_load_time.values['p(99)'],
    ].join(','),
    [
      'NPI Lookup Time (ms)',
      metrics.npi_lookup_time.values.min,
      metrics.npi_lookup_time.values.max,
      metrics.npi_lookup_time.values.avg,
      metrics.npi_lookup_time.values['p(90)'],
      metrics.npi_lookup_time.values['p(95)'],
      metrics.npi_lookup_time.values['p(99)'],
    ].join(','),
    [
      'Credential Issue Time (ms)',
      metrics.credential_issue_time.values.min,
      metrics.credential_issue_time.values.max,
      metrics.credential_issue_time.values.avg,
      metrics.credential_issue_time.values['p(90)'],
      metrics.credential_issue_time.values['p(95)'],
      metrics.credential_issue_time.values['p(99)'],
    ].join(','),
  ];

  rows.push('');
  rows.push(['Total Requests', data.metrics.http_reqs.values.count].join(','));
  rows.push(['Failed Requests', data.metrics.http_req_failed.values.passes].join(','));
  rows.push(['Success Rate', data.metrics.widget_success_rate.values.rate * 100 + '%'].join(','));
  rows.push(['VUs Max', data.metrics.vus_max.values.max].join(','));

  return rows.join('\n');
}

