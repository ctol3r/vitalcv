/* ══════════════════════════════════════════════════════════════════════════
   ci-ui.js — shared DOM helpers + status vocabulary for Career Intelligence (W320)
   Inherits the W310 Recruiter OS visual grammar (keep / seam / cut / blue) so the
   clinician-facing engine and the recruiter-facing OS read as one system.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  function el(tag, attrs, ...kids) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class') node.className = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'style' && typeof v === 'object') { for (const p in v) { if (p.startsWith('--')) node.style.setProperty(p, v[p]); else node.style[p] = v[p]; } }
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

  // tone → visual token (matches the four-state credential grammar)
  const TONE = {
    good:  'st-keep',   // verified / cleared / on track
    watch: 'st-seam',   // approaching / soft
    gate:  'st-blue',   // needs access / institutional
    risk:  'st-cut',    // adverse / blocked
    ghost: 'st-ghost',
  };

  function chip(tone, text) {
    return el('span', { class: 'chip ' + (TONE[tone] || 'st-ghost') }, el('span', { class: 'cd' }), text);
  }

  function tierChip(tier) {
    if (!tier) return null;
    return el('span', { class: 'tier tier-' + tier.toLowerCase() }, tier);
  }

  function delta(n, opts) {
    opts = opts || {};
    const dir = n > 0 ? 'up' : n < 0 ? 'dn' : 'flat';
    const sym = n > 0 ? '▲' : n < 0 ? '▼' : '—';
    const txt = (n > 0 ? '+' : '') + n + (opts.suffix || '');
    return el('span', { class: 'delta ' + dir }, el('span', { style: { fontSize: '7px' } }, sym), txt);
  }

  // SVG icon set (stroke, currentColor)
  const ICON = {
    sun:     'M12 17a5 5 0 100-10 5 5 0 000 10zM12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19',
    spark:   'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18',
    target:  'M12 21a9 9 0 100-18 9 9 0 000 18zM12 16a4 4 0 100-8 4 4 0 000 8zM12 12.5a.5.5 0 100-1 .5.5 0 000 1z',
    flag:    'M5 21V4M5 4h12l-2 4 2 4H5',
    bell:    'M6 10a6 6 0 1112 0c0 5 2 6 2 6H4s2-1 2-6zM10 20a2 2 0 004 0',
    home:    'M3 11l9-8 9 8M5 10v10h14V10',
    shield:  'M12 3l7 3v6c0 5-3 7-7 9-4-2-7-4-7-9V6z',
    wallet:  'M3 6h18v13H3zM3 10h18',
    mobility:'M4 17l6-6 4 4 6-7M4 21h16',
    check:   'M5 12l4 4 9-10',
    arrow:   'M9 6l6 6-6 6',
    arrowl:  'M15 6l-6 6 6 6',
    arrowup: 'M12 19V5M6 11l6-6 6 6',
    clock:   'M12 7v5l3 2M12 21a9 9 0 100-18 9 9 0 000 18z',
    lock:    'M6 11h12v9H6zM8 11V8a4 4 0 018 0v3',
    stamp:   'M9 13h6l1 4H8zM12 4a3 3 0 013 3c0 2-2 3-2 5h-2c0-2-2-3-2-5a3 3 0 013-3zM6 20h12',
    micro:   'M9 3h3l1 9-2 2-2-2zM6 21l4-5M14 13l4 8M3 21h6',
    badge:   'M12 3l2.4 2.1 3.1-.6.9 3 2.4 2-1.7 2.7 1.7 2.7-2.4 2-.9 3-3.1-.6L12 21l-2.4-2.1-3.1.6-.9-3-2.4-2 1.7-2.7L2.8 9.6l2.4-2 .9-3 3.1.6z',
    pin:     'M12 21s7-6.3 7-11a7 7 0 10-14 0c0 4.7 7 11 7 11zM12 12a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
    org:     'M6 7a2.5 2.5 0 100-.01M18 7a2.5 2.5 0 100-.01M12 17a2.5 2.5 0 100-.01M8 8l3 7M16 8l-3 7',
    book:    'M5 4h11l4 4v12H5zM15 4v5h5M8 13h8M8 17h5',
    brief:   'M4 7h16v13H4zM9 7V5a2 2 0 012-2h2a2 2 0 012 2v2M4 12h16',
    users:   'M9 11a3.2 3.2 0 100-6.4A3.2 3.2 0 009 11zM2 20a7 7 0 0114 0M17 11a3 3 0 000-6M22 20a6.5 6.5 0 00-5-6.3',
    grad:    'M12 4l10 5-10 5L2 9zM6 11v5c0 1 3 3 6 3s6-2 6-3v-5',
    rise:    'M4 17l6-6 4 4 6-7M4 21h16',
    gauge:   'M12 14l5-5M21 14a9 9 0 10-18 0',
    plus:    'M12 5v14M5 12h14',
    dot:     'M12 12a1 1 0 100-2 1 1 0 000 2z',
    eye:     'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z',
    feed:    'M4 6h16M4 12h16M4 18h10',
    bolt:    'M13 3L4 14h6l-1 7 9-11h-6l1-7z',
    refresh: 'M4 12a8 8 0 0113-6l3 2M20 12a8 8 0 01-13 6l-3-2M17 4v4h-4M7 20v-4h4',
    link:    'M9 15l6-6M10 7l1-1a4 4 0 016 6l-1 1M14 17l-1 1a4 4 0 01-6-6l1-1',
    star:    'M12 3l2.6 5.6L20.5 9l-4.5 4 1.2 6.2L12 16.4 6.8 19.2 8 13 3.5 9l5.9-.4z',
    alert:   'M12 3l9 16H3zM12 10v4M12 17v.5',
  };

  function icon(name, size) {
    size = size || 16;
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', size); svg.setAttribute('height', size);
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.9');
    svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
    const p = document.createElementNS(ns, 'path');
    p.setAttribute('d', ICON[name] || ICON.dot);
    svg.appendChild(p);
    return svg;
  }

  window.UI = { el, chip, tierChip, delta, icon, ICON, TONE };
})();
