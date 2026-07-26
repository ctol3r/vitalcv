/* ══════════════════════════════════════════════════════════════════════════
   eco-search.js — D5 · Unified ecosystem search
   Search across Evidence · Organizations · Opportunities · People · Career events
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  const { el, icon, typeMeta } = window.UI;

  const SCOPES = [
    { id: 'all',          label: 'Everything' },
    { id: 'evidence',     label: 'Evidence' },
    { id: 'organization', label: 'Organizations' },
    { id: 'opportunity',  label: 'Opportunities' },
    { id: 'person',       label: 'People' },
    { id: 'event',        label: 'Career events' },
  ];

  let state = { q: '', scope: 'all', cursor: 0, results: [] };

  function search(q, scope) {
    const idx = window.ECO.searchIndex;
    let pool = scope === 'all' ? idx : idx.filter(r => r.type === scope);
    if (!q.trim()) return pool;
    const t = q.toLowerCase();
    return pool
      .map(r => {
        const hay = (r.title + ' ' + r.sub + ' ' + r.type).toLowerCase();
        let score = 0;
        if (r.title.toLowerCase().startsWith(t)) score += 5;
        if (r.title.toLowerCase().includes(t)) score += 3;
        if (hay.includes(t)) score += 1;
        return { r, score };
      })
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(x => x.r);
  }

  function counts() {
    const idx = window.ECO.searchIndex;
    const c = {};
    SCOPES.forEach(s => { c[s.id] = s.id === 'all' ? idx.length : idx.filter(r => r.type === s.id).length; });
    return c;
  }

  function render() {
    const root = document.getElementById('searchRoot');
    root.innerHTML = '';
    const c = counts();
    state.results = search(state.q, state.scope);
    state.cursor = Math.max(0, Math.min(state.cursor, state.results.length - 1));

    const input = el('input', {
      type: 'text', placeholder: 'Search evidence, orgs, roles, people, career events…',
      value: state.q, spellcheck: 'false',
    });
    input.addEventListener('input', () => { state.q = input.value; state.cursor = 0; render(); input.focus(); });

    const scopes = el('div', { class: 'searchscopes' },
      SCOPES.map(s => el('button', {
        class: 'scope' + (state.scope === s.id ? ' on' : ''),
        onclick: () => { state.scope = s.id; state.cursor = 0; render(); document.querySelector('.searchpanel input').focus(); },
      }, s.label, el('span', { class: 'ct' }, String(c[s.id]))))
    );

    // group results by type when scope=all
    const list = el('div', { class: 'sresults' });
    if (state.results.length === 0) {
      list.appendChild(el('div', { class: 'sempty' }, state.q ? `No matches for “${state.q}”.` : 'Type to search the ecosystem.'));
    } else {
      const order = ['evidence', 'organization', 'opportunity', 'person', 'event'];
      let flatIdx = 0;
      const groups = state.scope === 'all'
        ? order.filter(t => state.results.some(r => r.type === t))
        : [state.scope];
      groups.forEach(t => {
        const rows = state.results.filter(r => r.type === t);
        if (!rows.length) return;
        list.appendChild(el('div', { class: 'sgroup' }, typeMeta(t).label + ' · ' + rows.length));
        rows.forEach(r => {
          const myIdx = flatIdx++;
          const row = el('div', {
            class: 'sresult' + (myIdx === state.cursor ? ' cursor' : ''),
            onclick: () => go(r),
            onmouseenter: () => { state.cursor = myIdx; updateCursor(); },
          },
            el('div', { class: 'sic' }, icon(typeMeta(r.type).icon, 16)),
            el('div', { class: 'stx' },
              el('div', { class: 'a' }, r.title),
              el('div', { class: 'b' }, r.sub)),
            el('div', { class: 'styp' }, typeMeta(r.type).label)
          );
          list.appendChild(row);
        });
      });
    }

    const panel = el('div', { class: 'searchpanel', onclick: (e) => e.stopPropagation() },
      el('div', { class: 'shead' },
        icon('search', 19),
        input,
        el('span', { class: 'esc' }, 'ESC')),
      scopes,
      list,
      el('div', { class: 'sfoot' },
        el('span', null, el('b', null, '↑↓'), ' navigate'),
        el('span', null, el('b', null, '↵'), ' open'),
        el('span', null, el('b', null, String(state.results.length)), ' results'),
        el('span', { style: { marginLeft: 'auto' } }, 'unified index · 5 entity types'))
    );

    const scrim = el('div', { class: 'scrim', onclick: close }, panel);
    root.appendChild(scrim);
    setTimeout(() => input.focus(), 10);
  }

  function updateCursor() {
    const rows = document.querySelectorAll('.sresult');
    rows.forEach((r, i) => r.classList.toggle('cursor', i === state.cursor));
  }

  function go(r) { close(); if (r.route) window.location.hash = r.route; }

  function onKey(e) {
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); state.cursor = Math.min(state.cursor + 1, state.results.length - 1); updateCursor(); scrollCursor(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); state.cursor = Math.max(state.cursor - 1, 0); updateCursor(); scrollCursor(); }
    if (e.key === 'Enter') { e.preventDefault(); if (state.results[state.cursor]) go(state.results[state.cursor]); }
  }

  function scrollCursor() {
    const c = document.querySelector('.sresult.cursor');
    const box = document.querySelector('.sresults');
    if (!c || !box) return;
    const ct = c.offsetTop, cb = ct + c.offsetHeight;
    if (ct < box.scrollTop) box.scrollTop = ct - 8;
    else if (cb > box.scrollTop + box.clientHeight) box.scrollTop = cb - box.clientHeight + 8;
  }

  function open() {
    state = { q: '', scope: 'all', cursor: 0, results: [] };
    render();
    document.addEventListener('keydown', onKey);
  }
  function close() {
    document.getElementById('searchRoot').innerHTML = '';
    document.removeEventListener('keydown', onKey);
  }

  window.openSearch = open;
})();
