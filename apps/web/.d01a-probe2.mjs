import { chromium } from '@playwright/test';
const BASE = process.env.BASE || 'http://localhost:4319';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
await page.goto(BASE + '/', { waitUntil: 'load' });
await page.waitForTimeout(13000);
const r = await page.evaluate(() => {
  const out = {};
  for (const sel of ['.ezh-npi-submit', '.ezh-npi-input', '.ezh-record', '.ezh-fact', '.ezh-truth']) {
    out[sel] = [...document.querySelectorAll(sel)].map((el) => {
      const b = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        size: Math.round(b.width) + 'x' + Math.round(b.height),
        display: cs.display, radius: cs.borderRadius, fs: cs.fontSize,
        bg: cs.backgroundColor, visibility: cs.visibility, opacity: cs.opacity,
        parent: el.parentElement ? String(el.parentElement.className).slice(0, 40) : null,
        inTemplate: !!el.closest('template'), hidden: el.offsetParent === null,
      };
    });
  }
  out.__sheets = [...document.styleSheets].map(s => {
    let n = 0; try { n = s.cssRules.length; } catch { n = -1; }
    return { href: s.href ? s.href.split('/').pop() : 'inline', rules: n };
  });
  out.__ezhRuleFound = [...document.styleSheets].some(s => {
    try { return [...s.cssRules].some(r => r.selectorText && r.selectorText.includes('ezh-npi-submit')); }
    catch { return false; }
  });
  return out;
});
console.log(JSON.stringify(r, null, 2));
await browser.close();
