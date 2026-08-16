// Amendment E.2 evidence set — after-shots + motion recordings against the
// production build on :3215. Run from apps/web: node scripts/capture-e2-evidence.mjs
//
// fullPage without scrolling is a lie on a page with entrance reveals:
// IntersectionObserver never fires off-screen, so sections would capture at
// opacity 0. Every full-page shot below scrolls the page through first (the
// 4s safety force-complete is also given time to land).
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = '../../docs/design/evidence/home-e2-clinical-motion-2026-08-16';
mkdirSync(OUT, { recursive: true });
const base = 'http://localhost:3215/';

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

const browser = await chromium.launch();

// ── stills ──────────────────────────────────────────────────────────────────
const shots = [
  { name: 'after-1440x900', w: 1440, h: 900 },
  { name: 'after-390x844', w: 390, h: 844 },
  { name: 'after-768x1024', w: 768, h: 1024 },
  { name: 'after-1728x1117', w: 1728, h: 1117 },
];
for (const s of shots) {
  const page = await browser.newPage({ viewport: { width: s.w, height: s.h } });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000); // hero one-shots settle
  await scrollThrough(page);
  await page.waitForTimeout(1500); // past the 4s safety, everything complete
  await page.screenshot({ path: `${OUT}/${s.name}.png`, fullPage: true });
  await page.screenshot({ path: `${OUT}/${s.name}-viewport.png`, fullPage: false });
  await page.close();
}

// Reduced motion at 1440 — the finished frame with zero animation.
const rm = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await rm.emulateMedia({ reducedMotion: 'reduce' });
await rm.goto(base, { waitUntil: 'networkidle' });
await rm.waitForTimeout(800);
await rm.screenshot({ path: `${OUT}/after-1440x900-reduced-motion.png`, fullPage: true });
await rm.close();

// 200% zoom equivalent: 720 CSS px layout width.
const zoom = await browser.newPage({ viewport: { width: 720, height: 450 } });
await zoom.goto(base, { waitUntil: 'networkidle' });
await zoom.waitForTimeout(3000);
await scrollThrough(zoom);
await zoom.waitForTimeout(1500);
await zoom.screenshot({ path: `${OUT}/after-200pct-zoom-of-1440.png`, fullPage: true });
await zoom.close();

// ── recordings ──────────────────────────────────────────────────────────────

// Desktop: hero one-shots (line-draw + row reveal + cycling word), the digit
// pop, entrance reveals on scroll, and hover micro-states.
{
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: OUT, size: { width: 1440, height: 900 } },
  });
  const page = await ctx.newPage();
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3200); // hero draw + word single pass
  const input = page.locator('#ezh-npi');
  await input.click();
  for (const d of '1234567890') {
    await page.keyboard.type(d);
    await page.waitForTimeout(180);
  }
  await page.waitForTimeout(400);
  // Scroll section by section so each entrance fires on camera.
  for (const sel of ['.ezh-opportunities', '.ezh-truthline', '.ezh-promises', '.ezh-qa', '.ezh-emp', '.ezh-start']) {
    await page.locator(sel).scrollIntoViewIfNeeded();
    await page.waitForTimeout(900);
  }
  // Hover states: promise card, QA row, employer CTA, final CTA.
  await page.locator('.ezh-promises').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  for (const sel of ['.ezh-promise >> nth=0', '.ezh-promise >> nth=2']) {
    await page.locator(sel).hover();
    await page.waitForTimeout(500);
  }
  await page.locator('.ezh-qa-row >> nth=0').hover();
  await page.waitForTimeout(500);
  await page.locator('.ezh-start-cta').scrollIntoViewIfNeeded();
  await page.locator('.ezh-start-cta').hover();
  await page.waitForTimeout(600);
  const video = page.video();
  await page.close();
  await video?.saveAs(`${OUT}/after-desktop-motion.webm`);
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
  await page.waitForTimeout(3200);
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 300) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 140));
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
  await page.waitForTimeout(2000);
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 500) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
  });
  await page.waitForTimeout(1200);
  const video = page.video();
  await page.close();
  await video?.saveAs(`${OUT}/after-reduced-motion.webm`);
  await ctx.close();
}

await browser.close();
console.log('E.2 after evidence captured');
