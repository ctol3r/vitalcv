/* ══════════════════════════════════════════════════════════════════════════
   rec-review.js — D4 · Candidate Review (/recruiter/review/[entityId])
   Evidence · Trust · Timeline · Mobility · Organizations combined into ONE
   recruiter decision screen, topped by a verdict and a call action.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  const { el, icon, chip, tierChip, initials } = window.UI;

  function styleOnce() {
    if (document.getElementById('rec-rev-css')) return;
    const css = `
    .rv-back{display:inline-flex;align-items:center;gap:6px;font-family:'Geist Mono',monospace;font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--s500);margin-bottom:14px}
    .rv-back:hover{color:var(--s900)}

    .rv-hero{background:#fff;border:1px solid var(--s200);border-radius:15px;padding:20px;display:flex;gap:20px;align-items:flex-start;margin-bottom:14px;position:relative;overflow:hidden}
    .rv-hero::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px}
    .rv-hero.b-ready::before{background:var(--keep)} .rv-hero.b-near::before{background:var(--seam)}
    .rv-hero.b-blocked::before{background:var(--cut)} .rv-hero.b-missing::before{background:var(--blue)}
    .rv-hero .rv-who{display:flex;gap:16px;align-items:center;flex:1;min-width:0}
    .rv-hero .rv-nm{font-size:24px;font-weight:600;letter-spacing:-.025em;line-height:1.05;display:flex;align-items:center;gap:9px;flex-wrap:wrap}
    .rv-hero .rv-cr{font-family:'Geist Mono',monospace;font-size:11px;color:var(--s500);text-transform:uppercase;letter-spacing:.06em;margin-top:6px}
    .rv-hero .rv-meta{font-size:12.5px;color:var(--s600);margin-top:9px;display:flex;flex-wrap:wrap;gap:4px 11px}
    .rv-hero .rv-meta .mono{color:var(--s800)}
    .rv-hero .rv-act{display:flex;flex-direction:column;gap:8px;flex-shrink:0;width:178px}
    .rv-pill{display:flex;align-items:center;gap:8px;border:1px solid var(--s200);border-radius:10px;padding:10px 12px;font-size:12.5px;font-weight:600;color:var(--s800);background:#fff;transition:border-color .12s,background .12s;width:100%;justify-content:center}
    .rv-pill:hover{border-color:var(--s300);background:var(--s50)}
    .rv-pill.primary{background:var(--keep);color:#fff;border-color:var(--keep)}
    .rv-pill.primary:hover{box-shadow:0 8px 20px -12px rgba(4,120,87,.6)}
    .rv-pill.warn{background:var(--cut);color:#fff;border-color:var(--cut)}

    .verdict{display:flex;gap:13px;align-items:flex-start;border-radius:13px;padding:15px 17px;margin-bottom:14px;border:1px solid}
    .verdict.v-ready{background:var(--keep-bg);border-color:var(--keep-line)}
    .verdict.v-near{background:var(--seam-bg);border-color:var(--seam-line)}
    .verdict.v-blocked{background:var(--cut-bg);border-color:var(--cut-line)}
    .verdict.v-missing{background:var(--blue-bg);border-color:var(--blue-line)}
    .verdict .vic{height:34px;width:34px;border-radius:9px;display:grid;place-items:center;color:#fff;flex-shrink:0}
    .verdict.v-ready .vic{background:var(--keep)} .verdict.v-near .vic{background:var(--seam)}
    .verdict.v-blocked .vic{background:var(--cut)} .verdict.v-missing .vic{background:var(--blue)}
    .verdict .vx{flex:1}
    .verdict .vt{font-size:14px;font-weight:600;letter-spacing:-.01em}
    .verdict .vd{font-size:12.5px;color:var(--s700);margin-top:3px;line-height:1.45}

    .rv-grid{display:grid;grid-template-columns:1.5fr 1fr;gap:14px;align-items:start}
    .panel{background:#fff;border:1px solid var(--s200);border-radius:13px;padding:16px}
    .panel + .panel{margin-top:14px}
    .panel .ph{display:flex;align-items:center;justify-content:space-between;margin-bottom:13px}
    .panel .ph .eyebrow{margin:0}

    /* evidence table */
    .evtable{display:flex;flex-direction:column}
    .evrow{display:grid;grid-template-columns:1fr auto auto auto;gap:12px;align-items:center;padding:11px 0;border-top:1px solid var(--rule-soft)}
    .evrow:first-child{border-top:0}
    .evrow .ev-l{min-width:0}
    .evrow .ev-nm{font-size:13px;font-weight:600;letter-spacing:-.005em;display:flex;align-items:center;gap:7px}
    .evrow .ev-src{font-family:'Geist Mono',monospace;font-size:9.5px;color:var(--s500);margin-top:2px}
    .evrow .ev-fr{font-family:'Geist Mono',monospace;font-size:10px;color:var(--s500);white-space:nowrap}

    /* trust lanes */
    .lanes{display:flex;flex-direction:column;gap:8px}
    .lane{display:flex;align-items:center;gap:11px}
    .lane .ln-nm{font-size:12.5px;color:var(--s700);width:108px;flex-shrink:0}
    .lane .ln-bar{flex:1;height:7px;background:var(--s100);border-radius:5px;overflow:hidden;position:relative}
    .lane .ln-bar i{display:block;height:100%;border-radius:5px}
    .lane .ln-t{flex-shrink:0}

    /* mobility */
    .mob{display:flex;flex-direction:column;gap:11px}
    .mob .mb-status{display:flex;align-items:center;gap:10px;padding:11px 12px;border-radius:11px;border:1px solid var(--s200);background:var(--s50)}
    .mob .mb-ic{height:32px;width:32px;border-radius:9px;display:grid;place-items:center;flex-shrink:0;color:#fff}
    .mob .mb-x .mb-t{font-size:13px;font-weight:600}
    .mob .mb-x .mb-d{font-size:11.5px;color:var(--s500);margin-top:1px}
    .mob .mb-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    .mob .mb-c{border:1px solid var(--s200);border-radius:9px;padding:9px 11px}
    .mob .mb-c .mc-k{font-family:'Geist Mono',monospace;font-size:8.5px;text-transform:uppercase;letter-spacing:.08em;color:var(--s400)}
    .mob .mb-c .mc-v{font-size:13px;font-weight:600;letter-spacing:-.01em;margin-top:3px}
    .statechips{display:flex;flex-wrap:wrap;gap:5px}
    .statechips .sc{font-family:'Geist Mono',monospace;font-size:10px;font-weight:600;color:var(--s700);background:var(--s100);border-radius:6px;padding:3px 8px}

    /* timeline */
    .tl{display:flex;flex-direction:column}
    .tlrow{display:flex;gap:12px;padding-bottom:14px;position:relative}
    .tlrow:not(:last-child)::before{content:"";position:absolute;left:5px;top:14px;bottom:0;width:1px;background:var(--rule)}
    .tlrow .tl-dot{width:11px;height:11px;border-radius:50%;border:2px solid #fff;background:var(--s400);flex-shrink:0;margin-top:2px;box-shadow:0 0 0 1px var(--s200);z-index:1}
    .tlrow.k-trust .tl-dot{background:var(--keep)} .tlrow.k-flag .tl-dot{background:var(--cut)}
    .tlrow .tl-x{flex:1;min-width:0}
    .tlrow .tl-t{font-size:12.5px;font-weight:600;letter-spacing:-.005em;display:flex;align-items:center;gap:7px}
    .tlrow .tl-d{font-size:11.5px;color:var(--s500);margin-top:1px}
    .tlrow .tl-w{font-family:'Geist Mono',monospace;font-size:9px;color:var(--s400);margin-top:3px}

    /* orgs */
    .orglist{display:flex;flex-direction:column;gap:9px}
    .orgrow{display:flex;gap:11px;align-items:center;padding:10px 11px;border:1px solid var(--s200);border-radius:10px}
    .orgrow .or-lg{height:34px;width:34px;border-radius:9px;display:grid;place-items:center;font-family:'Geist Mono',monospace;font-weight:600;font-size:12px;color:#fff;flex-shrink:0}
    .orgrow .or-x{flex:1;min-width:0}
    .orgrow .or-nm{font-size:12.5px;font-weight:600;display:flex;align-items:center;gap:6px}
    .orgrow .or-nm svg{color:var(--keep)}
    .orgrow .or-rel{font-size:11px;color:var(--s500)}
    @media(max-width:980px){.rv-grid{grid-template-columns:1fr}.rv-hero{flex-direction:column}.rv-hero .rv-act{width:100%;flex-direction:row}}
    `;
    document.head.appendChild(el('style', { id: 'rec-rev-css', html: css }));
  }

  const VERDICT = {
    ready:   { ic: 'check', t: 'Clear to present — call now.', d: 'Every credential lane is verified and fresh, sanctions are clean, and the clinician is reachable. No further checks required before outreach.' },
    near:    { ic: 'clock', t: 'Strong candidate — one gap from ready.', d: 'The profile is sound but a single item is outstanding. Advance to a conversation while the gap closes; do not present to the hiring panel until it clears.' },
    blocked: { ic: 'flag',  t: 'Do not advance — unresolved blocker.', d: 'A core credential is expired or a sanctions match is unresolved. This clinician is held from all pipelines until the blocker is cleared.' },
    missing: { ic: 'eye',   t: 'Promising — but evidence is incomplete.', d: 'Key lanes require an institutional query you can run. Request access before investing outreach time; readiness will recompute on return.' },
  };

  const ORG_TINT = { employer: '#0f172a', training: '#0e7490', authority: '#4338ca' };
  const laneColor = (t) => ({ T4: 'var(--keep)', T3: 'var(--blue)', T2: 'var(--s500)', T1: 'var(--s400)' }[t] || 'var(--s400)');
  const laneW = (t) => ({ T4: 100, T3: 76, T2: 50, T1: 26 }[t] || 20);

  window.renderRecReview = function (id) {
    styleOnce();
    window.RECCARDS.styleOnce();
    const D = window.REC, C = window.RECCARDS;
    const c = D.byId[id];
    const v = el('div', { class: 'view' });

    if (!c) {
      v.appendChild(el('div', { class: 'dempty', style: { padding: '60px', textAlign: 'center' } }, 'Candidate not found. ',
        el('a', { href: '#/discovery', class: 'linkmore' }, 'Back to discovery')));
      return v;
    }

    v.appendChild(el('a', { href: '#/readiness', class: 'rv-back' }, icon('arrowl', 12), 'Back to readiness'));

    // ── hero ──
    const av = C.avatar(c, 58);
    v.appendChild(el('div', { class: 'rv-hero b-' + c.bucket },
      el('div', { class: 'rv-who' },
        C.ring(c.readiness, c.bucket, 70),
        el('div', { style: { minWidth: 0 } },
          el('div', { class: 'rv-nm' }, c.name, tierChip(c.trust), C.bucketChip(c.bucket)),
          el('div', { class: 'rv-cr' }, c.credential + ' · ' + c.specialty + ' · ' + c.exp + ' experience'),
          el('div', { class: 'rv-meta' },
            el('span', null, c.location), el('span', null, '·'),
            el('span', null, 'NPI ', el('span', { class: 'mono' }, c.npi)), el('span', null, '·'),
            el('span', null, c.comp), el('span', null, '·'),
            el('span', null, 'Avail ', el('span', { class: 'mono' }, c.avail))))),
      el('div', { class: 'rv-act' },
        c.bucket === 'blocked'
          ? el('button', { class: 'rv-pill warn', onclick: () => toast('Held — blocker must clear first') }, icon('flag', 14), 'On hold')
          : el('button', { class: 'rv-pill primary', onclick: () => toast('Outreach drafted for ' + c.name) }, icon('phone', 14), 'Start outreach'),
        el('button', { class: 'rv-pill', onclick: () => toast('Added to workspace') }, icon('plus', 14), 'Add to workspace'),
        el('button', { class: 'rv-pill', onclick: () => toast('Shared with hiring panel') }, icon('export', 14), 'Share profile'))));

    // ── verdict ──
    const vd = VERDICT[c.bucket];
    v.appendChild(el('div', { class: 'verdict v-' + c.bucket },
      el('div', { class: 'vic' }, icon(vd.ic, 18)),
      el('div', { class: 'vx' },
        el('div', { class: 'vt' }, vd.t),
        el('div', { class: 'vd' }, vd.d))));

    // ── grid ──
    const left = el('div', null,
      evidencePanel(c),
      timelinePanel(c));
    const right = el('div', null,
      el('div', { class: 'panel' }, C.whySurfaced(c, 'Why ' + c.name.split(' ')[0] + ' surfaced')),
      trustPanel(c),
      mobilityPanel(c, C),
      orgsPanel(c));

    v.appendChild(el('div', { class: 'rv-grid' }, left, right));
    return v;
  };

  function evidencePanel(c) {
    return el('div', { class: 'panel' },
      el('div', { class: 'ph' },
        el('div', { class: 'eyebrow' }, icon('wallet', 12), 'Evidence ledger'),
        el('span', { class: 'spill' }, el('b', null, c.evidenceFresh + '%'), 'fresh')),
      el('div', { class: 'evtable' },
        c.evidenceItems.map(e => el('div', { class: 'evrow' },
          el('div', { class: 'ev-l' },
            el('div', { class: 'ev-nm' }, e.label),
            el('div', { class: 'ev-src' }, e.source)),
          tierChip(e.tier),
          chip(e.state),
          el('div', { class: 'ev-fr' }, e.fresh)))));
  }

  function trustPanel(c) {
    return el('div', { class: 'panel' },
      el('div', { class: 'eyebrow' }, icon('shield', 12), 'Trust ladder'),
      el('div', { class: 'lanes' },
        c.trustLanes.map(([nm, t]) => el('div', { class: 'lane' },
          el('span', { class: 'ln-nm' }, nm),
          el('span', { class: 'ln-bar' }, el('i', { style: { width: laneW(t) + '%', background: laneColor(t) } })),
          tierChip(t)))));
  }

  function mobilityPanel(c, C) {
    const m = c.mobility;
    const tone = m.status === 'open' ? 'var(--keep)' : m.status === 'closed' ? 'var(--cut)' : 'var(--seam)';
    const mic = m.status === 'open' ? 'mobility' : m.status === 'closed' ? 'flag' : 'clock';
    return el('div', { class: 'panel' },
      el('div', { class: 'eyebrow' }, icon('mobility', 12), 'Mobility'),
      el('div', { class: 'mob' },
        el('div', { class: 'mb-status' },
          el('div', { class: 'mb-ic', style: { background: tone } }, icon(mic, 16)),
          el('div', { class: 'mb-x' },
            el('div', { class: 'mb-t' }, C.mobLabel(m.status)),
            el('div', { class: 'mb-d' }, m.signal))),
        el('div', { class: 'mb-grid' },
          el('div', { class: 'mb-c' }, el('div', { class: 'mc-k' }, 'Radius'), el('div', { class: 'mc-v' }, m.radius)),
          el('div', { class: 'mb-c' }, el('div', { class: 'mc-k' }, 'Availability'), el('div', { class: 'mc-v' }, c.avail))),
        el('div', null,
          el('div', { class: 'mc-k', style: { fontFamily: "'Geist Mono',monospace", fontSize: '8.5px', textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--s400)', marginBottom: '6px' } }, 'Licensed states'),
          el('div', { class: 'statechips' }, m.states.map(s => el('span', { class: 'sc' }, s))))));
  }

  function timelinePanel(c) {
    return el('div', { class: 'panel' },
      el('div', { class: 'eyebrow' }, icon('clock', 12), 'Career timeline'),
      el('div', { class: 'tl' },
        c.timeline.map(t => el('div', { class: 'tlrow k-' + (t.tier === 'T4' || t.tier === 'T3' || t.tier === 'T2' ? 'trust' : 'plain') + (/flag|lapse|contradict|match/i.test(t.t) ? ' k-flag' : '') },
          el('span', { class: 'tl-dot' }),
          el('div', { class: 'tl-x' },
            el('div', { class: 'tl-t' }, t.t, t.tier ? tierChip(t.tier) : null),
            el('div', { class: 'tl-d' }, t.d),
            el('div', { class: 'tl-w' }, t.when))))));
  }

  function orgsPanel(c) {
    return el('div', { class: 'panel' },
      el('div', { class: 'eyebrow' }, icon('org', 12), 'Organizations'),
      el('div', { class: 'orglist' },
        c.orgs.map(o => el('div', { class: 'orgrow' },
          el('div', { class: 'or-lg', style: { background: ORG_TINT[o.kind] || '#334155' } }, initials(o.name)),
          el('div', { class: 'or-x' },
            el('div', { class: 'or-nm' }, o.name, icon('check', 13)),
            el('div', { class: 'or-rel' }, o.rel)),
          chip(o.status)))));
  }

  function toast(msg) {
    let t = document.getElementById('rec-toast');
    if (!t) { t = el('div', { id: 'rec-toast' }); document.body.appendChild(t);
      Object.assign(t.style, { position: 'fixed', bottom: '26px', left: '50%', transform: 'translateX(-50%)',
        background: 'var(--s950, #020617)', color: '#fff', padding: '11px 18px', borderRadius: '11px',
        fontSize: '13px', fontWeight: '500', zIndex: 200, boxShadow: '0 16px 40px -12px rgba(0,0,0,.5)',
        transition: 'opacity .2s, transform .2s', fontFamily: "'Geist',sans-serif" }); }
    t.textContent = msg; t.style.opacity = '1'; t.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(t._h); t._h = setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(-50%) translateY(8px)'; }, 1900);
  }
})();
