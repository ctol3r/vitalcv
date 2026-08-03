/**
 * Renders the three Living Evidence Record treatments.
 *
 * ONE anatomy, ONE content set, ONE state truth — only art direction differs.
 * Any divergence between A, B and C other than CSS class is a bug in this file.
 *
 * Data rule (shot list): fictional holder, MASKED NPI tail only — never a
 * well-formed ten-digit number, valid or synthetic.
 */
import { writeFileSync, mkdirSync } from 'node:fs';

const OUT = new URL('.', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const HOLDER = 'K. Osei, PA-C';
const NPI = 'NPI ····· 4821';
const ILLUS = 'Illustrative — not a live result';

/** The six lanes, in registry order. Shared by every treatment and face. */
const LANES = ['NPPES Identity', 'OIG Exclusions', 'State License', 'PECOS Enrollment', 'Employment History', 'Board Certification'];

/** RETURNED rows — the same four claims in all three treatments. */
const ROWS = [
  { claim: 'Identity', ret: 'Located in the NPPES registry', prov: 'NPPES · read live · The registry lists the provider record. It does not attest to current practice.', s: 's-conf', g: '●', w: 'Checked' },
  { claim: 'OIG exclusions', ret: 'No match in the current LEIE file', prov: 'OIG/LEIE · monthly snapshot · A monthly file cannot show an exclusion published after it was compiled.', s: 's-snap', g: '◐', w: 'Snapshot' },
  { claim: 'Medicare enrollment', ret: 'An active enrollment was returned', prov: 'PECOS · quarterly snapshot · A quarterly snapshot can lag a recent enrollment change.', s: 's-snap', g: '◐', w: 'Snapshot' },
  { claim: 'State licensure', ret: 'Not read — state-board access required', prov: 'Licensure · access-gated · VitalCV has no board or FSMB access for this lane yet.', s: 's-acc', g: '⊘', w: 'Access required' },
];

/** DECIDING — three travel, two held. */
const LEDGER = [
  { claim: 'Identity & taxonomy', d: 'from NPPES Identity', t: true },
  { claim: 'Federal exclusion result', d: 'from OIG LEIE', t: true },
  { claim: 'License claim', d: 'travels as exactly what it is — not read', t: true },
  { claim: 'Compensation expectations', d: 'entered by the clinician · never sourced', t: false },
  { claim: 'Current employer standing', d: 'not queried', t: false },
];

const stamp = (r) => `<span class="stamp ${r.s}"><span class="g">${r.g}</span>${r.w}</span>`;
const spine = '<span class="evr-spine"></span>';
const apertures = (open) => `<div class="evr-apertures">${LANES.map((l, i) => `<span class="evr-ap"${i < open ? ' data-open' : ''} title="${l}"></span>`).join('')}</div>`;

const head = (opts = {}) => `
  <header class="evr-head">
    <p class="evr-eyebrow"><span>Evidence record</span><span class="illus">${opts.tag ?? ''}</span></p>
    ${opts.name ? `<p class="evr-name">${opts.name}</p>` : ''}
    ${opts.npi ? `<p class="evr-npi">${opts.npi}</p>` : ''}
  </header>`;

/* ---------------------------------------------------------------- faces */

const BLANK = (w) => `
<div class="evr" style="--w:${w}">${spine}
  ${head({ tag: 'Awaiting your number' })}
  ${apertures(0)}
  <div class="evr-body"><ul class="evr-rows">
    ${LANES.map((l) => `<li class="evr-row"><span class="evr-claim">${l}</span>
      <span class="stamp s-pend"><span class="g">○</span>Not checked</span></li>`).join('')}
  </ul></div>
</div>`;

const RETURNED = (w) => `
<div class="evr" style="--w:${w}">${spine}
  ${head({ tag: ILLUS, name: HOLDER, npi: NPI })}
  ${apertures(6)}
  <div class="evr-body"><ul class="evr-rows">
    ${ROWS.map((r) => `<li class="evr-row"><span class="evr-row-main">
      <span class="evr-claim">${r.claim}</span>
      <span class="evr-ret">${r.ret}</span>
      <span class="evr-prov">${r.prov}</span></span>${stamp(r)}</li>`).join('')}
  </ul>
  <div class="evr-receipt">rcpt:nppes:8f2a…c41 · ES256 · P-256 · /.well-known/jwks.json</div></div>
</div>`;

const DECIDING = (w) => `
<div class="evr" style="--w:${w}">${spine}
  ${head({ tag: 'Illustrative workflow', name: HOLDER, npi: NPI })}
  ${apertures(6)}
  <div class="evr-body"><ul class="evr-rows">
    ${LEDGER.map((e) => `<li class="evr-row"><span class="evr-row-main">
      <span class="evr-claim">${e.claim}</span>
      <span class="evr-ret">${e.d}</span></span>
      <span class="evr-perm" data-t="${e.t ? 'travels' : 'held'}">${e.t ? '→ Travels' : '■ Held'}</span></li>`).join('')}
  </ul>
  <div class="evr-receipt">3 rows travel · 2 rows held with you</div></div>
</div>`;

/*
 * SEALED reduces to silhouette + seal + receipt edge, per the anatomy. It is
 * deliberately the SHORTEST face — a sealed record is closed, and padding it
 * out to match RETURNED's height would make "sealed" look like "empty".
 */
const SEALED = (w) => `
<div class="evr evr--sealed" style="--w:${w}">${spine}
  ${head({ tag: ILLUS, npi: NPI })}
  ${apertures(6)}
  <div class="evr-body" style="align-items:center;justify-content:center;padding:22px 18px">
    <div class="evr-seal">Permission<br>recorded</div>
  </div>
  <div class="evr-receipt">rcpt:nppes:8f2a…c41 · ES256 signed · scope: this application</div>
</div>`;

const FACES = { BLANK, RETURNED, DECIDING, SEALED };
const T = { a: 'Clinical Record', b: 'Evidence Instrument', c: 'Secure Handoff Object' };
const NOTE = {
  a: 'Strongest paper/document character. Ruled structure, a receipt edge, restrained apertures. The object reads as a page you could file.',
  b: 'Stronger physical silhouette. Apertures made apparent, depth through overlap rather than shadow. Closest to a designed device.',
  c: 'Stronger spine and seal. The clearest separation between the complete record and the recipient subset; permission and travel most legible.',
};

const page = (k) => `<!doctype html><html><head><meta charset="utf-8">
<title>Treatment ${k.toUpperCase()} — ${T[k]}</title><link rel="stylesheet" href="./record.css"></head>
<body class="t-${k}"><div class="sheet">
<h2>Treatment ${k.toUpperCase()} — ${T[k]}</h2>
<p class="sub">${NOTE[k]} Same anatomy, same content, same state truth as the other two — only art direction differs.</p>

<p class="cap">Desktop · 420px</p>
<div class="grid">
  ${['BLANK', 'RETURNED', 'DECIDING', 'SEALED'].map((f) => `<div class="cell"><p class="cap">${f}</p>${FACES[f]('420px')}</div>`).join('')}
</div>

<p class="cap" style="margin-top:34px">Mobile · 320px</p>
<div class="grid">
  ${['BLANK', 'RETURNED'].map((f) => `<div class="cell"><p class="cap">Mobile ${f}</p>${FACES[f]('320px')}</div>`).join('')}
</div>

<p class="cap" style="margin-top:34px">Thumbnail · 120px · all copy covered</p>
<p class="sub" style="margin-bottom:14px">The acceptance test: with every word blanked, is this still recognisably the same object — and can you tell the four states apart?</p>
<div class="thumbwrap">
  ${['BLANK', 'RETURNED', 'DECIDING', 'SEALED'].map((f) => `<div class="cell covered thumb"><p class="cap">${f}</p><div class="scaler">${FACES[f]('420px')}</div></div>`).join('')}
</div>
</div></body></html>`;

for (const k of ['a', 'b', 'c']) writeFileSync(`${OUT}treatment-${k}.html`, page(k));
console.log('built treatment-a.html treatment-b.html treatment-c.html');
