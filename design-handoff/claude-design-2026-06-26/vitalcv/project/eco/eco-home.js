/* ══════════════════════════════════════════════════════════════════════════
   eco-home.js — D1 · Ecosystem Home (/)
   The single operating system for a healthcare career. Answers, in one screen:
   What do I have? · Where am I? · What's next? · Who is connected to me?
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  const { el, icon, chip, tierChip } = window.UI;

  function styleOnce() {
    if (document.getElementById('home-css')) return;
    const css = `
    .home-hero{display:grid;grid-template-columns:1.5fr 1fr;gap:14px;margin-bottom:14px}
    .idcard{padding:20px;display:flex;flex-direction:column;gap:16px}
    .idcard .who{display:flex;gap:15px;align-items:flex-start}
    .idcard .ava{height:56px;width:56px;border-radius:14px;background:var(--s900);color:#fff;display:grid;place-items:center;font-size:20px;font-weight:600;flex-shrink:0}
    .idcard .nm{font-size:23px;font-weight:600;letter-spacing:-.025em;line-height:1.05}
    .idcard .cred{font-family:'Geist Mono',monospace;font-size:10.5px;color:var(--s500);text-transform:uppercase;letter-spacing:.07em;margin-top:5px}
    .idcard .meta{font-size:12.5px;color:var(--s500);margin-top:7px;display:flex;flex-wrap:wrap;gap:4px 9px}
    .idcard .meta .mono{color:var(--s800)}
    .q4{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;border-top:1px solid var(--rule-soft);padding-top:16px}
    .q4 a{display:flex;flex-direction:column;gap:3px;padding:11px 13px;border:1px solid var(--s200);border-radius:10px;background:var(--s50);transition:border-color .12s,background .12s}
    .q4 a:hover{border-color:var(--s300);background:#fff}
    .q4 .qk{font-family:'Geist Mono',monospace;font-size:8.5px;text-transform:uppercase;letter-spacing:.13em;color:var(--s400);font-weight:600;display:flex;align-items:center;gap:6px}
    .q4 .qv{font-size:15px;font-weight:600;letter-spacing:-.015em;color:var(--s900)}
    .q4 .qs{font-size:11px;color:var(--s500)}
    .q4 .qv .go{float:right;color:var(--s300)}

    .healthcard{padding:18px;display:flex;flex-direction:column;gap:14px}
    .gauge{display:flex;align-items:center;gap:16px}
    .gauge .ring{position:relative;height:96px;width:96px;flex-shrink:0}
    .gauge .ring .pct{position:absolute;inset:0;display:grid;place-items:center;flex-direction:column;text-align:center}
    .gauge .ring .pct b{font-size:26px;font-weight:600;letter-spacing:-.03em;line-height:1}
    .gauge .ring .pct span{font-family:'Geist Mono',monospace;font-size:8px;text-transform:uppercase;letter-spacing:.1em;color:var(--s400);margin-top:2px}
    .gauge .gtx .lab{font-size:16px;font-weight:600;letter-spacing:-.02em}
    .gauge .gtx .dl{font-size:12px;color:var(--keep);font-weight:500;margin-top:3px;display:flex;align-items:center;gap:5px}
    .gauge .gtx .bs{font-size:11.5px;color:var(--s500);margin-top:7px;line-height:1.45}
    .factors{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;border-top:1px solid var(--rule-soft);padding-top:13px}
    .factor{display:flex;flex-direction:column;gap:5px}
    .factor .fk{font-family:'Geist Mono',monospace;font-size:8.5px;text-transform:uppercase;letter-spacing:.1em;color:var(--s500);display:flex;justify-content:space-between}
    .factor .fk b{color:var(--s900);font-weight:600}
    .factor .fbar{height:5px;background:var(--s100);border-radius:5px;overflow:hidden}
    .factor .fbar i{display:block;height:100%;border-radius:5px}

    .streams5{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:14px}
    .scard{padding:15px;display:flex;flex-direction:column;gap:11px;position:relative;overflow:hidden;transition:border-color .12s,transform .12s,box-shadow .12s}
    .scard:hover{border-color:var(--s300);transform:translateY(-2px);box-shadow:var(--vt-shadow-md,0 8px 22px -12px rgba(15,23,42,.25))}
    .scard::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px}
    .scard.t-verified::before{background:var(--keep)} .scard.t-pending::before{background:var(--seam)}
    .scard .srow{display:flex;align-items:center;justify-content:space-between}
    .scard .sic{height:34px;width:34px;border-radius:9px;background:var(--s900);color:#fff;display:grid;place-items:center;flex-shrink:0}
    .scard .snum{font-family:'Geist Mono',monospace;font-size:9px;color:var(--s400);text-transform:uppercase;letter-spacing:.1em}
    .scard .snm{font-size:15px;font-weight:600;letter-spacing:-.015em}
    .scard .shead2{font-size:13px;font-weight:600;color:var(--s900)}
    .scard .ssub{font-size:11px;color:var(--s500)}
    .scard .sline{font-size:11.5px;color:var(--s500);line-height:1.45;flex:1}
    .scard .sstat{display:grid;grid-template-columns:repeat(2,1fr);gap:4px 10px;border-top:1px dashed var(--rule);padding-top:9px}
    .scard .sstat .si{display:flex;justify-content:space-between;font-size:11px;color:var(--s500)}
    .scard .sstat .si b{color:var(--s900);font-weight:600;font-variant-numeric:tabular-nums}

    .home-low{display:grid;grid-template-columns:1.25fr 1fr;gap:14px}
    .feedmini{padding:16px}
    .feedmini .fhead{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px}
    .feedrow{display:flex;gap:12px;padding:11px 0;border-top:1px solid var(--rule-soft)}
    .feedrow:first-of-type{border-top:0}
    .feedrow .fic{height:30px;width:30px;border-radius:8px;display:grid;place-items:center;flex-shrink:0;border:1px solid var(--s200)}
    .feedrow .ftx{flex:1;min-width:0}
    .feedrow .ftt{font-size:13px;font-weight:600;letter-spacing:-.01em;display:flex;align-items:center;gap:7px}
    .feedrow .fdd{font-size:11.5px;color:var(--s500);margin-top:1px}
    .feedrow .fwhen{font-family:'Geist Mono',monospace;font-size:9.5px;color:var(--s400);white-space:nowrap;flex-shrink:0}
    .nextcard{padding:16px;display:flex;flex-direction:column;gap:10px}
    .nextrow{border:1px solid var(--s200);border-radius:10px;padding:11px 12px;display:flex;align-items:center;gap:11px;background:var(--s50)}
    .nextrow:hover{background:#fff;border-color:var(--s300)}
    .nextrow .nic{height:32px;width:32px;border-radius:8px;background:#fff;border:1px solid var(--s200);display:grid;place-items:center;color:var(--s700);flex-shrink:0}
    .nextrow .ntx{flex:1;min-width:0}
    .nextrow .na{font-size:12.5px;font-weight:600;letter-spacing:-.01em}
    .nextrow .nb{font-size:11px;color:var(--s500)}
    .nextrow .ngo{font-family:'Geist Mono',monospace;font-size:9px;color:var(--s500);text-transform:uppercase;letter-spacing:.1em;display:flex;align-items:center;gap:4px;flex-shrink:0}
    .linkmore{font-family:'Geist Mono',monospace;font-size:9.5px;text-transform:uppercase;letter-spacing:.1em;color:var(--s500);display:inline-flex;align-items:center;gap:5px}
    .linkmore:hover{color:var(--s900)}
    @media(max-width:1100px){.streams5{grid-template-columns:repeat(3,1fr)}.home-hero{grid-template-columns:1fr}.home-low{grid-template-columns:1fr}}
    @media(max-width:680px){.streams5{grid-template-columns:1fr 1fr}.q4{grid-template-columns:1fr}}
    `;
    document.head.appendChild(el('style', { id: 'home-css', html: css }));
  }

  const toneColor = (t) => t === 'verified' ? 'var(--keep)' : t === 'pending' ? 'var(--seam)' : 'var(--s500)';
  const feedTone = (k) => ({ evidence: 'keep', trust: 'keep', opportunity: 'keep', organization: 'blue', mobility: 'seam' }[k] || 'ghost');
  const feedIcon = (k) => ({ evidence: 'wallet', trust: 'shield', opportunity: 'search', organization: 'org', mobility: 'mobility' }[k] || 'feed');

  window.renderHome = function () {
    styleOnce();
    const D = window.ECO;
    const v = el('div', { class: 'view' });

    // ── page head ──
    v.appendChild(el('div', { class: 'pagehead' },
      el('div', null,
        el('div', { class: 'lead' }, icon('home', 12), 'Career OS · ecosystem home'),
        el('h1', null, 'Your career, ', el('em', null, 'one operating system.')),
        el('div', { class: 'sub' }, 'Everything you can prove, how authoritative it is, where it can take you, and who you are connected to — composed from every stream into one place.')),
      el('div', { class: 'ra' }, chip('active', 'all streams live'))
    ));

    // ── hero: identity + the four questions, and Career Health gauge ──
    const p = D.provider, h = D.health;
    const idcard = el('div', { class: 'card idcard' },
      el('div', { class: 'who' },
        el('div', { class: 'ava' }, p.initials),
        el('div', null,
          el('div', { class: 'nm' }, p.name),
          el('div', { class: 'cred' }, p.credential + ' · ' + p.role),
          el('div', { class: 'meta' },
            el('span', null, p.specialty), el('span', null, '·'),
            el('span', null, 'NPI ', el('span', { class: 'mono' }, p.npi)), el('span', null, '·'),
            el('span', null, p.location)))),
      // The 60-second answer
      el('div', { class: 'q4' },
        q4cell('What do I have', '14 credentials', '9 verified · 72% fresh', 'wallet', '#/career-map'),
        q4cell('Where am I', 'Conditional Ready', 'Career Health 68 · ▲ +6', 'spark', '#/career-map'),
        q4cell("What's next", '2 gaps · +41 reqs', 'Close DEA · add NV/AZ licensure', 'mobility', '#/activity'),
        q4cell('Who is connected', '5 orgs · 6 people', 'Cedar Health · UCLA · NCCPA', 'network', '#/network'))
    );

    // gauge ring via conic-gradient
    const ringDeg = Math.round(h.score * 3.6);
    const ring = el('div', { class: 'ring', style: {
      borderRadius: '50%',
      background: `conic-gradient(var(--keep) ${ringDeg}deg, var(--s200) ${ringDeg}deg)`,
    } },
      el('div', { style: { position: 'absolute', inset: '10px', background: '#fff', borderRadius: '50%' } }),
      el('div', { class: 'pct' }, el('b', null, String(h.score)), el('span', null, 'health')));

    const healthcard = el('div', { class: 'card healthcard' },
      el('div', { class: 'eyebrow' }, 'Career Health'),
      el('div', { class: 'gauge' }, ring,
        el('div', { class: 'gtx' },
          el('div', { class: 'lab' }, h.label),
          el('div', { class: 'dl' }, icon('spark', 13), `+${h.delta} in ${h.deltaWindow}`),
          el('div', { class: 'bs' }, h.basis, ' — ', el('span', { class: 'muted' }, h.note)))),
      el('div', { class: 'factors' },
        h.factors.map(f => el('div', { class: 'factor' },
          el('div', { class: 'fk' }, f.k, el('b', null, f.v)),
          el('div', { class: 'fbar' }, el('i', { style: { width: f.v + '%', background: toneColor(f.tone) } })))))
    );

    v.appendChild(el('div', { class: 'home-hero' }, idcard, healthcard));

    // ── five stream tiles ──
    v.appendChild(el('div', { class: 'eyebrow rule', style: { marginBottom: '12px' } }, 'The five streams', el('span', { class: 'num' }, '· status at a glance')));
    const streams5 = el('div', { class: 'streams5' });
    ['evidence', 'trust', 'mobility', 'organizations', 'opportunities'].forEach(key => {
      const s = D.streams[key];
      streams5.appendChild(el('div', { class: 'card scard t-' + s.tone },
        el('div', { class: 'srow' },
          el('div', { class: 'sic' }, icon(streamIcon(key), 17)),
          el('span', { class: 'snum' }, 'Stream ' + s.stream)),
        el('div', null,
          el('div', { class: 'snm' }, s.name),
          el('div', { class: 'shead2' }, s.headline),
          el('div', { class: 'ssub' }, s.sub)),
        el('div', { class: 'sline' }, s.line),
        el('div', { class: 'sstat' }, s.stat.map(([k, val]) =>
          el('div', { class: 'si' }, el('span', null, k), el('b', null, val))))
      ));
    });
    v.appendChild(streams5);

    // ── low row: recent activity + what's next ──
    const feed = el('div', { class: 'card feedmini' },
      el('div', { class: 'fhead' },
        el('div', { class: 'eyebrow', style: { margin: 0 } }, icon('feed', 12), 'Recent activity'),
        el('a', { href: '#/activity', class: 'linkmore' }, 'Full feed', icon('arrow', 11))),
      D.activity.slice(0, 5).map(a => {
        const tone = feedTone(a.kind);
        return el('div', { class: 'feedrow' },
          el('div', { class: 'fic', style: { color: `var(--${tone === 'ghost' ? 's500' : tone})` } }, icon(feedIcon(a.kind), 15)),
          el('div', { class: 'ftx' },
            el('div', { class: 'ftt' }, a.t, a.tier ? tierChip(a.tier) : null),
            el('div', { class: 'fdd' }, a.d)),
          el('div', { class: 'fwhen' }, a.when));
      })
    );

    const next = el('div', { class: 'card nextcard' },
      el('div', { class: 'eyebrow', style: { margin: '0 0 2px' } }, icon('mobility', 12), "What's next"),
      el('div', { class: 'muted', style: { fontSize: '11.5px', marginBottom: '4px' } }, 'Two unlocks stand between you and +41 requisitions.'),
      D.mobility.unlocks.map(u => el('a', { class: 'nextrow', href: '#/career-map' },
        el('div', { class: 'nic' }, icon(u.state === 'done' ? 'check' : 'bolt', 16)),
        el('div', { class: 'ntx' },
          el('div', { class: 'na' }, u.label),
          el('div', { class: 'nb' }, u.sub)),
        u.state === 'done' ? chip('done') : el('div', { class: 'ngo' }, u.reqs, ' reqs', icon('arrow', 10))))
    );

    v.appendChild(el('div', { class: 'home-low' }, feed, next));
    return v;
  };

  function q4cell(k, val, sub, ic, route) {
    return el('a', { href: route, class: 'q4cell' },
      el('div', { class: 'qk' }, window.UI.icon(ic, 11), k + '?'),
      el('div', { class: 'qv' }, val, el('span', { class: 'go' }, window.UI.icon('arrow', 13))),
      el('div', { class: 'qs' }, sub));
  }

  function streamIcon(key) {
    return { evidence: 'wallet', trust: 'shield', mobility: 'mobility', organizations: 'org', opportunities: 'search' }[key] || 'home';
  }
})();
