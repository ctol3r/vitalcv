/* ══════════════════════════════════════════════════════════════════════════
   rec-home.js — D1 · Recruiter Home (/recruiter)
   The 30-second answer to "Who should I call?"  Talent Pipeline · Ready
   Candidates · Mobility Signals · Trust Signals · Recent Activity.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  const { el, icon, chip, tierChip } = window.UI;

  function styleOnce() {
    if (document.getElementById('rec-home-css')) return;
    const css = `
    .rh-hero{display:grid;grid-template-columns:1fr 1.05fr;gap:14px;margin-bottom:14px}
    .pipecard{padding:18px;display:flex;flex-direction:column;gap:15px}
    .pipecard .ptop{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
    .pipecard .pbig{font-size:38px;font-weight:600;letter-spacing:-.04em;line-height:1;font-variant-numeric:tabular-nums}
    .pipecard .pbiglab{font-family:'Geist Mono',monospace;font-size:9.5px;text-transform:uppercase;letter-spacing:.1em;color:var(--s400);margin-top:6px}
    .pipebar{display:flex;height:12px;border-radius:7px;overflow:hidden;border:1px solid var(--s200)}
    .pipebar i{display:block;height:100%}
    .pipekey{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
    .pk{border:1px solid var(--s200);border-radius:10px;padding:10px 11px;display:flex;flex-direction:column;gap:3px;background:var(--s50);text-align:left;transition:border-color .12s,background .12s}
    .pk:hover{border-color:var(--s300);background:#fff}
    .pk .pkn{font-size:21px;font-weight:600;letter-spacing:-.03em;font-variant-numeric:tabular-nums;display:flex;align-items:baseline;gap:5px}
    .pk .pkn .cd{width:7px;height:7px;border-radius:50%;align-self:center}
    .pk .pkl{font-family:'Geist Mono',monospace;font-size:8.5px;text-transform:uppercase;letter-spacing:.08em;color:var(--s500)}
    .pk .pkh{font-size:10.5px;color:var(--s400)}

    .callcard{padding:18px;display:flex;flex-direction:column;gap:13px;background:linear-gradient(180deg,#fff, var(--s50))}
    .callcard .clead{font-family:'Geist Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:.14em;color:var(--s400);font-weight:600;display:flex;align-items:center;gap:7px}
    .callcard .cq{font-size:21px;font-weight:600;letter-spacing:-.025em;line-height:1.1}
    .calltop{display:flex;align-items:center;gap:13px;border:1px solid var(--keep-line);background:var(--keep-bg);border-radius:12px;padding:13px;cursor:pointer;transition:box-shadow .12s}
    .calltop:hover{box-shadow:0 8px 22px -14px rgba(4,120,87,.5)}
    .calltop .ctx{flex:1;min-width:0}
    .calltop .cnm{font-size:15px;font-weight:600;letter-spacing:-.015em;display:flex;align-items:center;gap:7px}
    .calltop .crs{font-size:12px;color:var(--keep);font-weight:500;margin-top:2px}
    .calltop .cwh{font-size:11.5px;color:var(--s600);margin-top:5px;line-height:1.4}
    .callbtn{display:inline-flex;align-items:center;gap:7px;background:var(--keep);color:#fff;border:0;border-radius:9px;padding:9px 13px;font-size:12.5px;font-weight:600;flex-shrink:0}
    .callnext{display:flex;flex-direction:column;gap:7px}
    .callnext .cn{display:flex;align-items:center;gap:10px;padding:8px 4px;border-top:1px solid var(--rule-soft)}
    .callnext .cn .cnr{font-family:'Geist Mono',monospace;font-size:10px;color:var(--s400);width:16px}
    .callnext .cn .cnm{font-size:12.5px;font-weight:600;flex:1}
    .callnext .cn .cns{font-size:11px;color:var(--s500)}

    .rh-ready{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:14px}
    .rh-low{display:grid;grid-template-columns:1fr 1fr 1.1fr;gap:14px}
    .sigcard{padding:15px}
    .sighead{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px}
    .sigrow{display:flex;gap:11px;padding:11px 0;border-top:1px solid var(--rule-soft);align-items:flex-start;text-align:left;width:100%;background:none;border-left:0;border-right:0;border-bottom:0}
    .sigrow:hover .sg-t{color:var(--blue)}
    .sigrow .sg-ic{height:30px;width:30px;border-radius:8px;display:grid;place-items:center;flex-shrink:0;border:1px solid var(--s200)}
    .sigrow .sg-x{flex:1;min-width:0}
    .sigrow .sg-nm{font-size:12.5px;font-weight:600;letter-spacing:-.01em;display:flex;align-items:center;gap:6px}
    .sigrow .sg-t{font-size:11.5px;color:var(--s600);margin-top:2px;line-height:1.4;transition:color .12s}
    .sigrow .sg-w{font-family:'Geist Mono',monospace;font-size:9px;color:var(--s400);white-space:nowrap;flex-shrink:0}
    .sigtag{font-family:'Geist Mono',monospace;font-size:8px;text-transform:uppercase;letter-spacing:.08em;font-weight:600;padding:2px 6px;border-radius:4px;background:var(--s100);color:var(--s600)}
    @media(max-width:1080px){.rh-hero{grid-template-columns:1fr}.rh-ready{grid-template-columns:1fr}.rh-low{grid-template-columns:1fr}.pipekey{grid-template-columns:repeat(2,1fr)}}
    `;
    document.head.appendChild(el('style', { id: 'rec-home-css', html: css }));
  }

  const bucketColor = (b) => ({ ready: 'var(--keep)', near: 'var(--seam)', blocked: 'var(--cut)', missing: 'var(--blue)' }[b]);
  const sigTone = (k) => ({ mobility: 'seam', trust: 'keep', evidence: 'keep', review: 'blue', flag: 'cut' }[k] || 'ghost');
  const sigIcon = (k) => ({ mobility: 'mobility', trust: 'shield', evidence: 'wallet', review: 'eye', flag: 'flag' }[k] || 'feed');

  window.renderRecHome = function () {
    styleOnce();
    window.RECCARDS.styleOnce();
    const D = window.REC, C = window.RECCARDS;
    const v = el('div', { class: 'view' });

    // page head
    v.appendChild(el('div', { class: 'pagehead' },
      el('div', null,
        el('div', { class: 'lead' }, icon('home', 12), 'Recruiter OS · talent command'),
        el('h1', null, 'Who should I ', el('em', null, 'call?')),
        el('div', { class: 'sub' }, 'Every clinician in your network, ranked by verified readiness — not résumés. The answer to your next call sits at the top of this screen.')),
      el('div', { class: 'ra' }, chip('active', 'pool live'))));

    // ── hero: pipeline + the call answer ──
    const ready = D.candidates.filter(c => c.bucket === 'ready').sort((a, b) => b.readiness - a.readiness);
    v.appendChild(el('div', { class: 'rh-hero' }, pipelineCard(D, C), callCard(ready, C)));

    // ── ready candidates ──
    v.appendChild(el('div', { class: 'eyebrow rule', style: { marginBottom: '12px' } },
      icon('check', 12), 'Ready candidates', el('span', { class: 'num' }, '· call now, no gaps')));
    const rg = el('div', { class: 'rh-ready' });
    ready.slice(0, 3).forEach(c => rg.appendChild(C.card(c)));
    v.appendChild(rg);

    // ── signals + activity ──
    v.appendChild(el('div', { class: 'rh-low' },
      mobilityCard(D),
      trustCard(D),
      activityCard(D)));

    return v;
  };

  function pipelineCard(D, C) {
    const p = D.pipeline;
    const order = ['ready', 'near', 'missing', 'blocked'];
    const labels = { ready: 'Ready', near: 'Near ready', missing: 'Missing evidence', blocked: 'Blocked' };
    const hints = { ready: 'Call now', near: 'One gap', missing: 'Needs access', blocked: 'Hold' };
    return el('div', { class: 'card pipecard' },
      el('div', { class: 'ptop' },
        el('div', null,
          el('div', { class: 'pbig' }, String(p.total)),
          el('div', { class: 'pbiglab' }, 'clinicians in network · ' + p.newThisWeek + ' new this week')),
        el('div', { class: 'eyebrow', style: { margin: 0 } }, icon('people', 12), 'Talent pipeline')),
      el('div', { class: 'pipebar' },
        order.map(b => el('i', { style: { flex: p.counts[b] || 0.001, background: bucketColor(b) }, title: labels[b] }))),
      el('div', { class: 'pipekey' },
        order.map(b => el('a', { class: 'pk', href: '#/readiness' },
          el('div', { class: 'pkn' }, el('span', { class: 'cd', style: { background: bucketColor(b) } }), String(p.counts[b] || 0)),
          el('div', { class: 'pkl' }, labels[b]),
          el('div', { class: 'pkh' }, hints[b])))));
  }

  function callCard(ready, C) {
    const top = ready[0];
    const rest = ready.slice(1, 4);
    return el('div', { class: 'card callcard' },
      el('div', { class: 'clead' }, icon('phone', 11), 'Next call · highest verified readiness'),
      el('div', { class: 'calltop', onclick: () => C.go(top.id) },
        C.ring(top.readiness, top.bucket, 50),
        el('div', { class: 'ctx' },
          el('div', { class: 'cnm' }, top.name, window.UI.tierChip(top.trust)),
          el('div', { class: 'crs' }, top.credential + ' · ' + top.specialty + ' · ' + top.mobility.signal.split('·')[0].trim()),
          el('div', { class: 'cwh' }, top.highlight)),
        el('button', { class: 'callbtn', onclick: (e) => { e.stopPropagation(); C.go(top.id); } }, icon('phone', 13), 'Open')),
      el('div', { class: 'callnext' },
        rest.map((c, i) => el('button', { class: 'sigrow', style: { padding: 0 }, onclick: () => C.go(c.id) },
          el('div', { class: 'cn', style: { width: '100%', borderTop: i === 0 ? '1px solid var(--rule-soft)' : '1px solid var(--rule-soft)' } },
            el('span', { class: 'cnr' }, '0' + (i + 2)),
            el('span', { class: 'cnm' }, c.name),
            el('span', { class: 'cns' }, c.specialty + ' · ' + c.location),
            el('span', { class: 'spill' }, 'rdy ' + c.readiness))))));
  }

  function mobilityCard(D) {
    return el('div', { class: 'card sigcard' },
      el('div', { class: 'sighead' },
        el('div', { class: 'eyebrow', style: { margin: 0 } }, icon('mobility', 12), 'Mobility signals'),
        el('a', { href: '#/discovery', class: 'linkmore' }, 'Discover', icon('arrow', 11))),
      el('div', { class: 'muted', style: { fontSize: '11px', marginBottom: '2px' } }, 'Clinicians who just became reachable.'),
      D.mobilitySignals.map(s => sigRow(D.byId[s.id], s, 'seam', 'mobility')));
  }

  function trustCard(D) {
    return el('div', { class: 'card sigcard' },
      el('div', { class: 'sighead' },
        el('div', { class: 'eyebrow', style: { margin: 0 } }, icon('shield', 12), 'Trust signals'),
        el('a', { href: '#/readiness', class: 'linkmore' }, 'Readiness', icon('arrow', 11))),
      el('div', { class: 'muted', style: { fontSize: '11px', marginBottom: '2px' } }, 'Records that just got more authoritative.'),
      D.trustSignals.map(s => sigRow(D.byId[s.id], s, 'keep', 'shield', s.tier)));
  }

  function sigRow(c, s, tone, ic, tier) {
    return el('button', { class: 'sigrow', onclick: () => window.RECCARDS.go(c.id) },
      el('div', { class: 'sg-ic', style: { color: `var(--${tone})` } }, icon(ic, 15)),
      el('div', { class: 'sg-x' },
        el('div', { class: 'sg-nm' }, c.name, tier ? window.UI.tierChip(tier) : el('span', { class: 'sigtag' }, s.tag)),
        el('div', { class: 'sg-t' }, s.t)),
      el('div', { class: 'sg-w' }, s.when));
  }

  function activityCard(D) {
    return el('div', { class: 'card sigcard' },
      el('div', { class: 'sighead' },
        el('div', { class: 'eyebrow', style: { margin: 0 } }, icon('feed', 12), 'Recent activity'),
        el('span', { class: 'linkmore', style: { color: 'var(--s400)' } }, 'pool-wide')),
      D.activity.slice(0, 6).map(a => {
        const c = D.byId[a.id];
        return el('button', { class: 'sigrow', onclick: () => window.RECCARDS.go(a.id) },
          el('div', { class: 'sg-ic', style: { color: `var(--${sigTone(a.kind)})` } }, icon(sigIcon(a.kind), 15)),
          el('div', { class: 'sg-x' },
            el('div', { class: 'sg-nm' }, a.t, a.tier ? window.UI.tierChip(a.tier) : null),
            el('div', { class: 'sg-t' }, a.d)),
          el('div', { class: 'sg-w' }, a.when));
      }));
  }
})();
