/* ══════════════════════════════════════════════════════════════════════════
   ci-insights.js — Insights · generated analysis of the record
   Five families: opportunities unlocked · credential risks · readiness
   improvements · professional milestones · career trends. Each insight is a
   reasoned read with its basis shown, never an opaque score.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  const { el, icon, chip } = window.UI;

  const FAMILIES = [
    { key: 'opportunity', label: 'Opportunities', icon: 'mobility' },
    { key: 'risk',        label: 'Risks',         icon: 'alert' },
    { key: 'readiness',   label: 'Readiness',     icon: 'rise' },
    { key: 'milestone',   label: 'Milestones',    icon: 'star' },
    { key: 'trend',       label: 'Trends',        icon: 'gauge' },
  ];

  function styleOnce() {
    if (document.getElementById('ci-insights-css')) return;
    const css = `
    .in-filter{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:18px}
    .in-pill{display:inline-flex;align-items:center;gap:7px;height:32px;padding:0 12px;border-radius:9px;border:1px solid var(--s200);background:#fff;font-size:12px;font-weight:500;color:var(--s600);transition:.12s}
    .in-pill svg{color:var(--s400)}
    .in-pill:hover{border-color:var(--s300);color:var(--s900)}
    .in-pill.on{background:var(--s900);color:#fff;border-color:var(--s900)}
    .in-pill.on svg{color:#fff}
    .in-pill .ct{font-family:'Geist Mono',monospace;font-size:9px;opacity:.65}

    .in-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}
    .incard{padding:17px;display:flex;flex-direction:column;gap:12px;position:relative;overflow:hidden}
    .incard::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px}
    .incard.t-good::before{background:var(--keep)} .incard.t-watch::before{background:var(--seam)}
    .incard.t-gate::before{background:var(--blue)} .incard.t-ghost::before{background:var(--s400)}
    .incard .intop{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
    .incard .inlead{display:flex;align-items:center;gap:9px;min-width:0}
    .incard .inic{height:34px;width:34px;border-radius:9px;display:grid;place-items:center;flex-shrink:0}
    .incard .inkind{font-family:'Geist Mono',monospace;font-size:8.5px;text-transform:uppercase;letter-spacing:.12em;color:var(--s400);font-weight:600}
    .incard .inconf{font-family:'Geist Mono',monospace;font-size:8.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--s500);border:1px solid var(--s200);border-radius:5px;padding:2px 6px;white-space:nowrap}
    .incard .inbig{display:flex;align-items:baseline;gap:8px}
    .incard .inbig .bn{font-size:26px;font-weight:600;letter-spacing:-.035em;font-variant-numeric:tabular-nums;line-height:1}
    .incard .inbig .bl{font-family:'Geist Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:var(--s500)}
    .incard .inhead{font-size:14.5px;font-weight:600;letter-spacing:-.018em;line-height:1.25}
    .incard .inbody{font-size:12.5px;color:var(--s600);line-height:1.55;text-wrap:pretty}
    .incard .inbasis{font-size:11px;color:var(--s500);line-height:1.45;border-top:1px dashed var(--rule);padding-top:10px;display:flex;gap:7px}
    .incard .inbasis svg{color:var(--s400);flex-shrink:0;margin-top:1px}
    .incard .infoot{display:flex;align-items:center;justify-content:space-between;margin-top:auto}
    .incard .incta{font-family:'Geist Mono',monospace;font-size:9.5px;text-transform:uppercase;letter-spacing:.08em;font-weight:600;display:inline-flex;align-items:center;gap:5px}
    @media(max-width:900px){.in-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(el('style', { id: 'ci-insights-css', html: css }));
  }

  let active = 'all';

  window.renderInsights = function () {
    styleOnce();
    const D = window.CI;
    const v = el('div', { class: 'view' });

    v.appendChild(el('div', { class: 'pagehead' },
      el('div', null,
        el('div', { class: 'lead' }, icon('spark', 12), 'Career Intelligence · generated insights'),
        el('h1', null, 'What your record ', el('em', null, 'is telling you')),
        el('div', { class: 'sub' }, 'The engine reads every verified fact you own and surfaces the patterns — what just opened, what is aging, where you are pulling ahead. Each insight shows the basis it was drawn from.')),
      el('div', { class: 'ra' }, chip('good', String(D.insights.length) + ' insights'))));

    const grid = el('div', { class: 'in-grid' });
    const filter = el('div', { class: 'in-filter' });

    function paint() {
      grid.innerHTML = '';
      const items = active === 'all' ? D.insights : D.insights.filter(i => i.kind === active);
      items.forEach(i => grid.appendChild(insightCard(i, D)));
      filter.querySelectorAll('.in-pill').forEach(p => p.classList.toggle('on', p.dataset.k === active));
    }

    const counts = (k) => D.insights.filter(i => i.kind === k).length;
    filter.appendChild(pill('all', 'home', 'All', D.insights.length, () => { active = 'all'; paint(); }));
    FAMILIES.forEach(f => filter.appendChild(
      pill(f.key, f.icon, f.label, counts(f.key), () => { active = f.key; paint(); })));

    v.appendChild(filter);
    v.appendChild(grid);
    paint();
    return v;
  };

  function pill(k, ic, label, ct, onclick) {
    return el('button', { class: 'in-pill', data: { k }, onclick },
      icon(ic, 14), label, el('span', { class: 'ct' }, String(ct)));
  }

  function insightCard(i, D) {
    const km = D.insightKindMeta[i.kind];
    const C = window.CICARDS;
    const col = C.TONE_VAR[i.tone] || 'var(--s500)';
    const bg = ({ good: 'var(--keep-bg)', watch: 'var(--seam-bg)', gate: 'var(--blue-bg)', ghost: 'var(--s100)' })[i.tone] || 'var(--s100)';
    return el('div', { class: 'incard t-' + i.tone },
      el('div', { class: 'intop' },
        el('div', { class: 'inlead' },
          el('div', { class: 'inic', style: { background: bg, color: col } }, icon(i.icon, 17)),
          el('div', null,
            el('div', { class: 'inkind' }, km.label),
            el('div', { class: 'inbig' },
              el('span', { class: 'bn' }, i.stat),
              el('span', { class: 'bl' }, i.statLabel)))),
        el('span', { class: 'inconf' }, i.confidence)),
      el('div', { class: 'inhead' }, i.head),
      el('div', { class: 'inbody' }, i.body),
      el('div', { class: 'inbasis' }, icon('eye', 12), el('span', null, i.basis)),
      el('div', { class: 'infoot' },
        i.route ? el('a', { class: 'incta', href: i.route, style: { color: col } }, i.cta, icon('arrow', 11)) : el('span'),
        chip(i.tone === 'ghost' ? 'ghost' : i.tone, km.label.split(' ')[0])));
  }
})();
