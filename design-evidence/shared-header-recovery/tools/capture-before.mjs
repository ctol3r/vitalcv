// Capture BEFORE evidence of the production public header for the
// shared-header-recovery wave. Read-only observation of https://vitalcv.com.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const OUT = process.env.OUT_DIR;
if (!OUT) throw new Error('OUT_DIR required');
mkdirSync(OUT, { recursive: true });

const BASE = 'https://vitalcv.com';

const shots = [];
async function capture(page, name) {
  const path = `${OUT}/${name}.png`;
  await page.screenshot({ path, fullPage: false });
  shots.push(name);
}

const browser = await chromium.launch();

// ---- Desktop 1440x900 ----
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  for (const [route, slug] of [
    ['/', 'home'],
    ['/employers', 'employers'],
    ['/trust', 'trust'],
  ]) {
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(2500);
    await capture(page, `before-desktop-${slug}-rest`);
    await page.mouse.wheel(0, 1400);
    await page.waitForTimeout(1200);
    await capture(page, `before-desktop-${slug}-scrolled`);
    await page.mouse.wheel(0, -9000);
    await page.waitForTimeout(800);
  }
  // Expanded menu on home: try hovering/clicking first nav group
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(2000);
  const navButtons = page.locator('header button, nav button');
  const count = await navButtons.count();
  console.log('desktop nav buttons:', count);
  for (let i = 0; i < Math.min(count, 6); i++) {
    console.log(`  button[${i}]:`, (await navButtons.nth(i).textContent())?.trim().slice(0, 40), '|', await navButtons.nth(i).getAttribute('aria-label'));
  }
  if (count > 0) {
    await navButtons.first().click().catch(() => {});
    await page.waitForTimeout(900);
    await capture(page, 'before-desktop-home-menu-open');
  }
  await ctx.close();
}

// ---- Mobile 390x844 ----
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(2500);
  await capture(page, 'before-mobile-home-rest');
  await page.mouse.wheel(0, 1200).catch(() => {});
  await page.waitForTimeout(1000);
  await capture(page, 'before-mobile-home-scrolled');
  await page.mouse.wheel(0, -9000).catch(() => {});
  await page.waitForTimeout(800);
  // Open the mobile menu (LiquidMenu toggle)
  const toggle = page.locator('header button, nav button, [aria-label*="menu" i], [aria-label*="navigation" i]');
  const tcount = await toggle.count();
  console.log('mobile toggle candidates:', tcount);
  for (let i = 0; i < Math.min(tcount, 6); i++) {
    console.log(`  toggle[${i}]:`, (await toggle.nth(i).textContent())?.trim().slice(0, 40), '|', await toggle.nth(i).getAttribute('aria-label'));
  }
  if (tcount > 0) {
    await toggle.last().click().catch(() => {});
    await page.waitForTimeout(1200);
    await capture(page, 'before-mobile-home-menu-open');
  }
  await ctx.close();
}

await browser.close();
console.log('captured:', shots.join(', '));
