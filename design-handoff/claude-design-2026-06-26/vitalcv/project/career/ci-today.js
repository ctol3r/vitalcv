/* ══════════════════════════════════════════════════════════════════════════
   ci-today.js — Today · the personalized daily briefing
   Career Health · New Evidence · Trust Changes · Timeline Events · Mobility
   Updates · Recommended Actions — the engine's read of what changed overnight.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  const { el, icon, chip, delta } = window.UI;

  function styleOnce() {
    if (document.getElementById('ci-today-css')) return;
    const css = `
    .td-hero{display:grid;grid-template-columns:1.15fr 1fr;gap:14px;margin-bottom:16px}
    .healthcard{padding:20px;display:flex;gap:20px;align-items:center}
    .healthcard .hbody{flex:1;min-width:0}
    .healthcard .hband{display:flex;align-items:center;gap:9px;margin-bottom:3px}
    .healthcard .hband .bn{font-size:20px;font-weight:600;letter-spacing:-.02em}
    .healthcard .hsub{font-size:12.5px;color:var(--s600);line-height:1.5;margin:7px 0 13px;text-wrap:pretty}
    .healthcard .hpill{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
    .hp{border:1px solid var(--s200);border-radius:10px;padding:9px 10px;background:var(--s50)}
    .hp .hpn{font-size:17px;font-weight:600;letter-spacing:-.02em;font-variant-numeric:tabular-nums;display:flex;align-items:baseline;gap:5px}
    .hp .hpl{font-family:'Geist Mono',monospace;font-size:8px;text-transform:uppercase;letter-spacing:.08em;color:var(--s500);margin-top:2px}
    .hp .hph{font-size:10px;color:var(--s400);margin-top:3px;line-height:1.35}

    .briefcard{padding:18px;display:flex;flex-direction:column;gap:14px;background:linear-gradient(180deg,#fff,var(--s50))}
    .briefcard .bdate{font-family:'Geist Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:.14em;color:var(--s400);font-weight:600}
    .briefcard .bgreet{font-size:21px;font-weight:600;letter-spacing:-.025em;line-height:1.1}
    .briefcard .bline{font-size:13px;color:var(--s600);line-height:1.55;text-wrap:pretty}
    .briefcount{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-top:auto}
    .bc{text-align:left}
    .bc .bcn{font-size:22px;font-weight:600;letter-spacing:-.03em;font-variant-numeric:tabular-nums;line-height:1}
    .bc .bcl{font-family:'Geist Mono',monospace;font-size:8.5px;text-transform:uppercase;letter-spacing:.07em;color:var(--s500);margin-top:4px}

    .td-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}
    .stack{display:flex;flex-direction:column;gap:10px}
    .panel{padding:16px}
    .panel-rows{display:flex;flex-direction:column;gap:9px}
    .rec-strip{display:flex;flex-direction:column;gap:9px}
    .recrow{display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid var(--s200);border-radius:12px;background:#fff;width:100%;text-align:left;transition:border-color .12s,box-shadow .12s}
    .recrow:hover{border-color:var(--s300);box-shadow:0 4px 14px -10px rgba(15,23,42,.3)}
    .recrow .rnk{font-family:'Geist Mono',monospace;font-size:11px;color:var(--s400);width:18px;flex-shrink:0}
    .recrow .ric{height:32px;width:32px;border-radius:9px;display:grid;place-items:center;flex-shrink:0}
    .recrow .rx{flex:1;min-width:0}
    .recrow .rt{font-size:13px;font-weight:600;letter-spacing:-.01em}
    .recrow .rw{font-size:11.5px;color:var(--s500);margin-top:2px;line-height:1.4}
    .recrow .rimp{font-family:'Geist Mono',monospace;font-size:9px;color:var(--s500);text-transform:uppercase;letter-spacing:.06em;white-space:nowrap;flex-shrink:0}
    @media(max-width:980px){.td-hero{grid-template-columns:1fr}.td-grid{grid-template-columns:1fr}.hpill{grid-template-columns:repeat(3,1fr)}}
    `;
    document.head.appendChild(el('style', { id: 'ci-today-css', html: css }));
  }

  window.renderToday = function () {
    styleOnce();
    window.CICARDS.styleOnce();
    const D = window.CI, C = window.CICARDS;
    const v = el('div', { class: 'view' });

    v.appendChild(el('div', { class: 'pagehead' },
      el('div', null,
        el('div', { class: 'lead' }, icon('sun', 12), 'Career Intelligence · daily briefing'),
        el('h1', null, 'Today, on ', el('em', null, 'your record')),
        el('div', { class: 'sub' }, 'The engine read your owned ledger overnight. Here is what moved, what it means, and the one thing worth doing next — surfaced before you went looking.')),
      el('div', { class: 'ra' }, chip('good', 'engine live'))));

    // hero: career health + briefing
    v.appendChild(el('div', { class: 'td-hero' }, healthCard(D, C), briefCard(D)));

    // two columns of streams
    v.appendChild(el('div', { class: 'td-grid' },
      el('div', { class: 'stack' },
        streamPanel(D, 'New evidence', 'wallet', ['evidence']),
        streamPanel(D, 'Trust changes', 'shield', ['trust'])),
      el('div', { class: 'stack' },
        streamPanel(D, 'Timeline events', 'feed', ['timeline', 'org']),
        streamPanel(D, 'Mobility updates', 'mobility', ['mobility', 'milestone']))));

    // recommended actions
    v.appendChild(el('div', { class: 'eyebrow rule', style: { marginBottom: '12px' } },
      icon('target', 12), 'Recommended actions', el('span', { class: 'num' }, '· ranked by impact, today')));
    v.appendChild(recommended(D));

    return v;
  };

  function healthCard(D, C) {
    const h = D.health;
    return el('div', { class: 'card healthcard' },
      C.healthRing(h.overall, 'good', 118, 'health'),
      el('div', { class: 'hbody' },
        el('div', { class: 'eyebrow', style: { margin: '0 0 8px' } }, icon('gauge', 12), 'Career Health'),
        el('div', { class: 'hband' },
          el('span', { class: 'bn' }, h.band),
          delta(h.delta, { suffix: ' · 30d' })),
        el('div', { class: 'hsub' }, 'A single composite read across the three things employers actually weigh — how complete your evidence is, how much that evidence is trusted, and how ready you are to move.'),
        el('div', { class: 'hpill' },
          h.pillars.map(p => el('div', { class: 'hp' },
            el('div', { class: 'hpn' }, String(p.value), delta(p.delta)),
            el('div', { class: 'hpl' }, p.label),
            el('div', { class: 'hph' }, p.sub))))));
  }

  function briefCard(D) {
    const b = D.briefing;
    return el('div', { class: 'card briefcard' },
      el('div', null,
        el('div', { class: 'bdate' }, b.date),
        el('div', { class: 'bgreet', style: { marginTop: '6px' } }, b.greeting)),
      el('div', { class: 'bline' }, b.line),
      el('div', { class: 'briefcount' },
        el('a', { class: 'bc', href: '#/notifications' },
          el('div', { class: 'bcn' }, String(b.counts.changes)), el('div', { class: 'bcl' }, 'changes')),
        el('a', { class: 'bc', href: '#/actions' },
          el('div', { class: 'bcn', style: { color: 'var(--blue)' } }, String(b.counts.gates)), el('div', { class: 'bcl' }, 'open gate')),
        el('a', { class: 'bc', href: '#/goals' },
          el('div', { class: 'bcn', style: { color: 'var(--keep)' } }, String(b.counts.unlocked)), el('div', { class: 'bcl' }, 'roles unlocked'))));
  }

  function streamPanel(D, title, ic, streams) {
    const items = D.feed.filter(n => streams.includes(n.stream)).slice(0, 3);
    return el('div', { class: 'card panel' },
      el('div', { class: 'eyebrow', style: { margin: '0 0 12px' } }, icon(ic, 12), title,
        el('span', { class: 'num' }, '· ' + items.length)),
      el('div', { class: 'panel-rows' },
        items.map(n => window.CICARDS.streamRow(n))));
  }

  function recommended(D) {
    const top = [...D.actions].sort((a, b) => b.impact - a.impact).slice(0, 3);
    const tone = (t) => ({ gate: 'var(--blue)', soon: 'var(--seam)', grow: 'var(--s600)' }[t]);
    const bg = (t) => ({ gate: 'var(--blue-bg)', soon: 'var(--seam-bg)', grow: 'var(--s100)' }[t]);
    return el('div', { class: 'rec-strip' },
      top.map((a, i) => el('a', { class: 'recrow', href: '#/actions' },
        el('span', { class: 'rnk' }, '0' + (i + 1)),
        el('span', { class: 'ric', style: { background: bg(a.tier), color: tone(a.tier) } }, icon(a.icon, 16)),
        el('span', { class: 'rx' },
          el('span', { class: 'rt' }, a.title),
          el('span', { class: 'rw' }, a.matters.split('.')[0] + '.')),
        chip(D.actionTierMeta[a.tier].tone, D.actionTierMeta[a.tier].label),
        el('span', { class: 'rimp' }, 'impact ' + a.impact),
        icon('arrow', 14))));
  }
})();
