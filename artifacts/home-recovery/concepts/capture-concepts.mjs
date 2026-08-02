/**
 * R4 concept capture: each concept file's five frames at 1440×900 and 390×844.
 * Frames are full-viewport sections; we scroll each into place and screenshot
 * the viewport (not the element) so the founder sees real fold behavior.
 */
import { chromium } from '@playwright/test';

const DIR = '/tmp/vitalcv-homepage-recovery-concepts/artifacts/home-recovery/concepts';
const FRAMES = ['opening', 'sources', 'permission', 'review', 'closing'];
const CONCEPTS = ['a', 'b', 'c'];

const browser = await chromium.launch();
for (const c of CONCEPTS) {
  for (const vp of [
    { tag: '1440x900', width: 1440, height: 900 },
    { tag: '390x844', width: 390, height: 844 },
  ]) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    await page.goto(`file://${DIR}/concept-${c}.html`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    for (const frame of FRAMES) {
      const el = page.locator(`#${frame}`);
      if ((await el.count()) === 0) {
        console.log(`concept-${c}: MISSING #${frame}`);
        continue;
      }
      await page.evaluate((id) => {
        document.getElementById(id)?.scrollIntoView({ block: 'start' });
      }, frame);
      await page.waitForTimeout(200);
      await page.screenshot({ path: `${DIR}/concept-${c}-${frame}-${vp.tag}.png` });
    }
    // Overflow check.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    console.log(`concept-${c} @ ${vp.tag}: horizontal overflow = ${overflow}px`);
    await ctx.close();
  }
}
await browser.close();
console.log('CONCEPT CAPTURE DONE');
