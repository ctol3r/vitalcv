/* ══════════════════════════════════════════════════════════════════════════
   ci-actions.js — Action Center · high-priority actions ranked by impact
   Every action carries a tier (gate / soon / grow), an impact score, the effect
   on the record, and — most importantly — why it matters. Marking one done
   recomputes the queue, so the engine always shows the next-best move.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  const { el, icon, chip } = window.UI;

  const done = new Set(); // session-local "done" set

  function styleOnce() {
    if (document.getElementById('ci-actions-css')) return;
    const css = `
    .ac-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px}
    .ac-list{display:flex;flex-direction:column;gap:12px}
    .accard{padding:0;display:flex;overflow:hidden;transition:box-shadow .12s,opacity .2s}
    .accard:hover{box-shadow:0 8px 24px -16px rgba(15,23,42,.4)}
    .accard.is-done{opacity:.55}
    .accard .acrank{width:62px;flex-shrink:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;border-right:1px solid var(--s200);background:var(--s50)}
    .accard .acrank .acn{font-family:'Geist Mono',monospace;font-size:20px;font-weight:600;color:var(--s700);letter-spacing:-.02em}
    .accard .acrank .acl{font-family:'Geist Mono',monospace;font-size:7.5px;text-transform:uppercase;letter-spacing:.1em;color:var(--s400)}
    .accard .acbody{flex:1;min-width:0;padding:16px 18px;display:flex;flex-direction:column;gap:11px}
    .accard .actop{display:flex;align-items:flex-start;gap:12px}
    .accard .acic{height:36px;width:36px;border-radius:10px;display:grid;place-items:center;flex-shrink:0}
    .accard .acti{flex:1;min-width:0}
    .accard .actitle{font-size:15px;font-weight:600;letter-spacing:-.018em;line-height:1.2}
    .accard .acmeta{font-family:'Geist Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:.07em;color:var(--s500);margin-top:5px;display:flex;flex-wrap:wrap;gap:4px 10px}
    .accard .acmeta b{color:var(--s700);font-weight:600}
    .accard .acwhy{font-size:12.5px;color:var(--s600);line-height:1.55;text-wrap:pretty}
    .accard .acmatters{background:var(--s50);border:1px solid var(--rule);border-radius:10px;padding:11px 13px}
    .accard .acmatters .ml{font-family:'Geist Mono',monospace;font-size:8px;text-transform:uppercase;letter-spacing:.13em;color:var(--s400);font-weight:600;margin-bottom:6px;display:flex;align-items:center;gap:6px}
    .accard .acmatters .mt{font-size:12px;color:var(--s700);line-height:1.55;text-wrap:pretty}
    .accard .acfoot{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
    .accard .aceffect{display:inline-flex;align-items:center;gap:7px;font-size:11.5px;color:var(--keep);font-weight:500}
    .accard .aceffect svg{color:var(--keep)}
    .accard .acbtns{display:flex;align-items:center;gap:8px}
    .ac-impact{height:5px;border-radius:3px;background:var(--s100);width:96px;overflow:hidden;position:relative}
    .ac-impact i{position:absolute;left:0;top:0;bottom:0;border-radius:3px}
    @media(max-width:760px){.ac-summary{grid-template-columns:repeat(2,1fr)}.accard{flex-direction:column}.accard .acrank{width:100%;flex-direction:row;justify-content:flex-start;gap:10px;padding:8px 14px;border-right:0;border-bottom:1px solid var(--s200)}}
    `;
    document.head.appendChild(el('style', { id: 'ci-actions-css', html: css }));
  }

  const toneVar = { gate: 'var(--blue)', soon: 'var(--seam)', grow: 'var(--s600)' };
  const toneBg  = { gate: 'var(--blue-bg)', soon: 'var(--seam-bg)', grow: 'var(--s100)' };

  window.renderActions = function () {
    styleOnce();
    window.CICARDS.styleOnce();
    const D = window.CI;
    const v = el('div', { class: 'view' });

    v.appendChild(el('div', { class: 'pagehead' },
      el('div', null,
        el('div', { class: 'lead' }, icon('target', 12), 'Career Intelligence · action center'),
        el('h1', null, 'What to do ', el('em', null, 'next')),
        el('div', { class: 'sub' }, 'Every move you could make, ranked by how much it actually changes your reachable career — not a to-do list, a leverage list. Each one tells you plainly why it matters.')),
      el('div', { class: 'ra' }, chip('gate', '1 gate'), chip('watch', '2 soon'))));

    const summary = el('div', { class: 'ac-summary' });
    const list = el('div', { class: 'ac-list' });

    function paint() {
      const open = D.actions.filter(a => !done.has(a.id)).sort((a, b) => b.impact - a.impact);
      const C = window.CICARDS;
      summary.innerHTML = '';
      summary.appendChild(C.metricTile(String(open.length), 'open actions', 'Across gate, soon and grow'));
      summary.appendChild(C.metricTile(String(open.filter(a => a.tier === 'gate').length), 'gates', 'Only an institution can open'));
      summary.appendChild(C.metricTile(String(done.size), 'cleared', 'This session'));
      const topImpact = open[0] ? open[0].impact : 0;
      summary.appendChild(C.metricTile(String(topImpact), 'top impact', open[0] ? open[0].title : '—'));

      list.innerHTML = '';
      open.forEach((a, i) => list.appendChild(actionCard(a, i, D, paint)));
      if (!open.length) list.appendChild(emptyState());
    }

    v.appendChild(summary);
    v.appendChild(el('div', { class: 'eyebrow rule', style: { margin: '4px 0 14px' } },
      icon('rise', 12), 'Ranked by impact', el('span', { class: 'num' }, '· highest-leverage first')));
    v.appendChild(list);
    paint();
    return v;
  };

  function actionCard(a, i, D, repaint) {
    const tm = D.actionTierMeta[a.tier];
    const col = toneVar[a.tier], bg = toneBg[a.tier];
    return el('div', { class: 'card accard' + (done.has(a.id) ? ' is-done' : '') },
      el('div', { class: 'acrank' },
        el('div', { class: 'acn' }, '0' + (i + 1)),
        el('div', { class: 'acl' }, 'rank')),
      el('div', { class: 'acbody' },
        el('div', { class: 'actop' },
          el('div', { class: 'acic', style: { background: bg, color: col } }, icon(a.icon, 18)),
          el('div', { class: 'acti' },
            el('div', { class: 'actitle' }, a.title),
            el('div', { class: 'acmeta' },
              el('span', null, 'Owner · ', el('b', null, a.owner)),
              el('span', null, 'Feeds · ', el('b', null, a.dim)),
              el('span', null, 'Effort · ', el('b', null, a.eta)))),
          chip(tm.tone, tm.label)),
        el('div', { class: 'acwhy' }, a.why),
        el('div', { class: 'acmatters' },
          el('div', { class: 'ml' }, icon('spark', 10), 'Why it matters'),
          el('div', { class: 'mt' }, a.matters)),
        el('div', { class: 'acfoot' },
          el('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' } },
            el('span', { class: 'aceffect' }, icon('arrowup', 13), a.effect),
            el('div', { style: { display: 'flex', alignItems: 'center', gap: '7px' } },
              el('div', { class: 'ac-impact' }, el('i', { style: { width: a.impact + '%', background: col } })),
              el('span', { class: 'mono', style: { fontSize: '9.5px', color: 'var(--s500)' } }, 'impact ' + a.impact))),
          el('div', { class: 'acbtns' },
            el('button', { class: 'btn btn-soft', onclick: () => { done.add(a.id); repaint(); } }, icon('check', 13), 'Mark done'),
            el('button', { class: 'btn ' + (a.tier === 'gate' ? 'btn-pri' : a.tier === 'soon' ? 'btn-keep' : 'btn-pri'),
              onclick: () => { done.add(a.id); repaint(); } }, a.cta, icon('arrow', 13))))));
  }

  function emptyState() {
    return el('div', { class: 'card', style: { padding: '40px', textAlign: 'center' } },
      el('div', { style: { display: 'inline-grid', placeItems: 'center', height: '46px', width: '46px', borderRadius: '12px', background: 'var(--keep-bg)', color: 'var(--keep)', marginBottom: '14px' } }, icon('check', 22)),
      el('div', { style: { fontSize: '16px', fontWeight: '600', letterSpacing: '-.02em' } }, 'Queue clear'),
      el('div', { class: 'muted', style: { fontSize: '12.5px', marginTop: '6px' } }, 'You have worked through every recommended move. The engine will surface the next one as your record changes.'));
  }
})();
