const { chromium } = await import('file:///Users/christoler/vitalcv/apps/web/node_modules/@playwright/test/index.mjs');
const BASE = 'http://localhost:3097';
const OUT = '/private/tmp/claude-501/-Users-christoler-vitalcv/d135b0bd-0347-41fb-b42e-2a23c990c698/scratchpad/vcv';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(BASE + '/', { waitUntil: 'load', timeout: 90000 });
await page.waitForTimeout(3500);
await page.evaluate(() => document.querySelector('nextjs-portal')?.remove());
await page.mouse.move(700, 700);

const facts = await page.evaluate(() => {
  const r = (sel, i = 0) => {
    const els = document.querySelectorAll(sel);
    const el = els[i === -1 ? els.length - 1 : i];
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
  };
  const hits = Array.from(document.querySelectorAll('header.vcv-eb a[href], header.vcv-eb button')).map((el) => {
    const b = el.getBoundingClientRect();
    return { cls: el.className.split(' ')[0], w: Math.round(b.width), h: Math.round(b.height), clearsFloor: b.width >= 44 && b.height >= 44 };
  });
  return {
    painted: { wordmark: r('.vcv-eb__wordmark'), ctaBox: r('.vcv-eb__cta-box'), instrFirst: r('.vcv-eb__instr', 0), instrLast: r('.vcv-eb__instr', -1) },
    hitAreas: hits,
    fusedGap: (() => {
      const a = document.querySelectorAll('.vcv-eb__instr');
      if (a.length < 2) return null;
      const f = a[0].getBoundingClientRect(), s = a[1].getBoundingClientRect();
      return Math.round(s.x - (f.x + f.width));
    })(),
  };
});
console.log(JSON.stringify(facts, null, 1));
await page.screenshot({ path: `${OUT}/desktop-hero.png`, clip: { x: 0, y: 0, width: 1440, height: 160 } });
await page.screenshot({ path: `${OUT}/desktop-full.png`, clip: { x: 0, y: 0, width: 1440, height: 900 } });
await page.locator('.vcv-eb__cta').hover();
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/desktop-hover.png`, clip: { x: 900, y: 0, width: 540, height: 160 } });
await page.mouse.move(700, 700);
await page.waitForTimeout(400);
await page.evaluate(() => { const el = document.querySelector('.ezh-emp'); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + 200, behavior: 'instant' }); });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/desktop-light-band.png`, clip: { x: 0, y: 0, width: 1440, height: 160 } });
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
await page.waitForTimeout(600);
await page.locator('.vcv-eb__menu-btn').click();
await page.waitForTimeout(1200);
await page.screenshot({ path: `${OUT}/desktop-menu.png` });
await page.keyboard.press('Escape');
await page.goto(BASE + '/pricing', { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(2500);
await page.evaluate(() => document.querySelector('nextjs-portal')?.remove());
// Escape returned focus to the menu trigger; drop it so the capture shows rest state.
await page.evaluate(() => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : null));
await page.mouse.move(700, 700);
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/desktop-pricing.png`, clip: { x: 0, y: 0, width: 1440, height: 460 } });

const mp = await browser.newPage({ viewport: { width: 390, height: 844 } });
await mp.goto(BASE + '/', { waitUntil: 'load', timeout: 90000 });
await mp.waitForTimeout(3000);
await mp.evaluate(() => document.querySelector('nextjs-portal')?.remove());
await mp.screenshot({ path: `${OUT}/mobile-hero.png` });
await mp.locator('.vcv-eb__menu-btn').click();
await mp.waitForTimeout(1000);
await mp.evaluate(() => document.querySelector('nextjs-portal')?.remove());
await mp.screenshot({ path: `${OUT}/mobile-menu.png` });
await browser.close();
