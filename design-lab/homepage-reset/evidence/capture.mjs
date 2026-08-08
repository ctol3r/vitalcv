// Founder-evidence capture harness — homepage reset concept wave.
// Run: node design-lab/homepage-reset/evidence/capture.mjs [a|b|c|all]
// Requires the lab server on http://localhost:4870 (python3 -m http.server).
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire('/Users/christoler/vitalcv/apps/web/package.json');
const { chromium } = require('@playwright/test');

const EV = dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:4870';

// Per-direction tuning: playMs = full explainer duration once play() is called;
// midMs = wait before the "mid-animation" shot; explainer = selector of the animated surface.
const DIRECTIONS = {
  a: { slug: 'direction-a', explainer: '#how-it-works', playMs: 16000, midMs: 6000, scrollY: 1600, sticky: true },
  b: { slug: 'direction-b', explainer: '#hero',         playMs: 18500, midMs: 12200, scrollY: 1600, sticky: false, preplay: true },
  c: { slug: 'direction-c', explainer: '#how-it-works', playMs: 8000, midMs: 1600, scrollY: 1600, sticky: false },
};

// For sticky scroll-track explainers, element screenshots stitch the sticky stage into
// nonsense — use fixed-scroll viewport shots instead.
async function explainerShot(page, cfg, path) {
  if (cfg.sticky) { await page.screenshot({ path }); console.log('  saved', path.split('/evidence/')[1]); }
  else await elementShot(page, cfg.explainer, path);
}

async function gotoExplainer(page, cfg) {
  if (cfg.sticky) {
    await page.evaluate((sel) => {
      const t = document.querySelector(sel);
      if (t) window.scrollTo(0, t.offsetTop + 10);
    }, cfg.explainer);
  } else {
    const el = page.locator(cfg.explainer).first();
    if ((await el.count()) > 0) await el.scrollIntoViewIfNeeded();
  }
}

const settle = (page, ms = 700) => page.waitForTimeout(ms);

async function fontsReady(page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
}

async function shot(page, path, opts = {}) {
  await page.screenshot({ path, ...opts });
  console.log('  saved', path.split('/evidence/')[1]);
}

async function elementShot(page, sel, path) {
  const el = page.locator(sel).first();
  if ((await el.count()) === 0) { console.warn('  MISSING', sel); return; }
  await el.screenshot({ path });
  console.log('  saved', path.split('/evidence/')[1]);
}

async function play(page) {
  await page.evaluate(() => window.__reset?.play?.());
}

async function captureDirection(key) {
  const cfg = DIRECTIONS[key];
  const out = join(EV, cfg.slug);
  mkdirSync(out, { recursive: true });
  const url = `${BASE}/${cfg.slug}/?capture=1`;
  const browser = await chromium.launch();
  console.log(`\n=== ${cfg.slug} ===`);

  // ---------- DESKTOP 1440x900 ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'load' });
    await fontsReady(page);
    await settle(page, 900);
    await shot(page, join(out, 'desktop-01-hero.png'));
    await shot(page, join(out, 'desktop-02-eyebrow-top.png'), { clip: { x: 0, y: 0, width: 1440, height: 96 } });

    // Explainer: before / mid / final — capture harness drives the sequence via __reset.play()
    const ex = page.locator(cfg.explainer).first();
    if ((await ex.count()) > 0) {
      await gotoExplainer(page, cfg);
      await settle(page, 400);
      if (cfg.preplay) {
        // autoplaying surface: restart via play() and shoot the opening frame
        await play(page);
        await page.waitForTimeout(350);
        await explainerShot(page, cfg, join(out, 'desktop-03-explainer-before.png'));
        await page.waitForTimeout(Math.max(0, cfg.midMs - 350));
      } else {
        await explainerShot(page, cfg, join(out, 'desktop-03-explainer-before.png'));
        await play(page);
        await page.waitForTimeout(cfg.midMs);
      }
      await explainerShot(page, cfg, join(out, 'desktop-04-explainer-mid.png'));
      await page.waitForTimeout(Math.max(0, cfg.playMs - cfg.midMs) + 1200);
      await explainerShot(page, cfg, join(out, 'desktop-05-explainer-final.png'));
    } else console.warn('  MISSING explainer', cfg.explainer);

    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), cfg.scrollY);
    await settle(page, 600);
    await shot(page, join(out, 'desktop-06-eyebrow-scrolled.png'), { clip: { x: 0, y: 0, width: 1440, height: 96 } });

    for (const [sel, name] of [['#ownership', 'desktop-07-ownership.png'], ['#employers', 'desktop-08-employer-doorway.png'], ['#start', 'desktop-09-final-cta.png']]) {
      const el = page.locator(sel).first();
      if ((await el.count()) > 0) { await el.scrollIntoViewIfNeeded(); await settle(page, 800); await elementShot(page, sel, join(out, name)); }
      else console.warn('  MISSING', sel);
    }

    // eyebrow over the outcome + employer bands (captures inversion where a direction inverts)
    for (const [sel, name] of [['#outcome', 'desktop-06b-eyebrow-over-outcome.png'], ['#employers', 'desktop-06c-eyebrow-over-employers.png']]) {
      const band = page.locator(sel).first();
      if ((await band.count()) > 0) {
        await page.evaluate((s) => { const o = document.querySelector(s); window.scrollTo(0, o.offsetTop + 60); }, sel);
        await settle(page, 800);
        await shot(page, join(out, name), { clip: { x: 0, y: 0, width: 1440, height: 96 } });
      }
    }

    // full-page: pin the fixed/sticky eyebrow so stitching doesn't smear it mid-page
    await page.addStyleTag({ content: '#eyebrow{position:absolute !important;top:0 !important}' });
    await page.evaluate(() => window.scrollTo(0, 0));
    await settle(page, 400);
    await shot(page, join(out, 'desktop-10-full-page.png'), { fullPage: true });
    await ctx.close();
  }

  // ---------- MOBILE 390x844 ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'load' });
    await fontsReady(page);
    await settle(page, 900);
    await shot(page, join(out, 'mobile-01-hero.png'));
    await shot(page, join(out, 'mobile-02-eyebrow.png'), { clip: { x: 0, y: 0, width: 390, height: 88 } });
    const ex = page.locator(cfg.explainer).first();
    if ((await ex.count()) > 0) {
      await gotoExplainer(page, cfg);
      await settle(page, 400);
      await play(page);
      await page.waitForTimeout(cfg.playMs + 1200);
      await explainerShot(page, cfg, join(out, 'mobile-03-explainer.png'));
    }
    for (const [sel, name] of [['#ownership', 'mobile-04-agent-work.png'], ['#employers', 'mobile-05-employer-entry.png'], ['#start', 'mobile-06-final-cta.png']]) {
      const el = page.locator(sel).first();
      if ((await el.count()) > 0) { await el.scrollIntoViewIfNeeded(); await settle(page, 800); await elementShot(page, sel, join(out, name)); }
    }
    await page.addStyleTag({ content: '#eyebrow{position:absolute !important;top:0 !important}' });
    await shot(page, join(out, 'mobile-07-full-page.png'), { fullPage: true });
    await ctx.close();
  }

  // ---------- REDUCED MOTION (desktop) ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'load' });
    await fontsReady(page);
    await settle(page, 900);
    await elementShot(page, cfg.explainer, join(out, 'reduced-motion-explainer.png'));
    await page.addStyleTag({ content: '#eyebrow{position:absolute !important;top:0 !important}' });
    await shot(page, join(out, 'reduced-motion-full-page.png'), { fullPage: true });
    await ctx.close();
  }

  // ---------- MOTION RECORDING (desktop, continuous) ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: out, size: { width: 1440, height: 900 } } });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'load' });
    await fontsReady(page);
    await settle(page, 1200);                    // eyebrow + hero at rest
    const ex = page.locator(cfg.explainer).first();
    if ((await ex.count()) > 0) { await ex.scrollIntoViewIfNeeded(); await settle(page, 600); }
    await play(page);                            // how-it-works sequence
    await page.waitForTimeout(cfg.playMs + 1500);
    // slow scroll through the rest: eyebrow behavior + section transitions
    await page.evaluate(async () => {
      const total = document.body.scrollHeight - innerHeight;
      let y = window.scrollY;
      while (y < total) { y = Math.min(y + 14, total); window.scrollTo(0, y); await new Promise(r => setTimeout(r, 16)); }
    });
    await settle(page, 1500);
    const video = page.video();
    await ctx.close();
    const vp = await video.path();
    const { execSync } = await import('node:child_process');
    execSync(`/opt/homebrew/bin/ffmpeg -y -loglevel error -i "${vp}" -c:v libx264 -pix_fmt yuv420p -crf 23 "${join(out, 'motion.mp4')}"`);
    execSync(`rm -f "${vp}"`);
    console.log('  saved', cfg.slug + '/motion.mp4');
  }

  await browser.close();
}

const arg = (process.argv[2] || 'all').toLowerCase();
const keys = arg === 'all' ? ['a', 'b', 'c'] : [arg];
for (const k of keys) await captureDirection(k);
console.log('\ndone');
