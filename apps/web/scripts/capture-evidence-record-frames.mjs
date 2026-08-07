/**
 * Captures the founder-review frame set for the Living Evidence Record at
 * true viewport size — one PNG per composed scene, no sheet scaling.
 *
 * Run: node apps/web/scripts/capture-evidence-record-frames.mjs
 */
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const T = path.resolve(HERE, '../../../artifacts/zoox-fidelity-z0/treatments');
const OUT = path.join(T, 'frames');
mkdirSync(OUT, { recursive: true });

const mod = await import(path.join(T, 'build-scale-scene.mjs'));

const PLAN = [
  [1366, 'BLANK'], [1366, 'RETURNED'],
  [1440, 'BLANK'], [1440, 'RETURNED'], [1440, 'DECIDING'], [1440, 'SEALED'],
  [1536, 'RETURNED'],
  [1728, 'RETURNED'], [1728, 'DECIDING'],
  [390, 'BLANK'], [390, 'RETURNED'],
];

const browser = await chromium.launch();
for (const [vw, face] of PLAN) {
  const v = mod.V[vw];
  writeFileSync(path.join(T, '_frame.html'), mod.frameDoc(vw, face));
  const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto(`file://${path.join(T, '_frame.html')}`, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(400);
  const name = `${vw}-${face.toLowerCase()}.png`;
  await p.screenshot({ path: path.join(OUT, name) });
  console.log('  ' + name);
  await ctx.close();
}

/* The recognition strip: all eight faces at 120px with every word covered. */
writeFileSync(path.join(T, '_frame.html'), mod.thumbDoc());
const ctx = await browser.newContext({ viewport: { width: 1240, height: 620 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
await p.goto(`file://${path.join(T, '_frame.html')}`, { waitUntil: 'load' });
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(400);
await p.screenshot({ path: path.join(OUT, 'recognition-120px-all-eight.png'), fullPage: true });
console.log('  recognition-120px-all-eight.png');
await ctx.close();

await browser.close();
console.log(`\nframes written to ${OUT}`);
