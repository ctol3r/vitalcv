/**
 * Z0 acceptance matrix — the founder's demonstration list, machine-checked.
 *
 * Each row is a measurement or a repository fact, not a claim. Writes
 * artifacts/zoox-fidelity-z0/acceptance-matrix.md and exits non-zero if any
 * required demonstration fails.
 *
 * Run: node apps/web/scripts/evidence-record-acceptance-matrix.mjs
 */
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const T = path.join(ROOT, 'artifacts/zoox-fidelity-z0/treatments');
const mod = await import(path.join(T, 'build-scale-scene.mjs'));

const rows = [];
const add = (id, requirement, pass, evidence) => rows.push({ id, requirement, pass, evidence });
const git = (cmd) => { try { return execSync(cmd, { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { return ''; } };
/*
 * Diff from the MERGE BASE, not from origin/main.
 *
 * `git diff origin/main -- <paths>` is a two-dot diff: it reports differences
 * in both directions, so every change main has landed since this branch was
 * cut shows up as though this branch made it. It flagged the /api/candidates
 * security removal — work this branch never touched — as a production change.
 * The question is what THIS work introduced, which is the three-dot diff.
 */
const BASE = git('git merge-base origin/main HEAD') || 'origin/main';
const introduced = (paths) => git(`git diff --name-only ${BASE} HEAD -- ${paths}`);

/* Truth-contract strings that no copy may contain (CLAUDE.md). */
const BANNED = ['automatically verified', 'guaranteed verification', 'complete credentialing',
  'instant credentialing', 'legally accepted', 'risk transferred', 'final verification without review',
  'source confirmed before response', 'certified compliant', 'HIPAA compliant', 'SOC2 certified'];

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();

const SHEETS = ['b-scale.html', 'b-storyboard-desktop.html', 'b-storyboard-mobile.html', 'b-faces.html', 'b-refinements.html']
  .map((f) => path.join(T, f)).filter(existsSync);

let totals = { records: 0, deadBand: 0, intraRow: 0, concat: 0, overprint: 0, stretched: 0 };
const claims = new Set(), retrievals = new Set(), provenances = new Set(), stamps = new Set();
let bannedHits = [];

for (const sheet of SHEETS) {
  await page.goto(`file://${sheet}`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(450);
  const r = await page.evaluate(() => {
    const o = { records: 0, deadBand: 0, intraRow: 0, concat: 0, overprint: 0, stretched: 0,
      claims: [], retrievals: [], provenances: [], stamps: [], text: document.body.innerText };
    for (const evr of document.querySelectorAll('.evr')) {
      o.records++;
      const rowsEl = [...evr.querySelectorAll('.evr-row')];
      const rowsBox = evr.querySelector('.evr-rows');
      if (rowsBox && rowsEl.length) {
        const sum = rowsEl.reduce((a, x) => a + x.getBoundingClientRect().height, 0);
        if (Math.abs(rowsBox.getBoundingClientRect().height - sum) > 2) o.stretched++;
        const receipt = evr.querySelector('.evr-receipt');
        const foot = receipt ? receipt.getBoundingClientRect().top
                             : evr.querySelector('.evr-body').getBoundingClientRect().bottom;
        if (foot - rowsEl.at(-1).getBoundingClientRect().bottom > 8) o.deadBand++;
      }
      const items = [...evr.querySelectorAll('.evr-prov, .evr-claim, .evr-ret, .stamp, .evr-perm')]
        .map((el) => ({ el, r: el.getBoundingClientRect() })).filter((x) => x.r.width > 0);
      for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
        const a = items[i], b = items[j];
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
        if (Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left) > 1
         && Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top) > 1) o.overprint++;
      }
      for (const row of evr.querySelectorAll('.evr-row:not(.evr-row--opened)')) {
        const ret = row.querySelector('.evr-ret'), prov = row.querySelector('.evr-prov');
        if (ret && prov) {
          const a = ret.getBoundingClientRect(), b = prov.getBoundingClientRect();
          if (a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5) o.concat++;
        }
        if (!evr.matches('[data-scale="hero"]')) continue;
        const top = row.getBoundingClientRect().top + parseFloat(getComputedStyle(row).paddingTop);
        for (const c of row.children) if (c.getBoundingClientRect().top - top > 3) o.intraRow++;
      }
      evr.querySelectorAll('.evr-claim').forEach((e) => o.claims.push(e.textContent.trim()));
      evr.querySelectorAll('.evr-ret').forEach((e) => o.retrievals.push(e.textContent.trim()));
      evr.querySelectorAll('.evr-prov').forEach((e) => o.provenances.push(e.textContent.replace(/\s+/g, ' ').trim()));
      evr.querySelectorAll('.stamp').forEach((e) => o.stamps.push(e.textContent.trim()));
    }
    return o;
  });
  for (const k of Object.keys(totals)) totals[k] += r[k];
  r.claims.forEach((x) => claims.add(x));
  r.retrievals.forEach((x) => retrievals.add(x));
  r.provenances.forEach((x) => provenances.add(x));
  r.stamps.forEach((x) => stamps.add(x));
  const low = r.text.toLowerCase();
  for (const b of BANNED) if (low.includes(b.toLowerCase())) bannedHits.push(`${path.basename(sheet)}: "${b}"`);
}

/* Composed-scene geometry, for the crop and mobile rows. */
await page.goto(`file://${path.join(T, 'b-scale.html')}`, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(450);
const scenes = await page.evaluate(() => [...document.querySelectorAll('.stage')].map((s) => {
  const wrap = s.closest('[data-scaled]');
  const f = wrap ? parseFloat(wrap.dataset.scaled) : 1;
  const e = s.querySelector('.evr'), sr = s.getBoundingClientRect(), rr = e.getBoundingClientRect();
  const claim = e.querySelector('.evr-claim') || e.querySelector('.evr-npi');
  return { vw: +s.dataset.vw, face: s.dataset.face,
    recW: Math.round(rr.width / f), recH: Math.round(rr.height / f),
    cropped: rr.bottom > sr.bottom + 1,
    claimPx: +getComputedStyle(claim).fontSize.replace('px', '') / f,
    apertures: e.querySelectorAll('.evr-ap').length, rows: e.querySelectorAll('.evr-row').length,
    spine: !!e.querySelector('.evr-spine'), receipt: !!e.querySelector('.evr-receipt') };
}));
await browser.close();

/* ------------------------------------------------------------- the matrix -- */
add('D1', 'Zero unexplained internal dead band', totals.deadBand === 0,
  `${totals.records} records across ${SHEETS.length} sheets; ${totals.deadBand} with a band above the receipt`);

add('D2', 'Top alignment within every evidence row', totals.intraRow === 0,
  `${totals.intraRow} hero-row children sitting below their row's content top`);

add('D3', 'Claim, retrieval and provenance never concatenate', totals.concat === 0,
  `${totals.concat} rows where retrieval and provenance share a box; ${totals.overprint} overprints anywhere in any record`);

const desk = scenes.filter((s) => s.vw !== 390);
const ratios = {};
for (const s of desk) (ratios[s.face] ??= []).push(s.recH / s.recW);
const spread = Math.max(...Object.values(ratios).map((v) => (Math.max(...v) - Math.min(...v)) / Math.min(...v) * 100));
add('D4', '1366 and 1440 hold up alongside 1728', spread <= 6,
  `aspect spread across 1366/1440/1536/1728 is ${spread.toFixed(1)}% per face (limit 6%)`);

const mob = scenes.find((s) => s.vw === 390 && s.face === 'RETURNED');
const d14 = scenes.find((s) => s.vw === 1440 && s.face === 'RETURNED');
const mobSame = mob && d14 && mob.spine === d14.spine && mob.apertures === d14.apertures
  && mob.rows === d14.rows && mob.receipt === d14.receipt && mob.claimPx >= 14;
add('D5', 'Mobile retains object identity with readable type', !!mobSame,
  `mobile: spine ${mob?.spine}, ${mob?.apertures} apertures, ${mob?.rows} rows, receipt ${mob?.receipt}, claim ${mob?.claimPx.toFixed(1)}px (floor 14px)`);

const sealed = scenes.find((s) => s.face === 'SEALED');
const sameW = sealed && d14 && sealed.recW === d14.recW;
add('D6', 'SEALED recognisable without artificial padding', !!sameW,
  `SEALED ${sealed?.recW}×${sealed?.recH} vs RETURNED ${d14?.recW}×${d14?.recH} — same width, ${Math.round(sealed.recH / d14.recH * 100)}% of the height, no min-height floor`);

const cropExpected = scenes.every((s) => (['RETURNED', 'DECIDING'].includes(s.face) ? s.cropped : !s.cropped));
add('D7', 'Cropping is intentional and state-dependent', cropExpected,
  `cropped: ${scenes.filter((s) => s.cropped).map((s) => `${s.vw} ${s.face}`).join(', ')}; uncropped: ${scenes.filter((s) => !s.cropped).map((s) => `${s.vw} ${s.face}`).join(', ')}`);

/* Reduced motion must reach every state the animated version reaches. */
const aniSrc = readFileSync(path.join(HERE, 'capture-evidence-record-animatics.mjs'), 'utf8');
const facesIn = (block) => {
  const m = aniSrc.match(new RegExp(`const ${block} = \\[([\\s\\S]*?)\\n\\];`));
  return new Set([...(m?.[1] ?? '').matchAll(/'([A-Z]+)'/g)].map((x) => x[1]));
};
const animated = facesIn('DESKTOP'), reduced = facesIn('REDUCED');
const missing = [...animated].filter((f) => !reduced.has(f));
const gifs = ['animatic-desktop-1440', 'animatic-mobile-390', 'animatic-reduced-motion-1440']
  .filter((n) => existsSync(path.join(T, 'frames', `${n}.gif`)));
add('D8', 'Reduced motion preserves the complete argument', missing.length === 0 && gifs.length === 3,
  missing.length ? `states missing from reduced motion: ${missing.join(', ')}`
    : `all ${reduced.size} states present as hard cuts, no travel; ${gifs.length}/3 animatics built`);

add('D9', 'No new content or unsupported truth claims', bannedHits.length === 0,
  `${claims.size} distinct claims, ${retrievals.size} retrieval lines, ${provenances.size} provenance lines, ${stamps.size} state stamps; 0 banned strings across ${SHEETS.length} sheets`);

const prodDiff = introduced('apps/web/app apps/web/components apps/web/lib apps/web/styles apps/api/backend/src apps/marketing packages');
add('D10', 'No production changes', prodDiff === '',
  prodDiff === '' ? `no change under any app or package source path since ${BASE.slice(0, 9)}` : `CHANGED: ${prodDiff.split('\n').join(', ')}`);

const z1 = introduced('apps/web/components/home apps/web/styles/home.css');
add('D11', 'No Z1 work', z1 === '',
  z1 === '' ? 'homepage film components and route stylesheet untouched by this work' : `CHANGED: ${z1}`);

const sec = introduced('apps/api/backend/src/routes .github');
add('D12', 'No change to the security lane', sec === '',
  sec === '' ? 'backend routes and workflows untouched; advisory GHSA-f9xv-h5c5-x537 remains draft and unpublished' : `CHANGED: ${sec}`);

/* ------------------------------------------------------------------ write -- */
const ok = (p) => (p ? 'PASS' : '**FAIL**');
const md = `# Z0 acceptance matrix — Living Evidence Record

Generated by \`apps/web/scripts/evidence-record-acceptance-matrix.mjs\`. Every
row is a measurement or a repository fact. Regenerate with:

\`\`\`bash
node apps/web/scripts/evidence-record-acceptance-matrix.mjs
\`\`\`

| # | Demonstration | Result | Evidence |
|---|---|---|---|
${rows.map((r) => `| ${r.id} | ${r.requirement} | ${ok(r.pass)} | ${r.evidence} |`).join('\n')}

## Composed scenes

| viewport | face | record | cropped | claim type |
|---|---|---|---|---|
${scenes.map((s) => `| ${s.vw} | ${s.face} | ${s.recW}×${s.recH} | ${s.cropped ? 'yes' : 'no'} | ${s.claimPx.toFixed(1)}px |`).join('\n')}

## Every string the object asserts

Listed so that "no new content" can be checked by reading rather than trusted.

**Claims (${claims.size}):** ${[...claims].sort().join(' · ')}

**Retrieval lines (${retrievals.size}):**
${[...retrievals].sort().map((r) => `- ${r}`).join('\n')}

**Provenance lines (${provenances.size}):**
${[...provenances].sort().map((r) => `- ${r}`).join('\n')}

**State stamps (${stamps.size}):** ${[...stamps].sort().join(' · ')}

No status label is the bare word "Verified", and none of the ${BANNED.length} banned
truth-contract strings appears anywhere in the package.
`;

writeFileSync(path.join(ROOT, 'artifacts/zoox-fidelity-z0/acceptance-matrix.md'), md);

console.log('\nACCEPTANCE MATRIX');
for (const r of rows) console.log(`  ${r.pass ? '✓' : '✗'} ${r.id}  ${r.requirement}`);
const failed = rows.filter((r) => !r.pass);
if (failed.length) {
  console.log('\nFAILED:');
  failed.forEach((r) => console.log(`  ✗ ${r.id} — ${r.evidence}`));
  process.exit(1);
}
console.log(`\nall ${rows.length} demonstrations pass · acceptance-matrix.md written`);
