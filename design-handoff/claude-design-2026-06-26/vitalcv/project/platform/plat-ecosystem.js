/* ══════════════════════════════════════════════════════════════════════════
   plat-ecosystem.js — D2 · Ecosystem Hub (#/ecosystem)
   Connected organizations · verified partners · installed integrations ·
   developer apps · future marketplace.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  const { el, icon, chip, pagehead, toast } = window.UI;

  function styleOnce() {
    if (document.getElementById('eco2-css')) return;
    const css = `
    .eco-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px}
    .eco-stat{padding:15px 16px}
    .eco-stat .k{font-family:'Geist Mono',monospace;font-size:8.5px;text-transform:uppercase;letter-spacing:.1em;color:var(--s400);font-weight:600;display:flex;align-items:center;gap:6px}
    .eco-stat .v{font-size:25px;font-weight:600;letter-spacing:-.03em;margin-top:6px}
    .eco-stat .s{font-size:11px;color:var(--s500);margin-top:1px}

    .secthead{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;margin:24px 0 13px}
    .secthead .lh{display:flex;flex-direction:column;gap:3px}
    .secthead .lh .e{font-family:'Geist Mono',monospace;font-size:8.5px;text-transform:uppercase;letter-spacing:.14em;color:var(--s400);font-weight:600;display:flex;align-items:center;gap:7px}
    .secthead .lh .t{font-size:16px;font-weight:600;letter-spacing:-.02em}
    .secthead .rh{font-size:11.5px;color:var(--s500)}

    .orggrid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
    .orgcard{padding:16px;display:flex;gap:13px;align-items:flex-start;transition:.12s}
    .orgcard:hover{border-color:var(--s300);box-shadow:0 8px 22px -15px rgba(15,23,42,.28)}
    .orgcard .oa{height:42px;width:42px;border-radius:11px;background:var(--s900);color:#fff;display:grid;place-items:center;font-size:15px;font-weight:600;flex-shrink:0;font-family:'Geist Mono',monospace}
    .orgcard .ob{flex:1;min-width:0}
    .orgcard .on{font-size:14.5px;font-weight:600;letter-spacing:-.015em;display:flex;align-items:center;gap:8px}
    .orgcard .ov{color:var(--keep);display:inline-flex}
    .orgcard .ok{font-family:'Geist Mono',monospace;font-size:9.5px;text-transform:uppercase;letter-spacing:.07em;color:var(--s500);margin-top:3px}
    .orgcard .om{display:flex;flex-wrap:wrap;gap:4px 12px;margin-top:10px;font-size:11.5px;color:var(--s500)}
    .orgcard .om b{color:var(--s800);font-weight:600}
    .orgcard .os{display:flex;align-items:center;gap:8px;margin-top:11px;border-top:1px solid var(--rule-soft);padding-top:10px}
    .orgcard .scopes{font-family:'Geist Mono',monospace;font-size:10px;color:var(--s500)}

    .partnerrow{display:flex;flex-direction:column}
    .partner{display:flex;align-items:center;gap:14px;padding:14px 16px;border-top:1px solid var(--rule-soft)}
    .partner:first-child{border-top:0}
    .partner:hover{background:var(--s50)}
    .partner .pi{height:38px;width:38px;border-radius:10px;background:var(--s100);color:var(--s700);display:grid;place-items:center;flex-shrink:0;font-family:'Geist Mono',monospace;font-size:13px;font-weight:600}
    .partner .pn{font-size:14px;font-weight:600;letter-spacing:-.01em;display:flex;align-items:center;gap:7px}
    .partner .pv{color:var(--keep);display:inline-flex}
    .partner .pc{font-family:'Geist Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:var(--s400);margin-top:2px}
    .partner .pb{flex:1;min-width:0;font-size:12px;color:var(--s500);max-width:42ch}
    .partner .pmeta{font-family:'Geist Mono',monospace;font-size:10px;color:var(--s500);white-space:nowrap}

    .intgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
    .intcard{padding:16px;display:flex;flex-direction:column;gap:10px}
    .intcard .ih{display:flex;align-items:center;justify-content:space-between;gap:8px}
    .intcard .iv{font-family:'Geist Mono',monospace;font-size:9.5px;color:var(--s500)}
    .intcard .in{font-size:14px;font-weight:600;letter-spacing:-.015em}
    .intcard .id{font-family:'Geist Mono',monospace;font-size:10.5px;color:var(--s500);line-height:1.5}
    .intcard .if{display:flex;align-items:center;justify-content:space-between;border-top:1px solid var(--rule-soft);padding-top:10px;font-size:11px;color:var(--s500)}

    .apptbl .env-live{color:var(--keep);background:var(--keep-bg);box-shadow:inset 0 0 0 1px var(--keep-line)}
    .apptbl .env-sandbox{color:var(--blue);background:var(--blue-bg);box-shadow:inset 0 0 0 1px var(--blue-line)}
    .apptbl .env{font-family:'Geist Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:.06em;font-weight:600;padding:2px 7px;border-radius:5px}

    .market{padding:26px;display:grid;grid-template-columns:1.1fr 1fr;gap:26px;align-items:center;position:relative;overflow:hidden;background:linear-gradient(180deg,#fff, var(--s50))}
    .market .ml .e{font-family:'Geist Mono',monospace;font-size:8.5px;text-transform:uppercase;letter-spacing:.14em;color:var(--blue);font-weight:600;display:flex;align-items:center;gap:7px;margin-bottom:11px}
    .market .ml h3{margin:0;font-size:22px;font-weight:600;letter-spacing:-.025em;line-height:1.15}
    .market .ml p{font-size:13px;color:var(--s600);line-height:1.55;margin:10px 0 16px;max-width:42ch}
    .market .ml .mq{display:flex;gap:8px;flex-wrap:wrap}
    .market .ml .mq .q{font-family:'Geist Mono',monospace;font-size:10px;color:var(--s600);background:#fff;border:1px solid var(--s200);border-radius:7px;padding:5px 9px;display:flex;align-items:center;gap:6px}
    .market .ml .mq .q svg{color:var(--s400)}
    .mr-stack{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
    .mr-tile{aspect-ratio:1;border:1px dashed var(--s300);border-radius:13px;background:repeating-linear-gradient(135deg,transparent,transparent 7px,rgba(148,163,184,.07) 7px,rgba(148,163,184,.07) 14px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:var(--s400)}
    .mr-tile .mt{font-family:'Geist Mono',monospace;font-size:8.5px;text-transform:uppercase;letter-spacing:.08em;text-align:center;padding:0 8px}

    @media(max-width:1100px){.eco-stats{grid-template-columns:repeat(2,1fr)}.orggrid{grid-template-columns:1fr}.intgrid{grid-template-columns:1fr}.market{grid-template-columns:1fr;gap:20px}}
    `;
    document.head.appendChild(el('style', { id: 'eco2-css', html: css }));
  }

  window.renderEcosystem = function () {
    styleOnce();
    const D = window.PLAT;
    const v = el('div', { class: 'view' });

    v.appendChild(pagehead({
      lead: 'Ecosystem · who is building on the record', leadIcon: 'plug',
      title: 'The VitalCV', titleEm: 'ecosystem.',
      sub: 'Every organization, verified partner, installed integration, and developer app connected to your record — and where the marketplace is headed next.',
      right: chip('live', '4 orgs · 5 partners'),
    }));

    // ── stats ──
    v.appendChild(el('div', { class: 'eco-stats' },
      ecoStat('org', 'Connected orgs', '4', '3 active · 1 pending'),
      ecoStat('shield', 'Verified partners', '5', 'authorities & platforms'),
      ecoStat('plug', 'Installed integrations', '3', '2 live · 1 in review'),
      ecoStat('cube', 'Developer apps', '4', '3 live · 1 sandbox')));

    // ── connected orgs ──
    v.appendChild(sect('org', 'Connected organizations', 'Organizations with an active connection to your record', null));
    const og = el('div', { class: 'orggrid' });
    D.orgs.forEach(o => {
      og.appendChild(el('div', { class: 'card orgcard' },
        el('div', { class: 'oa' }, o.name.split(' ').map(w => w[0]).slice(0, 2).join('')),
        el('div', { class: 'ob' },
          el('div', { class: 'on' }, o.name, o.status === 'active' ? el('span', { class: 'ov' }, icon('check', 14)) : null),
          el('div', { class: 'ok' }, o.kind),
          el('div', { class: 'om' },
            el('span', null, el('b', null, o.members), ' members'),
            el('span', null, 'since ', el('b', null, o.since))),
          el('div', { class: 'os' },
            chip(o.status),
            el('span', { class: 'scopes' }, o.scopes))),
        el('button', { class: 'copybtn ghost', onclick: () => toast('Opened ' + o.name), title: 'Open' }, icon('arrowr', 14))));
    });
    v.appendChild(og);

    // ── verified partners ──
    v.appendChild(sect('shield', 'Verified partners', 'Authorities and platforms verified to exchange data', null));
    const pr = el('div', { class: 'card partnerrow' });
    D.partners.forEach(p => {
      pr.appendChild(el('div', { class: 'partner' },
        el('div', { class: 'pi' }, p.name.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase()),
        el('div', { style: { minWidth: '180px' } },
          el('div', { class: 'pn' }, p.name, el('span', { class: 'pv' }, icon('check', 13))),
          el('div', { class: 'pc' }, p.cat)),
        el('div', { class: 'pb' }, p.blurb),
        el('div', { class: 'pmeta' }, p.integrations + ' integration' + (p.integrations > 1 ? 's' : '')),
        chip('verified')));
    });
    v.appendChild(pr);

    // ── installed integrations ──
    v.appendChild(sect('plug', 'Installed integrations', 'Third-party apps installed against your org', 
      el('button', { class: 'btn btn-soft btn-sm', onclick: () => toast('Browse integrations directory') }, icon('search', 13), 'Browse directory')));
    const ig = el('div', { class: 'intgrid' });
    D.integrations.forEach(i => {
      ig.appendChild(el('div', { class: 'card intcard' },
        el('div', { class: 'ih' },
          el('div', { class: 'in' }, i.name),
          chip(i.status)),
        el('div', { class: 'iv' }, 'by ' + i.vendor),
        el('div', { class: 'id' }, i.scopes),
        el('div', { class: 'if' },
          el('span', null, i.events),
          el('span', { class: 'mono' }, i.installed === '—' ? 'awaiting approval' : 'installed ' + i.installed))));
    });
    v.appendChild(ig);

    // ── developer apps ──
    v.appendChild(sect('cube', 'Developer apps', 'OAuth clients and service apps owned by your org',
      el('button', { class: 'btn btn-pri btn-sm', onclick: () => toast('Create app — opens OAuth client setup') }, icon('plus', 13), 'New app')));
    const appCard = el('div', { class: 'card apptbl', style: { padding: '14px 4px 4px' } });
    const t = el('table', { class: 'tbl' },
      el('thead', null, el('tr', null,
        el('th', null, 'App'), el('th', null, 'Owner'), el('th', null, 'Env'),
        el('th', null, 'Keys'), el('th', null, 'Calls'), el('th', { style: { textAlign: 'right' } }, 'Created'))));
    const tb = el('tbody', null);
    D.apps.forEach(a => tb.appendChild(el('tr', { class: 'hov' },
      el('td', null, el('span', { class: 'nm' }, a.name)),
      el('td', { class: 'muted' }, a.owner),
      el('td', null, el('span', { class: 'env env-' + a.env }, a.env)),
      el('td', { class: 'mono' }, String(a.keys)),
      el('td', { class: 'mono' }, a.calls),
      el('td', { class: 'mono muted', style: { textAlign: 'right' } }, a.created))));
    t.appendChild(tb);
    appCard.appendChild(t);
    v.appendChild(appCard);

    // ── future marketplace ──
    v.appendChild(sect('store', 'Marketplace', 'Discover and install partner apps — shipping next', chip('soon')));
    v.appendChild(el('div', { class: 'card market' },
      el('div', { class: 'ml' },
        el('div', { class: 'e' }, icon('store', 12), 'Coming in a future wave'),
        el('h3', null, 'A marketplace for the career record.'),
        el('p', null, 'Publish your integration once and let any VitalCV organization install it in a click — scoped, reviewed, and billed through the platform.'),
        el('div', { class: 'mq' },
          el('span', { class: 'q' }, icon('check', 12), 'One-click install'),
          el('span', { class: 'q' }, icon('lock', 12), 'Scoped consent'),
          el('span', { class: 'q' }, icon('shield', 12), 'Reviewed listings'),
          el('span', { class: 'q' }, icon('bolt', 12), 'Usage billing'))),
      el('div', { class: 'mr-stack' },
        marketTile('badge', 'Credential apps'),
        marketTile('gauge', 'Readiness tools'),
        marketTile('refresh', 'HRIS sync'),
        marketTile('org', 'Org directories'),
        marketTile('layers', 'Embeds & widgets'),
        marketTile('plus', 'Your app here'))));

    return v;
  };

  function ecoStat(ic, k, val, s) {
    return el('div', { class: 'card eco-stat' },
      el('div', { class: 'k' }, icon(ic, 11), k),
      el('div', { class: 'v' }, val),
      el('div', { class: 's' }, s));
  }
  function sect(ic, t, sub, right) {
    return el('div', { class: 'secthead' },
      el('div', { class: 'lh' }, el('div', { class: 'e' }, icon(ic, 11), t), el('div', { class: 'rh' }, sub)),
      right || null);
  }
  function marketTile(ic, label) {
    return el('div', { class: 'mr-tile' }, icon(ic, 20), el('div', { class: 'mt' }, label));
  }
})();
