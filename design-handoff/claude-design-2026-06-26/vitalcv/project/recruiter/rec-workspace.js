/* ══════════════════════════════════════════════════════════════════════════
   rec-workspace.js — D5 · Recruiter Workspace (/recruiter/workspace)
   Track the work in flight: Opportunities (open reqs) across the top, then
   Prospects · Conversations · Reviews as three live columns.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  const { el, icon, chip, tierChip } = window.UI;

  function styleOnce() {
    if (document.getElementById('rec-ws-css')) return;
    const css = `
    .ws-opps{display:grid;grid-template-columns:repeat(5,1fr);gap:11px;margin-bottom:22px}
    .opp{border:1px solid var(--s200);border-radius:12px;background:#fff;padding:14px;display:flex;flex-direction:column;gap:9px;transition:border-color .12s,box-shadow .12s;text-align:left}
    .opp:hover{border-color:var(--s300);box-shadow:0 6px 18px -12px rgba(15,23,42,.3)}
    .opp .op-code{font-family:'Geist Mono',monospace;font-size:9px;color:var(--s400);text-transform:uppercase;letter-spacing:.07em}
    .opp .op-role{font-size:13.5px;font-weight:600;letter-spacing:-.015em;line-height:1.2}
    .opp .op-site{font-size:11px;color:var(--s500)}
    .opp .op-foot{display:flex;align-items:center;gap:7px;margin-top:auto;border-top:1px dashed var(--rule);padding-top:9px}
    .opp .op-mt{font-family:'Geist Mono',monospace;font-size:10px;color:var(--s600)}
    .opp .op-mt b{color:var(--s900)}
    .opp .op-ready{font-family:'Geist Mono',monospace;font-size:9px;font-weight:600;color:var(--keep);background:var(--keep-bg);box-shadow:inset 0 0 0 1px var(--keep-line);border-radius:5px;padding:2px 6px;margin-left:auto}

    .ws-board{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;align-items:start}
    .wscol .wch{display:flex;align-items:center;gap:9px;margin-bottom:11px}
    .wscol .wch .wci{height:30px;width:30px;border-radius:8px;background:var(--s900);color:#fff;display:grid;place-items:center;flex-shrink:0}
    .wscol .wch .wcn{font-size:14px;font-weight:600;letter-spacing:-.01em}
    .wscol .wch .wcc{font-family:'Geist Mono',monospace;font-size:13px;font-weight:600;margin-left:auto;color:var(--s500)}
    .wscol .wcwrap{display:flex;flex-direction:column;gap:9px}

    .wcard{border:1px solid var(--s200);border-radius:12px;background:#fff;padding:12px 13px;display:flex;flex-direction:column;gap:8px;transition:border-color .12s,box-shadow .12s;text-align:left;width:100%}
    .wcard:hover{border-color:var(--s300);box-shadow:0 5px 16px -10px rgba(15,23,42,.3)}
    .wcard .wc-top{display:flex;gap:10px;align-items:center}
    .wcard .wc-x{flex:1;min-width:0}
    .wcard .wc-nm{font-size:13px;font-weight:600;letter-spacing:-.01em;display:flex;align-items:center;gap:6px}
    .wcard .wc-sp{font-family:'Geist Mono',monospace;font-size:9px;color:var(--s500);text-transform:uppercase;letter-spacing:.05em;margin-top:2px}
    .wcard .wc-note{font-size:11.5px;color:var(--s600);line-height:1.4;border-top:1px dashed var(--rule);padding-top:8px}
    .wcard .wc-foot{display:flex;align-items:center;justify-content:space-between;font-family:'Geist Mono',monospace;font-size:9px;color:var(--s400);text-transform:uppercase;letter-spacing:.07em}
    .stagepill{font-family:'Geist Mono',monospace;font-size:8.5px;text-transform:uppercase;letter-spacing:.06em;font-weight:600;color:var(--s600);background:var(--s100);border-radius:5px;padding:3px 7px}
    @media(max-width:1080px){.ws-opps{grid-template-columns:repeat(2,1fr)}.ws-board{grid-template-columns:1fr}}
    `;
    document.head.appendChild(el('style', { id: 'rec-ws-css', html: css }));
  }

  window.renderRecWorkspace = function () {
    styleOnce();
    window.RECCARDS.styleOnce();
    const D = window.REC, C = window.RECCARDS;
    const W = D.workspace;
    const v = el('div', { class: 'view' });

    v.appendChild(el('div', { class: 'pagehead' },
      el('div', null,
        el('div', { class: 'lead' }, icon('workspace', 12), 'Workspace · the work in flight'),
        el('h1', null, 'Your desk, ', el('em', null, 'end to end.')),
        el('div', { class: 'sub' }, 'Open requisitions across the top; prospects, conversations and credential reviews tracked below — every card one click from the candidate it belongs to.')),
      el('div', { class: 'ra' }, chip('active', D.operator.reqs + ' open reqs'))));

    // ── opportunities ──
    v.appendChild(el('div', { class: 'eyebrow rule', style: { marginBottom: '12px' } },
      icon('target', 12), 'Opportunities', el('span', { class: 'num' }, '· open requisitions you are filling')));
    const opps = el('div', { class: 'ws-opps' });
    W.opportunities.forEach(o => opps.appendChild(
      el('a', { class: 'opp', href: '#/discovery' },
        el('div', { class: 'op-code' }, o.code),
        el('div', null,
          el('div', { class: 'op-role' }, o.role),
          el('div', { class: 'op-site' }, o.site)),
        el('div', { class: 'op-foot' },
          el('span', { class: 'op-mt' }, el('b', null, String(o.matches)), ' matched'),
          o.ready > 0 ? el('span', { class: 'op-ready' }, o.ready + ' ready') : el('span', { class: 'stagepill' }, 'building')))));
    v.appendChild(opps);

    // ── three columns ──
    const board = el('div', { class: 'ws-board' },
      wsCol('people', 'Prospects', W.prospects.length,
        W.prospects.map(p => prospectCard(D.byId[p.id], p, C))),
      wsCol('message', 'Conversations', W.conversations.length,
        W.conversations.map(cv => convoCard(D.byId[cv.id], cv, C))),
      wsCol('review', 'Reviews', W.reviews.length,
        W.reviews.map(r => reviewCard(D.byId[r.id], r, C))));
    v.appendChild(board);

    return v;
  };

  function wsCol(ic, name, count, cards) {
    return el('div', { class: 'wscol' },
      el('div', { class: 'wch' },
        el('div', { class: 'wci' }, icon(ic, 15)),
        el('div', { class: 'wcn' }, name),
        el('div', { class: 'wcc' }, String(count))),
      el('div', { class: 'wcwrap' }, cards));
  }

  function prospectCard(c, p, C) {
    return el('button', { class: 'wcard', onclick: () => C.go(c.id) },
      el('div', { class: 'wc-top' },
        C.ring(c.readiness, c.bucket, 36),
        el('div', { class: 'wc-x' },
          el('div', { class: 'wc-nm' }, c.name, tierChip(c.trust)),
          el('div', { class: 'wc-sp' }, c.specialty + ' · ' + c.location)),
        C.bucketChip(c.bucket)),
      el('div', { class: 'wc-note' }, p.note),
      el('div', { class: 'wc-foot' },
        el('span', { class: 'stagepill' }, p.stage),
        el('span', null, 'added ' + p.added)));
  }

  function convoCard(c, cv, C) {
    return el('button', { class: 'wcard', onclick: () => C.go(c.id) },
      el('div', { class: 'wc-top' },
        C.avatar(c, 34),
        el('div', { class: 'wc-x' },
          el('div', { class: 'wc-nm' }, c.name),
          el('div', { class: 'wc-sp' }, cv.subject)),
        chip(cv.state)),
      el('div', { class: 'wc-note' }, cv.last),
      el('div', { class: 'wc-foot' },
        el('span', null, c.specialty),
        el('span', null, cv.when)));
  }

  function reviewCard(c, r, C) {
    return el('button', { class: 'wcard', onclick: () => C.go(c.id) },
      el('div', { class: 'wc-top' },
        C.ring(c.readiness, c.bucket, 36),
        el('div', { class: 'wc-x' },
          el('div', { class: 'wc-nm' }, c.name, tierChip(c.trust)),
          el('div', { class: 'wc-sp' }, c.credential + ' · ' + c.specialty)),
        C.bucketChip(r.state)),
      el('div', { class: 'wc-note' }, r.note),
      el('div', { class: 'wc-foot' },
        el('span', null, 'credential review'),
        el('span', null, r.when)));
  }
})();
