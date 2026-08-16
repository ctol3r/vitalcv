/**
 * Founder-visual-gate evidence capture for the clinician sign-in
 * re-sequencing wave.
 *
 * Usage:
 *   node docs/design/clinician-signin-resequencing/tools/capture-evidence.mjs <baseUrl> <outDir> [--before]
 *
 * --before captures production's current state (the sign-in wall) — only the
 * static routes. The full "after" set adds the interactive guest states with
 * the identity bootstrap MOCKED to a synthetic fixture: a real NPI would put
 * a real person's registry record into PR evidence, and synthetic NPIs fail
 * the checksum gate by design. Every mocked capture is named *-mocked-*.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(new URL('../../../../apps/web/package.json', import.meta.url));
const { chromium } = require('@playwright/test');

const [baseUrl, outDir] = process.argv.slice(2);
const beforeOnly = process.argv.includes('--before');
if (!baseUrl || !outDir) {
  console.error('usage: capture-evidence.mjs <baseUrl> <outDir> [--before]');
  process.exit(1);
}
mkdirSync(outDir, { recursive: true });

const label = beforeOnly ? 'before' : 'after';
// Checksum-valid (passes the entry gate) but assigned to nobody — NPPES
// result_count 0, verified 2026-08-16 (npi-smoke's canonical ABSENT NPI). The
// committed metrics were captured with 1407202518, which later turned out to
// be a real registrant's NPI. All registry routes are mocked below, so the
// fixture person stays synthetic end to end.
const VALID_TEST_NPI = '1999999992';
const FIXTURE = {
  npi: VALID_TEST_NPI,
  npiType: 'TYPE_1',
  identitySource: 'NPPES_API',
  firstName: 'Ada',
  lastName: 'Rivers',
  specialty: 'Family Medicine',
  state: 'OR',
};

const metrics = { baseUrl, label, capturedAt: new Date().toISOString(), pages: {} };
const browser = await chromium.launch();

async function capture(name, { width, height, path: routePath, reducedMotion, interact, mock, mockSession, fullPage = true, focus = false }) {
  const context = await browser.newContext({
    viewport: { width, height },
    ...(reducedMotion ? { reducedMotion: 'reduce' } : {}),
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const failedRequests = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)); });
  page.on('requestfailed', (r) => { failedRequests.push(`${r.url().slice(0, 200)} — ${r.failure()?.errorText}`); });

  if (mockSession || mock) {
    // Simulate production's anonymous response. The keyless local build 500s
    // on /api/me/workspaces, which renders load_error instead of the entry
    // state — a local-environment artifact, not the product.
    await page.route('**/api/me/workspaces**', (route) => route.fulfill({ status: 401, body: '' }));
  }
  if (mock) {
    await page.route('**/api/identity/bootstrap/**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FIXTURE) }),
    );
    await page.route('**/api/trust-state/**', (route) => route.fulfill({ status: 503, body: '' }));
  }

  await page.goto(baseUrl + routePath, { waitUntil: 'load', timeout: 60_000 });
  await page.waitForTimeout(1500);
  if (interact) await interact(page);
  if (focus) {
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
  }

  const m = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  metrics.pages[name] = {
    ...m,
    horizontalOverflow: m.scrollWidth > m.innerWidth,
    consoleErrors,
    failedRequests,
  };
  await page.screenshot({ path: join(outDir, `${name}.png`), fullPage });
  await context.close();
}

const resolveGuest = async (page) => {
  await page.fill('#guest-npi-input', VALID_TEST_NPI);
  await page.click('button[type="submit"]');
  await page.waitForSelector('[data-guest-record]', { timeout: 15_000 });
  await page.waitForTimeout(400);
};

if (beforeOnly) {
  await capture(`${label}-onboarding-1440x900`, { width: 1440, height: 900, path: '/onboarding', mockSession: true });
  await capture(`${label}-onboarding-390x844`, { width: 390, height: 844, path: '/onboarding', mockSession: true });
  await capture(`${label}-home-review-1440x900`, {
    width: 1440, height: 900, path: '/',
    interact: async (page) => {
      await page.evaluate(() => document.querySelector('#review')?.scrollIntoView());
      await page.waitForTimeout(800);
    },
    fullPage: false,
  });
} else {
  // Entry state (real network — the entry state makes no registry call).
  await capture(`${label}-onboarding-entry-1440x900`, { width: 1440, height: 900, path: '/onboarding', mockSession: true });
  await capture(`${label}-onboarding-entry-390x844`, { width: 390, height: 844, path: '/onboarding', mockSession: true });
  await capture(`${label}-onboarding-entry-768x1024`, { width: 768, height: 1024, path: '/onboarding', mockSession: true });
  await capture(`${label}-onboarding-entry-reduced-motion`, { width: 1440, height: 900, path: '/onboarding', reducedMotion: true, mockSession: true });
  await capture(`${label}-onboarding-entry-200pct-zoom`, { width: 720, height: 450, path: '/onboarding', mockSession: true });
  await capture(`${label}-onboarding-entry-focus`, { width: 1440, height: 900, path: '/onboarding', focus: true, fullPage: false, mockSession: true });
  // Resolved state — synthetic fixture via route mock (see header).
  await capture(`${label}-onboarding-resolved-mocked-1440x900`, {
    width: 1440, height: 900, path: '/onboarding', mock: true, interact: resolveGuest,
  });
  await capture(`${label}-onboarding-resolved-mocked-390x844`, {
    width: 390, height: 844, path: '/onboarding', mock: true, interact: resolveGuest,
  });
  // Homepage review room — the retargeted CTA (ghost state, static).
  await capture(`${label}-home-review-1440x900`, {
    width: 1440, height: 900, path: '/',
    interact: async (page) => {
      await page.evaluate(() => document.querySelector('#review')?.scrollIntoView());
      await page.waitForTimeout(800);
    },
    fullPage: false,
  });
}

await browser.close();
writeFileSync(join(outDir, `metrics-${label}.json`), JSON.stringify(metrics, null, 2));
console.log(JSON.stringify(metrics, null, 2));
