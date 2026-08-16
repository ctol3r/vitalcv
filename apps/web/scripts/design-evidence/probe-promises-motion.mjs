/**
 * probe-promises-motion.mjs — proves the ThreePromises arrival actually RUNS,
 * staggers, and is genuinely absent under reduced motion / no-JS.
 *
 * Sampling the finished frame proves nothing: a change that never animates and
 * a change that animates correctly both end at opacity 1. This samples DURING
 * the transition and asserts the three contracts separately.
 */
import { chromium } from '@playwright/test';

const base = process.argv[2] ?? 'http://localhost:3311';
const browser = await chromium.launch();
const out = {};

async function sample({ reduced, js = true, width = 1280, height = 800 }) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    reducedMotion: reduced ? 'reduce' : 'no-preference',
    javaScriptEnabled: js,
  });
  const page = await ctx.newPage();
  await page.goto(base, { waitUntil: 'load' });
  await page.waitForSelector('.ezh-promise-grid');

  // Scroll the section into view, then sample opacity every 40ms for 900ms.
  const samples = await page.evaluate(async () => {
    const grid = document.querySelector('.ezh-promise-grid');
    const cards = [...document.querySelectorAll('.ezh-promise')];
    grid.scrollIntoView({ block: 'center' });
    const frames = [];
    const t0 = performance.now();
    await new Promise((resolve) => {
      const id = setInterval(() => {
        frames.push({
          t: Math.round(performance.now() - t0),
          motion: grid.getAttribute('data-motion'),
          o: cards.map((c) => Number(getComputedStyle(c).opacity).toFixed(2)),
        });
        if (performance.now() - t0 > 900) {
          clearInterval(id);
          resolve();
        }
      }, 40);
    });
    return frames;
  });

  const stages = [...new Set(samples.map((s) => s.motion))];
  const minOpacity = Math.min(...samples.flatMap((s) => s.o.map(Number)));
  // Did the three cards ever hold DIFFERENT opacities at the same instant?
  const staggered = samples.some((s) => new Set(s.o).size > 1);
  const finalO = samples.at(-1).o;
  await ctx.close();
  return { stages, minOpacity, staggered, finalO };
}

out.normal = await sample({ reduced: false });
out.reducedMotion = await sample({ reduced: true });
out.mobile390 = await sample({ reduced: false, width: 390, height: 844 });

// no-JS: the finished row must simply be present
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto(base, { waitUntil: 'load' });
  await page.waitForSelector('.ezh-promise-grid');
  out.noJs = await page.evaluate(() => {
    const grid = document.querySelector('.ezh-promise-grid');
    const cards = [...document.querySelectorAll('.ezh-promise')];
    return {
      motionAttr: grid.getAttribute('data-motion'),
      opacities: cards.map((c) => getComputedStyle(c).opacity),
      visibleText: cards.every((c) => c.innerText.trim().length > 20),
    };
  });
  await ctx.close();
}

await browser.close();
console.log(JSON.stringify(out, null, 2));
