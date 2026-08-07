/**
 * THE LIVING EVIDENCE RECORD — canonical faces.
 *
 * Founder-approved at Z0 (Treatment B, ten refinements, cinematic scale
 * approved 2026-08-03). This module IS the approved definition: the Z0 review
 * sheets, storyboards and animatics under artifacts/zoox-fidelity-z0 import
 * from HERE, and so does the application. One definition, two consumers —
 * rebuilding a second implementation that can drift is expressly forbidden by
 * the Z1 directive.
 *
 * Plain ESM template strings on purpose: the object is markup + record.css,
 * and a server component injects it verbatim. The faces carry no state and no
 * handlers, so React wrapping would add a translation layer that could drift.
 *
 * Data rule (Z0 shot list): fictional holder, MASKED NPI tail only — never a
 * well-formed ten-digit number, valid or synthetic.
 */

export const HOLDER = 'K. Osei, PA-C';
export const NPI_MASKED = 'NPI ····· 4821';
export const ILLUS = 'Illustrative — not a live result';
export const LANES = ['NPPES Identity', 'OIG Exclusions', 'State License', 'PECOS Enrollment', 'Employment History', 'Board Certification'];

/*
 * SIX rows, matching the six apertures. The band asserts six sources, so the
 * stack accounts for six — the two VitalCV cannot read say exactly that.
 */
export const ROWS = [
  { c: 'Identity', r: 'Located in the NPPES registry', p: 'NPPES · read live · The registry lists the provider record. It does not attest to current practice.', s: 's-conf', g: '●', w: 'Checked' },
  { c: 'OIG exclusions', r: 'No match in the current LEIE file', p: 'OIG/LEIE · monthly snapshot · A monthly file cannot show an exclusion published after it was compiled.', s: 's-snap', g: '◐', w: 'Snapshot' },
  { c: 'State licensure', r: 'Not read — state-board access required', p: 'Licensure · access-gated · VitalCV has no board or FSMB access for this lane yet.', s: 's-acc', g: '⊘', w: 'Access required' },
  { c: 'Medicare enrollment', r: 'An active enrollment was returned', p: 'PECOS · quarterly snapshot · A quarterly snapshot can lag a recent enrollment change.', s: 's-snap', g: '◐', w: 'Snapshot' },
  { c: 'Employment history', r: 'Not read — the source was not queried', p: 'The Work Number · not read · No employment source is connected for this record.', s: 's-pend', g: '○', w: 'Not checked' },
  { c: 'Board certification', r: 'Not read — the source was not queried', p: 'ABMS / specialty board · not read · No certification source is connected for this record.', s: 's-pend', g: '○', w: 'Not checked' },
];

export const LEDGER = [
  { c: 'Identity & taxonomy', d: 'from NPPES Identity', t: true },
  { c: 'Federal exclusion result', d: 'from OIG LEIE', t: true },
  { c: 'License claim', d: 'travels as exactly what it is — not read', t: true },
  { c: 'Compensation expectations', d: 'entered by the clinician · never sourced', t: false },
  { c: 'Current employer standing', d: 'not queried', t: false },
];

const spine = '<span class="evr-spine"></span>';
const stamp = (r) => `<span class="stamp ${r.s}"><span class="g">${r.g}</span>${r.w}</span>`;
/** states: array of 6 from closed|opening|returned|limited|unavailable */
export const band = (states) => `<div class="evr-apertures">${states.map((s, i) => `<span class="evr-ap" data-s="${s}" title="${LANES[i]}"></span>`).join('')}</div>`;
const head = (o = {}) => `<header class="evr-head">
  <p class="evr-eyebrow"><span>Evidence record</span><span class="illus">${o.tag ?? ''}</span></p>
  ${o.name ? `<p class="evr-name">${o.name}</p>` : ''}
  ${o.npi ? `<p class="evr-npi">${o.npi}</p>` : ''}</header>`;

export const S = {
  closed: Array(6).fill('closed'),
  opening: ['opening', 'opening', 'closed', 'closed', 'closed', 'closed'],
  returned: ['returned', 'returned', 'limited', 'returned', 'unavailable', 'unavailable'],
};

const F = {};

F.BLANK = (w, scale) => `<div class="evr"${scale ? ` data-scale="${scale}"` : ''} style="--wn:${w}">${spine}${head({ tag: 'Awaiting your number' })}${band(S.closed)}
  <div class="evr-body"><ul class="evr-rows">${LANES.map((l) => `<li class="evr-row"><span class="evr-claim">${l}</span>
  <span class="stamp s-pend"><span class="g">○</span>Not checked</span></li>`).join('')}</ul></div></div>`;

F.WRITING = (w, scale) => `<div class="evr"${scale ? ` data-scale="${scale}"` : ''} style="--wn:${w}">${spine}${head({ tag: 'Reading your number', npi: 'NPI 13•• ••• ••••' })}${band(S.closed)}
  <div class="evr-body"><ul class="evr-rows">${LANES.map((l) => `<li class="evr-row"><span class="evr-claim">${l}</span>
  <span class="stamp s-pend"><span class="g">○</span>Not checked</span></li>`).join('')}</ul></div></div>`;

F.RESOLVING = (w, scale) => `<div class="evr"${scale ? ` data-scale="${scale}"` : ''} style="--wn:${w}">${spine}${head({ tag: 'Querying sources', npi: NPI_MASKED })}${band(S.opening)}
  <div class="evr-body"><ul class="evr-rows">${LANES.map((l, i) => `<li class="evr-row"><span class="evr-claim">${l}</span>
  <span class="stamp s-pend"><span class="g">○</span>${i < 2 ? 'Asking' : 'Not checked'}</span></li>`).join('')}</ul></div></div>`;

F.RETURNED = (w, scale) => `<div class="evr"${scale ? ` data-scale="${scale}"` : ''} style="--wn:${w}">${spine}${head({ tag: ILLUS, name: HOLDER, npi: NPI_MASKED })}${band(S.returned)}
  <div class="evr-body"><ul class="evr-rows">${ROWS.map((r) => `<li class="evr-row"><span class="evr-assert">
  <span class="evr-claim">${r.c}</span><span class="evr-ret">${r.r}</span></span><span class="evr-prov">${r.p}</span>${stamp(r)}</li>`).join('')}</ul>
  <div class="evr-receipt">rcpt:nppes:8f2a…c41 · ES256 · P-256 · /.well-known/jwks.json</div></div></div>`;

F.INSPECTED = (w, scale) => `<div class="evr"${scale ? ` data-scale="${scale}"` : ''} style="--wn:${w}">${spine}${head({ tag: ILLUS, name: HOLDER, npi: NPI_MASKED })}${band(S.returned)}
  <div class="evr-body"><ul class="evr-rows">
  <li class="evr-row"><span class="evr-assert"><span class="evr-claim">Identity</span><span class="evr-ret">Located in the NPPES registry</span></span>${stamp(ROWS[0])}</li>
  <li class="evr-row evr-row--opened" style="background:var(--paper);border-top:2px solid var(--ink-strong)">
    <span class="evr-claim" style="margin-bottom:calc(6px * var(--u))">Identity — opened</span>
    ${[['State', 'Checked'], ['Source', 'NPPES NPI Registry'], ['Observation', '2026-08-02 14:02Z'], ['Retrieval', 'Read from the registry at the moment of this request'], ['Receipt', 'rcpt:nppes:8f2a…c41'], ['Limitation', 'Identity and taxonomy only. A registry match is not a licence status.'], ['Permitted use', 'Employer review. Not a credentialing decision.']]
      .map(([k, v]) => `<span class="evr-prov" style="display:grid;grid-template-columns:calc(120px * var(--u)) 1fr;gap:calc(8px * var(--u))"><span style="text-transform:uppercase;letter-spacing:.08em">${k}</span><span style="color:var(--ink)">${v}</span></span>`).join('')}
  </li>
  ${ROWS.slice(1, 3).map((r) => `<li class="evr-row"><span class="evr-assert"><span class="evr-claim">${r.c}</span><span class="evr-ret">${r.r}</span></span>${stamp(r)}</li>`).join('')}
  </ul></div></div>`;

F.DECIDING = (w, scale) => `<div class="evr"${scale ? ` data-scale="${scale}"` : ''} style="--wn:${w}">${spine}${head({ tag: 'Illustrative workflow', name: HOLDER, npi: NPI_MASKED })}${band(S.returned)}
  <div class="evr-body"><ul class="evr-rows">${LEDGER.map((e) => `<li class="evr-row" data-travel="${e.t ? 'travels' : 'held'}"><span class="evr-assert">
  <span class="evr-claim">${e.c}</span><span class="evr-ret">${e.d}</span></span>
  <span class="evr-perm" data-t="${e.t ? 'travels' : 'held'}">${e.t ? '→ Travels' : '■ Held'}</span></li>`).join('')}</ul>
  <div class="evr-receipt">3 rows travel · 2 rows held with you</div></div></div>`;

F.TRAVELLING = (w, scale) => `<div style="display:flex;gap:${Math.round(w * 0.07)}px;align-items:flex-start">
  <div class="evr"${scale ? ` data-scale="${scale}"` : ''} style="--wn:${w}">${spine}${head({ tag: 'Illustrative workflow', name: HOLDER, npi: NPI_MASKED })}${band(S.returned)}
   <div class="evr-body"><ul class="evr-rows">${LEDGER.map((e) => `<li class="evr-row" data-travel="${e.t ? 'travels' : 'held'}"><span class="evr-assert">
   <span class="evr-claim">${e.c}</span></span><span class="evr-perm" data-t="${e.t ? 'travels' : 'held'}">${e.t ? '→' : '■'}</span></li>`).join('')}</ul>
   <div class="evr-receipt">the complete record stays with the clinician</div></div></div>
  <div class="evr evr--recipient"${scale ? ` data-scale="${scale}"` : ''} style="--wn:${Math.round(w * 0.62)}">${spine}${head({ tag: 'Recipient frame' })}${band(['returned', 'returned', 'limited', 'closed', 'closed', 'closed'])}
   <div class="evr-body"><ul class="evr-rows">${LEDGER.filter((e) => e.t).map((e) => `<li class="evr-row"><span class="evr-claim">${e.c}</span>
   <span class="evr-perm" data-t="travels">arrives</span></li>`).join('')}</ul>
   <div class="evr-receipt">held rows are not in this frame — their absence is not flagged</div></div></div></div>`;

F.SEALED = (w, scale) => `<div class="evr evr--sealed"${scale ? ` data-scale="${scale}"` : ''} style="--wn:${w}">${spine}${head({ tag: ILLUS, npi: NPI_MASKED })}${band(S.returned)}
  <div class="evr-body" style="align-items:center;justify-content:center;padding:calc(24px * var(--u)) calc(18px * var(--u))">
  <div class="evr-seal">Permission<br>recorded</div></div>
  <div class="evr-receipt">rcpt:nppes:8f2a…c41 · ES256 signed · scope: this application</div></div>`;

export const FACES = F;
