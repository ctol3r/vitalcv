/* ══════════════════════════════════════════════════════════════════════════
   rec-discovery.js — D2 · Talent Discovery (/recruiter/discovery)
   Search the network across four axes — Clinicians · Evidence · Trust ·
   Mobility — and for every result, show WHY the candidate surfaced.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  const { el, icon, chip, tierChip } = window.UI;

  // facet state (module-scoped, persists within session)
  let F = { q: '', specialty: 'all', bucket: 'all', trust: 'all', mobility: 'all', fresh: 0, sort: 'readiness' };

  function styleOnce() {
    if (document.getElementById('rec-disc-css')) return;
    const css = `
    .disc{display:grid;grid-template-columns:248px 1fr;gap:16px;align-items:start}
    .facets{position:sticky;top:106px;display:flex;flex-direction:column;gap:16px}
    .fgroup{}
    .fglab{font-family:'Geist Mono',monospace;font-size:8.5px;text-transform:uppercase;letter-spacing:.13em;color:var(--s400);font-weight:600;margin-bottom:9px;display:flex;align-items:center;gap:6px}
    .fopts{display:flex;flex-direction:column;gap:3px}
    .fopt{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12.5px;color:var(--s600);padding:6px 9px;border-radius:8px;border:1px solid transparent;text-align:left;background:none;width:100%;transition:background .1s,color .1s}
    .fopt:hover{background:var(--s100)}
    .fopt.on{background:var(--s900);color:#fff}
    .fopt .fct{font-family:'Geist Mono',monospace;font-size:9.5px;opacity:.6}
    .fopt.on .fct{opacity:.8}
    .fopt .fdot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
    .fchips{display:flex;flex-wrap:wrap;gap:5px}
    .fchip{font-size:11.5px;color:var(--s600);padding:5px 10px;border-radius:8px;border:1px solid var(--s200);background:#fff;transition:border-color .1s,background .1s}
    .fchip:hover{border-color:var(--s300)}
    .fchip.on{background:var(--s900);color:#fff;border-color:var(--s900)}
    .freshrow{display:flex;align-items:center;gap:9px}
    .freshrow input{flex:1;accent-color:var(--s900)}
    .freshrow .fv{font-family:'Geist Mono',monospace;font-size:11px;color:var(--s700);width:34px;text-align:right}

    .discmain{display:flex;flex-direction:column;gap:13px}
    .discbar{display:flex;align-items:center;gap:11px;flex-wrap:wrap}
    .dsearch{flex:1;min-width:220px;display:flex;align-items:center;gap:10px;border:1px solid var(--s200);border-radius:11px;background:#fff;padding:0 13px;height:42px}
    .dsearch:focus-within{border-color:var(--s400);box-shadow:0 0 0 3px var(--s100)}
    .dsearch svg{color:var(--s400);flex-shrink:0}
    .dsearch input{flex:1;border:0;outline:0;font-family:inherit;font-size:14px;color:var(--s900);background:transparent}
    .dsearch input::placeholder{color:var(--s400)}
    .dsort{display:flex;align-items:center;gap:7px;font-size:12px;color:var(--s500)}
    .dsort select{font-family:inherit;font-size:12.5px;color:var(--s800);border:1px solid var(--s200);border-radius:9px;padding:8px 10px;background:#fff}
    .disccount{font-family:'Geist Mono',monospace;font-size:10px;color:var(--s400);text-transform:uppercase;letter-spacing:.1em}
    .disccount b{color:var(--s800)}

    .dresult{background:#fff;border:1px solid var(--s200);border-radius:13px;padding:15px;display:grid;grid-template-columns:auto 1fr 260px;gap:16px;align-items:center;transition:border-color .12s,box-shadow .12s;text-align:left;width:100%}
    .dresult:hover{border-color:var(--s300);box-shadow:0 8px 22px -14px rgba(15,23,42,.3)}
    .dresult .dr-id{display:flex;gap:12px;align-items:center;min-width:0}
    .dresult .dr-x{min-width:0}
    .dresult .dr-nm{font-size:15px;font-weight:600;letter-spacing:-.015em;display:flex;align-items:center;gap:7px}
    .dresult .dr-cr{font-family:'Geist Mono',monospace;font-size:9.5px;color:var(--s500);text-transform:uppercase;letter-spacing:.05em;margin-top:3px}
    .dresult .dr-meta{font-size:11.5px;color:var(--s500);margin-top:6px;display:flex;flex-wrap:wrap;gap:3px 8px}
    .dresult .dr-why{border-left:1px solid var(--rule);padding-left:15px}
    .dresult .dr-wl{font-family:'Geist Mono',monospace;font-size:8px;text-transform:uppercase;letter-spacing:.12em;color:var(--s400);font-weight:600;margin-bottom:7px;display:flex;align-items:center;gap:5px}
    .dresult .dr-wt{font-size:12px;font-weight:600;letter-spacing:-.005em;line-height:1.35}
    .dresult .dr-wd{font-size:11px;color:var(--s500);line-height:1.4;margin-top:3px}
    .dresult .dr-match{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}
    .dmt{font-family:'Geist Mono',monospace;font-size:8.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--keep);background:var(--keep-bg);box-shadow:inset 0 0 0 1px var(--keep-line);border-radius:4px;padding:2px 6px}
    .dempty{padding:60px;text-align:center;color:var(--s400);font-size:13px;background:#fff;border:1px solid var(--s200);border-radius:13px}
    @media(max-width:1100px){.disc{grid-template-columns:1fr}.facets{position:static}.dresult{grid-template-columns:auto 1fr}.dresult .dr-why{grid-column:1/-1;border-left:0;border-top:1px solid var(--rule);padding-left:0;padding-top:12px}}
    `;
    document.head.appendChild(el('style', { id: 'rec-disc-css', html: css }));
  }

  const SPECIALTIES = ['all', 'Emergency Medicine', 'Orthopedic Surgery', 'Hospital Medicine', 'Critical Care', 'Cardiology', 'Anesthesiology', 'Family Medicine', 'Psychiatric / Mental Health', 'Oncology', 'Dermatology', 'Critical Care / ICU'];
  const TRUST_ORDER = { T1: 1, T2: 2, T3: 3, T4: 4 };

  function match(c) {
    if (F.q.trim()) {
      const t = F.q.toLowerCase();
      const hay = (c.name + ' ' + c.specialty + ' ' + c.credential + ' ' + c.location + ' ' + c.highlight).toLowerCase();
      if (!hay.includes(t)) return false;
    }
    if (F.specialty !== 'all' && c.specialty !== F.specialty) return false;
    if (F.bucket !== 'all' && c.bucket !== F.bucket) return false;
    if (F.trust !== 'all' && TRUST_ORDER[c.trust] < TRUST_ORDER[F.trust]) return false;
    if (F.mobility !== 'all' && c.mobility.status !== F.mobility) return false;
    if (F.fresh > 0 && c.evidenceFresh < F.fresh) return false;
    return true;
  }

  function sorted(list) {
    const s = F.sort;
    return [...list].sort((a, b) => {
      if (s === 'readiness') return b.readiness - a.readiness;
      if (s === 'fresh') return b.evidenceFresh - a.evidenceFresh;
      if (s === 'trust') return TRUST_ORDER[b.trust] - TRUST_ORDER[a.trust] || b.readiness - a.readiness;
      if (s === 'name') return a.name.localeCompare(b.name);
      return 0;
    });
  }

  function rerender() {
    const host = document.getElementById('disc-results');
    if (!host) return;
    const list = sorted(window.REC.candidates.filter(match));
    host.innerHTML = '';
    const cnt = document.getElementById('disc-count');
    if (cnt) cnt.innerHTML = '';
    if (cnt) { cnt.appendChild(el('b', null, String(list.length))); cnt.appendChild(document.createTextNode(' of ' + window.REC.candidates.length + ' clinicians')); }
    if (!list.length) { host.appendChild(el('div', { class: 'dempty' }, 'No clinicians match these filters. Loosen a facet to widen the search.')); return; }
    list.forEach(c => host.appendChild(resultRow(c)));
    // refresh facet active states
    document.querySelectorAll('[data-facet]').forEach(node => {
      const [g, val] = node.dataset.facet.split('::');
      node.classList.toggle('on', String(F[g]) === val);
    });
  }

  function resultRow(c) {
    const C = window.RECCARDS;
    const w = c.why[0];
    return el('button', { class: 'dresult', onclick: () => C.go(c.id) },
      el('div', { class: 'dr-id' },
        C.ring(c.readiness, c.bucket, 50),
        el('div', { class: 'dr-x' },
          el('div', { class: 'dr-nm' }, c.name, tierChip(c.trust)),
          el('div', { class: 'dr-cr' }, c.credential + ' · ' + c.specialty),
          el('div', { class: 'dr-meta' },
            el('span', null, c.location), el('span', null, '·'),
            el('span', null, c.comp), el('span', null, '·'),
            el('span', null, C.mobLabel(c.mobility.status))))),
      el('div', null, C.bucketChip(c.bucket),
        el('div', { class: 'dr-match' },
          el('span', { class: 'dmt' }, c.evidenceFresh + '% fresh'),
          el('span', { class: 'dmt' }, c.verified + ' verified'),
          c.gaps ? el('span', { class: 'dmt', style: { color: 'var(--seam)', background: 'var(--seam-bg)', boxShadow: 'inset 0 0 0 1px var(--seam-line)' } }, c.gaps + (c.gaps === 1 ? ' gap' : ' gaps')) : el('span', { class: 'dmt' }, 'no gaps'))),
      el('div', { class: 'dr-why' },
        el('div', { class: 'dr-wl' }, icon('spark', 10), 'Why surfaced'),
        el('div', { class: 'dr-wt' }, w.t),
        el('div', { class: 'dr-wd' }, w.d)));
  }

  function facetOpt(group, val, label, count, dotColor) {
    return el('button', {
      class: 'fopt' + (String(F[group]) === val ? ' on' : ''),
      data: { facet: group + '::' + val },
      onclick: () => { F[group] = (F[group] === val ? (group === 'specialty' || group === 'bucket' || group === 'mobility' || group === 'trust' ? 'all' : val) : val); rerender(); },
    },
      el('span', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
        dotColor ? el('span', { class: 'fdot', style: { background: dotColor } }) : null, label),
      count != null ? el('span', { class: 'fct' }, String(count)) : null);
  }

  window.renderRecDiscovery = function () {
    styleOnce();
    window.RECCARDS.styleOnce();
    const D = window.REC, C = window.RECCARDS;
    const v = el('div', { class: 'view' });
    const cand = D.candidates;
    const cnt = (pred) => cand.filter(pred).length;

    v.appendChild(el('div', { class: 'pagehead' },
      el('div', null,
        el('div', { class: 'lead' }, icon('discovery', 12), 'Talent Discovery · search the network'),
        el('h1', null, 'Search clinicians by ', el('em', null, 'evidence, trust and mobility.')),
        el('div', { class: 'sub' }, 'Not a keyword résumé search — every result is ranked on what the clinician can prove and shows you exactly why it surfaced.')),
      el('div', { class: 'ra' }, chip('verified', 'evidence-ranked'))));

    // ── facet rail ──
    const bucketColor = (b) => C.ringColor(b);
    const facets = el('div', { class: 'facets' },
      el('div', { class: 'fgroup' },
        el('div', { class: 'fglab' }, icon('readiness', 11), 'Readiness'),
        el('div', { class: 'fopts' },
          facetOpt('bucket', 'all', 'All clinicians', cand.length),
          facetOpt('bucket', 'ready', 'Ready', cnt(c => c.bucket === 'ready'), bucketColor('ready')),
          facetOpt('bucket', 'near', 'Near ready', cnt(c => c.bucket === 'near'), bucketColor('near')),
          facetOpt('bucket', 'missing', 'Missing evidence', cnt(c => c.bucket === 'missing'), bucketColor('missing')),
          facetOpt('bucket', 'blocked', 'Blocked', cnt(c => c.bucket === 'blocked'), bucketColor('blocked')))),
      el('div', { class: 'fgroup' },
        el('div', { class: 'fglab' }, icon('shield', 11), 'Min trust tier'),
        el('div', { class: 'fchips' },
          ['all', 'T2', 'T3', 'T4'].map(t => el('button', {
            class: 'fchip' + (F.trust === t ? ' on' : ''), data: { facet: 'trust::' + t },
            onclick: () => { F.trust = t; rerender(); },
          }, t === 'all' ? 'Any' : t + '+')))),
      el('div', { class: 'fgroup' },
        el('div', { class: 'fglab' }, icon('mobility', 11), 'Mobility'),
        el('div', { class: 'fopts' },
          facetOpt('mobility', 'all', 'Any status', cand.length),
          facetOpt('mobility', 'open', 'Open to move', cnt(c => c.mobility.status === 'open'), 'var(--keep)'),
          facetOpt('mobility', 'passive', 'Passive', cnt(c => c.mobility.status === 'passive'), 'var(--seam)'),
          facetOpt('mobility', 'closed', 'Closed', cnt(c => c.mobility.status === 'closed'), 'var(--s400)'))),
      el('div', { class: 'fgroup' },
        el('div', { class: 'fglab' }, icon('wallet', 11), 'Evidence freshness'),
        el('div', { class: 'freshrow' },
          el('input', { type: 'range', min: '0', max: '95', step: '5', value: String(F.fresh),
            oninput: (e) => { F.fresh = +e.target.value; document.getElementById('freshval').textContent = F.fresh + '%'; rerender(); } }),
          el('span', { class: 'fv', id: 'freshval' }, F.fresh + '%'))),
      el('div', { class: 'fgroup' },
        el('div', { class: 'fglab' }, icon('target', 11), 'Specialty'),
        el('div', { class: 'fopts' },
          SPECIALTIES.filter(s => s === 'all' || cnt(c => c.specialty === s) > 0).map(s =>
            facetOpt('specialty', s, s === 'all' ? 'All specialties' : s, s === 'all' ? cand.length : cnt(c => c.specialty === s))))));

    // ── main column ──
    const searchInput = el('input', { type: 'text', placeholder: 'Search name, specialty, signal…', value: F.q, spellcheck: 'false',
      oninput: (e) => { F.q = e.target.value; rerender(); } });
    const main = el('div', { class: 'discmain' },
      el('div', { class: 'discbar' },
        el('div', { class: 'dsearch' }, icon('search', 17), searchInput),
        el('div', { class: 'dsort' }, icon('sort', 14),
          el('select', { onchange: (e) => { F.sort = e.target.value; rerender(); } },
            opt('readiness', 'Readiness', F.sort), opt('trust', 'Trust tier', F.sort),
            opt('fresh', 'Evidence freshness', F.sort), opt('name', 'Name', F.sort)))),
      el('div', { class: 'disccount', id: 'disc-count' }),
      el('div', { id: 'disc-results', style: { display: 'flex', flexDirection: 'column', gap: '11px' } }));

    v.appendChild(el('div', { class: 'disc' }, facets, main));
    // initial fill (deferred so #disc-results exists in DOM tree)
    setTimeout(rerender, 0);
    return v;
  };

  function opt(val, label, cur) {
    return el('option', { value: val, selected: cur === val ? 'selected' : null }, label);
  }
})();
