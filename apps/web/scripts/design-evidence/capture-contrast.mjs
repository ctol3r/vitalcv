/**
 * D-01A verification probe.
 *   1. Resolve the `.ezh-fact-l` / `.ezh-src` overlap signature: real glyph
 *      collision, or inline half-leading in the rect?
 *   2. Measured WCAG contrast for the CTA at rest / hover / focus-visible,
 *      the eyebrow CTA, and the A-1 truth/source copy — read off the RENDERED
 *      page, not the stylesheet.
 *   3. A-3: NPI input box at 390 and 480.
 */
import { chromium } from '@playwright/test';

const BASE = process.env.BASE || 'http://localhost:4319';
const browser = await chromium.launch();

const CONTRAST = `
window.__srgb = (c) => { c /= 255; return c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4); };
window.__lum = (rgb) => { const [r,g,b] = rgb; return 0.2126*__srgb(r)+0.7152*__srgb(g)+0.0722*__srgb(b); };
window.__parse = (s) => (s.match(/[\\d.]+/g)||[]).slice(0,3).map(Number);
window.__ratio = (fg, bg) => { const L1=__lum(fg), L2=__lum(bg); const [a,b]=L1>L2?[L1,L2]:[L2,L1]; return +((a+0.05)/(b+0.05)).toFixed(2); };
// walk up for the first non-transparent background
window.__bgOf = (el) => {
  let n = el;
  while (n && n !== document.documentElement) {
    const bg = getComputedStyle(n).backgroundColor;
    const p = __parse(bg);
    const alpha = (bg.match(/[\\d.]+/g)||[])[3];
    if (p.length === 3 && alpha !== '0') return p;
    n = n.parentElement;
  }
  return [21,20,18];
};
window.__probe = (sel) => {
  const el = document.querySelector(sel);
  if (!el) return null;
  const cs = getComputedStyle(el);
  const b = el.getBoundingClientRect();
  return {
    sel,
    text: (el.textContent||el.getAttribute('placeholder')||'').trim().slice(0,42),
    fg: cs.color, bg: cs.backgroundColor,
    fontSize: cs.fontSize, fontWeight: cs.fontWeight,
    size: Math.round(b.width)+'x'+Math.round(b.height),
    ratio: __ratio(__parse(cs.color), __parse(cs.backgroundColor).length===3 && (cs.backgroundColor.match(/[\\d.]+/g)||[])[3]!=='0' ? __parse(cs.backgroundColor) : __bgOf(el)),
    radius: cs.borderRadius,
  };
};
`;

const out = { overlapForensics: {}, contrast: {}, a3: {} };

// ── 1. overlap forensics at 1280 ─────────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(13000);
  out.overlapForensics = await page.evaluate(() => {
    const els = [...document.querySelectorAll('.ezh-fact-l, .ezh-src')];
    const rows = [...document.querySelectorAll('.ezh-fact')].map((r, i) => {
      const b = r.getBoundingClientRect();
      return { i, top: +b.top.toFixed(1), bottom: +b.bottom.toFixed(1), h: +b.height.toFixed(1) };
    });
    const detail = els.map((el) => {
      const b = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const row = el.closest('.ezh-fact');
      return {
        cls: String(el.className).split(' ')[0],
        text: (el.textContent||'').trim().slice(0, 22),
        top: +b.top.toFixed(1), bottom: +b.bottom.toFixed(1),
        h: +b.height.toFixed(1),
        fontSize: cs.fontSize, lineHeight: cs.lineHeight,
        rowIndex: row ? [...document.querySelectorAll('.ezh-fact')].indexOf(row) : -1,
      };
    });
    // do any two *different-row* elements overlap by more than half-leading?
    const collisions = [];
    for (let i = 0; i < detail.length; i++) {
      for (let j = i + 1; j < detail.length; j++) {
        const a = detail[i], b2 = detail[j];
        const ov = Math.min(a.bottom, b2.bottom) - Math.max(a.top, b2.top);
        if (ov > 0 && a.rowIndex !== b2.rowIndex) {
          const lead = (parseFloat(a.lineHeight) - parseFloat(a.fontSize)) / 2;
          collisions.push({
            a: a.cls + ':' + a.text, b: b2.cls + ':' + b2.text,
            overlapPx: +ov.toFixed(1), halfLeading: +lead.toFixed(1),
            glyphCollision: ov > lead * 2,
          });
        }
      }
    }
    return { rows: rows.slice(0, 6), sample: detail.slice(0, 6), collisions: collisions.slice(0, 10) };
  });
  await ctx.close();
}

// ── 2. contrast at 1280 ──────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.addScriptTag({ content: CONTRAST });
  await page.waitForTimeout(1200);

  const targets = ['.ezh-npi-submit', '.ezh-npi-input', '.ezh-truth', '.ezh-foot-truth',
                   '.ezh-sf-cap', '.ezh-result-src', '.ezh-hero-sub', '.vcv-eb__cta'];
  out.contrast.rest = await page.evaluate((t) => t.map((s) => window.__probe(s)).filter(Boolean), targets);

  // hover + focus-visible on the primary CTA
  await page.hover('.ezh-npi-submit').catch(() => {});
  await page.waitForTimeout(400);
  out.contrast.ctaHover = await page.evaluate(() => window.__probe('.ezh-npi-submit'));

  await page.evaluate(() => document.querySelector('.ezh-npi-input')?.focus());
  await page.keyboard.press('Tab');
  await page.waitForTimeout(400);
  out.contrast.ctaFocusVisible = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return null;
    const cs = getComputedStyle(el);
    return { active: el.className, fg: cs.color, bg: cs.backgroundColor,
             outline: cs.outlineColor + ' ' + cs.outlineWidth,
             ratio: window.__ratio(window.__parse(cs.color), window.__parse(cs.backgroundColor)) };
  });
  await ctx.close();
}

// ── 3. A-3 at 390 and 480 ────────────────────────────────────────────────────
for (const width of [390, 480]) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.waitForTimeout(900);
  out.a3[width] = await page.evaluate(() => {
    const g = (s) => {
      const el = document.querySelector(s);
      if (!el) return null;
      const b = el.getBoundingClientRect();
      return { w: Math.round(b.width), h: Math.round(b.height) };
    };
    return { input: g('.ezh-npi-input'), submit: g('.ezh-npi-submit'), row: g('.ezh-npi-row') };
  });
  await ctx.close();
}

await browser.close();
console.log(JSON.stringify(out, null, 2));
