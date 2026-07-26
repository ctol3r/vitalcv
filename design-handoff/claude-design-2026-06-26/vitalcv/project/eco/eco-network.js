/* ══════════════════════════════════════════════════════════════════════════
   eco-network.js — D4 · My Network (/network)
   Organizations · Training programs · Employers · Affiliations ·
   Career relationships. Who is connected to me.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  const { el, icon, chip } = window.UI;

  function styleOnce() {
    if (document.getElementById('net-css')) return;
    const css = `
    .netsummary{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:22px}
    .netstat{border:1px solid var(--s200);border-radius:12px;background:#fff;padding:15px;display:flex;flex-direction:column;gap:4px}
    .netstat .ns-ic{height:34px;width:34px;border-radius:9px;display:grid;place-items:center;margin-bottom:5px;border:1px solid var(--s200);color:var(--s700)}
    .netstat .ns-n{font-size:24px;font-weight:600;letter-spacing:-.03em;font-variant-numeric:tabular-nums}
    .netstat .ns-l{font-size:12px;color:var(--s500)}

    .netsec{margin-top:24px}
    .netgrid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
    .orgcard{border:1px solid var(--s200);border-radius:12px;background:#fff;padding:15px;display:flex;gap:13px;align-items:flex-start;transition:border-color .12s,box-shadow .12s}
    .orgcard:hover{border-color:var(--s300);box-shadow:var(--vt-shadow-sm,0 2px 8px -3px rgba(15,23,42,.12))}
    .orgcard .oc-logo{height:44px;width:44px;border-radius:11px;display:grid;place-items:center;font-family:'Geist Mono',monospace;font-weight:600;font-size:15px;flex-shrink:0;color:#fff}
    .orgcard .oc-main{flex:1;min-width:0}
    .orgcard .oc-name{font-size:15px;font-weight:600;letter-spacing:-.015em;display:flex;align-items:center;gap:7px}
    .orgcard .oc-name svg{color:var(--keep)}
    .orgcard .oc-rel{font-size:12px;color:var(--s500);margin-top:2px}
    .orgcard .oc-detail{font-size:12px;color:var(--s600);margin-top:8px;line-height:1.45;border-top:1px dashed var(--rule);padding-top:8px}
    .orgcard .oc-meta{display:flex;align-items:center;justify-content:space-between;margin-top:9px}
    .orgcard .oc-since{font-family:'Geist Mono',monospace;font-size:10px;color:var(--s400)}

    .peoplegrid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
    .pcard{border:1px solid var(--s200);border-radius:12px;background:#fff;padding:14px;display:flex;gap:12px;align-items:center;transition:border-color .12s}
    .pcard:hover{border-color:var(--s300)}
    .pcard .pava{height:42px;width:42px;border-radius:50%;background:var(--s100);display:grid;place-items:center;font-weight:600;font-size:14px;color:var(--s600);flex-shrink:0;border:1px solid var(--s200)}
    .pcard .pmain{flex:1;min-width:0}
    .pcard .pname{font-size:13.5px;font-weight:600;letter-spacing:-.01em}
    .pcard .prel{font-size:11.5px;color:var(--s500)}
    .pcard .porg{font-family:'Geist Mono',monospace;font-size:9.5px;color:var(--s400);text-transform:uppercase;letter-spacing:.06em;margin-top:3px}
    @media(max-width:900px){.netgrid{grid-template-columns:1fr}.peoplegrid{grid-template-columns:1fr 1fr}.netsummary{grid-template-columns:1fr 1fr}}
    @media(max-width:560px){.peoplegrid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(el('style', { id: 'net-css', html: css }));
  }

  const KINDMETA = {
    employer: { label: 'Employers', color: '#0f172a', icon: 'org' },
    training: { label: 'Training programs', color: '#0e7490', icon: 'calendar' },
    authority:{ label: 'Authorities & affiliations', color: '#4338ca', icon: 'shield' },
  };
  const statusChip = (st) => ({
    active: 'active', verified: 'verified', sealed: 'sealed', pending: 'pending',
  }[st] || 'verified');

  function initials(name) {
    return name.replace(/[^A-Za-z ]/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  window.renderNetwork = function () {
    styleOnce();
    const D = window.ECO;
    const v = el('div', { class: 'view' });

    v.appendChild(el('div', { class: 'pagehead' },
      el('div', null,
        el('div', { class: 'lead' }, icon('network', 12), 'My Network · who is connected to me'),
        el('h1', null, 'The people and places ', el('em', null, 'that vouch for you.')),
        el('div', { class: 'sub' }, 'Every employer, training program, certifying authority and clinical relationship in your verified career graph — each one an edge that strengthens your record.')),
      el('div', { class: 'ra' }, chip('verified', 'graph verified'))));

    // summary
    const employers = D.orgs.filter(o => o.kind === 'employer');
    const training = D.orgs.filter(o => o.kind === 'training');
    const authorities = D.orgs.filter(o => o.kind === 'authority');
    v.appendChild(el('div', { class: 'netsummary' },
      netStat('org', employers.length, 'Employers'),
      netStat('calendar', training.length, 'Training programs'),
      netStat('shield', authorities.length, 'Authorities & affiliations'),
      netStat('person', D.people.length, 'Career relationships')));

    // org sections by kind
    ['employer', 'training', 'authority'].forEach(kind => {
      const items = D.orgs.filter(o => o.kind === kind);
      if (!items.length) return;
      const M = KINDMETA[kind];
      const sec = el('div', { class: 'netsec' });
      sec.appendChild(el('div', { class: 'eyebrow rule' }, icon(M.icon, 12), M.label, el('span', { class: 'num' }, '· ' + items.length)));
      const grid = el('div', { class: 'netgrid' });
      items.forEach(o => grid.appendChild(orgCard(o, M.color)));
      sec.appendChild(grid);
      v.appendChild(sec);
    });

    // people
    const psec = el('div', { class: 'netsec' });
    psec.appendChild(el('div', { class: 'eyebrow rule' }, icon('person', 12), 'Career relationships', el('span', { class: 'num' }, '· ' + D.people.length)));
    const pgrid = el('div', { class: 'peoplegrid' });
    D.people.forEach(p => pgrid.appendChild(el('div', { class: 'pcard' },
      el('div', { class: 'pava' }, initials(p.name)),
      el('div', { class: 'pmain' },
        el('div', { class: 'pname' }, p.name),
        el('div', { class: 'prel' }, p.rel),
        el('div', { class: 'porg' }, p.org)),
      chip(p.tone === 'pending' ? 'pending' : 'verified', p.tone === 'pending' ? 'Pending' : null))));
    psec.appendChild(pgrid);
    v.appendChild(psec);

    return v;

    function netStat(ic, n, label) {
      return el('div', { class: 'netstat' },
        el('div', { class: 'ns-ic' }, icon(ic, 17)),
        el('div', { class: 'ns-n' }, String(n)),
        el('div', { class: 'ns-l' }, label));
    }
  };

  function orgCard(o, color) {
    return el('div', { class: 'orgcard' },
      el('div', { class: 'oc-logo', style: { background: color } }, initials(o.name)),
      el('div', { class: 'oc-main' },
        el('div', { class: 'oc-name' }, o.name, o.verified ? icon('check', 14) : null),
        el('div', { class: 'oc-rel' }, o.rel),
        el('div', { class: 'oc-detail' }, o.detail),
        el('div', { class: 'oc-meta' },
          el('span', { class: 'oc-since' }, o.since),
          window.UI.chip(statusChip(o.status)))));
  }
})();
