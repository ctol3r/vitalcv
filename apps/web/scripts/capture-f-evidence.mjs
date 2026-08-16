// Amendment F evidence set — the founder's Homepage v4 against the production
// build on :3311. Run from apps/web: node scripts/capture-f-evidence.mjs
//
// fullPage without scrolling is a lie on a page with entrance reveals:
// IntersectionObserver never fires off-screen, so sections would capture at
// opacity 0. Every full-page shot below scrolls the page through first and
// waits past the 4s safety force-complete.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = '../../docs/design/evidence/home-v4-2026-08-16';
mkdirSync(OUT, { recursive: true });
const base = 'http://localhost:3311/';

const consoleLog = [];

const scrollThrough = async (page) => {
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 90));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(700);
};

const watchConsole = (page, label) => {
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      consoleLog.push(`[${label}] ${msg.type()}: ${msg.text().slice(0, 300)}`);
    }
  });
  page.on('pageerror', (err) => consoleLog.push(`[${label}] pageerror: ${String(err).slice(0, 300)}`));
  page.on('requestfailed', (req) =>
    consoleLog.push(`[${label}] requestfailed: ${req.url().slice(0, 200)} — ${req.failure()?.errorText}`),
  );
};

const browser = await chromium.launch();

// ── stills ──────────────────────────────────────────────────────────────────
const shots = [
  { name: 'after-1440x900', w: 1440, h: 900 },
  { name: 'after-390x844', w: 390, h: 844 },
  { name: 'after-768x1024', w: 768, h: 1024 },
  { name: 'after-1728x1117', w: 1728, h: 1117 },
  { name: 'after-375x812', w: 375, h: 812 },
  { name: 'after-360x800', w: 360, h: 800 },
];
for (const s of shots) {
  const page = await browser.newPage({ viewport: { width: s.w, height: s.h } });
  watchConsole(page, s.name);
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2600); // hero one-shots settle
  await scrollThrough(page);
  await page.waitForTimeout(2200); // past the 4s safety, everything complete
  await page.screenshot({ path: `${OUT}/${s.name}.png`, fullPage: true });
  await page.screenshot({ path: `${OUT}/${s.name}-viewport.png`, fullPage: false });
  await page.close();
}

// Reduced motion at 1440 — the finished frame with zero animation.
{
  const rm = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  watchConsole(rm, 'reduced-motion');
  await rm.emulateMedia({ reducedMotion: 'reduce' });
  await rm.goto(base, { waitUntil: 'networkidle' });
  await rm.waitForTimeout(800);
  await rm.screenshot({ path: `${OUT}/after-1440x900-reduced-motion.png`, fullPage: true });
  await rm.close();
}

// 200% zoom equivalent: 720 CSS px layout width.
{
  const zoom = await browser.newPage({ viewport: { width: 720, height: 450 } });
  await zoom.goto(base, { waitUntil: 'networkidle' });
  await zoom.waitForTimeout(2600);
  await scrollThrough(zoom);
  await zoom.waitForTimeout(2200);
  await zoom.screenshot({ path: `${OUT}/after-200pct-zoom-of-1440.png`, fullPage: true });
  await zoom.close();
}

// No-JS frame — the composition must be complete without a script.
{
  const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
  const nojs = await ctx.newPage();
  await nojs.goto(base, { waitUntil: 'load' });
  await nojs.screenshot({ path: `${OUT}/after-1440x900-nojs.png`, fullPage: true });
  await ctx.close();
}

// The resolved recognition moment, against REAL-SHAPED mocked payloads (the
// local server has no backend; the pipeline and transform are the real ones).
async function mockResolve(page) {
  await page.route('**/api/identity/bootstrap/**', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      firstName: 'TEST', lastName: 'CLINICIAN', specialty: 'Internal Medicine',
      state: 'CA', npiType: 'TYPE_1', identitySource: 'NPPES_API',
    }),
  }));
  await page.route('**/api/trust-state/**', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({
      identityVerified: true, exclusionStatus: 'CLEAR', pecosStatus: 'ENROLLED',
      licensureStatus: 'unknown', blockers: [], nextActions: ['Add your preferred locations'],
    }),
  }));
  await page.route('**/api/matcha/opportunities/**', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ matches: [] }),
  }));
}
for (const [name, w, h] of [['after-resolved-1440x900', 1440, 900], ['after-resolved-390x844', 390, 844]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await mockResolve(page);
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const input = page.locator('#ezh-npi');
  await input.click();
  await input.fill('1234567893');
  await page.locator('[data-home-primary-cta]').click();
  await page.locator('[data-npi-reveal]').waitFor({ timeout: 15000 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  await page.close();
}

// ── recordings ──────────────────────────────────────────────────────────────

// Desktop: hero one-shots, the resolve journey, entrance reveals on scroll.
{
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: OUT, size: { width: 1440, height: 900 } },
  });
  const page = await ctx.newPage();
  await mockResolve(page);
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2400); // folio draw + arrivals
  const input = page.locator('#ezh-npi');
  await input.click();
  for (const d of '1234567893') {
    await page.keyboard.type(d);
    await page.waitForTimeout(150);
  }
  await page.locator('[data-home-primary-cta]').click();
  await page.locator('[data-npi-reveal]').waitFor({ timeout: 15000 });
  await page.waitForTimeout(1200);
  for (const sel of ['#flow', '#arc', '.ezh-opportunities', '#packet', '#employers', '#limits', '.ezh-start']) {
    await page.locator(sel).scrollIntoViewIfNeeded();
    await page.waitForTimeout(850);
  }
  await page.locator('.ezh-start-cta').hover();
  await page.waitForTimeout(600);
  const video = page.video();
  await page.close();
  await video?.saveAs(`${OUT}/after-desktop-motion.webm`);
  await ctx.close();
}

// Ambient motion (amendment F.1): a focused clip that lingers on the hero
// cadence-line trace, then scrolls to the trust-flow diagram so the packet
// travel + connector dash-march are unmistakable, then the arc for the tick.
{
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: OUT, size: { width: 1440, height: 900 } },
  });
  const page = await ctx.newPage();
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForTimeout(5200); // several ECG heartbeats on the hero
  await page.locator('#flow').scrollIntoViewIfNeeded();
  await page.waitForTimeout(5000); // packet travel + dash-march cycles
  await page.locator('#arc').scrollIntoViewIfNeeded();
  await page.waitForTimeout(4000); // marker-glyph tick
  const video = page.video();
  await page.close();
  await video?.saveAs(`${OUT}/after-ambient-motion.webm`);
  await ctx.close();
}

// Mobile: load, hero one-shots, then the scroll story.
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    recordVideo: { dir: OUT, size: { width: 390, height: 844 } },
  });
  const page = await ctx.newPage();
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2600);
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 300) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 130));
    }
  });
  await page.waitForTimeout(800);
  const video = page.video();
  await page.close();
  await video?.saveAs(`${OUT}/after-mobile-motion.webm`);
  await ctx.close();
}

// Reduced motion: the same journey with zero animation — stillness proof.
{
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: OUT, size: { width: 1440, height: 900 } },
  });
  const page = await ctx.newPage();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1600);
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
  });
  await page.waitForTimeout(1000);
  const video = page.video();
  await page.close();
  await video?.saveAs(`${OUT}/after-reduced-motion.webm`);
  await ctx.close();
}

await browser.close();
writeFileSync(`${OUT}/console-report.txt`, consoleLog.length ? consoleLog.join('\n') : 'clean — no console errors, page errors, or failed requests\n');
console.log(`F evidence captured. Console findings: ${consoleLog.length}`);
