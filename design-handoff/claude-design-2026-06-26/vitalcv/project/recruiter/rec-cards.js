/* ══════════════════════════════════════════════════════════════════════════
   rec-cards.js — shared candidate presentation primitives for Recruiter OS
   The readiness ring, candidate cards/rows, "why surfaced" block, and the
   bucket vocabulary are reused across Home, Discovery, Readiness and Workspace.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  const { el, icon, chip, tierChip, initials, tint, BUCKET } = window.UI;

  function styleOnce() {
    if (document.getElementById('rec-cards-css')) return;
    const css = `
    /* readiness ring */
    .rring{position:relative;flex-shrink:0;border-radius:50%}
    .rring .rc{position:absolute;background:#fff;border-radius:50%}
    .rring .rv{position:absolute;inset:0;display:grid;place-items:center}
    .rring .rv b{font-weight:600;letter-spacing:-.03em;line-height:1;font-variant-numeric:tabular-nums}

    /* avatar */
    .ava{border-radius:12px;display:grid;place-items:center;color:#fff;font-weight:600;flex-shrink:0;font-family:'Geist Mono',monospace}

    /* candidate card (grid use) */
    .ccard{background:#fff;border:1px solid var(--s200);border-radius:13px;padding:15px;display:flex;flex-direction:column;gap:12px;position:relative;overflow:hidden;transition:border-color .12s,transform .12s,box-shadow .12s;text-align:left;width:100%}
    .ccard::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px}
    .ccard.b-ready::before{background:var(--keep)} .ccard.b-near::before{background:var(--seam)}
    .ccard.b-blocked::before{background:var(--cut)} .ccard.b-missing::before{background:var(--blue)}
    .ccard:hover{border-color:var(--s300);transform:translateY(-2px);box-shadow:0 10px 26px -16px rgba(15,23,42,.4)}
    .ccard .ctop{display:flex;gap:12px;align-items:flex-start}
    .ccard .cid{flex:1;min-width:0}
    .ccard .cnm{font-size:15px;font-weight:600;letter-spacing:-.015em;display:flex;align-items:center;gap:6px}
    .ccard .ccr{font-family:'Geist Mono',monospace;font-size:9.5px;color:var(--s500);text-transform:uppercase;letter-spacing:.06em;margin-top:3px}
    .ccard .cmeta{font-size:11.5px;color:var(--s500);margin-top:6px;display:flex;flex-wrap:wrap;gap:3px 8px;align-items:center}
    .ccard .cmeta .mono{color:var(--s700)}
    .ccard .chl{font-size:12px;color:var(--s700);line-height:1.45;border-top:1px dashed var(--rule);padding-top:10px}
    .ccard .cfoot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:auto}
    .ccard .cdot{display:inline-flex;gap:4px;align-items:center;font-family:'Geist Mono',monospace;font-size:9.5px;color:var(--s500)}

    /* candidate row (list use) */
    .crow{display:flex;align-items:center;gap:13px;padding:13px 15px;background:#fff;border:1px solid var(--s200);border-radius:12px;transition:border-color .12s,box-shadow .12s;text-align:left;width:100%}
    .crow:hover{border-color:var(--s300);box-shadow:0 4px 14px -8px rgba(15,23,42,.25)}
    .crow .cid{flex:1;min-width:0}
    .crow .cnm{font-size:14px;font-weight:600;letter-spacing:-.01em;display:flex;align-items:center;gap:7px}
    .crow .csub{font-size:11.5px;color:var(--s500);margin-top:2px}
    .crow .cright{display:flex;align-items:center;gap:18px;flex-shrink:0}
    .crow .cwhy{font-size:11.5px;color:var(--s600);max-width:30ch;line-height:1.4;flex-shrink:0;display:none}
    @media(min-width:1180px){.crow .cwhy{display:block}}

    /* why block */
    .whyblock{display:flex;flex-direction:column;gap:8px}
    .whyrow{display:flex;gap:9px;align-items:flex-start}
    .whyrow .wic{height:25px;width:25px;border-radius:7px;background:var(--s100);display:grid;place-items:center;color:var(--s700);flex-shrink:0}
    .whyrow .wtx .wt{font-size:12px;font-weight:600;letter-spacing:-.005em}
    .whyrow .wtx .wd{font-size:11px;color:var(--s500);line-height:1.4}
    .whysurfaced{background:var(--s50);border:1px solid var(--rule);border-radius:10px;padding:11px 12px}
    .whysurfaced .wlead{font-family:'Geist Mono',monospace;font-size:8.5px;text-transform:uppercase;letter-spacing:.13em;color:var(--s400);font-weight:600;margin-bottom:9px;display:flex;align-items:center;gap:6px}

    /* tiny stat pills */
    .statline{display:flex;gap:7px;flex-wrap:wrap}
    .spill{font-family:'Geist Mono',monospace;font-size:9.5px;color:var(--s600);background:var(--s100);border-radius:6px;padding:3px 7px;display:inline-flex;align-items:center;gap:5px}
    .spill b{color:var(--s900);font-weight:600}
    `;
    document.head.appendChild(el('style', { id: 'rec-cards-css', html: css }));
  }

  const ringColor = (b) => ({ ready: 'var(--keep)', near: 'var(--seam)', blocked: 'var(--cut)', missing: 'var(--blue)' }[b] || 'var(--s400)');

  // readiness ring — size px, candidate bucket drives color
  function ring(score, bucket, size) {
    size = size || 52;
    const deg = Math.round(score * 3.6);
    const inset = Math.round(size * 0.16);
    const fs = Math.round(size * 0.34);
    const r = el('div', { class: 'rring', style: {
      height: size + 'px', width: size + 'px',
      background: `conic-gradient(${ringColor(bucket)} ${deg}deg, var(--s200) ${deg}deg)`,
    } },
      el('div', { class: 'rc', style: { inset: inset + 'px' } }),
      el('div', { class: 'rv' }, el('b', { style: { fontSize: fs + 'px' } }, String(score))));
    return r;
  }

  function avatar(c, size) {
    size = size || 44;
    return el('div', { class: 'ava', style: {
      height: size + 'px', width: size + 'px', background: tint(c.id), fontSize: Math.round(size * 0.34) + 'px',
      borderRadius: Math.round(size * 0.27) + 'px',
    } }, initials(c.name));
  }

  function bucketChip(bucket) {
    const b = BUCKET[bucket];
    return el('span', { class: 'chip ' + b.cls }, el('span', { class: 'cd' }), b.label);
  }

  function go(id) { window.location.hash = '#/review/' + id; }

  // full card — used on grids (home ready, discovery, readiness)
  function card(c, opts) {
    opts = opts || {};
    return el('button', { class: 'ccard b-' + c.bucket, onclick: () => go(c.id) },
      el('div', { class: 'ctop' },
        ring(c.readiness, c.bucket, 52),
        el('div', { class: 'cid' },
          el('div', { class: 'cnm' }, c.name, tierChip(c.trust)),
          el('div', { class: 'ccr' }, c.credential + ' · ' + c.specialty),
          el('div', { class: 'cmeta' },
            el('span', null, c.location), el('span', null, '·'),
            el('span', null, c.exp), el('span', null, '·'),
            el('span', { class: 'mono' }, c.comp))),
        bucketChip(c.bucket)),
      opts.hideWhy ? null : el('div', { class: 'chl' }, c.highlight),
      el('div', { class: 'cfoot' },
        el('div', { class: 'statline' },
          el('span', { class: 'spill' }, el('b', null, c.evidenceFresh + '%'), 'fresh'),
          el('span', { class: 'spill' }, el('b', null, String(c.verified)), 'verified'),
          c.gaps ? el('span', { class: 'spill' }, el('b', null, String(c.gaps)), c.gaps === 1 ? 'gap' : 'gaps') : null),
        el('span', { class: 'cdot' }, c.mobility.status === 'open' ? icon('mobility', 12) : c.mobility.status === 'closed' ? icon('flag', 12) : icon('clock', 12), mobLabel(c.mobility.status))));
  }

  // compact row — used in dense lists
  function row(c, opts) {
    opts = opts || {};
    return el('button', { class: 'crow', onclick: () => go(c.id) },
      ring(c.readiness, c.bucket, 42),
      avatar(c, 38),
      el('div', { class: 'cid' },
        el('div', { class: 'cnm' }, c.name, tierChip(c.trust)),
        el('div', { class: 'csub' }, c.credential + ' · ' + c.specialty + ' · ' + c.location)),
      opts.why ? el('div', { class: 'cwhy' }, c.why[0].t + ' — ' + c.why[0].d) : null,
      el('div', { class: 'cright' },
        opts.showComp !== false ? el('span', { class: 'spill' }, c.comp) : null,
        bucketChip(c.bucket),
        icon('arrow', 14)));
  }

  function mobLabel(s) {
    return { open: 'Open to move', passive: 'Passive', closed: 'Closed' }[s] || s;
  }

  // why-surfaced block (review + discovery)
  function whySurfaced(c, lead) {
    return el('div', { class: 'whysurfaced' },
      el('div', { class: 'wlead' }, icon('spark', 11), lead || 'Why this clinician surfaced'),
      el('div', { class: 'whyblock' },
        c.why.map(w => el('div', { class: 'whyrow' },
          el('div', { class: 'wic' }, icon(w.icon, 14)),
          el('div', { class: 'wtx' },
            el('div', { class: 'wt' }, w.t),
            el('div', { class: 'wd' }, w.d))))));
  }

  window.RECCARDS = { styleOnce, ring, avatar, bucketChip, card, row, whySurfaced, mobLabel, ringColor, go };
})();
