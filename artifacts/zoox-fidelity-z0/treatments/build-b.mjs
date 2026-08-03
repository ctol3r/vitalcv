/**
 * Refined Treatment B — the canonical Living Evidence Record.
 *
 * Produces three review sheets:
 *   b-refinements.html  — spine 4/5/6 selection, aperture states, seal, SEALED
 *   b-cinematic.html    — the object at hero scale (refinement 8)
 *   b-faces.html        — the first storyboard batch of faces
 *
 * Data rule: fictional holder, MASKED NPI tail only.
 */
import { writeFileSync } from 'node:fs';
const OUT = new URL('.', import.meta.url).pathname;

const HOLDER = 'K. Osei, PA-C';
const NPI = 'NPI ····· 4821';
const ILLUS = 'Illustrative — not a live result';
const LANES = ['NPPES Identity', 'OIG Exclusions', 'State License', 'PECOS Enrollment', 'Employment History', 'Board Certification'];

/*
 * SIX rows, matching the six apertures.
 *
 * The band has always shown six lanes while the row stack showed four, so the
 * object asserted six sources and accounted for four. That is not a layout
 * detail on an evidence surface — a viewer counting apertures against rows
 * would find two lanes unexplained. The two additions are not new claims:
 * they are the two lanes VitalCV genuinely cannot read, stated as exactly that.
 */
const ROWS = [
  { c:'Identity', r:'Located in the NPPES registry', p:'NPPES · read live · The registry lists the provider record. It does not attest to current practice.', s:'s-conf', g:'●', w:'Checked' },
  { c:'OIG exclusions', r:'No match in the current LEIE file', p:'OIG/LEIE · monthly snapshot · A monthly file cannot show an exclusion published after it was compiled.', s:'s-snap', g:'◐', w:'Snapshot' },
  { c:'State licensure', r:'Not read — state-board access required', p:'Licensure · access-gated · VitalCV has no board or FSMB access for this lane yet.', s:'s-acc', g:'⊘', w:'Access required' },
  { c:'Medicare enrollment', r:'An active enrollment was returned', p:'PECOS · quarterly snapshot · A quarterly snapshot can lag a recent enrollment change.', s:'s-snap', g:'◐', w:'Snapshot' },
  { c:'Employment history', r:'Not read — the source was not queried', p:'The Work Number · not read · No employment source is connected for this record.', s:'s-pend', g:'○', w:'Not checked' },
  { c:'Board certification', r:'Not read — the source was not queried', p:'ABMS / specialty board · not read · No certification source is connected for this record.', s:'s-pend', g:'○', w:'Not checked' },
];
const LEDGER = [
  { c:'Identity & taxonomy', d:'from NPPES Identity', t:true },
  { c:'Federal exclusion result', d:'from OIG LEIE', t:true },
  { c:'License claim', d:'travels as exactly what it is — not read', t:true },
  { c:'Compensation expectations', d:'entered by the clinician · never sourced', t:false },
  { c:'Current employer standing', d:'not queried', t:false },
];

const spine = '<span class="evr-spine"></span>';
const stamp = (r) => `<span class="stamp ${r.s}"><span class="g">${r.g}</span>${r.w}</span>`;
/** states: array of 6 from closed|opening|returned|limited|unavailable */
const band = (states) => `<div class="evr-apertures">${states.map((s,i)=>`<span class="evr-ap" data-s="${s}" title="${LANES[i]}"></span>`).join('')}</div>`;
const head = (o={}) => `<header class="evr-head">
  <p class="evr-eyebrow"><span>Evidence record</span><span class="illus">${o.tag ?? ''}</span></p>
  ${o.name ? `<p class="evr-name">${o.name}</p>` : ''}
  ${o.npi ? `<p class="evr-npi">${o.npi}</p>` : ''}</header>`;

const S = { closed:Array(6).fill('closed'), opening:['opening','opening','closed','closed','closed','closed'],
  returned:['returned','returned','limited','returned','unavailable','unavailable'] };

/* -------------------------------------------------------------- the faces */
const F = {};
F.BLANK = (w, scale) => `<div class="evr"${scale?` data-scale="${scale}"`:''} style="--wn:${w}">${spine}${head({tag:'Awaiting your number'})}${band(S.closed)}
  <div class="evr-body"><ul class="evr-rows">${LANES.map(l=>`<li class="evr-row"><span class="evr-claim">${l}</span>
  <span class="stamp s-pend"><span class="g">○</span>Not checked</span></li>`).join('')}</ul></div></div>`;

F.WRITING = (w, scale) => `<div class="evr"${scale?` data-scale="${scale}"`:''} style="--wn:${w}">${spine}${head({tag:'Reading your number', npi:'NPI 13•• ••• ••••'})}${band(S.closed)}
  <div class="evr-body"><ul class="evr-rows">${LANES.map(l=>`<li class="evr-row"><span class="evr-claim">${l}</span>
  <span class="stamp s-pend"><span class="g">○</span>Not checked</span></li>`).join('')}</ul></div></div>`;

F.RESOLVING = (w, scale) => `<div class="evr"${scale?` data-scale="${scale}"`:''} style="--wn:${w}">${spine}${head({tag:'Querying sources', npi:NPI})}${band(S.opening)}
  <div class="evr-body"><ul class="evr-rows">${LANES.map((l,i)=>`<li class="evr-row"><span class="evr-claim">${l}</span>
  <span class="stamp ${i<2?'s-pend':'s-pend'}"><span class="g">○</span>${i<2?'Asking':'Not checked'}</span></li>`).join('')}</ul></div></div>`;

F.RETURNED = (w, scale) => `<div class="evr"${scale?` data-scale="${scale}"`:''} style="--wn:${w}">${spine}${head({tag:ILLUS, name:HOLDER, npi:NPI})}${band(S.returned)}
  <div class="evr-body"><ul class="evr-rows">${ROWS.map(r=>`<li class="evr-row"><span class="evr-assert">
  <span class="evr-claim">${r.c}</span><span class="evr-ret">${r.r}</span></span>${stamp(r)}<span class="evr-prov">${r.p}</span></li>`).join('')}</ul>
  <div class="evr-receipt">rcpt:nppes:8f2a…c41 · ES256 · P-256 · /.well-known/jwks.json</div></div></div>`;

F.INSPECTED = (w, scale) => `<div class="evr"${scale?` data-scale="${scale}"`:''} style="--wn:${w}">${spine}${head({tag:ILLUS, name:HOLDER, npi:NPI})}${band(S.returned)}
  <div class="evr-body"><ul class="evr-rows">
  <li class="evr-row"><span class="evr-assert"><span class="evr-claim">Identity</span><span class="evr-ret">Located in the NPPES registry</span></span>${stamp(ROWS[0])}</li>
  <li class="evr-row evr-row--opened" style="background:var(--paper);border-top:2px solid var(--ink-strong)">
    <span class="evr-claim" style="margin-bottom:calc(6px * var(--u))">Identity — opened</span>
    ${[['State','Checked'],['Source','NPPES NPI Registry'],['Observation','2026-08-02 14:02Z'],['Retrieval','Read from the registry at the moment of this request'],['Receipt','rcpt:nppes:8f2a…c41'],['Limitation','Identity and taxonomy only. A registry match is not a licence status.'],['Permitted use','Employer review. Not a credentialing decision.']]
      .map(([k,v])=>`<span class="evr-prov" style="display:grid;grid-template-columns:calc(84px * var(--u)) 1fr;gap:calc(8px * var(--u))"><span style="text-transform:uppercase;letter-spacing:.08em">${k}</span><span style="color:var(--ink)">${v}</span></span>`).join('')}
  </li>
  ${ROWS.slice(1,3).map(r=>`<li class="evr-row"><span class="evr-assert"><span class="evr-claim">${r.c}</span><span class="evr-ret">${r.r}</span></span>${stamp(r)}</li>`).join('')}
  </ul></div></div>`;

F.DECIDING = (w, scale) => `<div class="evr"${scale?` data-scale="${scale}"`:''} style="--wn:${w}">${spine}${head({tag:'Illustrative workflow', name:HOLDER, npi:NPI})}${band(S.returned)}
  <div class="evr-body"><ul class="evr-rows">${LEDGER.map(e=>`<li class="evr-row" data-travel="${e.t?'travels':'held'}"><span class="evr-assert">
  <span class="evr-claim">${e.c}</span><span class="evr-ret">${e.d}</span></span>
  <span class="evr-perm" data-t="${e.t?'travels':'held'}">${e.t?'→ Travels':'■ Held'}</span></li>`).join('')}</ul>
  <div class="evr-receipt">3 rows travel · 2 rows held with you</div></div></div>`;

F.TRAVELLING = (w, scale) => `<div style="display:flex;gap:${Math.round(w*0.07)}px;align-items:flex-start">
  <div class="evr"${scale?` data-scale="${scale}"`:''} style="--wn:${w}">${spine}${head({tag:'Illustrative workflow', name:HOLDER, npi:NPI})}${band(S.returned)}
   <div class="evr-body"><ul class="evr-rows">${LEDGER.map(e=>`<li class="evr-row" data-travel="${e.t?'travels':'held'}"><span class="evr-assert">
   <span class="evr-claim">${e.c}</span></span><span class="evr-perm" data-t="${e.t?'travels':'held'}">${e.t?'→':'■'}</span></li>`).join('')}</ul>
   <div class="evr-receipt">the complete record stays with the clinician</div></div></div>
  <div class="evr evr--recipient"${scale?` data-scale="${scale}"`:''} style="--wn:${Math.round(w*0.62)}">${spine}${head({tag:'Recipient frame'})}${band(['returned','returned','limited','closed','closed','closed'])}
   <div class="evr-body"><ul class="evr-rows">${LEDGER.filter(e=>e.t).map(e=>`<li class="evr-row"><span class="evr-claim">${e.c}</span>
   <span class="evr-perm" data-t="travels">arrives</span></li>`).join('')}</ul>
   <div class="evr-receipt">held rows are not in this frame — their absence is not flagged</div></div></div></div>`;

F.SEALED = (w, scale) => `<div class="evr evr--sealed"${scale?` data-scale="${scale}"`:''} style="--wn:${w}">${spine}${head({tag:ILLUS, npi:NPI})}${band(S.returned)}
  <div class="evr-body" style="align-items:center;justify-content:center;padding:calc(24px * var(--u)) calc(18px * var(--u))">
  <div class="evr-seal">Permission<br>recorded</div></div>
  <div class="evr-receipt">rcpt:nppes:8f2a…c41 · ES256 signed · scope: this application</div></div>`;

export const FACES = F;

const shell = (title, body) => `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
<link rel="stylesheet" href="./record-b.css"></head><body><div class="sheet">${body}</div></body></html>`;

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
