// Cross-page consistency capture over every publicly-reachable vitalcv.com page.
// Read-only. Extends design-lab/product-inventory-2026-08-08/capture.mjs to the
// full reachable route set and adds the dimensions a consistency audit needs:
// chrome identity, footer identity, nav link set, page ground (light/dark
// register), heading structure, state-word vocabulary, token systems.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire('/Users/christoler/vitalcv/apps/web/package.json');
const { chromium } = require('@playwright/test');

const ROOT = dirname(fileURLToPath(import.meta.url));
const BASE = 'https://www.vitalcv.com';

const probe = JSON.parse(readFileSync(join(ROOT, 'probe-main.json'), 'utf8'));
const SURFACES = probe
  .filter((p) => p.status === 200)
  .map((p) => ({ path: p.probed, slug: p.probed.replace(/^\//, '').replace(/\//g, '-') || 'home' }));

// EC-3 truth-contract bans (Class A, rejection law) and EC-9 customer-facing
// noun bans (Class A). Clause numbers are R2 (the Constitution's current
// numbering), not the R1 numbers the 2026-08-08 harness used.
const BANNED = [
  ['automatically verified', 'EC-3'], ['guaranteed verification', 'EC-3'],
  ['complete credentialing', 'EC-3'], ['instant credentialing', 'EC-3'],
  ['legally accepted', 'EC-3'], ['risk transferred', 'EC-3'],
  ['final verification without review', 'EC-3'], ['source confirmed before response', 'EC-3'],
  ['certified compliant', 'EC-3'], ['HIPAA compliant', 'EC-3'],
  ['SOC2 certified', 'EC-3'], ['SOC 2 certified', 'EC-3'], ['NPDB', 'EC-3'],
  ['hire instantly', 'EC-3'], ['blockchain', 'EC-3'], ['zero-knowledge', 'EC-3'],
  ['all 50 states', 'EC-3'],
  ['real-time', 'EC-3'], ['always up to date', 'EC-3'],
  ['packet', 'EC-9'], ['artifact', 'EC-9'], ['evidence network', 'EC-9'],
  ['provenance', 'EC-9'], ['holder', 'EC-9'], ['readiness score', 'EC-9'],
  ['passport', 'EC-9'], ['wallet', 'EC-9'], ['trust tier', 'EC-9'],
  ['dossier', 'EC-9'], ['recognition', 'EC-9'], ['lane', 'EC-9'],
  ['MATCHA', 'codename'],
];

const audit = [];

function collect() {
  return ([banned]) => {
    const cs = (el) => (el ? getComputedStyle(el) : null);
    const out = { url: location.href, title: document.title };
    out.metaDescription = document.querySelector('meta[name="description"]')?.content || null;
    out.robots = document.querySelector('meta[name="robots"]')?.content || null;
    out.canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href') || null;
    out.lang = document.documentElement.getAttribute('lang');

    // ---- heading structure ----
    out.headings = {
      h1: [...document.querySelectorAll('h1')].map((h) => h.innerText.trim().replace(/\s+/g, ' ').slice(0, 120)),
      counts: Object.fromEntries([1, 2, 3, 4].map((n) => ['h' + n, document.querySelectorAll('h' + n).length])),
    };

    // ---- page ground (light vs dark register, EC-20) ----
    const bodyBg = cs(document.body)?.backgroundColor;
    const htmlBg = cs(document.documentElement)?.backgroundColor;
    const pick = (c) => {
      const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/.exec(c || '');
      if (!m) return null;
      const [r, g, b] = [+m[1], +m[2], +m[3]];
      return { rgb: [r, g, b], lum: 0.2126 * r + 0.7152 * g + 0.0722 * b };
    };
    const bg = pick(bodyBg)?.lum != null && pick(bodyBg).lum !== 0 ? pick(bodyBg) : pick(htmlBg);
    out.ground = { body: bodyBg, html: htmlBg, luminance: bg?.lum ?? null, register: bg ? (bg.lum < 90 ? 'dark' : 'light') : null };
    out.ink = cs(document.body)?.color;

    // ---- typography ----
    out.fonts = {
      body: cs(document.body)?.fontFamily,
      h1: cs(document.querySelector('h1'))?.fontFamily || null,
      h1Size: cs(document.querySelector('h1'))?.fontSize || null,
      mono: cs(document.querySelector('code,pre,[class*="mono"],[class*="Mono"]'))?.fontFamily || null,
    };
    out.bodyTransition = cs(document.body)?.transitionDuration;

    // ---- chrome identity ----
    const headers = [...document.querySelectorAll('header')];
    out.chrome = headers.map((h) => {
      const r = h.getBoundingClientRect();
      const c = cs(h);
      return {
        cls: h.className?.toString?.().slice(0, 140) || '',
        height: Math.round(r.height), top: Math.round(r.top),
        position: c.position, background: c.backgroundColor,
        backdrop: c.backdropFilter, borderBottom: c.borderBottomWidth + ' ' + c.borderBottomColor,
        linkCount: h.querySelectorAll('a').length,
        links: [...h.querySelectorAll('a')].map((a) => (a.innerText || a.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ')).filter(Boolean).slice(0, 14),
      };
    });
    out.navCount = document.querySelectorAll('nav').length;
    const foot = document.querySelector('footer');
    out.footer = foot ? {
      cls: foot.className?.toString?.().slice(0, 120) || '',
      height: Math.round(foot.getBoundingClientRect().height),
      linkCount: foot.querySelectorAll('a').length,
      firstLinks: [...foot.querySelectorAll('a')].map((a) => a.innerText.trim()).filter(Boolean).slice(0, 10),
    } : null;

    // ---- primary CTA / button grammar ----
    out.buttons = [...document.querySelectorAll('button, a[class*="btn"], a[class*="Button"], [role="button"]')]
      .map((b) => {
        const c = cs(b); const r = b.getBoundingClientRect();
        return {
          text: (b.innerText || b.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 50),
          radius: c.borderRadius, bg: c.backgroundColor, h: Math.round(r.height),
        };
      }).filter((b) => b.text).slice(0, 40);

    // ---- pill census (EC-20: pills retired, radius 0-3px locked) ----
    out.pills = [...document.querySelectorAll('body *')].filter((el) => {
      if (el.children.length > 2) return false;
      const r = el.getBoundingClientRect();
      if (r.height === 0 || r.height > 56 || r.width > 420) return false;
      const br = getComputedStyle(el).borderRadius; const px = parseFloat(br);
      if (!(br.includes('9999') || px >= 200 || (px > 0 && px >= r.height / 2 && px >= 12))) return false;
      const t = (el.innerText || '').trim();
      return t.length > 0 && t.length <= 40;
    }).slice(0, 80).map((el) => ({ text: el.innerText.trim().slice(0, 40), radius: getComputedStyle(el).borderRadius }));

    // ---- radius census across substantial panels (EC-20 card grammar) ----
    const radii = {};
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.width < 140 || r.height < 60) continue;
      const c = getComputedStyle(el);
      if (c.borderWidth === '0px' && c.backgroundColor === 'rgba(0, 0, 0, 0)' && c.boxShadow === 'none') continue;
      const k = c.borderTopLeftRadius;
      radii[k] = (radii[k] || 0) + 1;
    }
    out.panelRadii = radii;
    out.shadowed = [...document.querySelectorAll('body *')].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 140 && r.height > 60 && getComputedStyle(el).boxShadow !== 'none';
    }).length;

    // ---- banned copy ----
    const text = document.body.innerText;
    out.textLen = text.length;
    out.bannedHits = [];
    for (const [phrase, clause] of banned) {
      const re = new RegExp('\\b' + phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'gi');
      let m; let n = 0;
      while ((m = re.exec(text)) && n < 4) {
        out.bannedHits.push({ phrase, clause, ctx: text.slice(Math.max(0, m.index - 40), m.index + phrase.length + 40).replace(/\s+/g, ' ') });
        n++;
      }
    }

    // ---- state vocabulary: short uppercase/status-shaped words ----
    const stateWords = new Set();
    for (const el of document.querySelectorAll('[data-lane-key],[class*="badge"],[class*="Badge"],[class*="chip"],[class*="Chip"],[class*="status"],[class*="Status"],[class*="lane"],[class*="state"]')) {
      const t = (el.innerText || '').trim().replace(/\s+/g, ' ');
      if (t && t.length <= 34) stateWords.add(t);
    }
    out.stateWords = [...stateWords].slice(0, 60);

    // ---- era / token systems ----
    const n = (sel) => document.querySelectorAll(sel).length;
    out.era = {
      mz: n('.mz, [class^="mz-"], [class*=" mz-"]'),
      w14: n('[class^="w14"], [class*=" w14"]'),
      w1505: n('[class*="w1505"]'),
      vds: n('[class^="vds"], [class*=" vds"]'),
      vcv: n('[class^="vcv"], [class*=" vcv"]'),
      ag: n('[class^="ag-"], [class*=" ag-"], [data-antigravity]'),
      matcha: n('[class*="matcha"], [class*="zen-"]'),
      canvas: n('canvas'),
      tailwindish: n('[class*="rounded-"]'),
    };
    // token systems actually *resolved* on this page
    const probeEl = document.documentElement;
    const prefixes = ['--vt-', '--ag-', '--vital-', '--trust-', '--palette-', '--mz-', '--infra-', '--vcv-', '--ops-', '--vds-'];
    const rs = getComputedStyle(probeEl);
    out.tokenSystems = {};
    for (const p of prefixes) {
      // sample a few known-ish names is unreliable; instead count from inline style attr
      out.tokenSystems[p] = (probeEl.getAttribute('style') || '').split(p).length - 1;
    }

    out.scroll = { docWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth, docHeight: document.documentElement.scrollHeight };
    const small = [...document.querySelectorAll('a[href], button, input, select, [role="button"]')].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.height > 0 && r.width > 0 && r.height < 43.5;
    });
    out.smallTargets = { count: small.length, sample: small.slice(0, 6).map((el) => (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 34)) };

    // ---- focus visibility spot-check (EC-5) ----
    const firstLink = document.querySelector('a[href]');
    out.focusOutlineNoneCount = [...document.querySelectorAll('a[href], button')].filter((el) => {
      const c = getComputedStyle(el);
      return c.outlineStyle === 'none' && c.outlineWidth === '0px';
    }).length;

    out.links = [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href'));
    return out;
  };
}

async function capture(browser, s) {
  const url = BASE + s.path;
  const rec = { slug: s.slug, path: s.path, console: [], failed: [] };
  console.log(`=== ${s.path}`);
  for (const [name, vp] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, isMobile: name === 'mobile', hasTouch: name === 'mobile' });
    const page = await ctx.newPage();
    if (name === 'desktop') {
      page.on('console', (m) => { if (m.type() === 'error') rec.console.push(m.text().slice(0, 200)); });
      page.on('pageerror', (e) => rec.console.push('pageerror: ' + String(e).slice(0, 200)));
      page.on('response', (r) => { if (r.status() >= 400) rec.failed.push(r.url().slice(0, 160) + ' ' + r.status()); });
    }
    try {
      const resp = await page.goto(url, { waitUntil: 'load', timeout: 45000 });
      if (name === 'desktop') rec.httpStatus = resp?.status();
      await page.evaluate(() => document.fonts.ready).catch(() => {});
      await page.waitForTimeout(3000);
      rec[name] = await page.evaluate(collect(), [BANNED]);
    } catch (e) {
      rec[name + 'Error'] = String(e).slice(0, 200);
      console.warn('  ' + name + ' FAIL');
    }
    await ctx.close();
  }
  audit.push(rec);
}

const browser = await chromium.launch();
for (const s of SURFACES) await capture(browser, s);
await browser.close();
writeFileSync(join(ROOT, 'audit-full.json'), JSON.stringify(audit, null, 1));
console.log(`\ndone — ${audit.length} surfaces`);
