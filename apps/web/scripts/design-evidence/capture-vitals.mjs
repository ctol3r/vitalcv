/**
 * D-00 baseline harness — LCP / CLS / FCP / byte weight / font loads, plus
 * fold + full-page screenshots at 390 / 768 / 1280 / 1440 and the two
 * fallback compositions (reduced-motion, no-script).
 *
 * Run from apps/web (that is where @playwright/test resolves), against a
 * production build served by `next start`:
 *
 *   pnpm turbo run build --filter @vitalcv/web
 *   pnpm --filter @vitalcv/web exec next start -H localhost -p 4311
 *   cd apps/web && node ../../docs/design/evidence/d00-visual-baseline/capture-vitals.mjs
 *
 * Bind the server to `localhost`, not `127.0.0.1`: Next 15's router worker
 * dials `localhost`, and a 127.0.0.1 bind leaves it proxying to ::1 (ECONNREFUSED).
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:4311';
const OUT = process.env.OUT || './design-evidence-out';
const ROUTES = (process.env.ROUTES || '/,/employers').split(',');
const WIDTHS = [390, 768, 1280, 1440];

mkdirSync(OUT, { recursive: true });

const VITALS = `
window.__v = { cls: 0, clsSources: [], lcp: null, fcp: null, longTasks: 0, longTaskMs: 0 };
new PerformanceObserver((l) => {
  for (const e of l.getEntries()) {
    window.__v.lcp = {
      time: +e.startTime.toFixed(1),
      size: e.size,
      el: e.element ? e.element.tagName + (e.element.className ? '.' + String(e.element.className).split(' ').slice(0,2).join('.') : '') : null,
      text: e.element ? (e.element.textContent || '').trim().slice(0, 70) : null,
    };
  }
}).observe({ type: 'largest-contentful-paint', buffered: true });
new PerformanceObserver((l) => {
  for (const e of l.getEntries()) {
    if (e.hadRecentInput) continue;
    window.__v.cls += e.value;
    if (e.value > 0.0005) window.__v.clsSources.push({
      v: +e.value.toFixed(4), t: +e.startTime.toFixed(0),
      nodes: (e.sources || []).map(s => s.node ? s.node.tagName + (s.node.className ? '.' + String(s.node.className).split(' ')[0] : '') : '?').slice(0, 3),
    });
  }
}).observe({ type: 'layout-shift', buffered: true });
new PerformanceObserver((l) => {
  for (const e of l.getEntries()) { window.__v.longTasks++; window.__v.longTaskMs += e.duration; }
}).observe({ type: 'longtask', buffered: true });
new PerformanceObserver((l) => {
  for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') window.__v.fcp = +e.startTime.toFixed(1);
}).observe({ type: 'paint', buffered: true });
`;

const report = { base: BASE, capturedAt: new Date().toISOString(), routes: {} };
const browser = await chromium.launch();

for (const route of ROUTES) {
  const slug = route === '/' ? 'home' : route.replace(/^\//, '').replace(/\//g, '-');
  report.routes[route] = { widths: {} };

  for (const width of WIDTHS) {
    const ctx = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 900 },
      deviceScaleFactor: 1,
      reducedMotion: 'no-preference',
    });
    const page = await ctx.newPage();
    await page.addInitScript(VITALS);

    const bytes = { js: 0, css: 0, font: 0, img: 0, doc: 0, other: 0, count: 0 };
    page.on('response', async (res) => {
      const type = res.request().resourceType();
      let len = Number(res.headers()['content-length'] || 0);
      if (!len) { try { len = (await res.body()).length; } catch { len = 0; } }
      bytes.count++;
      if (type === 'script') bytes.js += len;
      else if (type === 'stylesheet') bytes.css += len;
      else if (type === 'font') bytes.font += len;
      else if (type === 'image') bytes.img += len;
      else if (type === 'document') bytes.doc += len;
      else bytes.other += len;
    });

    await page.goto(BASE + route, { waitUntil: 'load', timeout: 60000 });
    // the work-surface timeline runs ~10.8s; wait it out so late shifts count
    await page.waitForTimeout(13000);
    const vitals = await page.evaluate(() => window.__v);
    const fonts = await page.evaluate(() =>
      performance.getEntriesByType('resource')
        .filter((r) => /\.woff2?$/.test(r.name))
        .map((r) => ({ file: r.name.split('/').pop(), transfer: r.transferSize, decoded: r.decodedBodySize })));
    const docHeight = await page.evaluate(() => document.documentElement.scrollHeight);

    report.routes[route].widths[width] = { vitals, bytes, fonts, docHeight };

    await page.screenshot({ path: `${OUT}/${slug}-${width}-fold.png` });
    await page.screenshot({ path: `${OUT}/${slug}-${width}-full.png`, fullPage: true });
    await ctx.close();
  }

  for (const [label, opts] of [
    ['reduced-motion', { reducedMotion: 'reduce' }],
    ['no-script', { javaScriptEnabled: false }],
  ]) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...opts });
    const page = await ctx.newPage();
    await page.goto(BASE + route, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(label === 'reduced-motion' ? 3000 : 1500);
    await page.screenshot({ path: `${OUT}/${slug}-1280-${label}.png`, fullPage: true });
    await ctx.close();
  }
}

await browser.close();
writeFileSync(`${OUT}/baseline.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
