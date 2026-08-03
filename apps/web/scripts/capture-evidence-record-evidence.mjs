/**
 * Two pieces of founder evidence for the cinematic-scale gate:
 *
 *  1. before/after for the 1440 × 900 failure, with the empty region measured
 *     on both. "Before" is not a redrawing — it reinstates the exact defective
 *     declarations over the current stylesheet, so the failure is rendered by
 *     the rules that caused it.
 *  2. a scale-transition recording, 1366 → 1440 → 1536 → 1728 → back, proving
 *     the design holds continuously rather than at four sampled widths.
 *
 * Run: node apps/web/scripts/capture-evidence-record-evidence.mjs
 */
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const T = path.resolve(HERE, '../../../artifacts/zoox-fidelity-z0/treatments');
const OUT = path.join(T, 'frames');
mkdirSync(OUT, { recursive: true });
const mod = await import(path.join(T, 'build-scale-scene.mjs'));

/*
 * The three declarations that produced the failure, reinstated verbatim:
 *   · --u redefined from a LENGTH, so every `calc(px * var(--u))` is invalid
 *     and dropped — the object never scales
 *   · the width-derived min-height floor plus flex:1, which stretches the body
 *     past its content and pushes the receipt to the bottom
 *   · provenance spanning two grid tracks, which stretches both and strands
 *     the retrieval line at the bottom of the first
 */
const BEFORE_CSS = `
.evr{--u:calc(var(--w) / 420)}
.evr[data-scale="hero"]{min-height:calc(var(--w) * 0.72)}
.evr[data-scale="hero"] .evr-body,
.evr[data-scale="hero"] .evr-rows{flex:1}
.evr[data-scale="hero"] .evr-row{grid-template-columns:minmax(0,42%) minmax(0,1fr) auto;align-items:baseline}
.evr[data-scale="hero"] .evr-assert{display:contents}
.evr[data-scale="hero"] .evr-claim{grid-column:1;grid-row:1}
.evr[data-scale="hero"] .evr-ret{grid-column:1;grid-row:2}
.evr[data-scale="hero"] .evr-prov{grid-column:2;grid-row:1 / span 2}`;

const browser = await chromium.launch();

/* ------------------------------------------------ 1. before / after ------ */
const shot = async (label, extraCss, recWidth) => {
  const v = { ...mod.V[1440], rec: recWidth };
  const html = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="./record-b.css"><style>*{box-sizing:border-box}body{margin:0}
.stage{overflow:hidden;border:0}${extraCss}</style></head><body class="evr-scene">
<div class="stage" data-vw="1440" data-face="RETURNED"
  style="width:1440px;height:900px;display:flex;align-items:stretch;gap:56px;padding:0 ${v.padX}px">
  <div class="arg" style="flex:1"></div>
  <div style="flex:none;padding-top:${v.top}px">${mod.FACES.RETURNED(v.rec, 'hero')}</div>
</div></body></html>`;
  writeFileSync(path.join(T, '_ba.html'), html);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto(`file://${path.join(T, '_ba.html')}`, { waitUntil: 'load' });
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(400);

  const m = await p.evaluate(() => {
    const evr = document.querySelector('.evr');
    const r = evr.getBoundingClientRect();
    const rows = [...evr.querySelectorAll('.evr-row')];
    const last = rows[rows.length - 1].getBoundingClientRect();
    const rc = evr.querySelector('.evr-receipt').getBoundingClientRect();
    const claim = rows[0].querySelector('.evr-claim').getBoundingClientRect();
    const ret = rows[0].querySelector('.evr-ret').getBoundingClientRect();
    return {
      recW: Math.round(r.width), recH: Math.round(r.height),
      footBand: Math.round(rc.top - last.bottom),
      intraRow: Math.round(ret.top - claim.bottom),
      rowH: Math.round(rows[0].getBoundingClientRect().height),
    };
  });
  await p.screenshot({ path: path.join(OUT, `1440-${label}.png`) });
  await ctx.close();
  return m;
};

const before = await shot('failure-before', BEFORE_CSS, 1008);
const after = await shot('failure-after', '', mod.V[1440].rec);

console.log('\n1440 × 900 — THE FAILURE AND THE FIX');
console.table({
  BEFORE: { record: `${before.recW}×${before.recH}`, 'empty band above receipt': `${before.footBand}px`,
    'gap claim→retrieval': `${before.intraRow}px`, 'first row height': `${before.rowH}px` },
  AFTER: { record: `${after.recW}×${after.recH}`, 'empty band above receipt': `${after.footBand}px`,
    'gap claim→retrieval': `${after.intraRow}px`, 'first row height': `${after.rowH}px` },
});
console.log(`  band as share of record height: ${(before.footBand / before.recH * 100).toFixed(1)}% → ${(after.footBand / after.recH * 100).toFixed(1)}%`);

/* ------------------------------------------------ 2. scale transition ---- */
/* Anchors come from the shared module, never a second copy of the numbers —
   a hard-coded list here would silently disagree with the frames the moment a
   viewport is retuned, which is precisely the drift this package forbids. */
const anchors = [1366, 1440, 1536, 1728].map((w) => [w, mod.V[w].rec]);
const recAt = (w) => {
  if (w <= anchors[0][0]) return anchors[0][1];
  if (w >= anchors.at(-1)[0]) return anchors.at(-1)[1];
  for (let i = 1; i < anchors.length; i++) {
    const [w0, r0] = anchors[i - 1], [w1, r1] = anchors[i];
    if (w <= w1) return Math.round(r0 + (r1 - r0) * ((w - w0) / (w1 - w0)));
  }
};

const TMP = path.join(T, '_seq');
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

const widths = [];
for (let w = 1366; w <= 1728; w += 12) widths.push(w);
for (let w = 1728; w >= 1366; w -= 12) widths.push(w);

const H = 900;
const ctx = await browser.newContext({ viewport: { width: 1728, height: H }, deviceScaleFactor: 1 });
const p = await ctx.newPage();
let i = 0;
for (const w of widths) {
  const v = { w, h: H, rec: recAt(w), padX: Math.round(60 * (w / 1440)), top: Math.round(100 * (w / 1440)) };
  const k = (w / 1440).toFixed(3);
  writeFileSync(path.join(T, '_seq.html'), `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="./record-b.css"><style>*{box-sizing:border-box}body{margin:0}
.stage{overflow:hidden;border:0}</style></head><body class="evr-scene">
<div class="stage" style="width:${w}px;height:${H}px;display:flex;align-items:stretch;gap:calc(56px * ${k});padding:0 ${v.padX}px">
  <div style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:calc(20px * ${k})">
    <p style="font-family:var(--mono);font-size:calc(11px * ${k});letter-spacing:.09em;text-transform:uppercase;color:var(--ink-subtle)">For clinicians</p>
    <h1 style="font-family:var(--serif);font-weight:500;font-size:calc(50px * ${k});line-height:1.02;letter-spacing:-.02em;color:var(--ink-strong);max-width:12ch;margin:0">Get hired on <em style="font-style:italic;color:var(--accent)">evidence</em>.</h1>
    <p style="font-family:var(--mono);font-size:calc(12px * ${k});color:var(--ink-subtle);margin:0">viewport ${w} · record ${v.rec}px</p>
  </div>
  <div style="flex:none;padding-top:${v.top}px">${mod.FACES.RETURNED(v.rec, 'hero')}</div>
</div></body></html>`);
  await p.goto(`file://${path.join(T, '_seq.html')}`, { waitUntil: 'load' });
  if (i === 0) { await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300); }
  await p.screenshot({ path: path.join(TMP, `f${String(i).padStart(4, '0')}.png`), clip: { x: 0, y: 0, width: w, height: H } });
  i++;
}
await ctx.close();
await browser.close();

/* Pad every frame to the widest so the encoder gets a constant size; the pad
   colour is the paper, so the record appears to grow into the frame. */
const gif = path.join(OUT, 'scale-transition-1366-1728.gif');
const mp4 = path.join(OUT, 'scale-transition-1366-1728.mp4');
const pad = 'pad=1728:900:0:0:color=0xF0EEE9';
execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', '24', '-i', path.join(TMP, 'f%04d.png'),
  '-vf', `${pad},scale=1280:-2`, '-pix_fmt', 'yuv420p', '-crf', '20', mp4], { stdio: 'pipe' });
/* GIF in TWO passes. A single-pass split/palettegen graph collapses to one
   frame here — palettegen consumes the whole stream before paletteuse can
   draw, and the result encodes as a still. Verified by frame count, not by
   the encoder exiting zero. */
const palette = path.join(TMP, 'palette.png');
const gifChain = 'fps=20,scale=1000:-2:flags=lanczos';
execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', mp4, '-vf', `${gifChain},palettegen=max_colors=64`, palette], { stdio: 'pipe' });
execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', mp4, '-i', palette,
  '-lavfi', `${gifChain}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3`, '-loop', '0', gif], { stdio: 'pipe' });
const frameCount = readFileSync(gif).toString('latin1').split('\x00\x21\xf9\x04').length - 1;
if (frameCount < 10) throw new Error(`GIF encoded ${frameCount} frames — it is a still, not a recording`);
console.log(`  gif verified: ${frameCount} frames`);
rmSync(TMP, { recursive: true, force: true });
rmSync(path.join(T, '_seq.html'), { force: true });
rmSync(path.join(T, '_ba.html'), { force: true });

console.log(`\nrecording: ${i} frames → scale-transition-1366-1728.gif + .mp4`);
