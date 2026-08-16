// Confirms #1430's /verify fixes survive the glass-rail chrome change:
//   - .mz-reveal content is never TRAPPED hidden (no-JS shows it; with JS it
//     reveals on observation and nothing is stranded after scrolling)
//   - nothing above the fold is ghosted at first paint
//   - the rail's verify affordance is the shield-check, never a magnifier
import { chromium } from '@playwright/test';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3077';

const probe = () =>
  Array.from(document.querySelectorAll('.mz-reveal')).map((el) => {
    const r = el.getBoundingClientRect();
    return {
      opacity: +parseFloat(getComputedStyle(el).opacity).toFixed(2),
      top: Math.round(r.top + window.scrollY),
      aboveFold: r.top < window.innerHeight,
    };
  });

const run = async () => {
  const browser = await chromium.launch();
  const out = {};

  // JS enabled — at first paint, then after scrolling the whole page
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${BASE}/verify`, { waitUntil: 'networkidle' });
    // #1430's entrance is a rise/fade progressive enhancement. Measured at
    // `networkidle` it is still IN FLIGHT (0.99/0.96/0.94) and a naive
    // `< 0.99` read calls a working animation a ghosting bug. What matters is
    // that it COMPLETES without a scroll — measured: 1/1/1 within 400ms.
    await page.waitForTimeout(700);
    out.atLoad = await page.evaluate(probe);
    out.aboveFoldGhostedAtLoad = out.atLoad.filter((r) => r.aboveFold && r.opacity < 0.99).length;

    // Scroll the page so every observer fires, then settle.
    await page.evaluate(async () => {
      const step = window.innerHeight * 0.8;
      for (let y = 0; y < document.body.scrollHeight; y += step) {
        window.scrollTo({ top: y, behavior: 'instant' });
        await new Promise((r) => setTimeout(r, 120));
      }
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
    await page.waitForTimeout(900);
    out.afterScroll = await page.evaluate(probe);
    out.strandedAfterScroll = out.afterScroll.filter((r) => r.opacity < 0.99).length;

    const verify = page.locator('.vcv-eb__verify');
    out.railVerifyLabel = await verify.getAttribute('aria-label');
    out.railVerifyHref = await verify.getAttribute('href');
    out.railVerifyIsShield = await verify.evaluate((el) => {
      const paths = Array.from(el.querySelectorAll('path')).map((p) => p.getAttribute('d') ?? '');
      return paths.length === 2 && el.querySelector('circle') === null;
    });
    await page.close();
  }

  // JS DISABLED — the path #1430 fixed: content visible by default, never trapped
  {
    const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/verify`, { waitUntil: 'domcontentloaded' });
    out.nojs = await page.evaluate(probe);
    out.nojsGhosted = out.nojs.filter((r) => r.opacity < 0.99).length;
    await page.close();
    await ctx.close();
  }

  console.log(JSON.stringify(out, null, 2));
  const ok =
    out.nojsGhosted === 0 &&              // no-JS: never trapped hidden (#1430)
    out.strandedAfterScroll === 0 &&      // with JS: nothing stranded invisible
    out.aboveFoldGhostedAtLoad === 0 &&   // nothing ghosted in the first viewport
    out.railVerifyLabel === 'Verify a shared record' &&
    out.railVerifyHref === '/verify' &&
    out.railVerifyIsShield === true;
  console.log(ok ? '\n#1430 CHECK: PASS' : '\n#1430 CHECK: FAIL');
  await browser.close();
  process.exit(ok ? 0 : 1);
};
run().catch((e) => { console.error(e); process.exit(1); });
