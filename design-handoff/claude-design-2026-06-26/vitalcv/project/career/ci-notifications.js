/* ══════════════════════════════════════════════════════════════════════════
   ci-notifications.js — Notification Center
   Meaningful alerts generated from Evidence, Trust, Timeline, Mobility and
   Organizations. No spam — only verified changes, gates, and movements. Group
   by source, filter, and mark read; the nav badge tracks what is still unread.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  const { el, icon, chip } = window.UI;

  const SOURCES = [
    { key: 'evidence',  label: 'Evidence',      icon: 'wallet' },
    { key: 'trust',     label: 'Trust',         icon: 'shield' },
    { key: 'timeline',  label: 'Timeline',      icon: 'feed' },
    { key: 'mobility',  label: 'Mobility',      icon: 'mobility' },
    { key: 'org',       label: 'Organizations', icon: 'org' },
    { key: 'milestone', label: 'Milestones',    icon: 'star' },
  ];

  function styleOnce() {
    if (document.getElementById('ci-notif-css')) return;
    const css = `
    .nf-top{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:16px}
    .nf-filter{display:flex;gap:6px;flex-wrap:wrap}
    .nf-pill{display:inline-flex;align-items:center;gap:7px;height:32px;padding:0 12px;border-radius:9px;border:1px solid var(--s200);background:#fff;font-size:12px;font-weight:500;color:var(--s600);transition:.12s}
    .nf-pill svg{color:var(--s400)}
    .nf-pill:hover{border-color:var(--s300);color:var(--s900)}
    .nf-pill.on{background:var(--s900);color:#fff;border-color:var(--s900)}
    .nf-pill.on svg{color:#fff}
    .nf-pill .ct{font-family:'Geist Mono',monospace;font-size:9px;opacity:.65}
    .nf-pill .unr{width:6px;height:6px;border-radius:50%;background:var(--cut)}

    .nf-list{display:flex;flex-direction:column;gap:10px}
    .nf-daygroup{margin-bottom:6px}
    .nf-dayhead{font-family:'Geist Mono',monospace;font-size:8.5px;text-transform:uppercase;letter-spacing:.14em;color:var(--s400);font-weight:600;padding:4px 2px 10px;display:flex;align-items:center;gap:9px}
    .nf-dayhead::after{content:"";flex:1;height:1px;background:var(--rule-soft)}
    .nf-empty{padding:46px;text-align:center;color:var(--s400)}
    `;
    document.head.appendChild(el('style', { id: 'ci-notif-css', html: css }));
  }

  let active = 'all';

  window.renderNotifications = function () {
    styleOnce();
    window.CICARDS.styleOnce();
    const D = window.CI;
    const v = el('div', { class: 'view' });

    v.appendChild(el('div', { class: 'pagehead' },
      el('div', null,
        el('div', { class: 'lead' }, icon('bell', 12), 'Career Intelligence · notification center'),
        el('h1', null, 'Alerts worth ', el('em', null, 'your attention')),
        el('div', { class: 'sub' }, 'Generated only when a verified fact actually changes — a source re-read, a gate, a new event, a role unlocked. Held to a high bar so the feed stays signal, never noise.')),
      el('div', { class: 'ra' }, chip('risk', D.unread() + ' unread'))));

    const top = el('div', { class: 'nf-top' });
    const filter = el('div', { class: 'nf-filter' });
    const markAll = el('button', { class: 'linkmore', onclick: () => { D.feed.forEach(n => n.unread = false); paint(); window.refreshNavBadge(); } },
      icon('check', 12), 'Mark all read');
    top.appendChild(filter);
    top.appendChild(markAll);

    const list = el('div', { class: 'nf-list' });

    function paint() {
      // filter pills
      filter.innerHTML = '';
      const unreadFor = (k) => D.feed.filter(n => n.stream === k && n.unread).length;
      filter.appendChild(pill('all', 'bell', 'All', D.feed.length, D.unread(), () => { active = 'all'; paint(); }));
      SOURCES.forEach(s => {
        const ct = D.feed.filter(n => n.stream === s.key).length;
        if (!ct) return;
        filter.appendChild(pill(s.key, s.icon, s.label, ct, unreadFor(s.key), () => { active = s.key; paint(); }));
      });
      filter.querySelectorAll('.nf-pill').forEach(p => p.classList.toggle('on', p.dataset.k === active));

      // list, grouped lightly into Recent / Earlier
      list.innerHTML = '';
      const items = active === 'all' ? D.feed : D.feed.filter(n => n.stream === active);
      const recent = items.filter(n => n.when.startsWith('Today') || /Jun (1[1-9]|2[0-9])/.test(n.when) || n.when === 'Ongoing');
      const earlier = items.filter(n => !recent.includes(n));
      if (!items.length) { list.appendChild(el('div', { class: 'nf-empty' }, 'No alerts in this source.')); return; }
      if (recent.length) list.appendChild(dayGroup('Recent · this week', recent, paint));
      if (earlier.length) list.appendChild(dayGroup('Earlier', earlier, paint));
    }

    v.appendChild(top);
    v.appendChild(list);
    paint();
    return v;
  };

  function pill(k, ic, label, ct, unread, onclick) {
    return el('button', { class: 'nf-pill', data: { k }, onclick },
      icon(ic, 14), label, el('span', { class: 'ct' }, String(ct)),
      unread ? el('span', { class: 'unr' }) : null);
  }

  function dayGroup(label, items, repaint) {
    const g = el('div', { class: 'nf-daygroup' },
      el('div', { class: 'nf-dayhead' }, label));
    items.forEach(n => {
      const row = window.CICARDS.streamRow(n);
      // clicking the row marks it read
      row.style.cursor = 'pointer';
      row.addEventListener('click', (e) => {
        if (e.target.closest('a')) return; // let cta links route
        if (n.unread) { n.unread = false; repaint(); window.refreshNavBadge(); }
      });
      g.appendChild(row);
    });
    return g;
  }
})();
