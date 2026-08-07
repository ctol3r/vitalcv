// Behavior verification of the rebuilt header against the local dev server.
import { chromium } from '@playwright/test';

const BASE = 'http://localhost:3057';
const results = [];
const check = (name, ok, detail = '') => {
  results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);

const header = page.locator('header.vcv-header');
const plate = page.locator('.vcv-header__plate');

// 1. Rest: transparent plate, light theme, your-number stage
check('rest: not lifted', !(await header.getAttribute('data-nav-lifted') !== null));
check('rest: theme light', (await header.getAttribute('data-header-theme')) === 'light');
check('rest: stage your-number', (await header.getAttribute('data-header-stage')) === 'your-number');
const restBg = await plate.evaluate((el) => getComputedStyle(el).backgroundColor);
check('rest: plate transparent', /\/ 0\)$|rgba\(0, 0, 0, 0\)/.test(restBg), restBg);

// 2. Scroll into the ink CREATE room → dark + sources
await page.evaluate(() => {
  const el = document.getElementById('sources');
  window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + 160, behavior: 'instant' });
});
await page.waitForTimeout(700);
check('ink room: lifted', (await header.getAttribute('data-nav-lifted')) !== null);
check('ink room: theme dark', (await header.getAttribute('data-header-theme')) === 'dark', String(await header.getAttribute('data-header-theme')));
check('ink room: stage sources', (await header.getAttribute('data-header-stage')) === 'sources', String(await header.getAttribute('data-header-stage')));
const darkBg = await plate.evaluate((el) => getComputedStyle(el).backgroundColor);
check('ink room: plate is dark ink', /oklab\(0\.2|oklab\(0\.1/.test(darkBg), darkBg);

// 3. Indigo APPLY room → dark + permission
await page.evaluate(() => {
  const el = document.getElementById('permission');
  window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + 160, behavior: 'instant' });
});
await page.waitForTimeout(700);
check('apply room: stage permission', (await header.getAttribute('data-header-stage')) === 'permission');
check('apply room: theme dark', (await header.getAttribute('data-header-theme')) === 'dark');

// 4. CONTINUE room → light + review; then back to top → your-number again
await page.evaluate(() => {
  const el = document.getElementById('review');
  window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + 160, behavior: 'instant' });
});
await page.waitForTimeout(700);
check('continue room: stage review', (await header.getAttribute('data-header-stage')) === 'review');
check('continue room: theme light', (await header.getAttribute('data-header-theme')) === 'light');
await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
await page.waitForTimeout(700);
check('back to top: stage your-number', (await header.getAttribute('data-header-stage')) === 'your-number');
check('back to top: not lifted', (await header.getAttribute('data-nav-lifted')) === null);

// 5. Journey rail anchors are links on / with aria-current
const activeStage = page.locator('.vcv-rail--bar [data-rail-state="active"] .vcv-rail__stage');
check('rail: active stage has aria-current=step', (await activeStage.getAttribute('aria-current')) === 'step');
check('rail: interactive on /', (await activeStage.evaluate((el) => el.tagName)) === 'A');

// 6. Canvas: open, Escape closes, focus returns to trigger
const trigger = page.getByRole('button', { name: 'Menu' });
await trigger.click();
await page.waitForTimeout(500);
const canvas = page.locator('#vcv-header-menu');
check('canvas: opens', await canvas.isVisible());
check('canvas: trigger aria-expanded', (await page.locator('.vcv-header__trigger').getAttribute('aria-expanded')) === 'true');
const groupCount = await canvas.locator('.vcv-menu__group').count();
check('canvas: all three groups visible', groupCount === 3, String(groupCount));
await page.keyboard.press('Escape');
await page.waitForTimeout(400);
check('canvas: Escape closes', !(await canvas.isVisible()));
check('canvas: focus returns to trigger', await page.evaluate(() => document.activeElement?.classList.contains('vcv-header__trigger')));

// 7. Outside click closes
await trigger.click();
await page.waitForTimeout(400);
await page.mouse.click(720, 700);
await page.waitForTimeout(400);
check('canvas: outside click closes', !(await canvas.isVisible()));

// 8. No horizontal overflow on desktop
const overflowD = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check('desktop: no horizontal overflow', overflowD <= 0, String(overflowD));

// 9. /employers route context: stage review, CTA suppressed
await page.goto(BASE + '/employers', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
check('employers: stage review', (await header.getAttribute('data-header-stage')) === 'review');
check('employers: no bar CTA', (await page.locator('.vcv-header__cta').count()) === 0);
check('employers: rail not interactive', (await page.locator('.vcv-rail--bar [data-rail-state="active"] .vcv-rail__stage').evaluate((el) => el.tagName)) === 'SPAN');

// 10. /trust: stage sources + CTA present
await page.goto(BASE + '/trust', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
check('trust: stage sources', (await header.getAttribute('data-header-stage')) === 'sources');
check('trust: clinician CTA present', (await page.locator('.vcv-header__cta').count()) === 1);

// 11. /evidence-network now has chrome
await page.goto(BASE + '/evidence-network', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);
check('evidence-network: header renders', (await page.locator('header.vcv-header').count()) === 1);

await ctx.close();

// ---- Mobile ----
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const mpage = await mctx.newPage();
mpage.on('pageerror', (e) => errors.push('mobile: ' + String(e)));
await mpage.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await mpage.waitForTimeout(2000);

check('mobile: compact stage label visible', await mpage.locator('.vcv-header__stage').isVisible());
const mtoggle = mpage.getByRole('button', { name: 'Open menu' });
await mtoggle.click();
await mpage.waitForTimeout(800);
const dialog = mpage.locator('[data-liquid-menu]');
check('mobile: overlay opens as dialog', await dialog.isVisible());
check('mobile: aria-modal', (await dialog.getAttribute('aria-modal')) === 'true');
check('mobile: body scroll locked', (await mpage.evaluate(() => document.body.style.overflow)) === 'hidden');
check('mobile: journey rail in overlay', (await dialog.locator('.vcv-rail--overlay').count()) >= 1);
check('mobile: groups present', (await dialog.locator('.liquid-menu__group').count()) === 3);
// focus trap: Tab cycles within the dialog
for (let i = 0; i < 30; i++) await mpage.keyboard.press('Tab');
check('mobile: focus stays in dialog', await mpage.evaluate(() => !!document.activeElement?.closest('[data-liquid-menu]')));
await mpage.keyboard.press('Escape');
await mpage.waitForTimeout(500);
check('mobile: Escape closes', (await dialog.count()) === 0);
check('mobile: scroll restored', (await mpage.evaluate(() => document.body.style.overflow)) !== 'hidden');
check('mobile: focus returns to toggle', await mpage.evaluate(() => document.activeElement?.getAttribute('aria-label') === 'Open menu'));
const overflowM = await mpage.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check('mobile: no horizontal overflow', overflowM <= 0, String(overflowM));

// Reduced motion: hierarchy without animation
const rctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const rpage = await rctx.newPage();
await rpage.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await rpage.waitForTimeout(1500);
// The house reduced-motion convention is `transition-duration: 0.01ms
// !important` (globals.css) — effectively immediate, not literally 0s.
const plateTransition = await rpage.locator('.vcv-header__plate').evaluate((el) => getComputedStyle(el).transitionDuration);
check('reduced motion: plate transition immediate', parseFloat(plateTransition) <= 0.001, plateTransition);

await browser.close();

console.log(results.join('\n'));
const fails = results.filter((r) => r.startsWith('FAIL'));
console.log(`\n${results.length - fails.length}/${results.length} passed`);
if (errors.length) console.log('\nCONSOLE/PAGE ERRORS:\n' + [...new Set(errors)].slice(0, 10).join('\n'));
process.exit(fails.length ? 1 : 0);
