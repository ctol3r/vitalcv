// Film ↔ journey unification — visual evidence capture against the film-variant
// dev server (http://localhost:3058). MODE=before runs against the stashed
// (pre-change) tree and documents the defect; MODE=after runs against the
// unified tree and asserts the fix while capturing.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const BASE = 'http://localhost:3058';
const MODE = process.env.MODE === 'before' ? 'before' : 'after';
const OUT = `${process.env.OUT_ROOT}/${MODE}`;
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, detail = '') =>
  results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);

const browser = await chromium.launch();

async function railLabels(page) {
  return page.$$eval('nav[aria-label="Chapters"] .film-rail-link', (links) =>
    links.map((l) => l.childNodes[0]?.textContent?.trim()),
  );
}

// ---------------------------------------------------------------- desktop
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(2500);
  const header = page.locator('header.vcv-header');

  await page.screenshot({ path: `${OUT}/${MODE}-desktop-01-rest.png` });

  // The header rail's Sources anchor — the defect surface.
  await page.locator('a.vcv-rail__stage', { hasText: 'Sources' }).first().click();
  await page.waitForTimeout(1500);
  const stage = await header.getAttribute('data-header-stage');
  const movedTo = await page.evaluate(() => window.scrollY);
  if (MODE === 'after') {
    check('desktop: header Sources anchor lands on the film chapter', movedTo > 200, `scrollY=${movedTo}`);
    check('desktop: stage tracks to sources', stage === 'sources', `stage=${stage}`);
  } else {
    check('desktop (defect): anchor no-ops', movedTo <= 200, `scrollY=${movedTo}`);
    check('desktop (defect): stage stuck', stage === 'your-number', `stage=${stage}`);
  }
  await page.screenshot({ path: `${OUT}/${MODE}-desktop-02-after-header-sources-click.png` });

  // Walk the narrative; in `before` the unified ids do not exist, so walk by
  // document fraction instead and show the header never moving.
  if (MODE === 'after') {
    for (const [id, expectStage] of [
      ['permission', 'permission'],
      ['review', 'review'],
      ['closing', 'review'],
    ]) {
      await page.evaluate((sectionId) => {
        const el = document.getElementById(sectionId);
        window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + 160, behavior: 'instant' });
      }, id);
      await page.waitForTimeout(1200);
      const s = await header.getAttribute('data-header-stage');
      const t = await header.getAttribute('data-header-theme');
      check(`desktop: #${id} → stage ${expectStage}`, s === expectStage, `stage=${s}`);
      check(`desktop: #${id} stays on paper`, t === 'light', `theme=${t}`);
      await page.screenshot({ path: `${OUT}/${MODE}-desktop-03-${id}.png` });
    }
  } else {
    for (const frac of [0.45, 0.7]) {
      await page.evaluate((f) => window.scrollTo({ top: document.body.scrollHeight * f, behavior: 'instant' }), frac);
      await page.waitForTimeout(1200);
      const s = await header.getAttribute('data-header-stage');
      check(`desktop (defect): header undeclared at ${frac}`, s === 'your-number', `stage=${s}`);
      await page.screenshot({ path: `${OUT}/${MODE}-desktop-03-scroll-${Math.round(frac * 100)}.png` });
    }
  }

  // The film's own chapter rail.
  await page.evaluate(() => {
    document.querySelector('nav[aria-label="Chapters"]')?.scrollIntoView({ block: 'center', behavior: 'instant' });
  });
  await page.waitForTimeout(800);
  const labels = await railLabels(page);
  if (MODE === 'after') {
    check(
      'desktop: film rail speaks the journey vocabulary',
      JSON.stringify(labels) ===
        JSON.stringify(['Your Number', 'Sources', 'Permission', 'Review', 'What happens next']),
      labels.join(' · '),
    );
  } else {
    check('desktop (defect): two vocabularies', labels.includes('Source responses'), labels.join(' · '));
  }
  await page.screenshot({ path: `${OUT}/${MODE}-desktop-04-film-chapter-rail.png` });
  await ctx.close();
}

// ----------------------------------------------------------------- mobile
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(2500);

  await page.screenshot({ path: `${OUT}/${MODE}-mobile-01-rest.png` });

  const target = MODE === 'after' ? 'sources' : 'source-responses';
  await page.evaluate((sectionId) => {
    const el = document.getElementById(sectionId);
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + 120, behavior: 'instant' });
  }, target);
  await page.waitForTimeout(1200);
  if (MODE === 'after') {
    const s = await page.locator('header.vcv-header').getAttribute('data-header-stage');
    check('mobile: stage tracks in the compact bar', s === 'sources', `stage=${s}`);
  }
  await page.screenshot({ path: `${OUT}/${MODE}-mobile-02-sources.png` });

  await page.evaluate(() => {
    document.querySelector('nav[aria-label="Chapters"]')?.scrollIntoView({ block: 'center', behavior: 'instant' });
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${MODE}-mobile-03-film-chapter-rail.png` });
  await ctx.close();
}

// ------------------------------------------------------- recording (after)
if (MODE === 'after') {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: { dir: OUT, size: { width: 1440, height: 900 } },
  });
  const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(2000);
  for (const id of ['sources', 'permission', 'review', 'closing']) {
    await page.evaluate((sectionId) => {
      const el = document.getElementById(sectionId);
      window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY + 160, behavior: 'smooth' });
    }, id);
    await page.waitForTimeout(2200);
  }
  await page.evaluate(() => {
    document.querySelector('nav[aria-label="Chapters"]')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });
  await page.waitForTimeout(2000);
  const video = page.video();
  await ctx.close();
  const path = await video.path();
  const { renameSync } = await import('node:fs');
  renameSync(path, `${OUT}/after-desktop-journey-recording.webm`);
  results.push(`PASS recording saved`);
}

await browser.close();
console.log(results.join('\n'));
const failed = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
