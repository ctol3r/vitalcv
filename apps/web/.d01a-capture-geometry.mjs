/** D-00: measure overflow + overlap in the server-rendered completed frame. */
import { chromium } from '@playwright/test';

const BASE = process.env.BASE || 'http://localhost:4311';
const browser = await chromium.launch();
const results = {};

for (const [mode, opts] of Object.entries({
  'no-script': { javaScriptEnabled: false },
  'reduced-motion': { reducedMotion: 'reduce' },
  'motion-settled': {},
})) {
  results[mode] = {};
  for (const width of [360, 390, 768, 1280, 1440]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, ...opts });
    const page = await ctx.newPage();
    await page.goto(BASE + '/', { waitUntil: 'load' });
    await page.waitForTimeout(mode === 'motion-settled' ? 13000 : 2000);

    const r = await page.evaluate(() => {
      const doc = document.documentElement;
      const horizontalOverflow = doc.scrollWidth - doc.clientWidth;

      // elements whose content box escapes the viewport on the right
      const escapes = [];
      for (const el of document.querySelectorAll('.ezh *')) {
        const b = el.getBoundingClientRect();
        if (b.width === 0 || b.height === 0) continue;
        if (b.right > window.innerWidth + 1 || b.left < -1) {
          escapes.push({
            sel: el.tagName.toLowerCase() + '.' + String(el.className || '').split(' ')[0],
            left: Math.round(b.left), right: Math.round(b.right),
          });
        }
      }

      // text-node overlaps between the work-surface's two columns
      const pairs = [];
      const cand = [...document.querySelectorAll(
        '.ezh-seed-tag, .ezh-seed-v, .ezh-sf-h, .ezh-sf-hsub, .ezh-arow-t, .ezh-chip, .ezh-fact-l, .ezh-src, .ezh-feedline, .ezh-surface.is-static [data-beat]'
      )].filter(e => e.getBoundingClientRect().width > 0);
      for (let i = 0; i < cand.length; i++) {
        for (let j = i + 1; j < cand.length; j++) {
          const a = cand[i], b = cand[j];
          if (a.contains(b) || b.contains(a)) continue;
          const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
          const ox = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
          const oy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
          if (ox > 2 && oy > 2) {
            pairs.push({
              a: a.tagName.toLowerCase() + '.' + String(a.className).split(' ')[0],
              aText: (a.textContent || '').trim().slice(0, 34),
              b: b.tagName.toLowerCase() + '.' + String(b.className).split(' ')[0],
              bText: (b.textContent || '').trim().slice(0, 34),
              overlapPx: `${Math.round(ox)}x${Math.round(oy)}`,
            });
          }
        }
      }

      // the work feed: is the column so narrow the text breaks per word?
      const feed = document.querySelector('.ezh-feedline');
      const feedBox = feed ? feed.getBoundingClientRect() : null;

      // touch targets under 44px on interactive elements
      const smallTargets = [];
      for (const el of document.querySelectorAll('.ezh a, .ezh button, .ezh input')) {
        const b = el.getBoundingClientRect();
        if (b.width === 0) continue;
        if (b.height < 44 || b.width < 44) {
          smallTargets.push({
            sel: el.tagName.toLowerCase() + '.' + String(el.className || '').split(' ')[0],
            text: (el.textContent || el.getAttribute('placeholder') || '').trim().slice(0, 26),
            size: `${Math.round(b.width)}x${Math.round(b.height)}`,
          });
        }
      }

      return { horizontalOverflow, escapes: escapes.slice(0, 8), overlaps: pairs.slice(0, 8),
               feedWidth: feedBox ? Math.round(feedBox.width) : null, smallTargets: smallTargets.slice(0, 12) };
    });

    results[mode][width] = r;
    await ctx.close();
  }
}

await browser.close();
console.log(JSON.stringify(results, null, 2));
