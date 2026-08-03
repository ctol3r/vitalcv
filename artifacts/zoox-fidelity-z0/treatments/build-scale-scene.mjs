/**
 * THE scene composition for the Living Evidence Record at hero scale.
 *
 * Single source. The review sheet (build-scale.mjs) and the true-size frame
 * capture (apps/web/scripts/capture-evidence-record-frames.mjs) both import
 * from here, so a frame the founder approves cannot drift from the sheet it
 * was reviewed on. Duplicated composition is the failure this programme
 * exists to correct; it is not reintroduced here.
 *
 * WHAT THE MEASUREMENT SETTLED
 *
 * With proportional scaling actually in effect, the record's height is a
 * function of how much evidence has come back. At a 560px width:
 *   SEALED 355 · BLANK 567 · DECIDING 964 · RETURNED 1435
 * Six sources' worth of claim, retrieval and provenance, set at readable
 * type, is taller than a 900px viewport. That is the composition, not a
 * defect to pad away: the object GROWS as sources answer and the stage crops
 * it. The dead band inside the record is gone because rows are content-sized
 * and never stretched, and the frame is full because the object overflows it
 * rather than floating in it. The crop says the record continues — and
 * continuing is what the next scroll does.
 */
import { readFileSync } from 'node:fs';
const HERE = new URL('.', import.meta.url).pathname;
const mod = await import(`${HERE}build-b.mjs?v=${readFileSync(`${HERE}build-b.mjs`, 'utf8').length}`);
export const FACES = mod.FACES;

/* Per viewport: record width, stage padding, and the top offset that keeps
 * the record's top edge, identity block and aperture band in frame. The top
 * offset is constant per viewport across every face — the object does not
 * jump between states, it grows and closes from a fixed top edge. */
export const V = {
  1366: { w: 1366, h: 768,  rec: 620, padX: 52, top: 92,  label: '1366 × 768 · 13" laptop' },
  1440: { w: 1440, h: 900,  rec: 680, padX: 60, top: 100, label: '1440 × 900' },
  1536: { w: 1536, h: 864,  rec: 720, padX: 60, top: 96,  label: '1536 × 864' },
  1728: { w: 1728, h: 1117, rec: 810, padX: 80, top: 116, label: '1728 × 1117' },
  390:  { w: 390,  h: 844,  rec: 350, padX: 20, top: 64,  label: '390 × 844 · mobile' },
};

/* The argument field. Its type scales with the VIEWPORT, not with the record,
 * because it is page furniture rather than part of the object. */
const ARG = (v) => {
  const k = (v.w / 1440).toFixed(3);
  return `<div class="arg" style="flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:calc(20px * ${k})">
  <p style="font-family:var(--mono);font-size:calc(11px * ${k});letter-spacing:.09em;text-transform:uppercase;color:var(--ink-subtle)">For clinicians</p>
  <h1 style="font-family:var(--serif);font-weight:500;font-size:calc(50px * ${k});line-height:1.02;letter-spacing:-.02em;color:var(--ink-strong);max-width:12ch;margin:0">Get hired on <em style="font-style:italic;color:var(--accent)">evidence</em>.</h1>
  <p style="font-size:calc(16px * ${k});color:var(--ink-muted);margin:0;max-width:38ch">Enter your NPI and see exactly what a hiring team would be shown — and what no one has checked.</p>
  <div style="border-bottom:2px solid var(--ink-strong);padding-bottom:calc(10px * ${k});display:flex;align-items:flex-end;gap:calc(16px * ${k});max-width:calc(430px * ${k})">
    <span style="font-family:var(--mono);font-size:calc(23px * ${k});color:var(--ink-subtle)">10-digit NPI</span>
    <span style="margin-left:auto;background:var(--ink-strong);color:var(--raised);border-radius:calc(10px * ${k});padding:calc(11px * ${k}) calc(18px * ${k});font-size:calc(14px * ${k});font-weight:500;white-space:nowrap">Check what's ready →</span>
  </div>
  <p style="font-size:calc(12px * ${k});color:var(--ink-subtle);margin:0">Free for clinicians · No account required</p>
</div>`;
};

/* MOBILE is composed for the viewport, not compressed from desktop: the
 * argument sits above and the record enters from the bottom edge. */
const mobile = (v, face) => `<div class="stage" data-vw="390" data-face="${face}"
  style="width:${v.w}px;height:${v.h}px;display:flex;flex-direction:column;padding:${v.top}px ${v.padX}px 0;gap:20px">
  <p style="font-family:var(--mono);font-size:10px;letter-spacing:.09em;text-transform:uppercase;color:var(--ink-subtle)">For clinicians</p>
  <h1 style="font-family:var(--serif);font-weight:500;font-size:36px;line-height:1.04;letter-spacing:-.02em;color:var(--ink-strong);margin:0">Get hired on <em style="font-style:italic;color:var(--accent)">evidence</em>.</h1>
  <div style="border-bottom:2px solid var(--ink-strong);padding-bottom:9px;display:flex;align-items:flex-end;gap:12px">
    <span style="font-family:var(--mono);font-size:19px;color:var(--ink-subtle)">10-digit NPI</span>
    <span style="margin-left:auto;font-size:13px;font-weight:500;color:var(--ink-strong)">Check →</span></div>
  <div style="flex:none">${FACES[face](v.rec, 'hero')}</div>
</div>`;

export const scene = (vw, face) => {
  const v = V[vw];
  if (vw === 390) return mobile(v, face);
  return `<div class="stage" data-vw="${v.w}" data-face="${face}"
  style="width:${v.w}px;height:${v.h}px;display:flex;align-items:stretch;gap:calc(56px * ${(v.w / 1440).toFixed(3)});padding:0 ${v.padX}px">
  ${ARG(v)}
  <div style="flex:none;padding-top:${v.top}px">${FACES[face](v.rec, 'hero')}</div>
</div>`;
};

const HEAD = `<meta charset="utf-8"><link rel="stylesheet" href="./record-b.css">
<style>*{box-sizing:border-box}body{margin:0}.stage{overflow:hidden;border:0}</style>`;

/** One scene alone, at true viewport size, for founder frame capture. */
export const frameDoc = (vw, face) =>
  `<!doctype html><html><head>${HEAD}<title>${vw} ${face}</title></head><body>${scene(vw, face)}</body></html>`;

/** The recognition strip: all eight faces at 120px with every word covered. */
export const thumbDoc = () => `<!doctype html><html><head>${HEAD}
<style>body{background:var(--paper);padding:26px}</style></head><body>
<div class="grid">${['BLANK','WRITING','RESOLVING','RETURNED','INSPECTED','DECIDING','TRAVELLING','SEALED']
  .map((f) => `<div class="covered thumb"><p class="cap">${f}</p><div class="scaler">${FACES[f](420)}</div></div>`).join('')}</div>
</body></html>`;
