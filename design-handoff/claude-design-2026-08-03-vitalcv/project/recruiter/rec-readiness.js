/* ══════════════════════════════════════════════════════════════════════════
   rec-readiness.js — D3 · Readiness View (/recruiter/readiness)
   The whole network sorted into four columns the recruiter acts on:
   Ready · Near Ready · Blocked · Missing Evidence — each card shows the
   single thing standing between this clinician and the next column.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  const { el, icon, chip } = window.UI;

  function styleOnce() {
    if (document.getElementById('rec-rdy-css')) return;
    const css = `
    .rdy-board{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;align-items:start}
    .rcol{display:flex;flex-direction:column;gap:11px}
    .rcolhead{position:sticky;top:104px;z-index:5;background:var(--bg);padding-bottom:4px}
    .rcolbar{display:flex;align-items:center;gap:9px;padding:11px 13px;border-radius:11px;border:1px solid var(--s200);background:#fff}
    .rcolbar .rdot{width:9px;height:9px;border-radius:50%;flex-shrink:0}
    .rcolbar .rnm{font-size:13.5px;font-weight:600;letter-spacing:-.01em}
    .rcolbar .rct{font-family:'Geist Mono',monospace;font-size:15px;font-weight:600;margin-left:auto;font-variant-numeric:tabular-nums}
    .rcolbar .rhint{font-family:'Geist Mono',monospace;font-size:8.5px;text-transform:uppercase;letter-spacing:.08em;color:var(--s400)}
    .rcolwrap{display:flex;flex-direction:column;gap:9px}

    .rcard{background:#fff;border:1px solid var(--s200);border-radius:12px;padding:13px;display:flex;flex-direction:column;gap:10px;transition:border-color .12s,box-shadow .12s,transform .12s;text-align:left;width:100%;position:relative;overflow:hidden}
    .rcard::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px}
    .rcard.b-ready::before{background:var(--keep)} .rcard.b-near::before{background:var(--seam)}
    .rcard.b-blocked::before{background:var(--cut)} .rcard.b-missing::before{background:var(--blue)}
    .rcard:hover{border-color:var(--s300);transform:translateY(-2px);box-shadow:0 10px 24px -16px rgba(15,23,42,.4)}
    .rcard .rc-top{display:flex;gap:11px;align-items:center}
    .rcard .rc-x{min-width:0;flex:1}
    .rcard .rc-nm{font-size:13.5px;font-weight:600;letter-spacing:-.01em;display:flex;align-items:center;gap:6px}
    .rcard .rc-sp{font-family:'Geist Mono',monospace;font-size:9px;color:var(--s500);text-transform:uppercase;letter-spacing:.05em;margin-top:2px}
    .rcard .rc-loc{font-size:11px;color:var(--s500);margin-top:3px}
    .rcard .rc-gap{font-size:11.5px;line-height:1.4;border-top:1px dashed var(--rule);padding-top:9px;display:flex;gap:8px;align-items:flex-start}
    .rcard .rc-gap .gi{flex-shrink:0;margin-top:1px}
    .rcard .rc-gap .gt b{font-weight:600}
    .rcard .rc-foot{display:flex;align-items:center;justify-content:space-between;font-family:'Geist Mono',monospace;font-size:9.5px;color:var(--s500)}
    .rcard .rc-foot .act{color:var(--s700);display:flex;align-items:center;gap:4px}
    .rsummary{display:flex;align-items:center;gap:18px;flex-wrap:wrap;background:#fff;border:1px solid var(--s200);border-radius:12px;padding:14px 18px;margin-bottom:18px}
    .rsummary .rs-q{font-size:14px;font-weight:600;letter-spacing:-.015em}
    .rsummary .rs-m{font-size:12px;color:var(--s500)}
    .rsummary .rs-sp{flex:1}
    @media(max-width:1100px){.rdy-board{grid-template-columns:repeat(2,1fr)}.rcolhead{position:static}}
    @media(max-width:620px){.rdy-board{grid-template-columns:1fr}}
    `;
    document.head.appendChild(el('style', { id: 'rec-rdy-css', html: css }));
  }

  const COLS = [
    { bucket: 'ready', label: 'Ready', color: 'var(--keep)', hint: 'Call now', gapLead: 'Clear to present' },
    { bucket: 'near', label: 'Near Ready', color: 'var(--seam)', hint: 'One gap', gapLead: 'Standing between ready' },
    { bucket: 'blocked', label: 'Blocked', color: 'var(--cut)', hint: 'Do not advance', gapLead: 'Blocker' },
    { bucket: 'missing', label: 'Missing Evidence', color: 'var(--blue)', hint: 'Needs access', gapLead: 'Awaiting' },
  ];

  function gapFor(c) {
    if (c.bucket === 'ready') return { ic: 'check', tone: 'var(--keep)', t: 'All lanes verified — clear to present.' };
    const f = c.flags && c.flags[0];
    if (f) {
      const tone = f.state === 'blocked' ? 'var(--cut)' : f.state === 'missing' ? 'var(--blue)' : 'var(--seam)';
      const ic = f.state === 'blocked' ? 'flag' : f.state === 'missing' ? 'eye' : 'clock';
      return { ic, tone, t: f.t, d: f.d };
    }
    return { ic: 'clock', tone: 'var(--seam)', t: 'One gap to close.' };
  }

  window.renderRecReadiness = function () {
    styleOnce();
    window.RECCARDS.styleOnce();
    const D = window.REC, C = window.RECCARDS;
    const v = el('div', { class: 'view' });

    v.appendChild(el('div', { class: 'pagehead' },
      el('div', null,
        el('div', { class: 'lead' }, icon('readiness', 12), 'Readiness · the whole network, sorted'),
        el('h1', null, 'Who is ', el('em', null, 'ready'), ' — and what stands in the way.'),
        el('div', { class: 'sub' }, 'Every clinician falls into exactly one column. Each card names the single thing between this person and the next move — so you know precisely what to chase.')),
      el('div', { class: 'ra' }, chip('ready', D.pipeline.counts.ready + ' ready to call'))));

    // summary strip
    const readyTop = D.candidates.filter(c => c.bucket === 'ready').sort((a, b) => b.readiness - a.readiness)[0];
    v.appendChild(el('div', { class: 'rsummary' },
      icon('phone', 18),
      el('div', null,
        el('div', { class: 'rs-q' }, 'Start with ' + readyTop.name + ' — ' + readyTop.specialty),
        el('div', { class: 'rs-m' }, readyTop.readiness + ' readiness · ' + readyTop.highlight)),
      el('div', { class: 'rs-sp' }),
      el('a', { href: '#/review/' + readyTop.id, class: 'callbtn', style: { background: 'var(--keep)', color: '#fff', textDecoration: 'none' } }, icon('arrow', 13), 'Open review')));

    // board
    const board = el('div', { class: 'rdy-board' });
    COLS.forEach(col => {
      const items = D.candidates.filter(c => c.bucket === col.bucket).sort((a, b) => b.readiness - a.readiness);
      const wrap = el('div', { class: 'rcolwrap' });
      items.forEach(c => wrap.appendChild(readyCard(c, col, C)));
      board.appendChild(el('div', { class: 'rcol' },
        el('div', { class: 'rcolhead' },
          el('div', { class: 'rcolbar' },
            el('span', { class: 'rdot', style: { background: col.color } }),
            el('div', null,
              el('div', { class: 'rnm' }, col.label),
              el('div', { class: 'rhint' }, col.hint)),
            el('span', { class: 'rct' }, String(items.length)))),
        wrap));
    });
    v.appendChild(board);
    return v;
  };

  function readyCard(c, col, C) {
    const g = gapFor(c);
    return el('button', { class: 'rcard b-' + c.bucket, onclick: () => C.go(c.id) },
      el('div', { class: 'rc-top' },
        C.ring(c.readiness, c.bucket, 40),
        el('div', { class: 'rc-x' },
          el('div', { class: 'rc-nm' }, c.name, window.UI.tierChip(c.trust)),
          el('div', { class: 'rc-sp' }, c.credential + ' · ' + c.specialty),
          el('div', { class: 'rc-loc' }, c.location + ' · ' + c.comp))),
      el('div', { class: 'rc-gap' },
        el('span', { class: 'gi', style: { color: g.tone } }, icon(g.ic, 14)),
        el('span', { class: 'gt' }, el('b', null, g.t), g.d ? el('span', { class: 'muted' }, ' — ' + g.d) : null)),
      el('div', { class: 'rc-foot' },
        el('span', null, C.mobLabel(c.mobility.status) + ' · ' + c.avail),
        el('span', { class: 'act' }, 'Review', icon('arrow', 11))));
  }
})();
