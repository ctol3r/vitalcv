import { chromium } from '@playwright/test';
const BASE = process.env.BASE || 'http://localhost:4319';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
await page.goto(BASE + '/', { waitUntil: 'load' });
const probe = () => page.evaluate(() => {
  const el = document.querySelector('.ezh-npi-submit');
  const cs = el ? getComputedStyle(el) : null;
  const sheets = [...document.styleSheets].map(s => { try { return s.cssRules.length; } catch { return -1; } });
  return { radius: cs?.borderRadius, h: el ? Math.round(el.getBoundingClientRect().height) : null,
           bg: cs?.backgroundColor, sheets, links: document.querySelectorAll('link[rel=stylesheet]').length };
});
for (const t of [500, 2000, 4000, 6000, 9000, 13000, 16000]) {
  await page.waitForTimeout(t === 500 ? 500 : 2000);
  const r = await probe();
  console.log(`t≈${t}ms`.padEnd(10), JSON.stringify(r));
}
await browser.close();
