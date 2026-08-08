// Post-merge production verification of the journey header at the exact
// deployed SHA — exercises the change on https://vitalcv.com and captures
// proof stills.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = 'https://vitalcv.com';
const OUT = process.env.OUT_DIR;
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, detail = '') =>
  results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);

const browser = await chromium.launch();

// Desktop
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);
  const header = page.locator('header.vcv-header');
  check('prod: journey header renders', (await header.count()) === 1);
  check('prod: rail present with 4 stages', (await page.locator('.vcv-rail--bar li').count()) === 4);
  check(
    'prod: Your Number active',
    (await page
      .locator('.vcv-rail--bar [data-rail-state="active"] .vcv-rail__stage')
      .textContent())?.includes('Your Number') ?? false,
  );
  await page.screenshot({ path: `${OUT}/prod-desktop-rest.png` });

  await page.evaluate(() => {
    const el = document.getElementById('sources');
    window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + 160, behavior: 'instant' });
  });
  await page.waitForTimeout(1200);
  check('prod: ink scene → theme dark', (await header.getAttribute('data-header-theme')) === 'dark');
  check('prod: ink scene → stage sources', (await header.getAttribute('data-header-stage')) === 'sources');
  await page.screenshot({ path: `${OUT}/prod-desktop-ink-scene.png` });

  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.waitForTimeout(1000);
  await page.locator('.vcv-header__trigger').click();
  await page.waitForTimeout(900);
  check('prod: canvas opens', await page.locator('#vcv-header-menu').isVisible());
  check('prod: canvas has 3 groups', (await page.locator('.vcv-menu__group').count()) === 3);
  await page.screenshot({ path: `${OUT}/prod-desktop-canvas.png` });

  // Exercise a destination that previously had no chrome.
  await page.goto(BASE + '/evidence-network', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);
  check('prod: /evidence-network has the header', (await page.locator('header.vcv-header').count()) === 1);
  await ctx.close();
}

// Mobile
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);
  check('prod mobile: stage visible in bar', (await page.locator('.vcv-header__stage').textContent()) === 'Your Number');
  await page.screenshot({ path: `${OUT}/prod-mobile-rest.png` });
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.waitForTimeout(1200);
  check('prod mobile: overlay opens', await page.locator('[data-liquid-menu]').isVisible());
  check('prod mobile: journey rail in overlay', (await page.locator('[data-liquid-menu] .vcv-rail--overlay').count()) === 1);
  await page.screenshot({ path: `${OUT}/prod-mobile-overlay.png` });
  await ctx.close();
}

await browser.close();
console.log(results.join('\n'));
const fails = results.filter((r) => r.startsWith('FAIL'));
console.log(`\n${results.length - fails.length}/${results.length} passed`);
process.exit(fails.length ? 1 : 0);
