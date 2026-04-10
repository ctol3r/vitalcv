import { test, expect, type Page } from '@playwright/test';

// Format SSE data correctly
function sse(events: { event: string; data: any }[]) {
  return events
    .map((e) => {
      if (!e.data.timestamp) {
        e.data.timestamp = new Date().toISOString();
      }
      return `event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`;
    })
    .join('');
}

async function mockIngestFlow(page: Page, runId: string, events: any[]) {
  await page.route(`**/api/ingest/**`, async (route, request) => {
    if (request.method() === 'POST') {
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({ runId, npi: '1234567890', status: 'started' }),
      });
    } else if (request.method() === 'GET' && request.url().includes('/stream')) {
      await route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
        body: sse(events),
      });
    } else {
      await route.continue();
    }
  });
}

test.describe('NPI Truth Engine Validation', () => {
  test('1. Active NPI (Macie)', async ({ page }) => {
    await mockIngestFlow(page, 'run_macie', [
      { event: 'source_start', data: { type: 'source_start', sourceId: 'nppes' } },
      { event: 'source_complete', data: { type: 'source_complete', sourceId: 'nppes', payload: { status: 'DONE', displayName: 'Macie Miller', identityStatus: 'ACTIVE', sourceResult: 'SUCCESS', npiType: 'TYPE_1', entityType: 'PERSON' } } },
      { event: 'source_start', data: { type: 'source_start', sourceId: 'oig' } },
      { event: 'source_complete', data: { type: 'source_complete', sourceId: 'oig', payload: { status: 'DONE', exclusionChecked: true, exclusionClear: true, exclusionStatus: 'CLEAR' } } },
      { event: 'source_start', data: { type: 'source_start', sourceId: 'pecos' } },
      { event: 'source_complete', data: { type: 'source_complete', sourceId: 'pecos', payload: { status: 'DONE', enrollmentChecked: true, enrollmentStatus: 'ENROLLED' } } },
      { event: 'claim_update', data: { type: 'claim_update', sourceId: 'nppes', payload: { readinessScore: 95, readinessLevel: 'L3', readinessStatus: 'CLEAR_TO_START', claimCount: 3, blockerCount: 0, credentialCount: 1 } } },
      { event: 'passport_ready', data: { type: 'passport_ready' } },
      { event: 'done', data: { type: 'done' } },
    ]);

    await page.goto('/');
    await page.getByLabel('Enter your 10-digit NPI number').fill('1234567890');
    await page.getByRole('button', { name: /Check Credential Readiness/i }).click();

    // Verify UI state
    await expect(page.getByText('Macie Miller').first()).toBeVisible();
    await expect(page.getByText('Identity Verified (NPPES)').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Download Proof/i })).toBeVisible();

    // Check score is present since it's valid
    await expect(page.getByText('95/100 · L3').first()).toBeVisible();

    // State-integrity guarantee (fix/state-integrity):
    // A fully-checked happy path MUST NOT surface any "Unavailable" copy.
    // "Unavailable" is reserved for hard source failures (timeout/FAILED).
    // Identity + at least one data point must both be visible.
    await expect(page.getByText(/unavailable/i)).toHaveCount(0);
    await expect(page.getByText('Macie Miller').first()).toBeVisible();
    await expect(page.getByText(/95\s*\/\s*100/).first()).toBeVisible();
  });

  test('2. Deactivated NPI', async ({ page }) => {
    await mockIngestFlow(page, 'run_deactivated', [
      { event: 'source_start', data: { type: 'source_start', sourceId: 'nppes' } },
      { event: 'source_complete', data: { type: 'source_complete', sourceId: 'nppes', payload: { status: 'DONE', displayName: 'John Doe', identityStatus: 'DEACTIVATED', sourceResult: 'SUCCESS', npiType: 'TYPE_1', entityType: 'PERSON' } } },
      { event: 'done', data: { type: 'done' } },
    ]);

    await page.goto('/');
    await page.getByLabel('Enter your 10-digit NPI number').fill('1234567890');
    await page.getByRole('button', { name: /Check Credential Readiness/i }).click();

    await expect(page.getByText('DEACTIVATED').first()).toBeVisible();
    // Proof disabled because not enough claims
    await expect(page.getByRole('button', { name: /Download Proof/i })).not.toBeVisible();
    // No score shown early
    await expect(page.getByText('/100')).not.toBeVisible();
  });

  test('3. Org NPI', async ({ page }) => {
    await mockIngestFlow(page, 'run_org', [
      { event: 'source_start', data: { type: 'source_start', sourceId: 'nppes' } },
      { event: 'source_complete', data: { type: 'source_complete', sourceId: 'nppes', payload: { status: 'DONE', displayName: 'General Hospital', identityStatus: 'ACTIVE', sourceResult: 'SUCCESS', npiType: 'TYPE_2', entityType: 'ORGANIZATION' } } },
      { event: 'done', data: { type: 'done' } },
    ]);

    await page.goto('/');
    await page.getByLabel('Enter your 10-digit NPI number').fill('1234567890');
    await page.getByRole('button', { name: /Check Credential Readiness/i }).click();

    await expect(page.getByText('Organization (Type 2)').first()).toBeVisible();
  });

  test('4. Missing data NPI', async ({ page }) => {
    await mockIngestFlow(page, 'run_missing', [
      { event: 'source_start', data: { type: 'source_start', sourceId: 'nppes' } },
      { event: 'source_complete', data: { type: 'source_complete', sourceId: 'nppes', payload: { status: 'DONE', displayName: 'Sarah Smith', identityStatus: 'ACTIVE', sourceResult: 'SUCCESS' } } },
      { event: 'source_start', data: { type: 'source_start', sourceId: 'oig' } },
      { event: 'source_complete', data: { type: 'source_complete', sourceId: 'oig', payload: { status: 'DONE', exclusionChecked: true, exclusionClear: true } } },
      { event: 'source_start', data: { type: 'source_start', sourceId: 'pecos' } },
      { event: 'source_complete', data: { type: 'source_complete', sourceId: 'pecos', payload: { status: 'DONE', enrollmentChecked: true, enrollmentStatus: 'NOT_FOUND' } } },
      { event: 'done', data: { type: 'done' } },
    ]);

    await page.goto('/');
    await page.getByLabel('Enter your 10-digit NPI number').fill('1234567890');
    await page.getByRole('button', { name: /Check Credential Readiness/i }).click();

    await expect(page.getByText('Review required', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('CMS PECOS returned NOT_FOUND', { exact: false }).first()).toBeVisible();
    // Verify pending !== blocked
    await expect(page.getByText('Blocked')).not.toBeVisible();
  });

  test('5. Simulated OIG exclusion', async ({ page }) => {
    await mockIngestFlow(page, 'run_excluded', [
      { event: 'source_start', data: { type: 'source_start', sourceId: 'nppes' } },
      { event: 'source_complete', data: { type: 'source_complete', sourceId: 'nppes', payload: { status: 'DONE', displayName: 'Bad Actor', identityStatus: 'ACTIVE', sourceResult: 'SUCCESS' } } },
      { event: 'source_start', data: { type: 'source_start', sourceId: 'oig' } },
      { event: 'source_complete', data: { type: 'source_complete', sourceId: 'oig', payload: { status: 'DONE', exclusionChecked: true, exclusionClear: false, exclusionStatus: 'EXCLUDED' } } },
      { event: 'done', data: { type: 'done' } },
    ]);

    await page.goto('/');
    await page.getByLabel('Enter your 10-digit NPI number').fill('1234567890');
    await page.getByRole('button', { name: /Check Credential Readiness/i }).click();

    await expect(page.getByText('The current OIG / LEIE result needs attention: EXCLUDED', { exact: false }).first()).toBeVisible();
  });

  test('6. Timeout simulation (unavailable != pending)', async ({ page }) => {
    await mockIngestFlow(page, 'run_timeout', [
      { event: 'source_start', data: { type: 'source_start', sourceId: 'nppes' } },
      { event: 'source_complete', data: { type: 'source_complete', sourceId: 'nppes', payload: { status: 'ERROR', sourceResult: 'FAILED', error: 'Timeout' } } },
      { event: 'error', data: { type: 'error' } },
    ]);

    await page.goto('/');
    await page.getByLabel('Enter your 10-digit NPI number').fill('1234567890');
    await page.getByRole('button', { name: /Check Credential Readiness/i }).click();

    await expect(page.getByText(/unavailable/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Download Proof/i })).not.toBeVisible();
  });
});
