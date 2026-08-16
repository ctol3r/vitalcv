// Before-shots for amendment E.2 — the shipped E.1 page at origin/main
// (5bd0f459d, content-identical to production /), served by `next start`.
// Run from apps/web: node scripts/capture-e2-before.mjs
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = '../../docs/design/evidence/home-e2-clinical-motion-2026-08-16';
mkdirSync(OUT, { recursive: true });
const base = 'http://localhost:3211/';

const shots = [
  { name: 'before-1440x900', w: 1440, h: 900 },
  { name: 'before-390x844', w: 390, h: 844 },
];

const browser = await chromium.launch();
for (const s of shots) {
  const page = await browser.newPage({ viewport: { width: s.w, height: s.h } });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2800); // one-shot motion settles
  // Scroll through so nothing captures mid-reveal, then return to top.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/${s.name}.png`, fullPage: true });
  await page.screenshot({ path: `${OUT}/${s.name}-viewport.png`, fullPage: false });
  await page.close();
}
await browser.close();
console.log('E.2 before evidence captured');
