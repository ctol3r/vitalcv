// Amendment F rendered measurements — contrast, touch targets, figure floor,
// overflow, focus visibility — against the production build on :3311.
// Run from apps/web: node scripts/measure-f-evidence.mjs
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const OUT = '../../docs/design/evidence/home-v4-2026-08-16';
mkdirSync(OUT, { recursive: true });
const base = 'http://localhost:3311/';
const report = [];
const browser = await chromium.launch();

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(base, { waitUntil: 'networkidle' });
await page.waitForTimeout(2600);
await page.evaluate(async () => {
  for (let y = 0; y < document.body.scrollHeight; y += 500) {
    window.scrollTo(0, y);
    await new Promise((r) => setTimeout(r, 80));
  }
  window.scrollTo(0, 0);
});
await page.waitForTimeout(2400);

// ── measured contrast of key painted pairs (computed rgb, not token values) ──
const contrastReport = await page.evaluate(() => {
  const lum = (r, g, b) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const parse = (c) => {
    const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
  };
  const bgOf = (el) => {
    let node = el;
    while (node) {
      const c = parse(getComputedStyle(node).backgroundColor);
      if (c && c.a > 0.95) return c;
      node = node.parentElement;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  };
  const ratio = (fg, bg) => {
    const [hi, lo] = [lum(fg.r, fg.g, fg.b), lum(bg.r, bg.g, bg.b)].sort((a, b) => b - a);
    return ((hi + 0.05) / (lo + 0.05)).toFixed(2);
  };
  const probe = (label, sel) => {
    const el = document.querySelector(sel);
    if (!el) return `${label}: NOT FOUND (${sel})`;
    const fg = parse(getComputedStyle(el).color);
    if (!fg) return `${label}: unparsed color ${getComputedStyle(el).color}`;
    return `${label}: ${ratio(fg, bgOf(el))}:1 (color ${getComputedStyle(el).color})`;
  };
  return [
    probe('h1 on ground', '.ezh h1'),
    probe('hero lede', '.ezh .ezh-lede'),
    probe('micro-label (ezh-k)', '.ezh .ezh-k'),
    probe('NPI count (mono)', '.ezh .ezh-npi-count'),
    probe('NPI fine print', '.ezh .ezh-npi-fine'),
    probe('primary action label', '.ezh [data-home-primary-cta]'),
    probe('ledger claim', '.ezh .ezh-lrow-claim'),
    probe('ledger source line', '.ezh .ezh-lrow-src'),
    probe('state stamp word', '.ezh .ezh-stamp'),
    probe('tally caption', '.ezh .ezh-res-caption'),
    probe('beat body', '.ezh .ezh-beat p'),
    probe('packet refuses item', '.ezh .ezh-pkt-not li span'),
    probe('legend note', '.ezh .ezh-legend-note'),
    probe('truth boundary', '.ezh .ezh-truth'),
    probe('footer cadence', '.ezh .ezh-foot-truth'),
    probe('footer link', '.ezh .ezh-foot-links a'),
    probe('quiet link (signal)', '.ezh .ezh-quiet-link'),
    probe('secondary hero link', '.ezh .ezh-hero-opportunity'),
  ];
});
report.push('── measured contrast (painted, 1440) ──', ...contrastReport, '');

// ── touch targets: every interactive element in the island ──────────────────
const targets = await page.evaluate(() => {
  const out = [];
  for (const el of document.querySelectorAll('main.ezh a, main.ezh button, main.ezh input, main.ezh summary')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue; // display:none variant
    out.push({
      what: `${el.tagName.toLowerCase()} "${(el.textContent || el.id || '').trim().slice(0, 40)}"`,
      w: Math.round(r.width),
      h: Math.round(r.height),
      ok: r.height >= 44 || r.width >= 44 * 2, // 44px floor (EC-5)
    });
  }
  return out;
});
const small = targets.filter((t) => t.h < 44);
report.push('── touch targets (island, 1440) — floor 44px tall ──');
report.push(`total interactive: ${targets.length}; under 44px tall: ${small.length}`);
for (const t of small) report.push(`  UNDER: ${t.what} — ${t.w}×${t.h}`);
report.push('');

// ── figure text floor at the narrow widths ──────────────────────────────────
for (const w of [1440, 768, 390, 375, 360]) {
  await page.setViewportSize({ width: w, height: 900 });
  await page.waitForTimeout(250);
  const m = await page.evaluate(() => {
    let min = Infinity;
    let where = 'none';
    for (const svg of document.querySelectorAll('.ezh-fig-art svg, .ezh-beat-fig svg')) {
      const rect = svg.getBoundingClientRect();
      if (rect.width === 0) continue;
      const vb = svg.viewBox.baseVal;
      if (!vb || vb.width === 0) continue;
      const scale = rect.width / vb.width;
      for (const t of svg.querySelectorAll('text')) {
        const e = parseFloat(getComputedStyle(t).fontSize) * scale;
        if (e < min) { min = e; where = (t.textContent || '').slice(0, 28); }
      }
    }
    return { min: min.toFixed(2), where };
  });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  report.push(`@${w}px — min effective figure text: ${m.min}px ("${m.where}") · horizontal overflow: ${overflow}px`);
}
report.push('');

// ── focus visibility on the primary action and the NPI field ────────────────
await page.setViewportSize({ width: 1440, height: 900 });
await page.waitForTimeout(300);
const focusReport = await page.evaluate(() => {
  const probe = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return `${sel}: NOT FOUND`;
    el.focus();
    const s = getComputedStyle(el);
    return `${sel}: outline ${s.outlineWidth} ${s.outlineStyle} ${s.outlineColor}, offset ${s.outlineOffset}`;
  };
  return [probe('#ezh-npi'), probe('[data-home-primary-cta]'), probe('.ezh-hero-opportunity')];
});
report.push('── focus (programmatic :focus computed outline) ──', ...focusReport, '');
await page.keyboard.press('Tab');
await page.keyboard.press('Tab');
await page.keyboard.press('Tab');
await page.screenshot({ path: `${OUT}/after-focus-visible-1440.png`, fullPage: false });

await page.close();
await browser.close();
writeFileSync(`${OUT}/measurements.txt`, report.join('\n') + '\n');
console.log(report.join('\n'));
