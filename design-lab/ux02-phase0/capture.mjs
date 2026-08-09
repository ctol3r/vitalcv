#!/usr/bin/env node
// UX-02 Phase 0 baseline capture — screenshots + structural metrics + axe scan.
// Regenerable evidence (PNGs untracked by design, same policy as homepage-reset/evidence).
//
// Usage: BASE_URL=http://localhost:4890 node design-lab/ux02-phase0/capture.mjs
// Requires the production build served (`next start`), Playwright from apps/web,
// and (optionally) axe-core resolvable — the axe section is skipped if absent.
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(here, '../../apps/web/package.json'));
const { chromium } = require('@playwright/test');

const BASE = process.env.BASE_URL || 'http://localhost:4890';
const OUT = join(here, 'evidence');
mkdirSync(OUT, { recursive: true });

// 1407202518 is the designated safe test NPI (synthetic, does not name a real person).
const ROUTES = [
  { slug: 'home', path: '/' },
  { slug: 'employers', path: '/employers' },
  { slug: 'pricing', path: '/pricing' },
  { slug: 'profile-test-npi', path: '/profile/1407202518' },
  { slug: 'matcha', path: '/matcha' },
];
const WIDTHS = [390, 768, 1280, 1728];

let axeSource = null;
try {
  axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
} catch {
  console.error('axe-core not resolvable — skipping accessibility scan (recorded in metrics).');
}

const results = [];
const browser = await chromium.launch();
for (const route of ROUTES) {
  for (const width of WIDTHS) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const resp = await page.goto(BASE + route.path, { waitUntil: 'load', timeout: 60000 });
    // Let one-shot reveals and fonts settle; scroll full page so lazy content mounts.
    await page.evaluate(async () => {
      await new Promise((r) => setTimeout(r, 1200));
      const step = window.innerHeight;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 150));
      }
      window.scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 800));
    });
    const metrics = await page.evaluate(() => {
      const text = document.body.innerText || '';
      return {
        status: undefined,
        pageHeight: document.documentElement.scrollHeight,
        viewportHeight: window.innerHeight,
        textChars: text.replace(/\s+/g, ' ').trim().length,
        title: document.title,
      };
    });
    metrics.status = resp?.status();
    metrics.heightRatio = +(metrics.pageHeight / metrics.viewportHeight).toFixed(2);
    metrics.charsPerViewport = Math.round(metrics.textChars / Math.max(1, metrics.heightRatio));

    let axe = null;
    if (axeSource && width === 1280) {
      await page.evaluate(axeSource);
      axe = await page.evaluate(async () => {
        const r = await window.axe.run(document, {
          resultTypes: ['violations'],
          rules: { 'color-contrast': { enabled: true } },
        });
        return r.violations.map((v) => ({
          id: v.id, impact: v.impact, nodes: v.nodes.length,
          help: v.help,
        }));
      });
    }

    const shot = join(OUT, `${route.slug}-${width}.png`);
    await page.screenshot({ path: shot, fullPage: true });
    results.push({ route: route.path, slug: route.slug, width, ...metrics, axeViolations: axe });
    await page.close();
    console.error(`${route.path} @${width}: ${metrics.status} h=${metrics.pageHeight} ratio=${metrics.heightRatio} chars=${metrics.textChars}${axe ? ` axe=${axe.length}` : ''}`);
  }
}
await browser.close();
writeFileSync(join(OUT, 'metrics.json'), JSON.stringify({ base: BASE, capturedAt: process.env.CAPTURE_STAMP || 'unstamped', results }, null, 2));
console.error(`wrote ${results.length} captures to ${OUT}`);
