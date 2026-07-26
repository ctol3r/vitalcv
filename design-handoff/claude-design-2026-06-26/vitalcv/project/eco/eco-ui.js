/* ══════════════════════════════════════════════════════════════════════════
   eco-ui.js — shared DOM helpers + status vocabulary for W300 surfaces
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  // tiny hyperscript
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

  // status → visual token
  const STATE = {
    verified:     { label: 'Verified',     cls: 'st-keep' },
    sealed:       { label: 'Sealed',       cls: 'st-keep' },
    active:       { label: 'Active',       cls: 'st-keep' },
    done:         { label: 'On file',      cls: 'st-keep' },
    ready:        { label: 'Ready',        cls: 'st-keep' },
    pending:      { label: 'Pending',      cls: 'st-seam' },
    gap:          { label: 'Gap',          cls: 'st-seam' },
    open:         { label: 'Open',         cls: 'st-seam' },
    access:       { label: 'Needs access', cls: 'st-blue' },
    contradicted: { label: 'Contradicted', cls: 'st-cut' },
  };

  // tier chip
  function tierChip(tier) {
    if (!tier) return null;
    return el('span', { class: 'tier tier-' + tier.toLowerCase() }, tier);
  }

  function chip(state, textOverride) {
    const s = STATE[state] || { label: state, cls: 'st-ghost' };
    return el('span', { class: 'chip ' + s.cls },
      el('span', { class: 'cd' }),
      textOverride || s.label
    );
  }

  // SVG icon set (stroke, currentColor)
  const ICON = {
    home:    'M3 11l9-8 9 8M5 10v10h14V10',
    wallet:  'M3 6h18v13H3zM3 10h18',
    mobility:'M4 17l6-6 4 4 6-7M4 21h16',
    org:     'M6 7a2.5 2.5 0 100-.01M18 7a2.5 2.5 0 100-.01M12 17a2.5 2.5 0 100-.01M8 8l3 7M16 8l-3 7',
    search:  'M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-4-4',
    map:     'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14',
    feed:    'M4 6h16M4 12h16M4 18h10',
    network: 'M12 3a3 3 0 100 6 3 3 0 000-6zM5 21a3 3 0 100-6 3 3 0 000 6zM19 21a3 3 0 100-6 3 3 0 000 6zM12 9v3M9.5 18l-3-3M14.5 18l3-3',
    arrow:   'M9 6l6 6-6 6',
    shield:  'M12 3l7 3v6c0 5-3 7-7 9-4-2-7-4-7-9V6z',
    export:  'M12 3v12M7 11l5 4 5-4M5 21h14',
    check:   'M5 12l4 4 9-10',
    person:  'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0',
    bolt:    'M13 3L4 14h6l-1 7 9-11h-6l1-7z',
    calendar:'M4 7h16v13H4zM4 11h16M8 3v4M16 3v4',
    spark:   'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18',
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
    p.setAttribute('d', ICON[name] || ICON.home);
    svg.appendChild(p);
    return svg;
  }

  function typeMeta(type) {
    return ({
      evidence:     { label: 'Evidence',     icon: 'wallet' },
      organization: { label: 'Organization', icon: 'org' },
      opportunity:  { label: 'Opportunity',  icon: 'search' },
      person:       { label: 'Person',       icon: 'person' },
      event:        { label: 'Career event', icon: 'calendar' },
      trust:        { label: 'Trust',        icon: 'shield' },
      mobility:     { label: 'Mobility',     icon: 'mobility' },
    })[type] || { label: type, icon: 'home' };
  }

  window.UI = { el, chip, tierChip, icon, ICON, STATE, typeMeta };
})();
