/**
 * Z0 animatics — desktop, mobile, and reduced-motion.
 *
 * All three are built from the SAME shared scene-composition module as the
 * storyboard frames and the proof sheet, so none of them can drift.
 *
 * The desktop and mobile animatics move by changing the CROP — the record
 * travels under the stage. The object itself never resizes, tweens, or
 * dissolves; what changes is how much of it you can see and which state it is
 * in. That is the only motion the record is allowed.
 *
 * The REDUCED-MOTION animatic carries the complete argument with no travel at
 * all. Every state is a hard cut, and the faces that exceed the viewport are
 * presented at each reading position as separate cuts — which is what native
 * scrolling gives a reduced-motion user. Nothing is only reachable by
 * animation, so no claim is lost when motion is switched off.
 *
 * Run: node apps/web/scripts/capture-evidence-record-animatics.mjs
 */
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync, rmSync, copyFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const T = path.resolve(HERE, '../../../artifacts/zoox-fidelity-z0/treatments');
const OUT = path.join(T, 'frames');
mkdirSync(OUT, { recursive: true });
const mod = await import(path.join(T, 'build-scale-scene.mjs'));

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
/** hold a state */
const hold = (vw, face, offset, n) => Array.from({ length: n }, () => ({ vw, face, offset }));
/** travel the crop from `from` to `to` */
const travel = (vw, face, from, to, n) =>
  Array.from({ length: n }, (_, i) => ({ vw, face, offset: Math.round(from + (to - from) * ease(i / (n - 1))) }));

/* ---------------------------------------------------------------- boards -- */
const DESKTOP = [
  ...hold(1440, 'BLANK', 0, 14),
  ...hold(1440, 'WRITING', 0, 14),
  ...hold(1440, 'RESOLVING', 0, 16),
  ...hold(1440, 'RETURNED', 0, 10),
  ...travel(1440, 'RETURNED', 0, 850, 46),
  ...hold(1440, 'RETURNED', 850, 8),
  ...hold(1440, 'INSPECTED', 0, 22),
  ...hold(1440, 'DECIDING', 0, 12),
  ...travel(1440, 'DECIDING', 0, 320, 20),
  ...hold(1440, 'TRAVELLING', 0, 24),
  ...hold(1440, 'SEALED', 0, 26),
];

const MOBILE = [
  ...hold(390, 'BLANK', 0, 12),
  ...hold(390, 'WRITING', 0, 12),
  ...hold(390, 'RESOLVING', 0, 14),
  ...hold(390, 'RETURNED', 0, 10),
  ...travel(390, 'RETURNED', 0, 680, 40),
  ...hold(390, 'RETURNED', 680, 8),
  ...hold(390, 'INSPECTED', 0, 20),
  ...hold(390, 'DECIDING', 0, 18),
  ...hold(390, 'SEALED', 0, 22),
];

/* No travel. Every reading position is its own cut. */
const REDUCED = [
  ...hold(1440, 'BLANK', 0, 9),
  ...hold(1440, 'WRITING', 0, 9),
  ...hold(1440, 'RESOLVING', 0, 10),
  ...hold(1440, 'RETURNED', 0, 12),
  ...hold(1440, 'RETURNED', 430, 12),
  ...hold(1440, 'RETURNED', 850, 12),
  ...hold(1440, 'INSPECTED', 0, 12),
  ...hold(1440, 'DECIDING', 0, 10),
  ...hold(1440, 'DECIDING', 320, 10),
  ...hold(1440, 'TRAVELLING', 0, 10),
  ...hold(1440, 'SEALED', 0, 11),
];

/* ------------------------------------------------------------- rendering -- */
const browser = await chromium.launch();
const CACHE = path.join(T, '_anicache');
rmSync(CACHE, { recursive: true, force: true });
mkdirSync(CACHE, { recursive: true });
const tmpHtml = path.join(T, '_ani.html');
const rendered = new Map();

const renderState = async (s) => {
  const key = `${s.vw}-${s.face}-${s.offset}`;
  if (rendered.has(key)) return rendered.get(key);
  const v = mod.V[s.vw];
  writeFileSync(tmpHtml, mod.frameDoc(s.vw, s.face, { offset: s.offset }));
  const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.goto(`file://${tmpHtml}`, { waitUntil: 'load' });
  if (rendered.size === 0) { await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(400); }
  const file = path.join(CACHE, `${key}.png`);
  await p.screenshot({ path: file });
  await ctx.close();
  rendered.set(key, file);
  return file;
};

const encode = async (board, name, fps, label) => {
  const seq = path.join(T, `_seq_${name}`);
  rmSync(seq, { recursive: true, force: true });
  mkdirSync(seq, { recursive: true });
  let i = 0;
  for (const s of board) {
    const src = await renderState(s);
    copyFileSync(src, path.join(seq, `f${String(i).padStart(4, '0')}.png`));
    i++;
  }
  const v = mod.V[board[0].vw];
  const mp4 = path.join(OUT, `${name}.mp4`);
  const gif = path.join(OUT, `${name}.gif`);
  const gifW = v.w > 800 ? 900 : 380;
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', String(fps), '-i', path.join(seq, 'f%04d.png'),
    '-vf', `scale=${v.w > 800 ? 1280 : 480}:-2`, '-pix_fmt', 'yuv420p', '-crf', '20', mp4], { stdio: 'pipe' });
  /* GIF in two passes — a single-pass split/palettegen graph collapses to one
     frame, and the encoder still exits zero, so the count is verified below. */
  const pal = path.join(seq, 'pal.png');
  const chain = `fps=${Math.min(fps, 20)},scale=${gifW}:-2:flags=lanczos`;
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', mp4, '-vf', `${chain},palettegen=max_colors=64`, pal], { stdio: 'pipe' });
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', mp4, '-i', pal,
    '-lavfi', `${chain}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3`, '-loop', '0', gif], { stdio: 'pipe' });
  const frames = readFileSync(gif).toString('latin1').split('\x00\x21\xf9\x04').length - 1;
  if (frames < 10) throw new Error(`${name}: GIF encoded ${frames} frames — it is a still, not a recording`);
  rmSync(seq, { recursive: true, force: true });
  console.log(`  ${name.padEnd(34)} ${String(i).padStart(3)} frames @${fps}fps · ${(i / fps).toFixed(1)}s · gif ${frames} frames · ${label}`);
};

console.log('\nANIMATICS');
await encode(DESKTOP, 'animatic-desktop-1440', 24, 'crop travels, object never resizes');
await encode(MOBILE, 'animatic-mobile-390', 24, 'composed for the viewport');
await encode(REDUCED, 'animatic-reduced-motion-1440', 8, 'hard cuts only, complete argument');

rmSync(CACHE, { recursive: true, force: true });
rmSync(tmpHtml, { force: true });
await browser.close();
console.log(`\n${rendered.size} unique states rendered`);
