import fs from 'node:fs';
const { chromium } = await import('file:///Users/christoler/vitalcv/apps/web/node_modules/@playwright/test/index.mjs');

const BASE = process.env.BASE || 'http://localhost:3097';
const OUT = process.env.OUT || '/private/tmp/claude-501/-Users-christoler-vitalcv/d135b0bd-0347-41fb-b42e-2a23c990c698/scratchpad/vcv';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(BASE + '/', { waitUntil: 'load', timeout: 90000 });
await page.waitForTimeout(4000);

const facts = {};
facts.rest = await page.evaluate(() => {
  const read = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const c = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return { rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      bg: c.backgroundColor, color: c.color, border: c.border, radius: c.borderRadius, fs: c.fontSize, fw: c.fontWeight };
  };
  return {
    header: read('header.vcv-eb'),
    wordmark: read('.vcv-eb__wordmark'),
    controls: read('.vcv-eb__controls'),
    signin: read('.vcv-eb__signin'),
    cta: read('.vcv-eb__cta'),
    lookup: read('.vcv-eb__lookup'),
    menuBtn: read('.vcv-eb__menu-btn'),
    theme: document.querySelector('header.vcv-eb')?.getAttribute('data-eb-theme'),
  };
});

await page.screenshot({ path: `${OUT}/desktop-hero.png`, clip: { x: 0, y: 0, width: 1440, height: 160 } });
await page.screenshot({ path: `${OUT}/desktop-full.png`, clip: { x: 0, y: 0, width: 1440, height: 900 } });

// hover
await page.locator('.vcv-eb__cta').hover();
await page.waitForTimeout(500);
facts.ctaHover = await page.locator('.vcv-eb__cta').evaluate((el) => {
  const c = getComputedStyle(el); return { bg: c.backgroundColor, color: c.color };
});
await page.screenshot({ path: `${OUT}/desktop-hover.png`, clip: { x: 900, y: 0, width: 540, height: 160 } });

// light band
await page.evaluate(() => {
  const el = document.querySelector('.ezh-emp');
  if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + 200, behavior: 'instant' });
});
await page.waitForTimeout(1500);
facts.lightBand = await page.evaluate(() => {
  const h = document.querySelector('header.vcv-eb');
  const cta = document.querySelector('.vcv-eb__cta');
  const icon = document.querySelector('.vcv-eb__icon-btn');
  const wm = document.querySelector('.vcv-eb__wordmark');
  const g = (el) => el ? { bg: getComputedStyle(el).backgroundColor, color: getComputedStyle(el).color, border: getComputedStyle(el).border } : null;
  return { theme: h?.getAttribute('data-eb-theme'), cta: g(cta), icon: g(icon), wordmark: g(wm) };
});
await page.screenshot({ path: `${OUT}/desktop-light-band.png`, clip: { x: 0, y: 0, width: 1440, height: 160 } });

// menu
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
await page.waitForTimeout(600);
await page.evaluate(() => document.querySelector('nextjs-portal')?.remove());
await page.locator('.vcv-eb__menu-btn').click();
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/desktop-menu.png` });
facts.menu = await page.evaluate(() => {
  const m = document.querySelector('#vcv-eb-menu');
  if (!m) return null;
  const c = getComputedStyle(m);
  const lbl = m.querySelector('.vcv-eb-menu__label');
  const link = m.querySelector('.vcv-eb-menu__link-label');
  const det = m.querySelector('.vcv-eb-menu__detail');
  const g = (el) => el ? { fs: getComputedStyle(el).fontSize, fw: getComputedStyle(el).fontWeight, color: getComputedStyle(el).color, lh: getComputedStyle(el).lineHeight, tt: getComputedStyle(el).textTransform } : null;
  return { bg: c.backgroundColor, padding: c.padding, label: g(lbl), link: g(link), detail: g(det),
    menuBtnBg: getComputedStyle(document.querySelector('.vcv-eb__menu-btn')).backgroundColor,
    headerTheme: document.querySelector('header.vcv-eb')?.getAttribute('data-eb-theme') };
});
await page.keyboard.press('Escape');
await page.waitForTimeout(600);

// off-home
await page.goto(BASE + '/pricing', { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/desktop-pricing.png`, clip: { x: 0, y: 0, width: 1440, height: 500 } });

// mobile
const mp = await browser.newPage({ viewport: { width: 390, height: 844 } });
await mp.goto(BASE + '/', { waitUntil: 'load', timeout: 90000 });
await mp.waitForTimeout(3500);
await mp.screenshot({ path: `${OUT}/mobile-hero.png` });
facts.mobile = await mp.evaluate(() => {
  const r = (sel) => { const el = document.querySelector(sel); if (!el) return null; const b = el.getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
  return { wordmark: r('.vcv-eb__wordmark'), controls: r('.vcv-eb__controls'), cta: r('.vcv-eb__cta'), menuBtn: r('.vcv-eb__menu-btn'),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
});
await mp.evaluate(() => document.querySelector('nextjs-portal')?.remove());
await mp.locator('.vcv-eb__menu-btn').click();
await mp.waitForTimeout(1000);
await mp.screenshot({ path: `${OUT}/mobile-menu.png` });

fs.writeFileSync(`${OUT}/facts.json`, JSON.stringify(facts, null, 2));
console.log(JSON.stringify(facts, null, 2));
await browser.close();
