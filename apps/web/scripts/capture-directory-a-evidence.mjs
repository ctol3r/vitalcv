/**
 * capture-directory-a-evidence.mjs — founder-gate evidence for the
 * /directory/[npi] Direction A register pass.
 *
 * Run from apps/web against a production `next start` on :3077 whose fetch is
 * stubbed by scripts/directory-evidence-fetch-stub.mjs (repo root), so the
 * rendered record is the sanctioned SYNTHETIC fixture, never a real person:
 *
 *   pnpm exec next build
 *   NODE_OPTIONS="--import $REPO/scripts/directory-evidence-fetch-stub.mjs" \
 *     node node_modules/next/dist/bin/next start -p 3077 &
 *   node scripts/capture-directory-a-evidence.mjs before|after
 *
 * Captures the founder visual gate §3 static set (1440×900, 390×844,
 * 768×1024, reduced-motion, 200%-zoom-equivalent 720px), the organization
 * branch, a desktop motion recording (after only), and a measurement pass
 * (CTA target size, painted colours via canvas — not getComputedStyle
 * strings, which Chromium returns as oklch()).
 *
 * fullPage captures SCROLL THROUGH THE PAGE FIRST: the after-state uses
 * IntersectionObserver reveals, and a fullPage shot of an unscrolled page
 * captures armed sections at opacity 0 and lies about the composition.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const phase = process.argv[2];
if (phase !== 'before' && phase !== 'after') {
  console.error('usage: node scripts/capture-directory-a-evidence.mjs before|after');
  process.exit(1);
}

const OUT = '../../docs/design/evidence/directory-direction-a-2026-08-16';
mkdirSync(OUT, { recursive: true });

const INDIVIDUAL = 'http://localhost:3077/directory/1558395516';
const ORGANIZATION = 'http://localhost:3077/directory/1558395511';

const consoleErrors = [];

async function settleAndScroll(page) {
  await page.waitForTimeout(900); // header reveal + pulse draw settle
  // Walk the page so every one-shot reveal has genuinely fired before any
  // fullPage capture. globals.css sets `scroll-behavior: smooth`, which makes
  // every programmatic scrollTo animate — force it off for the walk, or the
  // return-to-top races the screenshot and captures mid-flight.
  await page.evaluate(async () => {
    const html = document.documentElement;
    const prev = html.style.scrollBehavior;
    html.style.scrollBehavior = 'auto';
    const step = window.innerHeight * 0.7;
    for (let y = 0; y <= document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 160));
    }
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 120));
    html.style.scrollBehavior = prev;
  });
  await page.waitForFunction(() => window.scrollY === 0);
  await page.waitForTimeout(420); // reveal transitions finish at the top
}

async function newPage(browser, viewport, opts = {}) {
  const context = await browser.newContext({ viewport, ...opts });
  const page = await context.newPage();
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(`${viewport.width}w: ${m.text()}`);
  });
  page.on('pageerror', (e) => consoleErrors.push(`${viewport.width}w pageerror: ${e.message}`));
  return { context, page };
}

const browser = await chromium.launch();

// ── static set, individual branch ─────────────────────────────────────────
const shots = [
  { name: '1440x900', w: 1440, h: 900 },
  { name: '390x844', w: 390, h: 844 },
  { name: '768x1024', w: 768, h: 1024 },
];

const report = { phase, capturedAt: new Date().toISOString(), pages: {} };

for (const s of shots) {
  const { context, page } = await newPage(browser, { width: s.w, height: s.h });
  await page.goto(INDIVIDUAL, { waitUntil: 'networkidle' });
  await settleAndScroll(page);
  await page.screenshot({ path: `${OUT}/${phase}-${s.name}-viewport.png` });
  await page.screenshot({ path: `${OUT}/${phase}-${s.name}.png`, fullPage: true });

  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  report.pages[s.name] = { overflow };
  await context.close();
}

// ── reduced motion at 1440 — the finished frame with nothing armed ────────
{
  const { context, page } = await newPage(
    browser,
    { width: 1440, height: 900 },
    { reducedMotion: 'reduce' },
  );
  await page.goto(INDIVIDUAL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/${phase}-1440x900-reduced-motion.png`, fullPage: true });
  await context.close();
}

// ── 200% zoom equivalent: 720 CSS px layout width ──────────────────────────
{
  const { context, page } = await newPage(browser, { width: 720, height: 450 });
  await page.goto(INDIVIDUAL, { waitUntil: 'networkidle' });
  await settleAndScroll(page);
  await page.screenshot({ path: `${OUT}/${phase}-200pct-zoom-of-1440.png`, fullPage: true });
  await context.close();
}

// ── organization branch (no claim CTA) at 1440 ────────────────────────────
{
  const { context, page } = await newPage(browser, { width: 1440, height: 900 });
  await page.goto(ORGANIZATION, { waitUntil: 'networkidle' });
  await settleAndScroll(page);
  await page.screenshot({ path: `${OUT}/${phase}-org-1440x900.png`, fullPage: true });
  await context.close();
}

// ── focus visibility: Tab to the claim CTA ─────────────────────────────────
{
  const { context, page } = await newPage(browser, { width: 1440, height: 900 });
  await page.goto(INDIVIDUAL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  const cta = page.getByTestId('directory-claim-cta');
  await cta.focus();
  await page.screenshot({ path: `${OUT}/${phase}-1440-focus-claim-cta.png` });

  // Measurement pass: painted pixels, not computed-style strings.
  const box = await cta.boundingBox();
  const colors = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="directory-claim-cta"]');
    if (!el) return null;
    const toRgb = (css) => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#000';
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      return Array.from(ctx.getImageData(0, 0, 1, 1).data.slice(0, 3));
    };
    const cs = getComputedStyle(el);
    return { bg: toRgb(cs.backgroundColor), fg: toRgb(cs.color) };
  });
  report.claimCta = { box, colors };
  await context.close();
}

// ── desktop motion recording (after only) ─────────────────────────────────
if (phase === 'after') {
  for (const rec of [
    { name: 'desktop', width: 1440, height: 900 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    const context = await browser.newContext({
      viewport: { width: rec.width, height: rec.height },
      recordVideo: { dir: `${OUT}/video-tmp-${rec.name}`, size: { width: rec.width, height: rec.height } },
    });
    const page = await context.newPage();
    await page.goto(INDIVIDUAL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1400); // header entrance + pulse draw
    await page.evaluate(async () => {
      const step = window.innerHeight * 0.85;
      for (let y = step; y <= document.body.scrollHeight; y += step) {
        window.scrollTo({ top: y, behavior: 'smooth' });
        await new Promise((r) => setTimeout(r, 900));
      }
    });
    const cta2 = page.getByTestId('directory-claim-cta');
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await page.waitForTimeout(800);
    await cta2.hover();
    await page.waitForTimeout(400);
    await page.mouse.down();
    await page.waitForTimeout(250);
    await page.mouse.up();
    await page.waitForTimeout(400);
    const video = page.video();
    await context.close();
    const path = await video.path();
    const { renameSync, rmSync } = await import('node:fs');
    renameSync(path, `${OUT}/after-motion-${rec.name}.webm`);
    rmSync(`${OUT}/video-tmp-${rec.name}`, { recursive: true, force: true });
  }

  // Reduced-motion recording: proof that nothing moves and the frame is
  // complete.
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
    recordVideo: { dir: `${OUT}/video-tmp-rm`, size: { width: 1440, height: 900 } },
  });
  const page = await context.newPage();
  await page.goto(INDIVIDUAL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.evaluate(async () => {
    const step = window.innerHeight * 0.85;
    for (let y = step; y <= document.body.scrollHeight; y += step) {
      window.scrollTo({ top: y, behavior: 'smooth' });
      await new Promise((r) => setTimeout(r, 700));
    }
  });
  const video = page.video();
  await context.close();
  const path = await video.path();
  const { renameSync, rmSync } = await import('node:fs');
  renameSync(path, `${OUT}/after-motion-reduced.webm`);
  rmSync(`${OUT}/video-tmp-rm`, { recursive: true, force: true });
}

report.consoleErrors = consoleErrors;
writeFileSync(`${OUT}/${phase}-runtime-report.json`, JSON.stringify(report, null, 2));

await browser.close();
console.log(`${phase} evidence captured; console errors: ${consoleErrors.length}`);
if (consoleErrors.length > 0) {
  console.log(consoleErrors.join('\n'));
}
