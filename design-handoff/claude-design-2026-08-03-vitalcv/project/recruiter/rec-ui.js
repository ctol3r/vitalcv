/* ══════════════════════════════════════════════════════════════════════════
   rec-ui.js — shared DOM helpers + status vocabulary for Recruiter OS (W310)
   Inherits the W300 ecosystem visual grammar (keep / seam / cut / blue).
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
    ready:        { label: 'Ready',         cls: 'st-keep' },
    verified:     { label: 'Verified',      cls: 'st-keep' },
    sealed:       { label: 'Sealed',        cls: 'st-keep' },
    active:       { label: 'Active',        cls: 'st-keep' },
    replied:      { label: 'Replied',       cls: 'st-keep' },
    near:         { label: 'Near ready',    cls: 'st-seam' },
    pending:      { label: 'Pending',       cls: 'st-seam' },
    gap:          { label: 'Gap',           cls: 'st-seam' },
    sent:         { label: 'Awaiting',      cls: 'st-seam' },
    missing:      { label: 'Missing evidence', cls: 'st-blue' },
    access:       { label: 'Needs access',  cls: 'st-blue' },
    scheduled:    { label: 'Scheduled',     cls: 'st-blue' },
    blocked:      { label: 'Blocked',       cls: 'st-cut' },
    contradicted: { label: 'Contradicted',  cls: 'st-cut' },
    flag:         { label: 'Flag',          cls: 'st-cut' },
  };

  const BUCKET = {
    ready:   { label: 'Ready',          cls: 'st-keep', tone: 'keep',  hint: 'Call now' },
    near:    { label: 'Near ready',     cls: 'st-seam', tone: 'seam',  hint: 'One gap to close' },
    blocked: { label: 'Blocked',        cls: 'st-cut',  tone: 'cut',   hint: 'Do not advance' },
    missing: { label: 'Missing evidence', cls: 'st-blue', tone: 'blue', hint: 'Needs access' },
  };

  function tierChip(tier) {
    if (!tier) return null;
    return el('span', { class: 'tier tier-' + tier.toLowerCase() }, tier);
  }

  function chip(state, textOverride) {
    const s = STATE[state] || { label: state, cls: 'st-ghost' };
    return el('span', { class: 'chip ' + s.cls }, el('span', { class: 'cd' }), textOverride || s.label);
  }

  // SVG icon set (stroke, currentColor)
  const ICON = {
    home:    'M3 11l9-8 9 8M5 10v10h14V10',
    discovery:'M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-4-4',
    search:  'M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-4-4',
    readiness:'M4 17l6-6 4 4 6-7M4 21h16',
    review:  'M5 4h11l4 4v12H5zM15 4v5h5M8 13h8M8 17h5',
    workspace:'M4 5h16v14H4zM4 9h16M9 9v10',
    mobility:'M4 17l6-6 4 4 6-7M4 21h16',
    wallet:  'M3 6h18v13H3zM3 10h18',
    org:     'M6 7a2.5 2.5 0 100-.01M18 7a2.5 2.5 0 100-.01M12 17a2.5 2.5 0 100-.01M8 8l3 7M16 8l-3 7',
    shield:  'M12 3l7 3v6c0 5-3 7-7 9-4-2-7-4-7-9V6z',
    arrow:   'M9 6l6 6-6 6',
    arrowl:  'M15 6l-6 6 6 6',
    check:   'M5 12l4 4 9-10',
    person:  'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0',
    people:  'M9 11a3.2 3.2 0 100-6.4A3.2 3.2 0 009 11zM2 20a7 7 0 0114 0M17 11a3 3 0 000-6M22 20a6.5 6.5 0 00-5-6.3',
    bolt:    'M13 3L4 14h6l-1 7 9-11h-6l1-7z',
    phone:   'M5 4h3l2 5-2 1a11 11 0 005 5l1-2 5 2v3a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z',
    message: 'M4 5h16v11H8l-4 4z',
    calendar:'M4 7h16v13H4zM4 11h16M8 3v4M16 3v4',
    clock:   'M12 7v5l3 2M12 21a9 9 0 100-18 9 9 0 000 18z',
    pin:     'M12 21s7-6.3 7-11a7 7 0 10-14 0c0 4.7 7 11 7 11zM12 12a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
    filter:  'M3 5h18l-7 8v6l-4 2v-8z',
    sort:    'M7 4v16M7 20l-3-3M7 4l3 3M17 20V4M17 4l-3 3M17 4l3 3',
    target:  'M12 21a9 9 0 100-18 9 9 0 000 18zM12 16a4 4 0 100-8 4 4 0 000 8zM12 12.5a.5.5 0 100-1 .5.5 0 000 1z',
    spark:   'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18',
    plus:    'M12 5v14M5 12h14',
    star:    'M12 3l2.6 5.6L20.5 9l-4.5 4 1.2 6.2L12 16.4 6.8 19.2 8 13 3.5 9l5.9-.4z',
    flag:    'M5 21V4M5 4h12l-2 4 2 4H5',
    inbox:   'M4 13h4l2 3h4l2-3h4M4 13l2-8h12l2 8v6H4z',
    feed:    'M4 6h16M4 12h16M4 18h10',
    export:  'M12 3v12M7 11l5 4 5-4M5 21h14',
    eye:     'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z',
    grid:    'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
    dollar:  'M12 3v18M16 7a4 4 0 00-4-2c-2 0-4 1-4 3s2 3 4 3 4 1 4 3-2 3-4 3a4 4 0 01-4-2',
    layers:  'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5',
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
      clinician:    { label: 'Clinicians',    icon: 'person' },
      evidence:     { label: 'Evidence',      icon: 'wallet' },
      trust:        { label: 'Trust',         icon: 'shield' },
      mobility:     { label: 'Mobility',      icon: 'mobility' },
      opportunity:  { label: 'Opportunities', icon: 'target' },
    })[type] || { label: type, icon: 'home' };
  }

  function initials(name) {
    return name.replace(/[^A-Za-z ]/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  }

  // deterministic avatar tint per id
  function tint(seed) {
    const palette = ['#0f172a', '#334155', '#1e293b', '#475569', '#0e7490', '#4338ca', '#3730a3', '#155e63'];
    let h = 0; for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    return palette[h % palette.length];
  }

  window.UI = { el, chip, tierChip, icon, ICON, STATE, BUCKET, typeMeta, initials, tint };
})();
