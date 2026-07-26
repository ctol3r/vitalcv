/* ══════════════════════════════════════════════════════════════════════════
   plat-portal.js — D1 · Developer Portal (#/)
   Build on VitalCV. API Explorer · SDKs · Authentication · Examples.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  const { el, icon, chip, method, pagehead, copyBtn, jsonHL, toast } = window.UI;

  function styleOnce() {
    if (document.getElementById('portal-css')) return;
    const css = `
    .pl-hero{display:grid;grid-template-columns:1.55fr 1fr;gap:14px;margin-bottom:16px}
    .pl-build{padding:22px;display:flex;flex-direction:column;gap:18px}
    .pl-build .bl{font-size:21px;font-weight:600;letter-spacing:-.025em;line-height:1.18;max-width:30ch}
    .pl-build .bl em{font-style:normal;color:var(--s400);font-weight:400}
    .pl-base{display:flex;align-items:center;gap:10px;border:1px solid var(--s200);border-radius:10px;background:var(--s50);padding:11px 13px}
    .pl-base .bm{font-family:'Geist Mono',monospace;font-size:8.5px;text-transform:uppercase;letter-spacing:.12em;color:var(--s400);font-weight:600}
    .pl-base .bu{font-family:'Geist Mono',monospace;font-size:13px;color:var(--s900);font-weight:500}
    .pl-base .copybtn{margin-left:auto}
    .pl-quick{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
    .pl-quick a{display:flex;flex-direction:column;gap:7px;padding:13px;border:1px solid var(--s200);border-radius:11px;background:var(--s50);transition:.12s;cursor:pointer}
    .pl-quick a:hover{border-color:var(--s300);background:#fff;transform:translateY(-1px)}
    .pl-quick .qi{height:30px;width:30px;border-radius:8px;background:var(--s900);color:#fff;display:grid;place-items:center}
    .pl-quick .qt{font-size:13px;font-weight:600;letter-spacing:-.01em}
    .pl-quick .qs{font-size:10.5px;color:var(--s500)}
    .pl-stat{padding:18px;display:flex;flex-direction:column;gap:14px}
    .pl-stat .sg{display:grid;grid-template-columns:1fr 1fr;gap:13px 16px}
    .pl-stat .si .sk{font-family:'Geist Mono',monospace;font-size:8.5px;text-transform:uppercase;letter-spacing:.1em;color:var(--s400);font-weight:600;display:flex;align-items:center;gap:5px}
    .pl-stat .si .sv{font-size:20px;font-weight:600;letter-spacing:-.03em;margin-top:3px}
    .pl-stat .si .sv small{font-size:11px;color:var(--s500);font-weight:500}
    .pl-regions{display:flex;gap:6px;flex-wrap:wrap;border-top:1px solid var(--rule-soft);padding-top:13px}
    .pl-regions .rg{font-family:'Geist Mono',monospace;font-size:10px;color:var(--s600);background:var(--s100);border-radius:6px;padding:3px 8px;display:flex;align-items:center;gap:5px}
    .pl-regions .rg::before{content:"";width:5px;height:5px;border-radius:50%;background:var(--keep)}

    .pl-tabwrap{margin-top:6px}
    .pl-tabbar{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:16px;flex-wrap:wrap}

    /* API Explorer */
    .exp{display:grid;grid-template-columns:300px 1fr;gap:14px;align-items:start}
    .exp-list{padding:8px}
    .exp-group{margin-bottom:6px}
    .exp-gh{display:flex;align-items:center;gap:8px;padding:9px 9px 6px;font-family:'Geist Mono',monospace;font-size:8.5px;text-transform:uppercase;letter-spacing:.13em;color:var(--s400);font-weight:600}
    .exp-gh svg{color:var(--s400)}
    .exp-ep{display:flex;align-items:center;gap:9px;padding:9px 9px;border-radius:9px;cursor:pointer;transition:.1s}
    .exp-ep:hover{background:var(--s100)}
    .exp-ep.on{background:var(--s900)}
    .exp-ep.on .epn{color:#fff}
    .exp-ep.on .verb{box-shadow:none}
    .exp-ep .epn{font-size:12.5px;font-weight:600;color:var(--s700);letter-spacing:-.01em}
    .exp-panel{overflow:hidden}
    .exp-top{padding:16px 18px;border-bottom:1px solid var(--s200);display:flex;flex-direction:column;gap:9px}
    .exp-pathrow{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
    .exp-pathrow .p{font-family:'Geist Mono',monospace;font-size:14px;font-weight:500;color:var(--s900)}
    .exp-pathrow .scopetag{margin-left:auto;font-family:'Geist Mono',monospace;font-size:10px;color:var(--blue);background:var(--blue-bg);box-shadow:inset 0 0 0 1px var(--blue-line);padding:3px 8px;border-radius:6px;display:flex;align-items:center;gap:5px}
    .exp-desc{font-size:12.5px;color:var(--s600);line-height:1.5}
    .exp-body{padding:18px;display:grid;grid-template-columns:1fr 1fr;gap:16px}
    .exp-params .ph{font-family:'Geist Mono',monospace;font-size:8.5px;text-transform:uppercase;letter-spacing:.13em;color:var(--s400);font-weight:600;margin-bottom:11px}
    .prow{display:flex;flex-direction:column;gap:3px;padding:9px 0;border-top:1px solid var(--rule-soft)}
    .prow:first-of-type{border-top:0}
    .prow .pn{display:flex;align-items:center;gap:8px}
    .prow .pn code{font-family:'Geist Mono',monospace;font-size:12px;color:var(--s900);font-weight:600}
    .prow .pin{font-family:'Geist Mono',monospace;font-size:9px;color:var(--s500);text-transform:uppercase;letter-spacing:.06em;background:var(--s100);border-radius:4px;padding:1px 5px}
    .prow .pt{font-family:'Geist Mono',monospace;font-size:10px;color:var(--s400);margin-left:auto}
    .prow .pd{font-size:11.5px;color:var(--s500);line-height:1.4}
    .exp-resp{display:flex;flex-direction:column;gap:9px}
    .exp-runbar{display:flex;align-items:center;gap:9px}
    .exp-runbar .rstatus{margin-left:auto;font-family:'Geist Mono',monospace;font-size:11px;display:flex;align-items:center;gap:6px;color:var(--keep);font-weight:600}
    .exp-runbar .rstatus .rc{width:6px;height:6px;border-radius:50%;background:var(--keep)}
    .respbox{min-height:120px}
    .respbox .empty{padding:30px 16px;text-align:center;color:var(--s400);font-size:12px;display:flex;flex-direction:column;align-items:center;gap:9px}
    .spin{width:16px;height:16px;border:2px solid var(--s200);border-top-color:var(--s700);border-radius:50%;animation:spin .7s linear infinite}
    @keyframes spin{to{transform:rotate(360deg)}}

    /* SDK grid */
    .sdkgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
    .sdk{padding:16px;display:flex;flex-direction:column;gap:12px;transition:.12s}
    .sdk:hover{border-color:var(--s300);transform:translateY(-2px);box-shadow:0 10px 26px -16px rgba(15,23,42,.3)}
    .sdk .sh{display:flex;align-items:center;gap:11px}
    .sdk .si{height:38px;width:38px;border-radius:10px;background:var(--s900);color:#fff;display:grid;place-items:center;flex-shrink:0}
    .sdk .sn{font-size:14.5px;font-weight:600;letter-spacing:-.015em}
    .sdk .sp{font-family:'Geist Mono',monospace;font-size:10.5px;color:var(--s500)}
    .sdk .smeta{margin-left:auto;text-align:right}
    .sdk .smeta .sv{font-family:'Geist Mono',monospace;font-size:11px;color:var(--s700);font-weight:600}
    .sdk .smeta .sd{font-family:'Geist Mono',monospace;font-size:9px;color:var(--s400)}
    .sdk .install{display:flex;align-items:center;gap:8px;background:var(--s950);border-radius:9px;padding:9px 11px}
    .sdk .install .dollar{color:var(--s600);font-family:'Geist Mono',monospace;font-size:12px}
    .sdk .install code{font-family:'Geist Mono',monospace;font-size:11.5px;color:var(--ink-code);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .sdk .install .copybtn{background:transparent;border-color:transparent;color:var(--s500);padding:4px}
    .sdk .install .copybtn:hover{color:#fff}
    .sdk .sfoot{display:flex;align-items:center;justify-content:space-between;gap:8px;border-top:1px solid var(--rule-soft);padding-top:11px}
    .sdk .docs{font-family:'Geist Mono',monospace;font-size:9.5px;text-transform:uppercase;letter-spacing:.1em;color:var(--s500);display:flex;align-items:center;gap:5px}
    .sdk .docs:hover{color:var(--s900)}

    /* Auth */
    .auth-2{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}
    .authcard{padding:18px}
    .authcard h4{margin:0 0 4px;font-size:15px;font-weight:600;letter-spacing:-.02em;display:flex;align-items:center;gap:9px}
    .authcard h4 svg{color:var(--s500)}
    .authcard .ad{font-size:12.5px;color:var(--s600);line-height:1.5;margin-bottom:13px}
    .flow{display:flex;flex-direction:column;gap:0}
    .flowstep{display:flex;gap:12px;padding-bottom:15px;position:relative}
    .flowstep:not(:last-child)::before{content:"";position:absolute;left:13px;top:28px;bottom:0;width:1.5px;background:var(--s200)}
    .flowstep .fn{height:27px;width:27px;border-radius:50%;background:var(--s900);color:#fff;display:grid;place-items:center;font-family:'Geist Mono',monospace;font-size:11px;font-weight:600;flex-shrink:0;z-index:1}
    .flowstep .ft{font-size:13px;font-weight:600;letter-spacing:-.01em;margin-top:4px}
    .flowstep .fs{font-size:11.5px;color:var(--s500);margin-top:2px;line-height:1.45}
    .scopetbl .sens-elevated{color:var(--seam);background:var(--seam-bg);box-shadow:inset 0 0 0 1px var(--seam-line)}
    .scopetbl .sens-standard{color:var(--s500);background:var(--s100);box-shadow:inset 0 0 0 1px var(--s200)}
    .scopetbl .sens{font-family:'Geist Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:.06em;font-weight:600;padding:2px 7px;border-radius:5px}

    /* Recipes */
    .recipegrid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .recipe{padding:16px;display:flex;gap:14px;transition:.12s;cursor:pointer}
    .recipe:hover{border-color:var(--s300);transform:translateY(-1px);box-shadow:0 8px 22px -14px rgba(15,23,42,.28)}
    .recipe .ri{height:40px;width:40px;border-radius:11px;background:var(--s100);color:var(--s700);display:grid;place-items:center;flex-shrink:0}
    .recipe .rt{font-size:14px;font-weight:600;letter-spacing:-.015em;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
    .recipe .rtag{font-family:'Geist Mono',monospace;font-size:8.5px;text-transform:uppercase;letter-spacing:.1em;color:var(--blue);background:var(--blue-bg);padding:2px 6px;border-radius:5px;font-weight:600}
    .recipe .rd{font-size:12px;color:var(--s600);line-height:1.5;margin-top:6px}
    .recipe .rf{display:flex;align-items:center;gap:8px;margin-top:10px}
    .recipe .lang{font-family:'Geist Mono',monospace;font-size:9px;color:var(--s500);background:var(--s100);border-radius:5px;padding:2px 6px;font-weight:600}
    .recipe .rtime{font-family:'Geist Mono',monospace;font-size:9.5px;color:var(--s400);margin-left:auto;display:flex;align-items:center;gap:5px}

    @media(max-width:1100px){.pl-hero{grid-template-columns:1fr}.exp{grid-template-columns:1fr}.exp-body{grid-template-columns:1fr}.sdkgrid{grid-template-columns:1fr 1fr}.recipegrid{grid-template-columns:1fr}.auth-2{grid-template-columns:1fr}.pl-quick{grid-template-columns:1fr 1fr}}
    @media(max-width:680px){.sdkgrid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(el('style', { id: 'portal-css', html: css }));
  }

  let activeTab = 'explorer';

  window.renderPortal = function () {
    styleOnce();
    const D = window.PLAT;
    const v = el('div', { class: 'view' });

    v.appendChild(pagehead({
      lead: 'Developer Portal · build on VitalCV', leadIcon: 'code',
      title: 'Build on the', titleEm: 'owned record.',
      sub: 'Read verified evidence, issue recognition, project readiness, and verify trust — all through one API. Everything you build extends VitalCV without ever modifying the core product.',
      right: chip('healthy', 'all systems healthy'),
    }));

    // ── hero ──
    const build = el('div', { class: 'card pl-build' },
      el('div', { class: 'bl' }, 'Integrate a verifiable career record in ', el('em', null, 'an afternoon.')),
      el('div', { class: 'pl-base' },
        el('span', { class: 'bm' }, 'Base URL'),
        el('span', { class: 'bu' }, D.meta.base),
        copyBtn(D.meta.base, { label: 'Copy' })),
      el('div', { class: 'pl-quick' },
        quick('terminal', 'Quickstart', 'Auth → first call', () => switchTab('explorer')),
        quick('box', 'SDKs', '6 languages', () => switchTab('sdks')),
        quick('lock', 'Authentication', 'OAuth2 · keys', () => switchTab('auth')),
        quick('git', 'Examples', '4 recipes', () => switchTab('examples'))));

    const p = D.platform;
    const stat = el('div', { class: 'card pl-stat' },
      el('div', { class: 'eyebrow' }, icon('gauge', 12), 'Platform status'),
      el('div', { class: 'sg' },
        statcell('uptime 30d', p.uptime, 'spark'),
        statcell('calls today', p.callsToday, 'bolt'),
        statcell('latency p50', p.p50, 'clock'),
        statcell('latency p99', p.p99, 'clock')),
      el('div', { class: 'pl-regions' },
        el('span', { class: 'bm', style: { fontFamily: "'Geist Mono',monospace", fontSize: '8.5px', textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--s400)', fontWeight: 600, alignSelf: 'center', marginRight: '3px' } }, 'Regions'),
        p.regions.map(r => el('span', { class: 'rg' }, r))));

    v.appendChild(el('div', { class: 'pl-hero' }, build, stat));

    // ── tabbed body ──
    const tabbar = el('div', { class: 'pl-tabbar' },
      el('div', { class: 'tabs', id: 'portalTabs' },
        tabBtn('explorer', 'search', 'API Explorer'),
        tabBtn('sdks', 'box', 'SDKs'),
        tabBtn('auth', 'lock', 'Authentication'),
        tabBtn('examples', 'git', 'Examples')),
      el('a', { class: 'docbtn', href: '#/', style: { textDecoration: 'none' }, onclick: (e) => { e.preventDefault(); toast('Full reference opens in docs'); } },
        icon('book', 14), el('span', null, 'Full API reference'), icon('external', 12)));

    const body = el('div', { class: 'pl-tabwrap', id: 'portalBody' });

    v.appendChild(tabbar);
    v.appendChild(body);

    function switchTab(t) {
      activeTab = t;
      document.querySelectorAll('#portalTabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
      body.innerHTML = '';
      body.appendChild(({ explorer: explorerPane, sdks: sdkPane, auth: authPane, examples: recipePane })[t]());
    }
    window.__portalSwitch = switchTab;
    setTimeout(() => switchTab(activeTab), 0);

    return v;

    function tabBtn(t, ic, label) {
      return el('button', { class: 'tabbtn' + (t === activeTab ? ' on' : ''), data: { tab: t }, onclick: () => switchTab(t) }, icon(ic, 14), label);
    }
  };

  function quick(ic, t, s, onclick) {
    return el('a', { onclick, class: 'q' }, el('div', { class: 'qi' }, icon(ic, 16)), el('div', { class: 'qt' }, t), el('div', { class: 'qs' }, s));
  }
  function statcell(k, val, ic) {
    return el('div', { class: 'si' }, el('div', { class: 'sk' }, icon(ic, 11), k), el('div', { class: 'sv' }, val));
  }

  /* ── API Explorer pane ─────────────────────────────────────────────── */
  function explorerPane() {
    const D = window.PLAT;
    const wrap = el('div', { class: 'exp' });

    // flatten endpoints
    let selected = D.api[0].endpoints[0];

    const list = el('div', { class: 'card exp-list' });
    D.api.forEach(g => {
      const grp = el('div', { class: 'exp-group' },
        el('div', { class: 'exp-gh' }, icon(g.icon, 12), g.group));
      g.endpoints.forEach(ep => {
        const row = el('div', { class: 'exp-ep', data: { ep: ep.path + ep.m } },
          method(ep.m), el('span', { class: 'epn' }, ep.name));
        row.addEventListener('click', () => { selected = ep; renderPanel(); });
        grp.appendChild(row);
      });
      list.appendChild(grp);
    });

    const panel = el('div', { class: 'card exp-panel' });
    wrap.appendChild(list);
    wrap.appendChild(panel);

    function renderPanel() {
      // highlight selected
      list.querySelectorAll('.exp-ep').forEach(r => r.classList.toggle('on', r.dataset.ep === selected.path + selected.m));
      panel.innerHTML = '';
      const ep = selected;
      const curl = `curl ${window.PLAT.meta.base}${ep.path.replace(/\{(\w+)\}/g, 'vc_sub_1346053246')} \\\n  -H "Authorization: Bearer $VITALCV_KEY" \\\n  -H "VitalCV-Version: ${window.PLAT.meta.version}"`;

      panel.appendChild(el('div', { class: 'exp-top' },
        el('div', { class: 'exp-pathrow' }, method(ep.m), el('span', { class: 'p' }, ep.path),
          el('span', { class: 'scopetag' }, icon('lock', 11), ep.scope)),
        el('div', { class: 'exp-desc' }, ep.desc)));

      const params = el('div', { class: 'exp-params' },
        el('div', { class: 'ph' }, 'Parameters'),
        ep.params.map(([n, where, type, desc]) => el('div', { class: 'prow' },
          el('div', { class: 'pn' }, el('code', null, n), el('span', { class: 'pin' }, where), el('span', { class: 'pt' }, type)),
          el('div', { class: 'pd' }, desc))));

      const respBox = el('div', { class: 'card respbox', style: { background: 'var(--s950)', borderColor: 'var(--s800)' } },
        el('div', { class: 'empty' }, icon('play', 20), 'Run the request to see a live response'));

      const runBtn = el('button', { class: 'btn btn-pri btn-sm' }, icon('send', 13), 'Send request');
      runBtn.addEventListener('click', () => {
        respBox.innerHTML = '';
        respBox.appendChild(el('div', { class: 'empty' }, el('div', { class: 'spin' }), 'Calling ' + ep.path + ' …'));
        setTimeout(() => {
          respBox.classList.remove('respbox');
          respBox.className = 'code';
          respBox.innerHTML = '';
          respBox.appendChild(el('div', { class: 'chead' },
            el('span', { class: 'ct' }, el('span', { class: 'rc', style: { width: '6px', height: '6px', borderRadius: '50%', background: 'var(--keep)', display: 'inline-block' } }), '200 OK · ' + (40 + Math.floor(Math.random() * 120)) + 'ms'),
            copyBtn(() => JSON.stringify(ep.resp, null, 2), { label: 'Copy' })));
          respBox.appendChild(el('pre', { html: jsonHL(ep.resp) }));
        }, 620);
      });

      const resp = el('div', { class: 'exp-resp' },
        el('div', { class: 'exp-runbar' }, runBtn, copyBtn(curl, { label: 'Copy cURL' })),
        respBox);

      panel.appendChild(el('div', { class: 'exp-body' }, params, resp));
    }
    setTimeout(renderPanel, 0);
    return wrap;
  }

  /* ── SDK pane ──────────────────────────────────────────────────────── */
  function sdkPane() {
    const D = window.PLAT;
    const wrap = el('div', null);
    wrap.appendChild(el('div', { class: 'eyebrow rule' }, 'Official SDKs', el('span', { class: 'num' }, '· typed, generated from the spec')));
    const grid = el('div', { class: 'sdkgrid' });
    D.sdks.forEach(s => {
      grid.appendChild(el('div', { class: 'card sdk' },
        el('div', { class: 'sh' },
          el('div', { class: 'si' }, icon(s.icon, 18)),
          el('div', null, el('div', { class: 'sn' }, s.lang), el('div', { class: 'sp' }, s.pkg)),
          el('div', { class: 'smeta' }, el('div', { class: 'sv' }, 'v' + s.version), el('div', { class: 'sd' }, s.downloads))),
        el('div', { class: 'install' },
          el('span', { class: 'dollar' }, '$'),
          el('code', null, s.install),
          copyBtn(s.install, {})),
        el('div', { class: 'sfoot' },
          chip(s.state), 
          el('a', { class: 'docs', onclick: () => toast(s.lang + ' reference opens in docs') }, icon('book', 11), 'Docs', icon('arrow', 10)))));
    });
    wrap.appendChild(grid);
    return wrap;
  }

  /* ── Auth pane ─────────────────────────────────────────────────────── */
  function authPane() {
    const D = window.PLAT;
    const wrap = el('div', null);

    const oauth = el('div', { class: 'card authcard' },
      el('h4', null, icon('shield', 16), 'OAuth 2.0'),
      el('div', { class: 'ad' }, 'For apps acting on behalf of an organization or a subject. Authorization-code flow with PKCE; tokens are scoped and short-lived.'),
      el('div', { class: 'flow' },
        flowStep('1', 'Redirect to authorize', 'Send the org admin to /oauth/authorize with your client_id and requested scopes.'),
        flowStep('2', 'Exchange the code', 'Trade the returned code for an access + refresh token at /oauth/token.'),
        flowStep('3', 'Call the API', 'Send the bearer token on every request. Refresh before the 1-hour expiry.')));

    const keys = el('div', { class: 'card authcard' },
      el('h4', null, icon('key', 16), 'API keys'),
      el('div', { class: 'ad' }, 'For server-to-server integrations you own. Keys carry a fixed scope set and an environment. Manage them in the API Keys console.'),
      el('div', { class: 'code', style: { marginTop: '2px' } },
        el('div', { class: 'chead' }, el('span', { class: 'ct' }, icon('terminal', 12), 'authenticated request'),
          copyBtn('curl https://api.vitalcv.com/v1/subjects/vc_sub_1346053246/evidence -H "Authorization: Bearer vck_live_8f31a2…"', {})),
        el('pre', { html: '<span class="pun">curl</span> https://api.vitalcv.com/v1/subjects/{id}/evidence \\\n  -H <span class="str">"Authorization: Bearer vck_live_8f31a2…"</span> \\\n  -H <span class="str">"VitalCV-Version: 2026-06-25"</span>' }),
      ),
      el('div', { style: { marginTop: '12px' } }, el('a', { class: 'btn btn-soft btn-sm', href: '#/keys' }, icon('key', 13), 'Manage API keys', icon('arrow', 12))));

    wrap.appendChild(el('div', { class: 'auth-2' }, oauth, keys));

    // scopes table
    const tbl = el('div', { class: 'card', style: { padding: '16px 4px 4px' } },
      el('div', { class: 'eyebrow', style: { padding: '0 14px' } }, icon('sliders', 12), 'Scopes'),
      el('div', { class: 'scopetbl', style: { padding: '0 0 6px' } },
        (function () {
          const t = el('table', { class: 'tbl' },
            el('thead', null, el('tr', null, el('th', null, 'Scope'), el('th', null, 'Grants'), el('th', { style: { textAlign: 'right' } }, 'Sensitivity'))));
          const tb = el('tbody', null);
          D.scopes.forEach(s => tb.appendChild(el('tr', { class: 'hov' },
            el('td', null, el('span', { class: 'mono', style: { fontSize: '12px', color: 'var(--s900)', fontWeight: 600 } }, s.scope)),
            el('td', { class: 'muted' }, s.desc),
            el('td', { style: { textAlign: 'right' } }, el('span', { class: 'sens sens-' + s.sensitivity }, s.sensitivity)))));
          t.appendChild(tb);
          return t;
        })()));
    wrap.appendChild(tbl);
    return wrap;
  }

  /* ── Recipes pane ──────────────────────────────────────────────────── */
  function recipePane() {
    const D = window.PLAT;
    const wrap = el('div', null);
    wrap.appendChild(el('div', { class: 'eyebrow rule' }, 'Example integrations', el('span', { class: 'num' }, '· copy-paste starting points')));
    const grid = el('div', { class: 'recipegrid' });
    D.recipes.forEach(r => {
      grid.appendChild(el('div', { class: 'card recipe', onclick: () => toast('Recipe walkthrough opens in docs') },
        el('div', { class: 'ri' }, icon(r.icon, 19)),
        el('div', { style: { flex: 1, minWidth: 0 } },
          el('div', { class: 'rt' }, r.title, el('span', { class: 'rtag' }, r.tag)),
          el('div', { class: 'rd' }, r.desc),
          el('div', { class: 'rf' },
            r.langs.map(l => el('span', { class: 'lang' }, l)),
            el('span', { class: 'rtime' }, icon('clock', 11), r.time)))));
    });
    wrap.appendChild(grid);
    return wrap;
  }

  function flowStep(n, t, s) {
    return el('div', { class: 'flowstep' }, el('div', { class: 'fn' }, n), el('div', null, el('div', { class: 'ft' }, t), el('div', { class: 'fs' }, s)));
  }
})();
