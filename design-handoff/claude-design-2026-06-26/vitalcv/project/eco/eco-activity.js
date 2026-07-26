/* ══════════════════════════════════════════════════════════════════════════
   eco-activity.js — D3 · Ecosystem Feed (/activity)
   One stream across every stream: evidence verified · trust milestones ·
   new opportunities · organization changes · mobility unlocks.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  const { el, icon, chip, tierChip } = window.UI;

  const KIND = {
    evidence:     { label: 'Evidence',     icon: 'wallet',   color: 'var(--keep)', bg: 'var(--keep-bg)', line: 'var(--keep-line)' },
    trust:        { label: 'Trust',        icon: 'shield',   color: 'var(--blue)', bg: 'var(--blue-bg)', line: 'var(--blue-line)' },
    opportunity:  { label: 'Opportunity',  icon: 'search',   color: '#7e22ce',     bg: '#faf5ff',        line: '#e9d5ff' },
    organization: { label: 'Organization', icon: 'org',      color: '#9a3412',     bg: '#fff7ed',        line: '#fed7aa' },
    mobility:     { label: 'Mobility',     icon: 'mobility', color: 'var(--seam)', bg: 'var(--seam-bg)', line: 'var(--seam-line)' },
  };

  function styleOnce() {
    if (document.getElementById('act-css')) return;
    const css = `
    .actlayout{display:grid;grid-template-columns:200px 1fr;gap:18px;align-items:start}
    .actfilters{position:sticky;top:104px;display:flex;flex-direction:column;gap:4px}
    .actfilters .ff{display:flex;align-items:center;gap:9px;padding:9px 11px;border-radius:9px;font-size:13px;color:var(--s600);cursor:pointer;border:1px solid transparent}
    .actfilters .ff:hover{background:var(--s100)}
    .actfilters .ff.on{background:#fff;border-color:var(--s200);color:var(--s900);font-weight:500;box-shadow:var(--vt-shadow-sm,0 1px 2px rgba(15,23,42,.05))}
    .actfilters .ff .fdot{width:8px;height:8px;border-radius:3px;flex-shrink:0}
    .actfilters .ff .fct{margin-left:auto;font-family:'Geist Mono',monospace;font-size:10px;color:var(--s400);font-variant-numeric:tabular-nums}
    .actfilters .ff.on .fct{color:var(--s600)}
    .actfilters .flabel{font-family:'Geist Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:.14em;color:var(--s400);font-weight:600;padding:0 11px;margin-bottom:8px}

    .feed{position:relative;padding-left:6px}
    .fday{font-family:'Geist Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:.14em;color:var(--s400);font-weight:600;margin:0 0 4px;padding-left:46px}
    .fitem{display:grid;grid-template-columns:36px 1fr;gap:14px;position:relative;padding:10px 0}
    .fitem::before{content:"";position:absolute;left:17px;top:0;bottom:0;width:1.5px;background:var(--rule)}
    .fitem:first-of-type::before{top:26px}
    .fitem:last-of-type::before{bottom:auto;height:26px}
    .fitem .fnode{height:36px;width:36px;border-radius:10px;display:grid;place-items:center;z-index:1;border:1.5px solid}
    .fcard{border:1px solid var(--s200);border-radius:11px;background:#fff;padding:13px 15px;transition:border-color .12s,box-shadow .12s}
    .fcard:hover{border-color:var(--s300);box-shadow:var(--vt-shadow-sm,0 2px 8px -2px rgba(15,23,42,.12))}
    .fcard .fc-top{display:flex;align-items:center;gap:8px;margin-bottom:5px}
    .fcard .fc-stream{font-family:'Geist Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:.1em;font-weight:600}
    .fcard .fc-when{margin-left:auto;font-family:'Geist Mono',monospace;font-size:9.5px;color:var(--s400)}
    .fcard .fc-title{font-size:14.5px;font-weight:600;letter-spacing:-.015em;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
    .fcard .fc-desc{font-size:12.5px;color:var(--s500);margin-top:3px;line-height:1.5}
    .actsummary{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:18px}
    .sumcard{border:1px solid var(--s200);border-radius:11px;background:#fff;padding:12px 13px;display:flex;flex-direction:column;gap:7px;cursor:pointer;transition:border-color .12s,transform .12s}
    .sumcard:hover{transform:translateY(-2px)}
    .sumcard .stop{display:flex;align-items:center;justify-content:space-between}
    .sumcard .sn{font-size:22px;font-weight:600;letter-spacing:-.03em;font-variant-numeric:tabular-nums}
    .sumcard .sl{font-size:11.5px;color:var(--s500);font-weight:500}
    @media(max-width:860px){.actlayout{grid-template-columns:1fr}.actfilters{position:static;flex-direction:row;flex-wrap:wrap}.actsummary{grid-template-columns:repeat(3,1fr)}}
    @media(max-width:520px){.actsummary{grid-template-columns:1fr 1fr}}
    `;
    document.head.appendChild(el('style', { id: 'act-css', html: css }));
  }

  let filter = 'all';

  window.renderActivity = function () {
    styleOnce();
    const D = window.ECO;
    const v = el('div', { class: 'view' });

    v.appendChild(el('div', { class: 'pagehead' },
      el('div', null,
        el('div', { class: 'lead' }, icon('feed', 12), 'Activity · the ecosystem stream'),
        el('h1', null, 'Everything that moved, ', el('em', null, 'in one feed.')),
        el('div', { class: 'sub' }, 'Evidence verifications, trust milestones, new opportunities, organization changes and mobility unlocks — every stream reporting into a single chronology.')),
      el('div', { class: 'ra' }, chip('active', 'live'))));

    // summary row
    const counts = {};
    Object.keys(KIND).forEach(k => counts[k] = D.activity.filter(a => a.kind === k).length);
    const summary = el('div', { class: 'actsummary' });
    Object.keys(KIND).forEach(k => {
      const K = KIND[k];
      summary.appendChild(el('div', { class: 'sumcard', style: { borderColor: K.line }, onclick: () => setFilter(k) },
        el('div', { class: 'stop' },
          el('div', { style: { color: K.color } }, icon(K.icon, 17)),
          el('span', { class: 'sn', style: { color: K.color } }, String(counts[k]))),
        el('div', { class: 'sl' }, K.label)));
    });
    v.appendChild(summary);

    // layout: filters + feed
    const filters = el('div', { class: 'actfilters' });
    filters.appendChild(el('div', { class: 'flabel' }, 'Filter stream'));
    filters.appendChild(filterBtn('all', 'All activity', D.activity.length, 'var(--s900)'));
    Object.keys(KIND).forEach(k => filters.appendChild(filterBtn(k, KIND[k].label, counts[k], KIND[k].color)));

    const feedWrap = el('div', { class: 'feedwrap' });
    renderFeed(feedWrap);

    v.appendChild(el('div', { class: 'actlayout' }, filters, feedWrap));
    return v;

    function filterBtn(k, label, ct, color) {
      return el('div', { class: 'ff' + (filter === k ? ' on' : ''), data: { k }, onclick: () => setFilter(k) },
        el('span', { class: 'fdot', style: { background: color } }),
        el('span', null, label),
        el('span', { class: 'fct' }, String(ct)));
    }
    function setFilter(k) {
      filter = k;
      v.querySelectorAll('.ff').forEach(b => b.classList.toggle('on', b.dataset.k === k));
      renderFeed(feedWrap);
    }
  };

  function renderFeed(wrap) {
    const D = window.ECO;
    wrap.innerHTML = '';
    const items = filter === 'all' ? D.activity : D.activity.filter(a => a.kind === filter);
    const feed = el('div', { class: 'feed' });
    items.forEach(a => {
      const K = KIND[a.kind];
      feed.appendChild(el('div', { class: 'fitem' },
        el('div', { class: 'fnode', style: { color: K.color, background: K.bg, borderColor: K.line } }, icon(K.icon, 17)),
        el('div', { class: 'fcard' },
          el('div', { class: 'fc-top' },
            el('span', { class: 'fc-stream', style: { color: K.color } }, K.label),
            a.tier ? tierChip(a.tier) : null,
            el('span', { class: 'fc-when' }, a.when)),
          el('div', { class: 'fc-title' }, a.t),
          el('div', { class: 'fc-desc' }, a.d))));
    });
    if (!items.length) feed.appendChild(el('div', { class: 'muted', style: { padding: '40px', textAlign: 'center' } }, 'No activity in this stream.'));
    wrap.appendChild(feed);
  }
})();
