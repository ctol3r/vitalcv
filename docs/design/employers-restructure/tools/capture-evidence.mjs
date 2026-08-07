/**
 * Founder-visual-gate evidence capture for the /employers restructure.
 *
 * Usage:
 *   node docs/design/employers-restructure/tools/capture-evidence.mjs <baseUrl> <outDir> [--before]
 *
 * <baseUrl>   e.g. http://localhost:3062 (branch prod build) or https://vitalcv.com (before)
 * --before    capture only the "before" set (prod), skipping new routes
 *
 * Produces the FOUNDER_VISUAL_GATE.md §3 static + runtime evidence:
 *   - 1440×900, 390×844, 768×1024 screenshots (viewport + full page)
 *   - reduced-motion capture
 *   - 200% zoom proxy (720×450 viewport reflow)
 *   - keyboard-focus capture (two Tab presses)
 *   - metrics.json: scrollHeight per route, horizontal-overflow check,
 *     console errors, failed requests
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

// Resolve Playwright from apps/web regardless of where this script lives.
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
const routes = beforeOnly
  ? ['/employers']
  : ['/employers', '/employers/request-access', '/employers/how-it-works'];

const metrics = { baseUrl, label, capturedAt: new Date().toISOString(), routes: {} };

const slug = (route) => route.replace(/\//g, '_').replace(/^_/, '') || 'root';

/**
 * Fire the single-shot Reveal observers before a fullPage capture: CDP's
 * captureBeyondViewport does not scroll, so IntersectionObservers below the
 * fold never fire and mz-reveal content screenshots as blank (the same trap
 * that once shipped an opacity-0 scene). Reveals are single-shot, so a scroll
 * through the page settles them permanently.
 */
async function settleReveals(page) {
  await page.evaluate(async () => {
    const step = Math.floor(window.innerHeight * 0.8);
    for (let y = 0; y <= document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(600);
  // The observer (threshold 0.12, −8% root margin, React-state class flip) can
  // miss a single fast programmatic pass — a real reader keeps elements in view
  // so it always fires for them. Force the settled end state for the capture;
  // this is exactly the neutralization matcha-zen.css ships for reduced motion.
  await page.addStyleTag({ content: '.mz-reveal { opacity: 1 !important; animation: none !important; }' });
  await page.waitForTimeout(200);
}

const browser = await chromium.launch();
try {
  for (const route of routes) {
    const consoleErrors = [];
    const failedRequests = [];
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300));
    });
    page.on('requestfailed', (r) => {
      failedRequests.push(`${r.url().slice(0, 200)} — ${r.failure()?.errorText}`);
    });

    await page.goto(baseUrl + route, { waitUntil: 'load', timeout: 60_000 });
    // Motion on these pages is single-shot on entry; give it one beat to rest.
    await page.waitForTimeout(1_500);

    const m = await page.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      title: document.title,
    }));
    m.horizontalOverflow = m.scrollWidth > m.innerWidth;

    await page.screenshot({ path: join(outDir, `${label}-${slug(route)}-1440x900-viewport.png`) });
    await settleReveals(page);
    await page.screenshot({ path: join(outDir, `${label}-${slug(route)}-1440x900-full.png`), fullPage: true });

    // Keyboard focus evidence on the landing route only.
    if (route === '/employers') {
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.screenshot({ path: join(outDir, `${label}-${slug(route)}-1440x900-focus.png`) });
    }

    metrics.routes[route] = { ...m, consoleErrors, failedRequests };
    await context.close();

    // 390×844 (mobile) — full page.
    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const mp = await mobile.newPage();
    await mp.goto(baseUrl + route, { waitUntil: 'load', timeout: 60_000 });
    await mp.waitForTimeout(1_500);
    const mm = await mp.evaluate(() => ({
      scrollHeight: document.documentElement.scrollHeight,
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    metrics.routes[route].mobile = { ...mm, horizontalOverflow: mm.scrollWidth > mm.innerWidth };
    await mp.screenshot({ path: join(outDir, `${label}-${slug(route)}-390x844-viewport.png`) });
    await settleReveals(mp);
    await mp.screenshot({ path: join(outDir, `${label}-${slug(route)}-390x844-full.png`), fullPage: true });
    await mobile.close();
  }

  if (!beforeOnly) {
    // Final-only sets per the gate: 768×1024, reduced motion, 200% zoom proxy.
    const tablet = await browser.newContext({ viewport: { width: 768, height: 1024 } });
    const tp = await tablet.newPage();
    await tp.goto(baseUrl + '/employers', { waitUntil: 'load', timeout: 60_000 });
    await tp.waitForTimeout(1_500);
    await tp.screenshot({ path: join(outDir, 'after-employers-768x1024-viewport.png') });
    await tablet.close();

    const reduced = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'reduce',
    });
    const rp = await reduced.newPage();
    await rp.goto(baseUrl + '/employers', { waitUntil: 'load', timeout: 60_000 });
    await rp.waitForTimeout(500);
    await settleReveals(rp);
    await rp.screenshot({ path: join(outDir, 'after-employers-1440x900-reduced-motion.png'), fullPage: true });
    await reduced.close();

    // 200% zoom proxy: 720×450 viewport reflows layout exactly as a 1440
    // window at 200% browser zoom (CSS px halve; media queries agree).
    const zoom = await browser.newContext({ viewport: { width: 720, height: 450 } });
    const zp = await zoom.newPage();
    await zp.goto(baseUrl + '/employers', { waitUntil: 'load', timeout: 60_000 });
    await zp.waitForTimeout(1_500);
    await zp.screenshot({ path: join(outDir, 'after-employers-200pct-zoom-viewport.png') });
    await zoom.close();
  }
} finally {
  await browser.close();
}

writeFileSync(join(outDir, `metrics-${label}.json`), JSON.stringify(metrics, null, 2));
console.log(JSON.stringify(metrics, null, 2));
