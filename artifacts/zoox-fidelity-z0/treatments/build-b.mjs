/**
 * Z0 review-sheet builder for the canonical Living Evidence Record.
 *
 * THE OBJECT NO LONGER LIVES HERE. At Z1 the approved faces graduated into
 * the application as the single source of truth:
 *   apps/web/components/evidence-record/faces.mjs   (markup)
 *   apps/web/components/evidence-record/record.css  (rules; record-b.css @imports it)
 * This file re-exports FACES for the other Z0 builders and generates the
 * review sheets. Editing the object means editing the app module — a copy
 * here would be exactly the drift the Z1 directive forbids.
 */
import { writeFileSync } from 'node:fs';
import { FACES, HOLDER, NPI_MASKED as NPI, ILLUS, LANES, ROWS, LEDGER, S, band } from '../../../apps/web/components/evidence-record/faces.mjs';
const OUT = new URL('.', import.meta.url).pathname;

export { FACES };
const F = FACES;
const spine = '<span class="evr-spine"></span>';
const stamp = (r) => `<span class="stamp ${r.s}"><span class="g">${r.g}</span>${r.w}</span>`;
const head = (o={}) => `<header class="evr-head">
  <p class="evr-eyebrow"><span>Evidence record</span><span class="illus">${o.tag ?? ''}</span></p>
  ${o.name ? `<p class="evr-name">${o.name}</p>` : ''}
  ${o.npi ? `<p class="evr-npi">${o.npi}</p>` : ''}</header>`;


const shell = (title, body) => `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<link rel="stylesheet" href="./record-b.css"></head><body class="evr-scene"><div class="sheet">${body}</div></body></html>`;

/* ---------------------------------------------------------- sheet 1: refinements */
const spineTest = [4,5,6].map(px=>`<div><p class="cap">Spine ${px}px</p>
  <div style="--spine:${px}px">${F.RETURNED(420)}</div>
  <div class="covered thumb" style="--spine:${px}px;margin-top:14px"><div class="scaler">${F.RETURNED(420)}</div></div></div>`).join('');

const apTest = [['closed','Nothing checked'],['opening','Request in flight'],['returned','Source answered'],['limited','Access or scope limitation'],['unavailable','System could not answer']]
  .map(([s,label])=>`<div><p class="cap">${s}</p>
   <div class="evr" style="--wn:260">${spine}${head({tag:label})}${band(Array(6).fill(s))}</div></div>`).join('');

writeFileSync(`${OUT}b-refinements.html`, shell('B — refinements', `
<h2>Treatment B — refinements applied</h2>
<p class="sub">Backing layer removed: measured byte-identical with and without it. Indigo now appears only on permission choices and the travel action — never on an aperture or a state stamp. Seal is ~68px at a 420px record, ink outline, no fill.</p>

<p class="cap">Refinement 3 · spine width, in composition, with its thumbnail beneath</p>
<div class="grid">${spineTest}</div>

<p class="cap" style="margin-top:36px">Refinement 6 · the five aperture states</p>
<p class="sub">Fill does the work, not hue. LIMITED is barred so it can never read as full; UNAVAILABLE is struck so it is visibly different from CLOSED, which means "not asked".</p>
<div class="grid">${apTest}</div>

<p class="cap" style="margin-top:36px">Refinement 7 · SEALED is shorter, and the same object</p>
<p class="sub">Same width, same top edge, same spine, same aperture rhythm, same receipt edge, same material. Only the row stack is gone.</p>
<div class="grid"><div>${F.RETURNED(420)}</div><div>${F.SEALED(420)}</div></div>
`));

/* ---------------------------------------------------------- sheet 2: cinematic */
writeFileSync(`${OUT}b-cinematic.html`, shell('B — cinematic scale', `
<h2>Treatment B at hero scale</h2>
<p class="sub">Refinement 8. Every dimension scales from the object's own width, so this is one design at four sizes rather than a small design enlarged. The stages below are true viewport boxes.</p>

<p class="cap">1440 × 900 · record at 70vw (1008px) · cropped by the stage, deliberately</p>
<div class="stage" style="width:1440px;height:900px;display:flex;align-items:center;padding-left:80px">
  <div style="margin-bottom:-120px">${F.RETURNED(1008)}</div>
</div>

<p class="cap" style="margin-top:34px">390 × 844 · record at 340px</p>
<div class="stage" style="width:390px;height:844px;display:flex;align-items:center;justify-content:center;padding:0 25px">
  ${F.RETURNED(340)}
</div>

<p class="cap" style="margin-top:34px">1728 × 1117 · record at 60vw (1037px)</p>
<div class="stage" style="width:1728px;height:1117px;display:flex;align-items:center;padding-left:110px;transform:scale(0.86);transform-origin:top left">
  <div>${F.RETURNED(1037,'hero')}</div>
</div>
`));

/* ---------------------------------------------------------- sheet 3: faces */
const order = ['BLANK','WRITING','RESOLVING','RETURNED','INSPECTED','DECIDING','TRAVELLING','SEALED'];
writeFileSync(`${OUT}b-faces.html`, shell('B — faces', `
<h2>The first storyboard batch — eight faces of one object</h2>
<p class="sub">Hero BLANK, WRITING, RESOLVING, RETURNED, INSPECTED, DECIDING, TRAVELLING, SEALED. Same silhouette, same top edge, same spine, same aperture rhythm throughout — only fill, layer and crop change.</p>
${order.map(f=>`<p class="cap" style="margin-top:26px">${f}</p><div class="grid">${F[f](420)}</div>`).join('')}

<p class="cap" style="margin-top:36px">Recognition test · 120px · all copy covered</p>
<div class="grid">${['BLANK','RESOLVING','RETURNED','INSPECTED','DECIDING','SEALED'].map(f=>`<div class="covered thumb"><p class="cap">${f}</p><div class="scaler">${F[f](420)}</div></div>`).join('')}</div>
`));

console.log('built b-refinements.html b-cinematic.html b-faces.html');
