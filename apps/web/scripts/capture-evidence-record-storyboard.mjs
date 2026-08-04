/**
 * Z0 storyboard capture — 13 desktop frames, 9 mobile frames, and a contact
 * sheet for each. Every frame comes from the shared scene-composition module,
 * so the storyboard, the proof sheet and the animatics cannot drift.
 *
 * Run: node apps/web/scripts/capture-evidence-record-storyboard.mjs
 */
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const T = path.resolve(HERE, '../../../artifacts/zoox-fidelity-z0/treatments');
const mod = await import(path.join(T, 'build-scale-scene.mjs'));

const DESK = path.join(T, 'frames/storyboard-desktop');
const MOB = path.join(T, 'frames/storyboard-mobile');
for (const d of [DESK, MOB]) { rmSync(d, { recursive: true, force: true }); mkdirSync(d, { recursive: true }); }

const browser = await chromium.launch();
const tmp = path.join(T, '_sb.html');

const capture = async (board, dir, label) => {
  console.log(`\n${label}`);
  let n = 0;
  for (const s of board) {
    const v = mod.V[s.vw];
    writeFileSync(tmp, mod.frameDoc(s.vw, s.face, { offset: s.offset }));
    const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h }, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    await p.goto(`file://${tmp}`, { waitUntil: 'load' });
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(350);
    n += 1;
    const name = `${String(n).padStart(2, '0')}-${s.face.toLowerCase()}${s.offset ? `-at${s.offset}` : ''}.png`;
    await p.screenshot({ path: path.join(dir, name) });
    console.log(`  ${name.padEnd(30)} ${s.vw}×${v.h}  ${s.title}`);
    await ctx.close();
  }
  return n;
};

const nD = await capture(mod.STORYBOARD_DESKTOP, DESK, 'DESKTOP STORYBOARD');
const nM = await capture(mod.STORYBOARD_MOBILE, MOB, 'MOBILE STORYBOARD');

/* ---- contact sheets ------------------------------------------------------
 * Each stage is scaled down as a whole so the sequence can be read at once.
 * These are for reading the narrative; the true-size PNGs above are the frames. */
const sheet = (board, cols, target, title, blurb) => {
  const cells = board.map((s, i) => {
    const v = mod.V[s.vw];
    const f = (target / v.w).toFixed(4);
    return `<figure style="margin:0">
      <p class="cap">${String(i + 1).padStart(2, '0')} · ${s.vw} · ${s.face}${s.offset ? ` · scrolled ${s.offset}px` : ''}</p>
      <div style="width:${target}px;height:${Math.round(v.h * f)}px;overflow:hidden;border:1px solid var(--rule)">
        <div style="transform:scale(${f});transform-origin:top left">${mod.scene(s.vw, s.face, { offset: s.offset })}</div>
      </div>
      <figcaption style="margin-top:8px;max-width:${target}px">
        <strong style="font-size:13px;color:var(--ink-strong)">${s.title}</strong>
        ${s.note ? `<p style="font-size:12.5px;color:var(--ink-muted);margin-top:3px;line-height:1.5">${s.note}</p>` : ''}
      </figcaption></figure>`;
  }).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<link rel="stylesheet" href="./record-b.css"><style>.stage{overflow:hidden;border:0}</style></head>
<body class="evr-scene"><div class="sheet"><h2>${title}</h2><p class="sub">${blurb}</p>
<div style="display:grid;grid-template-columns:repeat(${cols},max-content);gap:34px 30px">${cells}</div>
</div></body></html>`;
};

writeFileSync(path.join(T, 'b-storyboard-desktop.html'), sheet(mod.STORYBOARD_DESKTOP, 2, 560,
  'Desktop storyboard — 13 frames',
  'The narrative is the object&rsquo;s own behaviour: it arrives empty, takes an identity from the NPI, opens only the lanes actually queried, grows past the frame as sources answer, opens a claim to its provenance, lets the holder choose what travels, hands a subset over, and closes. Captions describe what the record does and introduce no claim the object does not already carry.'));

writeFileSync(path.join(T, 'b-storyboard-mobile.html'), sheet(mod.STORYBOARD_MOBILE, 5, 250,
  'Mobile storyboard — 9 frames',
  'Composed for the viewport, not compressed from desktop. Type holds at design size, so the record wraps more and is proportionally taller — and the same instrument is present: fixed top edge, six apertures, claim/retrieval/provenance separation, receipt edge, closure.'));

rmSync(tmp, { force: true });
await browser.close();
console.log(`\n${nD} desktop + ${nM} mobile frames · b-storyboard-desktop.html · b-storyboard-mobile.html`);
