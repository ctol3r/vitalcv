// Assembles the founder comparison board (board.html) with embedded evidence.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const EV = dirname(fileURLToPath(import.meta.url));

const jpg = (n) => existsSync(join(EV, 'board-thumbs', n + '.jpg'))
  ? `data:image/jpeg;base64,${readFileSync(join(EV, 'board-thumbs', n + '.jpg')).toString('base64')}`
  : null;
const mp4 = (d) => `data:video/mp4;base64,${readFileSync(join(EV, `direction-${d}`, 'motion.mp4')).toString('base64')}`;

const fig = (name, caption) => {
  const src = jpg(name);
  return src ? `<figure class="shot"><img src="${src}" alt="${caption}" loading="lazy"><figcaption>${caption}</figcaption></figure>` : '';
};

const D = {
  a: {
    key: 'A', name: 'Operational Calm', chip: '#175E4C',
    thesis: 'The calmest, most capable operating system in healthcare hiring.',
    rationale: `Porcelain bone ground, graphite ink, one spruce accent. Instrument Sans with IBM Plex Mono
      micro-labels. The agent appears as a humane work ledger — mono timestamps, four ownership states —
      and the explainer is a sticky five-beat operations sequence with a left rail. Everything is hairline
      rules and solid panels; nothing shouts. It should feel expensive without being flashy.`,
    rejected: `Rejects the current site's editorial display serif, violet accent, rounded pills, journey-rail
      nav, film-strip stages, and the two-systems-in-one-scroll mix (teal + Calm Wave indigo). Keeps only
      the wordmark and the honesty doctrine.`,
    a11y: `Semantic landmarks; one h1; visible focus; menu focus-trap with Esc + focus restore; brief's amber/
      neutral text tones darkened to ≥5.4:1 (AA); reduced motion renders all five beats stacked and fully
      resolved (base state IS the final state); no-JS shows the same static sequence.`,
    risk: `LOW-MEDIUM. Standard observer/transition patterns; the sticky scroll-track explainer is the only
      nonstandard piece. Design system implications smallest of the three.`,
    critique: `Pass 1+2: five-second, easy-button, trust, product, employer tests PASS. Distinctiveness
      partial by thesis — it is deliberately the calmest pole of the set. Two pane "defects" were
      verification artifacts (hidden-pane compositor freeze; sticky-stage stitch); mobile h1 rebalanced.`,
  },
  b: {
    key: 'B', name: 'Intelligent Product', chip: '#2E9E6B',
    thesis: 'You watch VitalCV do the work before anyone asks you to believe anything.',
    rationale: `Warm graphite (no blue cast), off-white ink, work-green reserved for completed work and the
      CTA. Geist + Geist Mono. The hero IS the explainer: a living product surface that types a masked NPI,
      assembles sourced facts, ranks what remains, flips work to "Done by VitalCV" with timestamps, pauses
      amber for approval, and resolves to a role and a first-day track — ~18s, once, replayable. The eyebrow's
      middle zone is a mono ticker narrating the beats: contextual product state, literally.`,
    rejected: `Rejects light-paper marketing entirely — and rejects brochure-first structure: demonstration
      before copy. No serif, no violet, no pills, no journey rail, no film. Also rejects chat as the agent's
      face: the agent is visible only through work.`,
    a11y: `Semantic landmarks; menu focus containment + restore; AA-corrected CTA (green ground + dark ink,
      9.8:1 — brief's suggested combo failed AA and was rejected); reduced motion = final composed frame with
      numbered annotations, no autoplay; ticker becomes static text.`,
    risk: `MEDIUM-HIGH. The choreographed surface (~18s timeline, beat engine, ticker sync, eyebrow inversion)
      is the heaviest build and the most design-QA-sensitive. Highest payoff if motion quality is the bar.`,
    critique: `Pass 1+2: all six tests PASS; strongest on easy-button and product visibility. Watch items:
      18s autoplay patience (mitigated by beat dots + replay + ticker), dark-first brand statement (relieved
      by the light employer band). Desktop h1 orphan fixed.`,
  },
  c: {
    key: 'C', name: 'Precision / Editorial', chip: '#D8451D',
    thesis: 'The visual confidence of a category-defining technology company, in service of one promise.',
    rationale: `Gallery white, true black, scarce vermilion (8 static instances page-wide). Archivo variable
      display at 96px with expanded width; IBM Plex Mono annotations; the page is drafted — full-bleed rules,
      column verticals, registration crosshairs, numbered sections 01–06. The explainer is five ruled frames
      that draw in once, like a printed spread that happens to move. The eyebrow is a band between two rules
      whose centered index annotation updates per section, and it fully inverts over the black outcome band.`,
    rejected: `Rejects "healthcare software" wholesale: no cards, no shadows, no radius, no accent-on-cream
      editorial serif — and rejects the film conceptual model explicitly. Nothing from the current site
      survives except the wordmark (recomposed as tracked caps) and the honesty doctrine.`,
    a11y: `Semantic landmarks; verified fresh-load tab order (skip link → wordmark → sign in → CTA → input →
      submit → employer link → replay); vermilion never appears as small text (AA-driven); muted tone darkened
      to pass on white; reduced motion = fully drawn printed spread, REPLAY hidden.`,
    risk: `MEDIUM. The drafted rule grid demands precision at every breakpoint, and the display face is a new
      brand commitment; motion itself is modest. Typography discipline is the main ongoing cost.`,
    critique: `Pass 1+2: all six tests PASS; strongest on distinctiveness and immediate comprehension.
      Watch items: most assertive pole of the set; hero's drafted void is intentional editorial air; mobile
      4-line h1 stack is deliberate but a founder taste call.`,
  },
};

const desktopRows = [
  ['Immediate comprehension', 5, 4.5, 4.5, 'A/C say it instantly; B shows it within two seconds of watching.'],
  ['Easy-button feeling', 4, 5, 3.5, 'B demonstrates work leaving your plate; A illustrates it; C narrates it.'],
  ['Product visibility', 3.5, 5, 4, 'B is the product working; C diagrams it; A abstracts it into a ledger.'],
  ['Visual differentiation', 3, 4, 5, 'C is unmistakable; B is distinct-dark-instrument; A is quietly distinct.'],
  ['Trust', 5, 4.5, 4.5, 'All three carry honest illustration labels; A’s calm + provenance chips edge it.'],
  ['Clinician conversion', 4.5, 4, 4, 'A’s hero form is frictionless; B/C ask a beat of attention first.'],
  ['Employer credibility', 4, 4, 4.5, 'C’s editorial confidence reads most enterprise; all three doorways work.'],
  ['Mobile strength', 4.5, 4, 4, 'A’s recomposition is cleanest; B’s task stream and C’s stack both intentional.'],
  ['Motion quality', 4, 5, 3.5, 'B’s choreography is the centerpiece; C is deliberately sparing.'],
  ['Build simplicity', 4, 2.5, 3, 'Higher = simpler. A is mostly standard patterns; B is the heaviest build.'],
];
const mobileRows = [
  ['Eyebrow recomposition', 4.5, 4.5, 4.5, 'All three hold geometry: wordmark + primary action + menu control.'],
  ['Explainer reframe', 4, 4.5, 4, 'B becomes a growing task stream; A stacks beats; C stacks drafted frames.'],
  ['CTA priority', 5, 4.5, 4.5, 'A: field + full-width Start immediately; B/C equally clear, one screen later.'],
  ['Copy economy', 4.5, 4.5, 4, 'C’s display scale spends more vertical space per idea.'],
  ['Work-state visualization', 4, 5, 4, 'B’s stream keeps states legible at 390px; A’s ledger close behind.'],
];

const bar = (v) => {
  const pct = (v / 5) * 100;
  return `<span class="sc"><span class="scbar" style="width:${pct}%"></span></span><span class="scv">${v}</span>`;
};
const matrix = (rows) => `
<div class="tblwrap"><table>
<thead><tr><th>Dimension</th><th><i class="chip" style="background:${D.a.chip}"></i>A</th><th><i class="chip" style="background:${D.b.chip}"></i>B</th><th><i class="chip" style="background:${D.c.chip}"></i>C</th><th class="why">Reading</th></tr></thead>
<tbody>${rows.map(([dim, a, b, c, why]) => `<tr><td>${dim}</td><td>${bar(a)}</td><td>${bar(b)}</td><td>${bar(c)}</td><td class="why">${why}</td></tr>`).join('\n')}</tbody>
</table></div>`;

const chapter = (d) => {
  const x = D[d];
  return `
<section class="dir" id="dir-${d}">
  <header class="dirhead">
    <div class="dirkey"><i class="chip big" style="background:${x.chip}"></i><span class="mono">DIRECTION ${x.key}</span></div>
    <h2>${x.name}</h2>
    <p class="thesis">${x.thesis}</p>
  </header>
  <div class="two">
    <div><h3>Rationale</h3><p>${x.rationale}</p></div>
    <div><h3>What it deliberately rejected</h3><p>${x.rejected}</p></div>
  </div>
  <h3>Desktop evidence — 1440×900</h3>
  <div class="gallery">
    ${fig(`${d}-desktop-01-hero`, 'Hero')}
    ${fig(`${d}-desktop-02-eyebrow-top`, 'Eyebrow at top')}
    ${fig(`${d}-desktop-04-explainer-mid`, 'Explainer — mid-sequence (approval moment)')}
    ${fig(`${d}-desktop-05-explainer-final`, 'Explainer — final state')}
    ${fig(`${d}-desktop-07-ownership`, 'What VitalCV handles — four owners')}
    ${fig(`${d}-desktop-08-employer-doorway`, 'Employer doorway')}
    ${fig(`${d}-desktop-06b-eyebrow-over-outcome`, 'Eyebrow over the outcome band')}
    ${fig(`${d}-desktop-06c-eyebrow-over-employers`, 'Eyebrow over the employer band')}
  </div>
  <h3>Mobile evidence — 390×844</h3>
  <div class="gallery mob">
    ${fig(`${d}-mobile-01-hero`, 'Mobile hero + eyebrow')}
    ${fig(`${d}-mobile-03-explainer`, 'Mobile explainer (final state)')}
    ${fig(`${d}-mobile-04-agent-work`, 'Mobile agent-work state')}
  </div>
  <h3>Reduced motion</h3>
  <div class="gallery solo">
    ${fig(`${d}-reduced-motion-explainer`, 'prefers-reduced-motion: the full story as a static, annotated state')}
  </div>
  <h3>Motion recording</h3>
  <video controls preload="metadata" src="${mp4(d)}"></video>
  <p class="vidnote">Continuous capture: eyebrow + hero at rest → full how-it-works sequence → slow scroll through every section (eyebrow behavior and transitions).</p>
  <div class="two">
    <div><h3>Browser critique verdict</h3><p>${x.critique}</p></div>
    <div><h3>Accessibility</h3><p>${x.a11y}</p><h3>Implementation risk</h3><p>${x.risk}</p></div>
  </div>
</section>`;
};

const html = `<title>VitalCV — Homepage Reset: Direction Selection</title>
<style>
  :root{
    --bg:#F6F5F2; --panel:#FFFFFF; --ink:#1B1C1E; --muted:#6C6E6B; --rule:#DCDBD5;
    --frame:#E6E5E0; --barbg:#E9E8E4;
  }
  @media (prefers-color-scheme: dark){:root{
    --bg:#161719; --panel:#1D1E21; --ink:#ECEBE7; --muted:#9A9B97; --rule:#2F3033;
    --frame:#2A2B2E; --barbg:#2A2B2E;
  }}
  :root[data-theme="dark"]{
    --bg:#161719; --panel:#1D1E21; --ink:#ECEBE7; --muted:#9A9B97; --rule:#2F3033;
    --frame:#2A2B2E; --barbg:#2A2B2E;
  }
  :root[data-theme="light"]{
    --bg:#F6F5F2; --panel:#FFFFFF; --ink:#1B1C1E; --muted:#6C6E6B; --rule:#DCDBD5;
    --frame:#E6E5E0; --barbg:#E9E8E4;
  }
  *{box-sizing:border-box;margin:0}
  body{background:var(--bg);color:var(--ink);
    font:16px/1.62 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
    padding:0 24px 96px}
  .mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;letter-spacing:.09em;
    text-transform:uppercase;color:var(--muted)}
  .wrap{max-width:1080px;margin:0 auto}
  header.mast{padding:56px 0 28px;border-bottom:1px solid var(--ink)}
  header.mast h1{font-size:clamp(28px,4vw,44px);line-height:1.06;letter-spacing:-.022em;font-weight:650;
    text-wrap:balance;margin:14px 0 10px}
  .facts{display:flex;flex-wrap:wrap;gap:8px 28px;margin-top:18px}
  .facts .mono b{color:var(--ink);font-weight:600}
  .lead{max-width:64ch;margin:28px 0 0;font-size:17.5px}
  .lead b{font-weight:650}
  section{margin-top:64px}
  h2{font-size:26px;letter-spacing:-.015em;font-weight:650;line-height:1.15}
  h3{font-size:13px;letter-spacing:.07em;text-transform:uppercase;font-weight:600;color:var(--muted);
    margin:34px 0 12px}
  p{max-width:72ch}
  .rooms{margin-top:10px}
  .rooms p{color:var(--muted);font-size:14px}
  .rooms code{font-family:ui-monospace,Menlo,monospace;font-size:13px;color:var(--ink)}
  .tblwrap{overflow-x:auto;border:1px solid var(--rule);background:var(--panel);margin-top:14px}
  table{border-collapse:collapse;width:100%;min-width:760px}
  th,td{text-align:left;padding:11px 14px;border-bottom:1px solid var(--rule);font-size:14px;vertical-align:middle}
  thead th{font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);font-weight:600}
  tbody tr:last-child td{border-bottom:0}
  td:first-child{font-weight:600;white-space:nowrap}
  .why{color:var(--muted);font-size:13px;min-width:260px}
  .chip{display:inline-block;width:9px;height:9px;margin-right:7px;vertical-align:baseline}
  .chip.big{width:11px;height:11px}
  .sc{display:inline-block;width:64px;height:6px;background:var(--barbg);vertical-align:middle;margin-right:8px}
  .scbar{display:block;height:100%;background:var(--ink)}
  .scv{font-family:ui-monospace,Menlo,monospace;font-size:12.5px;font-variant-numeric:tabular-nums}
  .dir{border-top:1px solid var(--ink);padding-top:26px}
  .dirkey{display:flex;align-items:center;gap:10px}
  .dir h2{margin-top:10px;font-size:32px}
  .thesis{margin-top:8px;font-size:17px;color:var(--muted);max-width:56ch}
  .two{display:grid;grid-template-columns:1fr 1fr;gap:0 44px}
  @media (max-width:760px){.two{grid-template-columns:1fr}}
  .gallery{display:grid;grid-template-columns:1fr 1fr;gap:18px}
  .gallery.mob{grid-template-columns:repeat(3,1fr)}
  .gallery.solo{grid-template-columns:1fr}
  @media (max-width:760px){.gallery,.gallery.mob{grid-template-columns:1fr}}
  .shot{border:1px solid var(--frame);background:var(--panel);padding:8px}
  .shot img{width:100%;height:auto;display:block}
  .shot figcaption{font-family:ui-monospace,Menlo,monospace;font-size:11px;letter-spacing:.06em;
    text-transform:uppercase;color:var(--muted);padding:8px 2px 2px}
  video{width:100%;border:1px solid var(--frame);background:#000;display:block}
  .vidnote{color:var(--muted);font-size:13px;margin-top:8px}
  .rec{border:1px solid var(--ink);background:var(--panel);padding:28px 30px;margin-top:18px}
  .rec p{max-width:76ch}
  .rec .mono{display:block;margin-bottom:10px}
  .decide{margin-top:26px}
  .decide ul{list-style:none;padding:0;display:grid;gap:8px;max-width:520px}
  .decide li{border:1px solid var(--rule);padding:12px 16px;font-weight:600;background:var(--panel)}
  a{color:inherit}
</style>
<div class="wrap">
<header class="mast">
  <span class="mono">Founder wave — concept selection · 2026-08-07</span>
  <h1>VitalCV homepage reset: three directions, one idea</h1>
  <p class="lead"><b>Enter your NPI. VitalCV does the rest.</b> Three from-first-principles visual directions
  around the same product truth, the same content architecture, and the same hard eyebrow requirement —
  so the choice is about design language, not strategy.</p>
  <div class="facts">
    <span class="mono">Source main <b>0b62fc04b</b></span>
    <span class="mono">PR #1133 <b>untouched</b></span>
    <span class="mono">Production <b>unchanged</b></span>
    <span class="mono">Prototypes <b>isolated · design-lab/</b></span>
  </div>
  <div class="rooms">
    <h3>Live prototypes (this machine)</h3>
    <p><code>localhost:4870/direction-a/</code> · <code>localhost:4870/direction-b/</code> ·
    <code>localhost:4870/direction-c/</code> — served from <code>design-lab/homepage-reset/</code>, noindex, not wired into any app.</p>
  </div>
</header>

<section>
  <h2>Desktop comparison</h2>
  <p class="mono" style="margin-top:6px">Scored 1–5 by Claude · higher is stronger · founder makes the call</p>
  ${matrix(desktopRows)}
</section>

<section>
  <h2>Mobile comparison — 390×844</h2>
  ${matrix(mobileRows)}
</section>

${chapter('a')}
${chapter('b')}
${chapter('c')}

<section class="rec">
  <span class="mono">Claude's recommendation — advisory only</span>
  <p><b>Direction B — Intelligent Product.</b> The wave's target reaction is "That's it? VitalCV already
  knows this and is handling the rest?" — and B is the only direction that produces that reaction by
  <em>demonstration</em>: within seconds, a visitor watches facts assemble with sources, work flip to
  "Done by VitalCV," and the one honest pause — approval — before work continues. It is also the most
  literal fulfilment of the eyebrow's "contextual product state" middle zone. The costs are real: the
  heaviest build, and a dark-first brand statement. If the founder wants the brand to live in daylight,
  A is the strongest calm pole and C is the strongest statement of category confidence — both complete,
  neither a compromise.</p>
</section>

<section class="decide">
  <h2>One decision</h2>
  <ul>
    <li>DIRECTION A — Operational Calm</li>
    <li>DIRECTION B — Intelligent Product</li>
    <li>DIRECTION C — Precision / Editorial</li>
    <li>REVISE THE SET</li>
  </ul>
</section>
</div>`;

writeFileSync(join(EV, 'board.html'), html);
console.log('board.html written,', Math.round(html.length / 1024), 'KB');
