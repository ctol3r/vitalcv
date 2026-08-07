/**
 * Phase 2 founder pixel package — captured at the CURRENT PR head.
 *
 * The resolved-NPI views use a MOCKED API payload (labelled as such in the PR
 * comment): this machine has no backend, and the honest local behaviour is the
 * system-state capsule, which is captured separately. The payload shape is the
 * real one the route consumes.
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = '/tmp/captures';
mkdirSync(OUT, { recursive: true });
const URL = 'http://localhost:4791/';
const NPI = '1234567893';

const BOOT = {
  firstName: 'Karin',
  lastName: 'Osei',
  specialty: 'Physician Assistant',
  state: 'MA',
  identitySource: 'NPPES_API',
};
const TRUST = {
  identityVerified: true,
  exclusionStatus: 'CLEAR',
  pecosStatus: 'ENROLLED',
  licensureStatus: 'unknown',
  blockers: [],
  nextActions: [],
};

async function mock(ctx) {
  await ctx.route('**/api/identity/bootstrap/**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(BOOT) }),
  );
  await ctx.route('**/api/trust-state/**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(TRUST) }),
  );
}

async function open(ctx) {
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-home-hero]');
  await page.waitForTimeout(1200);
  return page;
}

async function toChapter(page, i, total = 5) {
  const mode = await page.locator('.film').getAttribute('data-film-mode');
  if (mode === 'film') {
    await page.evaluate(
      (f) => {
        const r = document.querySelector('.film-runway').getBoundingClientRect();
        const t = r.height - window.innerHeight;
        window.scrollTo(0, r.top + window.scrollY + Math.max(0, t) * f);
      },
      i / (total - 1),
    );
  } else {
    const ids = ['arrival', 'sources', 'permission', 'review', 'closing'];
    await page.locator(`[data-film-scene="${ids[i]}"]`).scrollIntoViewIfNeeded();
  }
  await page.waitForTimeout(700);
}

const browser = await chromium.launch();

/* ---------------------------------------------------- 1440 x 900 stills */
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await mock(ctx);
  const page = await open(ctx);
  await page.screenshot({ path: `${OUT}/d-01-arrival.png` });

  // Valid NPI typed, not yet submitted.
  const input = page.locator('#film-npi-input');
  await input.click();
  await input.pressSequentially(NPI, { delay: 25 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/d-02-valid-npi.png` });

  // Resolved.
  await page.keyboard.press('Enter');
  await page.waitForTimeout(6500);
  await page.screenshot({ path: `${OUT}/d-03-resolved.png` });
  await ctx.close();
}
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await open(ctx);
  for (const [i, name] of [[1, 'sources'], [2, 'permission'], [3, 'review'], [4, 'closing']]) {
    await toChapter(page, i);
    await page.screenshot({ path: `${OUT}/d-0${i + 3}-${name}.png` });
  }
  await ctx.close();
}

/* ----------------------------------------------------- 390 x 844 stills */
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  await mock(ctx);
  const page = await open(ctx);
  await page.screenshot({ path: `${OUT}/m-01-arrival.png` });
  const input = page.locator('#film-npi-input');
  await input.click();
  await input.pressSequentially(NPI, { delay: 20 });
  await page.keyboard.press('Enter');
  await page.waitForTimeout(6500);
  await page.screenshot({ path: `${OUT}/m-02-resolved.png` });
  await ctx.close();
}
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const page = await open(ctx);
  await toChapter(page, 2);
  await page.screenshot({ path: `${OUT}/m-03-permission.png` });
  await toChapter(page, 4);
  await page.screenshot({ path: `${OUT}/m-04-closing.png` });
  await ctx.close();
}

/* ------------------------------------------------- fallbacks + 200% zoom */
{
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    javaScriptEnabled: false,
  });
  const page = await ctx.newPage();
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/f-01-nojs.png` });
  await ctx.close();
}
{
  // 200% zoom is layout-equivalent to halving the viewport at the same CSS px.
  const ctx = await browser.newContext({ viewport: { width: 720, height: 450 } });
  const page = await open(ctx);
  await page.screenshot({ path: `${OUT}/f-02-zoom200.png` });
  await ctx.close();
}
{
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  });
  const page = await open(ctx);
  await page.screenshot({ path: `${OUT}/f-03-reduced-motion.png` });
  await ctx.close();
}

/* ------------------------------------------------------------- recordings */
async function video(name, opts, fn) {
  const ctx = await browser.newContext({
    recordVideo: { dir: `${OUT}/video-${name}`, size: opts.viewport },
    ...opts,
  });
  if (opts.mockApi) await mock(ctx);
  const page = await open(ctx);
  await fn(page);
  await ctx.close();
  console.log(`video: ${name}`);
}

const smooth = async (page, steps = 150) => {
  const end = await page.evaluate(() => document.body.scrollHeight - window.innerHeight);
  await page.evaluate(
    async ({ end, steps }) => {
      for (let i = 1; i <= steps; i++) {
        window.scrollTo(0, (end * i) / steps);
        await new Promise((r) => requestAnimationFrame(r));
        await new Promise((r) => setTimeout(r, 16));
      }
    },
    { end, steps },
  );
};

await video('desktop', { viewport: { width: 1440, height: 900 } }, (p) => smooth(p, 180));
await video(
  'mobile',
  { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
  (p) => smooth(p, 150),
);
await video(
  'reduced-motion',
  { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' },
  (p) => smooth(p, 120),
);
await video('keyboard', { viewport: { width: 1440, height: 900 }, mockApi: true }, async (p) => {
  for (let i = 0; i < 12; i++) {
    await p.keyboard.press('Tab');
    await p.waitForTimeout(320);
    const id = await p.evaluate(() => document.activeElement?.id);
    if (id === 'film-npi-input') break;
  }
  await p.keyboard.type(NPI, { delay: 90 });
  await p.waitForTimeout(400);
  await p.keyboard.press('Enter');
  await p.waitForTimeout(6500);
  for (let i = 0; i < 4; i++) {
    await p.keyboard.press('Tab');
    await p.waitForTimeout(400);
  }
});

await browser.close();
console.log('CAPTURES DONE');
