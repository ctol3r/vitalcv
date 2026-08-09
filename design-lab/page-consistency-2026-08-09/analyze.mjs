// Digests audit-full.json into the cross-page consistency matrix.
import { readFileSync } from 'node:fs';
const A = JSON.parse(readFileSync(new URL('./audit-full.json', import.meta.url), 'utf8'));
const D = A.filter((r) => r.desktop).map((r) => ({ ...r, d: r.desktop, m: r.mobile }));

const line = (t) => console.log('\n' + '='.repeat(78) + '\n' + t + '\n' + '='.repeat(78));

line('1. CHROME — header identity per page');
const chromeKey = (d) => {
  if (!d.chrome || !d.chrome.length) return 'NONE';
  return d.chrome.map((c) => `h=${c.height} pos=${c.position} links=${c.linkCount}`).join(' + ');
};
const byChrome = {};
for (const r of D) (byChrome[chromeKey(r.d)] ||= []).push(r.path);
Object.entries(byChrome).sort((a, b) => b[1].length - a[1].length).forEach(([k, v]) => {
  console.log(`\n[${v.length}] ${k}`);
  if (v.length <= 12) v.forEach((p) => console.log('     ' + p));
});

line('2. FOOTER presence');
const byFoot = {};
for (const r of D) (byFoot[r.d.footer ? `footer links=${r.d.footer.linkCount}` : 'NO FOOTER'] ||= []).push(r.path);
Object.entries(byFoot).sort((a, b) => b[1].length - a[1].length).forEach(([k, v]) => {
  console.log(`\n[${v.length}] ${k}`);
  if (v.length <= 14) v.forEach((p) => console.log('     ' + p));
});

line('3. GROUND / register (EC-20: dark = public register; light REQUIRED for evidence+dense)');
const byGround = {};
for (const r of D) (byGround[`${r.d.ground.register} (${r.d.ground.body})`] ||= []).push(r.path);
Object.entries(byGround).sort((a, b) => b[1].length - a[1].length).forEach(([k, v]) => {
  console.log(`\n[${v.length}] ${k}`);
  v.forEach((p) => console.log('     ' + p));
});

line('4. TYPOGRAPHY — h1 family + size');
const byType = {};
for (const r of D) {
  const f = (r.d.fonts.h1 || 'none').split(',')[0].replace(/["']/g, '');
  (byType[`${f} @ ${r.d.fonts.h1Size || '-'}`] ||= []).push(r.path);
}
Object.entries(byType).sort((a, b) => b[1].length - a[1].length).forEach(([k, v]) => console.log(`  [${v.length}] ${k}${v.length <= 5 ? '  → ' + v.join(', ') : ''}`));
console.log('\n  body families:');
const byBody = {};
for (const r of D) (byBody[(r.d.fonts.body || '?').split(',')[0].replace(/["']/g, '')] ||= []).push(r.path);
Object.entries(byBody).forEach(([k, v]) => console.log(`  [${v.length}] ${k}`));

line('5. HEADINGS — h1 count anomalies');
D.filter((r) => r.d.headings.counts.h1 !== 1).forEach((r) =>
  console.log(`  h1×${r.d.headings.counts.h1}  ${r.path}  ${JSON.stringify(r.d.headings.h1.slice(0, 2))}`));

line('6. TITLE / METADATA');
D.filter((r) => (r.d.title.match(/VitalCV/g) || []).length > 1).forEach((r) => console.log(`  DOUBLED BRAND  ${r.path}  "${r.d.title}"`));
console.log();
D.filter((r) => /Your career evidence, ready before your next job/.test(r.d.title)).forEach((r) => console.log(`  FALLBACK TITLE ${r.path}  "${r.d.title}"`));
console.log();
D.filter((r) => !r.d.metaDescription).forEach((r) => console.log(`  NO DESCRIPTION ${r.path}`));
console.log();
const descs = {};
for (const r of D) if (r.d.metaDescription) (descs[r.d.metaDescription] ||= []).push(r.path);
Object.entries(descs).filter(([, v]) => v.length > 1).forEach(([k, v]) => console.log(`  SHARED DESC ×${v.length}: "${k.slice(0, 70)}..."\n     ${v.join(', ')}`));

line('7. PILLS (EC-20 locked: pills retired, radius 0-3px)');
D.map((r) => [r.path, r.d.pills.length]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])
  .forEach(([p, n]) => console.log(`  ${String(n).padStart(3)}  ${p}`));
console.log(`\n  TOTAL pill-shaped state markers (desktop): ${D.reduce((s, r) => s + r.d.pills.length, 0)}`);

line('8. PANEL RADII (EC-20 locked: 0-3px) + SHADOWS (EC-20 locked: no shadows)');
const radAgg = {};
for (const r of D) for (const [k, n] of Object.entries(r.d.panelRadii)) radAgg[k] = (radAgg[k] || 0) + n;
Object.entries(radAgg).sort((a, b) => b[1] - a[1]).slice(0, 14).forEach(([k, n]) => console.log(`  ${String(n).padStart(5)}  radius ${k}`));
console.log('\n  pages with shadowed panels:');
D.map((r) => [r.path, r.d.shadowed]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, 20)
  .forEach(([p, n]) => console.log(`  ${String(n).padStart(4)}  ${p}`));

line('9. BANNED COPY (EC-3 truth contract / EC-9 nouns)');
const hits = {};
for (const r of D) for (const h of r.d.bannedHits) {
  const k = `${h.clause} · ${h.phrase}`;
  (hits[k] ||= new Set()).add(r.path);
}
Object.entries(hits).sort((a, b) => b[1].size - a[1].size).forEach(([k, v]) =>
  console.log(`  [${String(v.size).padStart(2)} pages] ${k}\n        ${[...v].slice(0, 8).join(', ')}${v.size > 8 ? ` … +${v.size - 8}` : ''}`));

line('10. STATE VOCABULARY — distinct state words across the product');
const words = {};
for (const r of D) for (const w of r.d.stateWords) (words[w] ||= new Set()).add(r.path);
console.log(`  distinct state-shaped strings: ${Object.keys(words).length}`);
Object.entries(words).sort((a, b) => b[1].size - a[1].size).slice(0, 40)
  .forEach(([k, v]) => console.log(`  ${String(v.size).padStart(3)}p  ${k}`));

line('11. ERA / DESIGN-SYSTEM ISLANDS per page');
for (const r of D) {
  const e = Object.entries(r.d.era).filter(([, n]) => n > 0).map(([k, n]) => `${k}:${n}`);
  if (e.length) console.log(`  ${r.path.padEnd(34)} ${e.join(' ')}`);
}

line('12. ACCESSIBILITY — mobile touch targets <44px + horizontal scroll');
D.filter((r) => r.m).map((r) => [r.path, r.m.smallTargets.count, r.m.scroll.docWidth > r.m.scroll.innerWidth])
  .sort((a, b) => b[1] - a[1]).forEach(([p, n, hs]) => { if (n > 0 || hs) console.log(`  ${String(n).padStart(3)} small${hs ? '  H-SCROLL!' : ''}  ${p}`); });
console.log(`\n  TOTAL sub-44px targets on mobile: ${D.filter((r) => r.m).reduce((s, r) => s + r.m.smallTargets.count, 0)}`);

line('13. RUNTIME ERRORS / failed requests');
for (const r of D) {
  if (r.console?.length) console.log(`  ${r.path}\n     console: ${r.console.slice(0, 3).join(' | ').slice(0, 220)}`);
  if (r.failed?.length) console.log(`     failed: ${[...new Set(r.failed)].slice(0, 4).join(' | ').slice(0, 260)}`);
}

line('14. GLOBAL TRANSITION RULE (EC: the * transition fingerprint)');
const byTrans = {};
for (const r of D) (byTrans[r.d.bodyTransition] ||= []).push(r.path);
Object.entries(byTrans).forEach(([k, v]) => console.log(`  [${v.length}] transition-duration: ${k}`));
