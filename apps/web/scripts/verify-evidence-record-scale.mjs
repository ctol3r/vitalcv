/**
 * Prototype assertions for the Living Evidence Record at cinematic scale.
 *
 * These are the acceptance criteria from the founder's scale gate, expressed
 * as measurements rather than opinions. They run against the review sheet, not
 * against a shipped route — the record is not on the production homepage yet.
 *
 * Lives under apps/web/scripts because that is where @playwright/test resolves;
 * the sheet it measures lives in artifacts/zoox-fidelity-z0/treatments.
 *
 * Run: node apps/web/scripts/verify-evidence-record-scale.mjs
 */
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SHEET = path.resolve(HERE, '../../../artifacts/zoox-fidelity-z0/treatments/b-scale.html');

const fails = [];
const notes = [];
const fail = (m) => fails.push(m);

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 1000 }, deviceScaleFactor: 2 })).newPage();
await page.goto(`file://${SHEET}`, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(600);

/* ---- geometry of every composed scene ---------------------------------- */
const scenes = await page.evaluate(() => {
  const px = (n) => Math.round(n);
  return [...document.querySelectorAll('.stage')].map((s) => {
    const wrap = s.closest('[data-scaled]');
    const f = wrap ? parseFloat(wrap.dataset.scaled) : 1;
    const evr = s.querySelector('.evr');
    const sr = s.getBoundingClientRect();
    const rr = evr.getBoundingClientRect();
    const rows = [...evr.querySelectorAll('.evr-row')];
    const rowsBox = evr.querySelector('.evr-rows');
    const rowsBoxH = rowsBox ? rowsBox.getBoundingClientRect().height : 0;
    const rowsSum = rows.reduce((a, r) => a + r.getBoundingClientRect().height, 0);
    const last = rows.length ? rows[rows.length - 1].getBoundingClientRect() : null;
    const receipt = evr.querySelector('.evr-receipt');
    const foot = receipt ? receipt.getBoundingClientRect().top
                         : evr.querySelector('.evr-body').getBoundingClientRect().bottom;
    const arg = s.querySelector('.arg');
    /* SEALED reduces to silhouette, seal and receipt — it has no claim rows,
     * so the type floor is read from the NPI line it does carry. */
    const claim = evr.querySelector('.evr-claim') || evr.querySelector('.evr-npi');
    return {
      vw: +s.dataset.vw, face: s.dataset.face,
      stageH: px(sr.height / f),
      recW: px(rr.width / f), recH: px(rr.height / f),
      recTop: px((rr.top - sr.top) / f),
      visible: px((Math.min(rr.bottom, sr.bottom) - rr.top) / f),
      cropped: rr.bottom > sr.bottom + 1,
      rows: rows.length,
      innerGap: last ? px((foot - last.bottom) / f) : 0,
      rowStretch: px(Math.abs(rowsBoxH - rowsSum) / f),
      claimPx: +getComputedStyle(claim).fontSize.replace('px', '') / f,
      // does the argument column collide with the record?
      collide: arg ? (arg.getBoundingClientRect().right > rr.left + 1) : false,
      hOverflow: px((rr.right - sr.right) / f),
    };
  });
});

console.log('\nCOMPOSED SCENES (true viewport pixels)');
console.table(scenes.map((s) => ({
  viewport: s.vw, face: s.face, record: `${s.recW}×${s.recH}`, top: s.recTop,
  visible: `${s.visible}/${s.stageH}`, cropped: s.cropped ? 'yes' : 'no',
  'stage below': s.cropped ? 0 : s.stageH - s.recTop - s.recH,
  'dead band': s.innerGap, 'row stretch': s.rowStretch, 'claim px': s.claimPx.toFixed(1),
})));

for (const s of scenes) {
  const at = `${s.vw} ${s.face}`;
  // 1. No unexplained empty band inside the record.
  if (s.innerGap > 8) fail(`${at}: ${s.innerGap}px dead band inside the record`);
  // 2. No factual row stretched to fill height.
  if (s.rowStretch > 2) fail(`${at}: rows stretched by ${s.rowStretch}px beyond their content`);
  // 3. The record must not spill sideways out of the stage.
  if (s.hOverflow > 1) fail(`${at}: record overflows the stage horizontally by ${s.hOverflow}px`);
  // 4. The argument field must not collide with the record.
  if (s.collide) fail(`${at}: argument column overlaps the record`);
  /* 5. The record must remain the protagonist of the frame.
   *
   * This is deliberately a SHARE of the stage, not an absolute height. An
   * absolute floor would demand that SEALED and BLANK be padded up to
   * RETURNED's height, which is precisely what refinement 7 forbids: a sealed
   * record is a closed record, and a record with nothing checked is a short
   * one. Their shortness is the state being expressed. What must hold is that
   * the object still commands the frame rather than floating in it. */
  const share = s.visible / s.stageH;
  if (share < 0.38) fail(`${at}: record holds only ${(share * 100).toFixed(0)}% of the frame height`);
  // 6. Type must stay readable at every scale.
  if (s.claimPx < 12) fail(`${at}: claim type is ${s.claimPx.toFixed(1)}px — below the readable floor`);
}

/* ---- the record stays the same object at every scale -------------------- */
/*
 * Constant aspect is a claim about the DESKTOP scales, where the object is one
 * design at four sizes. Mobile is deliberately excluded: text holds at design
 * size in a narrower box, so it wraps more and the object is taller. Requiring
 * mobile to match the desktop ratio would mean shrinking its type back down —
 * which is exactly the "compressed desktop record" the gate forbids. Mobile is
 * instead held to still being the same object, checked structurally below.
 */
const byFace = {};
for (const s of scenes) if (s.vw !== 390) (byFace[s.face] ??= []).push(s.recH / s.recW);
console.log('\nASPECT RATIO PER FACE, DESKTOP (must be constant — one design at four sizes)');
for (const [face, rs] of Object.entries(byFace)) {
  const lo = Math.min(...rs), hi = Math.max(...rs);
  const spread = ((hi - lo) / lo) * 100;
  console.log(`  ${face.padEnd(10)} ${rs.map((r) => r.toFixed(2)).join('  ')}   spread ${spread.toFixed(1)}%`);
  if (spread > 6) fail(`${face}: aspect ratio varies ${spread.toFixed(1)}% across desktop viewports — not one design at four sizes`);
}

/* ---- mobile is still the same object ------------------------------------ */
const anatomy = await page.evaluate(() => {
  const read = (vw) => {
    const s = [...document.querySelectorAll(`.stage[data-vw="${vw}"][data-face="RETURNED"]`)].pop();
    const e = s.querySelector('.evr');
    const cs = getComputedStyle(e);
    return {
      spine: !!e.querySelector('.evr-spine'),
      apertures: e.querySelectorAll('.evr-ap').length,
      rows: e.querySelectorAll('.evr-row').length,
      receipt: !!e.querySelector('.evr-receipt'),
      topEdge: cs.borderTopWidth,
      /* the top edge as a share of width — the silhouette's signature */
      topRatio: parseFloat(cs.borderTopWidth) / parseFloat(cs.width),
    };
  };
  return { mobile: read(390), desktop: read(1440) };
});
const A = anatomy;
console.log('\nMOBILE IS THE SAME OBJECT');
console.log(`  spine ${A.mobile.spine} · apertures ${A.mobile.apertures} · rows ${A.mobile.rows} · receipt ${A.mobile.receipt}`);
for (const k of ['spine', 'apertures', 'rows', 'receipt']) {
  if (String(A.mobile[k]) !== String(A.desktop[k])) fail(`mobile record differs from desktop in ${k}: ${A.mobile[k]} vs ${A.desktop[k]}`);
}
if (Math.abs(A.mobile.topRatio - A.desktop.topRatio) / A.desktop.topRatio > 0.08) {
  fail(`mobile top edge is ${(A.mobile.topRatio * 100).toFixed(2)}% of width vs desktop ${(A.desktop.topRatio * 100).toFixed(2)}% — the silhouette changed`);
}

/* ---- no dead space WITHIN a row ----------------------------------------
 *
 * A whole-record measurement cannot see this. Provenance previously spanned
 * two grid tracks, so both stretched to its height and the retrieval line was
 * pushed to the bottom of a track it did not fill — a ~90px void inside every
 * row while the record-level dead band read zero. Each hero row must have all
 * three of its parts top-aligned, and the retrieval line must sit directly
 * under its claim. */
const intraRow = await page.evaluate(() => {
  const bad = [];
  for (const row of document.querySelectorAll('.evr[data-scale="hero"] .evr-row')) {
    const pad = parseFloat(getComputedStyle(row).paddingTop);
    const top = row.getBoundingClientRect().top + pad;
    for (const child of row.children) {
      const gap = child.getBoundingClientRect().top - top;
      if (gap > 3) bad.push({ what: child.className || 'child', gap: Math.round(gap) });
    }
    const claim = row.querySelector('.evr-claim');
    const ret = row.querySelector('.evr-ret');
    if (claim && ret) {
      const g = ret.getBoundingClientRect().top - claim.getBoundingClientRect().bottom;
      const lh = parseFloat(getComputedStyle(ret).lineHeight) || 16;
      if (g > lh) bad.push({ what: 'claim→retrieval', gap: Math.round(g) });
    }
  }
  return bad;
});
const worst = intraRow.reduce((a, b) => (b.gap > (a?.gap ?? 0) ? b : a), null);
console.log(`\nINTRA-ROW DEAD SPACE — ${intraRow.length ? `${intraRow.length} offences, worst ${worst.gap}px on ${worst.what}` : 'none; every hero row is top-aligned'}`);
if (intraRow.length) fail(`${intraRow.length} rows carry dead space inside them (worst ${worst.gap}px)`);

/* ---- claim and provenance are separate boxes, never one sentence -------- */
const concat = await page.evaluate(() => {
  const bad = [];
  for (const row of document.querySelectorAll('.evr-row')) {
    const ret = row.querySelector('.evr-ret');
    const prov = row.querySelector('.evr-prov');
    if (!ret || !prov) continue;
    if (getComputedStyle(ret).display !== 'block') bad.push('retrieval is not a block');
    if (getComputedStyle(prov).display !== 'block') bad.push('provenance is not a block');
    const a = ret.getBoundingClientRect();
    const b = prov.getBoundingClientRect();
    // Separate boxes: their rectangles must not intersect. Side by side (hero
    // grid) and stacked (compact) both satisfy this; sharing a line box does not.
    const overlap = a.left < b.right - 0.5 && b.left < a.right - 0.5
                 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;
    if (overlap) bad.push(`retrieval and provenance share a box: ${ret.textContent.slice(0, 30)}`);
  }
  return bad;
});
console.log(`\nCLAIM/PROVENANCE SEPARATION — ${concat.length ? 'VIOLATIONS' : 'clean across all rows'}`);
concat.slice(0, 5).forEach((c) => console.log('  ' + c));
if (concat.length) fail(`${concat.length} rows merge retrieval and provenance`);

/* ---- nothing inside the record may overprint anything else --------------
 *
 * General, and it is the assertion that catches placement bugs the eye would
 * otherwise have to. INSPECTED's opened claim reuses .evr-row, so it inherited
 * the hero grid and all SEVEN of its provenance lines were placed at
 * column 2 / row 1 — overprinted into an illegible block while every
 * whole-record and per-row measurement still read clean. */
const overprint = await page.evaluate(() => {
  const bad = [];
  for (const evr of document.querySelectorAll('.evr')) {
    const items = [...evr.querySelectorAll('.evr-prov, .evr-claim, .evr-ret, .stamp, .evr-perm')]
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter((x) => x.r.width > 0 && x.r.height > 0);
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i], b = items[j];
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
        const ox = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
        const oy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
        if (ox > 1 && oy > 1) {
          bad.push(`${a.el.className.split(' ')[0]} over ${b.el.className.split(' ')[0]}: "${a.el.textContent.trim().slice(0, 26)}"`);
        }
      }
    }
  }
  return bad;
});
console.log(`\nOVERPRINT — ${overprint.length ? `${overprint.length} COLLISIONS` : 'nothing inside the record overlaps anything else'}`);
overprint.slice(0, 4).forEach((o) => console.log('  ' + o));
if (overprint.length) fail(`${overprint.length} elements overprint inside the record`);

/* ---- the recognition test must actually cover every word ----------------
 *
 * The strip is only evidence if nothing is readable. INSPECTED's detail rows
 * set colour inline, which outranked the .covered class rule, so the face
 * carrying the most copy stayed legible while the test appeared to pass. */
const leaks = await page.evaluate(() => {
  const out = [];
  for (const root of document.querySelectorAll('.covered')) {
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      const t = n.textContent.trim();
      if (!t) continue;
      const el = n.parentElement;
      if (el.closest('.cap')) continue; // the face's own label, outside the object
      const c = getComputedStyle(el).color;
      const alpha = c.startsWith('rgba') ? parseFloat(c.split(',')[3]) : 1;
      if (alpha > 0.01) out.push(`${el.className || el.tagName}: "${t.slice(0, 34)}"`);
    }
  }
  return out;
});
console.log(`\nRECOGNITION TEST COVERAGE — ${leaks.length ? `${leaks.length} LEAKS` : 'every word covered'}`);
leaks.slice(0, 4).forEach((l) => console.log('  ' + l));
if (leaks.length) fail(`${leaks.length} strings remain readable in the covered recognition test`);

/* ---- mobile is composed, not compressed --------------------------------- */
const m = scenes.filter((s) => s.vw === 390);
const d = scenes.filter((s) => s.vw === 1440);
if (m.length && d.length) {
  const ratio = m[0].claimPx / d[0].claimPx;
  console.log(`\nMOBILE claim type ${m[0].claimPx.toFixed(1)}px vs 1440 ${d[0].claimPx.toFixed(1)}px (${(ratio * 100).toFixed(0)}%)`);
  if (ratio < 0.5) fail('mobile record reads as a shrunken desktop record');
  notes.push(`mobile record ${m[0].recW}px wide, ${m[0].visible}px in frame`);
}

/* ---- SEALED is the same object, not a different one --------------------- */
const sealed = scenes.find((s) => s.face === 'SEALED');
const returned = scenes.find((s) => s.face === 'RETURNED' && s.vw === sealed?.vw);
if (sealed && returned) {
  const same = sealed.recW === returned.recW;
  console.log(`\nSEALED vs RETURNED at ${sealed.vw}: width ${sealed.recW} vs ${returned.recW}, height ${sealed.recH} vs ${returned.recH}`);
  if (!same) fail('SEALED is not the same width as RETURNED — it must read as the same object closed');
  notes.push(`SEALED is ${(sealed.recH / returned.recH * 100).toFixed(0)}% of RETURNED's height — the record closes`);
}

await page.screenshot({ path: path.resolve(HERE, '../../../artifacts/zoox-fidelity-z0/treatments/b-scale.png'), fullPage: true });

/* ---- structural sweep across EVERY sheet --------------------------------
 *
 * The proof sheet carries only four faces, so checking it alone left INSPECTED
 * and TRAVELLING unverified — and INSPECTED was the one that was broken. The
 * structural rules are properties of the object, not of one sheet, so they run
 * everywhere the object is rendered. */
const SHEETS = ['b-scale.html', 'b-storyboard-desktop.html', 'b-storyboard-mobile.html', 'b-faces.html', 'b-refinements.html'];
console.log('\nSTRUCTURAL SWEEP');
for (const name of SHEETS) {
  const file = path.resolve(HERE, '../../../artifacts/zoox-fidelity-z0/treatments', name);
  if (!existsSync(file)) { console.log(`  ${name.padEnd(30)} not built — skipped`); continue; }
  const sp = await (await browser.newContext({ viewport: { width: 1400, height: 1000 } })).newPage();
  await sp.goto(`file://${file}`, { waitUntil: 'load' });
  await sp.evaluate(() => document.fonts.ready);
  await sp.waitForTimeout(500);
  const r = await sp.evaluate(() => {
    const out = { records: 0, overprint: 0, intraRow: 0, concat: 0, stretched: 0 };
    for (const evr of document.querySelectorAll('.evr')) {
      out.records++;
      const items = [...evr.querySelectorAll('.evr-prov, .evr-claim, .evr-ret, .stamp, .evr-perm')]
        .map((el) => ({ el, r: el.getBoundingClientRect() })).filter((x) => x.r.width > 0 && x.r.height > 0);
      for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
        const a = items[i], b = items[j];
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
        if (Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left) > 1
         && Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top) > 1) out.overprint++;
      }
      for (const row of evr.querySelectorAll('.evr-row:not(.evr-row--opened)')) {
        const ret = row.querySelector('.evr-ret'), prov = row.querySelector('.evr-prov');
        if (ret && prov) {
          const a = ret.getBoundingClientRect(), b = prov.getBoundingClientRect();
          if (a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5) out.concat++;
        }
        if (!evr.matches('[data-scale="hero"]')) continue;
        const top = row.getBoundingClientRect().top + parseFloat(getComputedStyle(row).paddingTop);
        for (const child of row.children) if (child.getBoundingClientRect().top - top > 3) out.intraRow++;
      }
    }
    return out;
  });
  const bad = r.overprint + r.intraRow + r.concat + r.stretched;
  console.log(`  ${name.padEnd(30)} ${String(r.records).padStart(3)} records · overprint ${r.overprint} · intra-row ${r.intraRow} · concat ${r.concat}`);
  if (bad) fail(`${name}: ${r.overprint} overprint, ${r.intraRow} intra-row gaps, ${r.concat} concatenations`);
  await sp.context().close();
}

await browser.close();

console.log('\n' + '─'.repeat(64));
notes.forEach((n) => console.log('· ' + n));
if (fails.length) {
  console.log(`\nFAILED ${fails.length}:`);
  fails.forEach((f) => console.log('  ✗ ' + f));
  process.exit(1);
}
console.log('\nALL SCALE ASSERTIONS PASS');
