/* ══════════════════════════════════════════════════════════════════════════
   plat-ui.js — shared DOM helpers + status vocabulary for the W330 platform
   The developer-facing surface of VitalCV. Same chrome, same trust grammar.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  // tiny hyperscript ────────────────────────────────────────────────────────
  function el(tag, attrs, ...kids) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class') node.className = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
        else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'data' && typeof v === 'object') { for (const d in v) node.dataset[d] = v[d]; }
        else node.setAttribute(k, v);
      }
    }
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      node.appendChild(typeof kid === 'string' || typeof kid === 'number' ? document.createTextNode(String(kid)) : kid);
    }
    return node;
  }

  // status → visual token ─────────────────────────────────────────────────
  const STATE = {
    verified:   { label: 'Verified',   cls: 'st-keep' },
    active:     { label: 'Active',     cls: 'st-keep' },
    live:       { label: 'Live',       cls: 'st-keep' },
    healthy:    { label: 'Healthy',    cls: 'st-keep' },
    stable:     { label: 'Stable',     cls: 'st-keep' },
    ga:         { label: 'GA',         cls: 'st-keep' },
    installed:  { label: 'Installed',  cls: 'st-keep' },
    enabled:    { label: 'Enabled',    cls: 'st-keep' },
    delivered:  { label: 'Delivered',  cls: 'st-keep' },
    pending:    { label: 'Pending',    cls: 'st-seam' },
    degraded:   { label: 'Degraded',   cls: 'st-seam' },
    beta:       { label: 'Beta',       cls: 'st-seam' },
    review:     { label: 'In review',  cls: 'st-seam' },
    retrying:   { label: 'Retrying',   cls: 'st-seam' },
    test:       { label: 'Test mode',  cls: 'st-seam' },
    failed:     { label: 'Failed',     cls: 'st-cut' },
    revoked:    { label: 'Revoked',    cls: 'st-cut' },
    expired:    { label: 'Expired',    cls: 'st-cut' },
    paused:     { label: 'Paused',     cls: 'st-cut' },
    sandbox:    { label: 'Sandbox',    cls: 'st-blue' },
    preview:    { label: 'Preview',    cls: 'st-blue' },
    soon:       { label: 'Coming soon',cls: 'st-blue' },
    draft:      { label: 'Draft',      cls: 'st-ghost' },
    inactive:   { label: 'Inactive',   cls: 'st-ghost' },
  };

  function chip(state, textOverride) {
    const s = STATE[state] || { label: state, cls: 'st-ghost' };
    return el('span', { class: 'chip ' + s.cls }, el('span', { class: 'cd' }), textOverride || s.label);
  }

  function tierChip(tier) {
    if (!tier) return null;
    return el('span', { class: 'tier tier-' + tier.toLowerCase() }, tier);
  }

  // HTTP method pill
  function method(m) {
    return el('span', { class: 'verb verb-' + m.toLowerCase() }, m.toUpperCase());
  }

  // SVG icon set (stroke, currentColor) ─────────────────────────────────────
  const ICON = {
    home:     'M3 11l9-8 9 8M5 10v10h14V10',
    code:     'M9 7l-5 5 5 5M15 7l5 5-5 5',
    terminal: 'M5 5h14v14H5zM8 10l3 2-3 2M13 14h4',
    book:     'M4 5a2 2 0 012-2h12v16H6a2 2 0 00-2 2zM4 5v14',
    key:      'M14 7a4 4 0 11-3.5 6L4 19v-3h3v-3h3l.5-.5A4 4 0 0114 7zM15.5 8.5h.01',
    webhook:  'M12 7a3 3 0 10-3 3l-3 5M14 13a3 3 0 11-1 5l-6 0M9 7l3 6 5-1a3 3 0 113 2',
    plug:     'M9 3v5M15 3v5M7 8h10v3a5 5 0 01-10 0zM12 16v5',
    box:      'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10',
    layers:   'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5',
    badge:    'M12 3l2.4 2.1 3.1-.4.9 3 2.6 1.8-1.4 2.8 1.4 2.8-2.6 1.8-.9 3-3.1-.4L12 21l-2.4-2.1-3.1.4-.9-3L3 13.5l1.4-2.8L3 7.9l2.6-1.8.9-3 3.1.4z',
    gauge:    'M12 13l4-4M4.5 18a9 9 0 1115 0',
    org:      'M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5M9 11h.01M15 11h.01',
    person:   'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0',
    shield:   'M12 3l7 3v6c0 5-3 7-7 9-4-2-7-4-7-9V6z',
    check:    'M5 12l4 4 9-10',
    copy:     'M9 9h11v11H9zM5 15H4V4h11v1',
    plus:     'M12 5v14M5 12h14',
    refresh:  'M4 9a8 8 0 0114-3l2 2M20 15a8 8 0 01-14 3l-2-2M18 4v4h-4M6 20v-4h4',
    trash:    'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
    arrow:    'M9 6l6 6-6 6',
    arrowr:   'M5 12h14M13 6l6 6-6 6',
    external: 'M14 4h6v6M20 4l-9 9M19 13v6H5V5h6',
    lock:     'M6 11h12v9H6zM9 11V8a3 3 0 016 0v3',
    play:     'M7 5l11 7-11 7z',
    bolt:     'M13 3L4 14h6l-1 7 9-11h-6l1-7z',
    search:   'M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-4-4',
    filter:   'M4 5h16l-6 8v5l-4 2v-7z',
    dot:      'M12 12h.01',
    clock:    'M12 4a8 8 0 100 16 8 8 0 000-16zM12 8v4l3 2',
    eye:      'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7zM12 9a3 3 0 100 6 3 3 0 000-6z',
    eyeoff:   'M3 3l18 18M10.5 10.6a3 3 0 004 4M6.5 6.6C3.8 8.2 2 12 2 12s4 7 10 7c2 0 3.7-.6 5.2-1.5M9.5 5.2A9 9 0 0112 5c6 0 10 7 10 7a18 18 0 01-2.2 3',
    cube:     'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10',
    grid:     'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
    sliders:  'M4 6h10M18 6h2M4 12h2M10 12h10M4 18h12M18 18h2M14 4v4M6 10v4M16 16v4',
    wallet:   'M3 6h18v13H3zM3 10h18M16 14h2',
    spark:    'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18',
    link:     'M9 15l6-6M10 6l1-1a4 4 0 016 6l-1 1M14 18l-1 1a4 4 0 01-6-6l1-1',
    send:     'M4 12l16-7-7 16-2-7z',
    store:    'M4 9l1-5h14l1 5M4 9h16v11H4zM4 9a3 3 0 006 0 3 3 0 006 0 3 3 0 006 0',
    flag:     'M5 21V4h11l-1.5 3.5L16 11H5',
    git:      'M6 3v12a3 3 0 003 3h6M6 6a3 3 0 100-.01M18 18a3 3 0 100-.01M15 6a3 3 0 100-.01',
  };

  function icon(name, size) {
    size = size || 16;
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', size); svg.setAttribute('height', size);
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.8');
    svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', ICON[name] || ICON.home);
    svg.appendChild(p);
    return svg;
  }

  // page header helper ───────────────────────────────────────────────────
  function pagehead(opts) {
    return el('div', { class: 'pagehead' },
      el('div', null,
        el('div', { class: 'lead' }, opts.leadIcon ? icon(opts.leadIcon, 12) : null, opts.lead),
        el('h1', null, opts.title, opts.titleEm ? el('em', null, ' ' + opts.titleEm) : null),
        opts.sub ? el('div', { class: 'sub' }, opts.sub) : null),
      opts.right ? el('div', { class: 'ra' }, opts.right) : null);
  }

  // copy-to-clipboard button with feedback ─────────────────────────────────
  function copyBtn(getText, opts) {
    opts = opts || {};
    const b = el('button', { class: 'copybtn ' + (opts.cls || ''), title: 'Copy' },
      icon('copy', opts.size || 13), opts.label ? el('span', { class: 'cl' }, opts.label) : null);
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      const txt = typeof getText === 'function' ? getText() : getText;
      try { navigator.clipboard && navigator.clipboard.writeText(txt); } catch (_) {}
      const lbl = b.querySelector('.cl');
      b.classList.add('ok');
      const prev = lbl ? lbl.textContent : null;
      if (lbl) lbl.textContent = 'Copied';
      const sv = b.querySelector('svg');
      if (sv) sv.replaceWith(icon('check', opts.size || 13));
      setTimeout(() => {
        b.classList.remove('ok');
        if (lbl) lbl.textContent = prev;
        const s2 = b.querySelector('svg');
        if (s2) s2.replaceWith(icon('copy', opts.size || 13));
      }, 1400);
    });
    return b;
  }

  // small toast ─────────────────────────────────────────────────────────────
  function toast(msg, tone) {
    let root = document.getElementById('toastRoot');
    if (!root) { root = el('div', { id: 'toastRoot', class: 'toastroot' }); document.body.appendChild(root); }
    const t = el('div', { class: 'toast ' + (tone ? 'tn-' + tone : '') },
      icon(tone === 'cut' ? 'shield' : 'check', 14), el('span', null, msg));
    root.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(6px)'; }, 2600);
    setTimeout(() => t.remove(), 3000);
  }

  // syntax-highlight a small JSON string into spans ─────────────────────────
  function jsonHL(obj) {
    const str = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2);
    const esc = str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const html = esc.replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+\-]?\d+)?)/g,
      (m) => {
        let c = 'jn';
        if (/^"/.test(m)) c = /:$/.test(m) ? 'jk' : 'js';
        else if (/true|false/.test(m)) c = 'jb';
        else if (/null/.test(m)) c = 'jnull';
        return '<span class="' + c + '">' + m + '</span>';
      });
    return html;
  }

  window.UI = { el, chip, tierChip, method, icon, ICON, STATE, pagehead, copyBtn, toast, jsonHL };
})();
