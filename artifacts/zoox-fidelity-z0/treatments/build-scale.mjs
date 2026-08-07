/**
 * The cinematic-scale review sheet — 1366, 1440, 1536, 1728, 390.
 *
 * Composition lives in build-scale-scene.mjs and is shared with the true-size
 * frame capture, so what is reviewed here and what is approved as a frame are
 * the same markup.
 */
import { writeFileSync } from 'node:fs';
import { V, scene, FACES } from './build-scale-scene.mjs';
const OUT = new URL('.', import.meta.url).pathname;

/* At true pixel size these stages would not fit a review sheet, so each is
 * scaled down as a whole. The probe divides the factor back out, so every
 * number it reports is in true-viewport pixels rather than sheet pixels. */
const framed = (vw, face) => {
  const v = V[vw], f = (1180 / v.w).toFixed(4);
  return `<p class="cap" style="margin-top:32px">${v.label} · ${face} · record ${v.rec}px (${Math.round(v.rec / v.w * 100)}vw)</p>
  <div data-scaled="${f}" style="transform:scale(${f});transform-origin:top left;height:${Math.round(v.h * f)}px;margin-bottom:6px">${scene(vw, face)}</div>`;
};

const body = `<h2>Cinematic scale — 1366 / 1440 / 1536 / 1728 / 390</h2>
<p class="sub">Proportional scaling is now actually in effect, so the record has a true aspect ratio and its height tracks how much evidence has returned. No row is stretched, no band is padded, and the frame is full because the object <em>overflows</em> it rather than floating in it. BLANK and SEALED fit the stage; RETURNED and DECIDING are deliberately cropped at the bottom edge — the record continues, and continuing is what the next scroll does.</p>
${framed(1366,'BLANK')}${framed(1366,'RETURNED')}
${framed(1440,'BLANK')}${framed(1440,'RETURNED')}${framed(1440,'DECIDING')}${framed(1440,'SEALED')}
${framed(1536,'RETURNED')}
${framed(1728,'RETURNED')}${framed(1728,'DECIDING')}

<p class="cap" style="margin-top:36px">390 × 844 · composed for the viewport, not compressed from desktop</p>
<div class="grid">${scene(390,'BLANK')}${scene(390,'RETURNED')}</div>

<p class="cap" style="margin-top:36px">120px · all eight faces · every word covered</p>
<p class="sub" style="margin-bottom:14px">With the copy blanked, the object must stay recognisable and the states must stay distinguishable by silhouette, aperture fill and length alone.</p>
<div class="grid">${['BLANK','WRITING','RESOLVING','RETURNED','INSPECTED','DECIDING','TRAVELLING','SEALED']
  .map(f=>`<div class="covered thumb"><p class="cap">${f}</p><div class="scaler">${FACES[f](420)}</div></div>`).join('')}</div>`;

writeFileSync(`${OUT}b-scale.html`, `<!doctype html><html><head><meta charset="utf-8">
<title>B — cinematic scale convergence</title><link rel="stylesheet" href="./record-b.css">
<style>.stage{overflow:hidden}</style></head><body class="evr-scene"><div class="sheet">${body}</div></body></html>`);
console.log('built b-scale.html');
