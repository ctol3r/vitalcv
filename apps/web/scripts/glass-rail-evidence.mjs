// Founder-gate evidence + painted-pixel contrast for the glass nav rail.
// Runs against a LOCAL PRODUCTION server (next start), per FOUNDER_VISUAL_GATE §3.
//   node scripts/glass-rail-evidence.mjs
import { chromium } from '@playwright/test';
import { PNG } from 'pngjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3077';
const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../docs/design/evidence/glass-rail-2026-08-16',
);
mkdirSync(OUT, { recursive: true });

// ── WCAG contrast from real painted pixels ──────────────────────────────────
const srgbToLin = (c) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const lum = (r, g, b) => 0.2126 * srgbToLin(r) + 0.7152 * srgbToLin(g) + 0.0722 * srgbToLin(b);
const ratio = (l1, l2) => (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);

// Decode an element screenshot and read the darkest text cluster vs the modal
// background — the actual composited result (frost + blur + page content).
async function paintedContrast(locator) {
  const buf = await locator.screenshot();
  const png = PNG.sync.read(buf);
  const hist = new Map(); // quantized luminance → count, with a representative rgb
  for (let i = 0; i < png.data.length; i += 4) {
    const r = png.data[i], g = png.data[i + 1], b = png.data[i + 2], a = png.data[i + 3];
    if (a < 250) continue;
    const l = lum(r, g, b);
    const key = Math.round(l * 200); // 0..200 buckets
    const e = hist.get(key) ?? { count: 0, l, r, g, b };
    e.count += 1;
    hist.set(key, e);
  }
  const buckets = [...hist.values()];
  if (buckets.length < 2) return null;
  // Background = the most frequent bucket.
  const bg = buckets.reduce((a, c) => (c.count > a.count ? c : a));
  // Text = the bucket furthest in luminance from bg that still has real ink
  // (>=0.4% of pixels), so a stray anti-aliased pixel is not treated as text.
  const total = buckets.reduce((s, c) => s + c.count, 0);
  const inkCandidates = buckets.filter((c) => c.count >= total * 0.004 && c !== bg);
  if (inkCandidates.length === 0) return null;
  const text = inkCandidates.reduce((a, c) =>
    Math.abs(c.l - bg.l) > Math.abs(a.l - bg.l) ? c : a,
  );
  return {
    ratio: +ratio(text.l, bg.l).toFixed(2),
    text: `rgb(${text.r},${text.g},${text.b})`,
    background: `rgb(${bg.r},${bg.g},${bg.b})`,
  };
}

async function shot(page, name) {
  await page.screenshot({ path: join(OUT, name) });
  console.log('  shot', name);
}

const rail = (page) => page.locator('nav.vcv-eb__rail');

const run = async () => {
  const browser = await chromium.launch();
  const contrast = {};

  // ── 1440 desktop, at rest (over warm paper) ───────────────────────────────
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.vcv-eb__wordmark');
    await shot(page, 'after-1440-rest.png');

    // scrolled state — content moves under the glass
    await page.evaluate(() => window.scrollTo({ top: 1400, behavior: 'instant' }));
    await page.waitForTimeout(400);
    await shot(page, 'after-1440-scrolled.png');
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(200);

    // painted-pixel contrast over the light (paper-frost) register
    contrast['1440 light · wordmark'] = await paintedContrast(page.locator('.vcv-eb__wordmark'));
    contrast['1440 light · nav link'] = await paintedContrast(page.locator('.vcv-eb__link').first());
    contrast['1440 light · sign-in'] = await paintedContrast(page.locator('.vcv-eb__signin'));
    contrast['1440 light · action (filled)'] = await paintedContrast(page.locator('.vcv-eb__cta'));

    // focus-visible ring on every rail control (keyboard)
    const controls = ['.vcv-eb__wordmark', '.vcv-eb__link', '.vcv-eb__signin', '.vcv-eb__verify', '.vcv-eb__cta', '.vcv-eb__menu-btn'];
    for (const sel of controls) {
      await page.locator(sel).first().focus();
      await page.waitForTimeout(120);
      await shot(page, `after-1440-focus-${sel.replace(/[^a-z]/gi, '')}.png`);
    }

    // takeover open — the rail floating over the DARK mega-menu
    await page.locator('.vcv-eb__menu-btn').click();
    await page.waitForSelector('#vcv-eb-menu');
    await page.waitForTimeout(300);
    await shot(page, 'after-1440-menu-open.png');
    // focus trap demonstration: tab a few times, ring visible in-header
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.waitForTimeout(120);
    await shot(page, 'after-1440-menu-focus-trap.png');
    // contrast over the dark register (rail on ink) + overlay
    contrast['1440 dark · wordmark (rail on ink)'] = await paintedContrast(page.locator('.vcv-eb__wordmark'));
    contrast['1440 dark · menu link'] = await paintedContrast(page.locator('.vcv-eb-menu__link-label').first());
    contrast['1440 dark · menu close ✕'] = await paintedContrast(page.locator('.vcv-eb-menu__close'));
    await page.close();
  }

  // ── 768 tablet ────────────────────────────────────────────────────────────
  {
    const page = await browser.newPage({ viewport: { width: 768, height: 1024 } });
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.vcv-eb__wordmark');
    await shot(page, 'after-768-rest.png');
    await page.close();
  }

  // ── 390 mobile, rest + menu ───────────────────────────────────────────────
  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.vcv-eb__wordmark');
    await shot(page, 'after-390-rest.png');
    await page.locator('.vcv-eb__menu-btn').click();
    await page.waitForSelector('#vcv-eb-menu');
    await page.waitForTimeout(300);
    await shot(page, 'after-390-menu-open.png');
    await page.close();
  }

  // ── 1728 wide ─────────────────────────────────────────────────────────────
  {
    const page = await browser.newPage({ viewport: { width: 1728, height: 1117 } });
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.vcv-eb__wordmark');
    await shot(page, 'after-1728-rest.png');
    await page.close();
  }

  // ── reduced motion ────────────────────────────────────────────────────────
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.vcv-eb__wordmark');
    await shot(page, 'after-1440-reduced-motion.png');
    await page.close();
  }

  // ── 200% zoom reflow (1440 → 720 CSS px) ──────────────────────────────────
  {
    const page = await browser.newPage({ viewport: { width: 720, height: 900 } });
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.vcv-eb__wordmark');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    await shot(page, 'after-720-zoom200-reflow.png');
    contrast['__zoom200_horizontal_overflow_px'] = overflow;
    await page.close();
  }

  // ── off-home: /employers over paper (no overlap check) ────────────────────
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`${BASE}/employers`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.vcv-eb__wordmark');
    await shot(page, 'after-1440-employers.png');
    await page.close();
  }

  // ── recordings: the takeover open/close, desktop + mobile + reduced-motion ──
  for (const [w, h, tag, reduced] of [
    [1440, 900, 'desktop', false],
    [390, 844, 'mobile', false],
    [1440, 900, 'reduced-motion', true],
  ]) {
    const ctx = await browser.newContext({
      viewport: { width: w, height: h },
      recordVideo: { dir: join(OUT, `video-${tag}`), size: { width: w, height: h } },
      reducedMotion: reduced ? 'reduce' : 'no-preference',
    });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.vcv-eb__wordmark');
    await page.waitForTimeout(600);
    await page.locator('.vcv-eb__menu-btn').click();      // open
    await page.waitForSelector('#vcv-eb-menu');
    await page.waitForTimeout(900);
    await page.keyboard.press('Tab');                      // focus trap visible
    await page.keyboard.press('Tab');
    await page.waitForTimeout(600);
    await page.keyboard.press('Escape');                   // close
    await page.waitForTimeout(900);
    await page.close();
    await ctx.close();
    console.log('  recorded', `video-${tag}`);
  }

  writeFileSync(join(OUT, 'contrast.json'), `${JSON.stringify(contrast, null, 2)}\n`);
  console.log('\nPainted-pixel contrast (WCAG, from real screenshots):');
  for (const [k, v] of Object.entries(contrast)) {
    if (k.startsWith('__')) { console.log(`  ${k}: ${v}`); continue; }
    console.log(`  ${k}: ${v ? `${v.ratio}:1  (${v.text} on ${v.background})` : 'n/a'}`);
  }
  await browser.close();
};

run().catch((e) => { console.error(e); process.exit(1); });
