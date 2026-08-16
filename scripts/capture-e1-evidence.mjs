// Capture the amendment E.1 evidence set against the production build on :3210.
// Overwrites the after-* files in the evidence dir; before-* (D.7 production)
// stand, and the E-era after-shots are superseded by these.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = '../../docs/design/evidence/direction-a-recomposition-2026-08-15';
mkdirSync(OUT, { recursive: true });
const base = 'http://localhost:3210/';

const shots = [
  { name: 'after-1440x900', w: 1440, h: 900 },
  { name: 'after-390x844', w: 390, h: 844 },
  { name: 'after-768x1024', w: 768, h: 1024 },
  { name: 'after-1728x1117', w: 1728, h: 1117 },
];

const browser = await chromium.launch();
for (const s of shots) {
  const page = await browser.newPage({ viewport: { width: s.w, height: s.h } });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500); // one-shot motion settles
  await page.screenshot({ path: `${OUT}/${s.name}.png`, fullPage: true });
  await page.screenshot({ path: `${OUT}/${s.name}-viewport.png`, fullPage: false });
  await page.close();
}

// Reduced motion at 1440.
const rm = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await rm.emulateMedia({ reducedMotion: 'reduce' });
await rm.goto(base, { waitUntil: 'networkidle' });
await rm.screenshot({ path: `${OUT}/after-1440x900-reduced-motion.png`, fullPage: true });
await rm.close();

// 200% zoom equivalent: 720 CSS px layout width.
const zoom = await browser.newPage({ viewport: { width: 720, height: 450 } });
await zoom.goto(base, { waitUntil: 'networkidle' });
await zoom.screenshot({ path: `${OUT}/after-200pct-zoom-of-1440.png`, fullPage: true });
await zoom.close();

// Bottom-half crop at 1440 — the section the E.1 revision changed.
const bh = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await bh.goto(base, { waitUntil: 'networkidle' });
await bh.waitForTimeout(1500);
const promises = bh.locator('.ezh-promises');
await promises.scrollIntoViewIfNeeded();
await bh.waitForTimeout(300);
await bh.screenshot({ path: `${OUT}/after-1440-bottom-half-e1.png`, fullPage: false });
await bh.close();

await browser.close();
console.log('E.1 evidence captured');
