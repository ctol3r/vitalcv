/* ══════════════════════════════════════════════════════════════════════════
   eco-map.js — D2 · Career Map (/career-map)
   Interactive radial graph: Clinician ↔ Evidence ↔ Trust ↔ Timeline ↔
   Organization ↔ Opportunity. Click any node to trace its connections.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  const { el, icon, chip, tierChip } = window.UI;
  const SVGNS = 'http://www.w3.org/2000/svg';

  function s(tag, attrs, ...kids) {
    const n = document.createElementNS(SVGNS, tag);
    if (attrs) for (const k in attrs) { if (attrs[k] != null) n.setAttribute(k, attrs[k]); }
    kids.flat().forEach(c => c && n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
    return n;
  }

  function styleOnce() {
    if (document.getElementById('map-css')) return;
    const css = `
    .maplayout{display:grid;grid-template-columns:1fr 330px;gap:14px;align-items:start}
    .mapcanvas{position:relative;padding:8px;overflow:hidden;background:
      radial-gradient(circle at 50% 46%, #fff 0%, var(--s50) 78%)}
    .mapcanvas svg{display:block;width:100%;height:auto;font-family:'Geist',sans-serif}
    .mapcanvas svg text{user-select:none}
    .node{cursor:pointer}
    .node .hit{fill:transparent}
    .edge{stroke:var(--s300);fill:none;transition:stroke .18s,stroke-width .18s,opacity .18s}
    .edge.hl{stroke:var(--s900);stroke-width:2}
    .pill-bg{transition:fill .15s,stroke .15s,opacity .15s}
    .node.dim{opacity:.26}
    .edge.dim{opacity:.12}
    .node text{transition:fill .15s}
    .maplegend{position:absolute;left:14px;bottom:12px;display:flex;gap:13px;flex-wrap:wrap;font-family:'Geist Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:var(--s500)}
    .maplegend span{display:inline-flex;align-items:center;gap:5px}
    .maplegend i{width:9px;height:9px;border-radius:3px;display:inline-block}
    .maphint{position:absolute;right:14px;top:12px;font-family:'Geist Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:var(--s400);background:rgba(255,255,255,.8);border:1px solid var(--s200);border-radius:6px;padding:4px 8px}

    .mappanel{padding:0;overflow:hidden;position:sticky;top:104px}
    .mp-head{padding:16px 16px 14px;border-bottom:1px solid var(--s200);background:var(--s50)}
    .mp-kind{font-family:'Geist Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:.14em;color:var(--s400);font-weight:600;display:flex;align-items:center;gap:7px}
    .mp-title{font-size:18px;font-weight:600;letter-spacing:-.02em;margin-top:7px;line-height:1.1}
    .mp-sub{font-size:12px;color:var(--s500);margin-top:4px}
    .mp-body{padding:15px 16px;display:flex;flex-direction:column;gap:13px}
    .mp-stat{display:flex;align-items:center;justify-content:space-between;font-size:12.5px;color:var(--s600)}
    .mp-stat b{color:var(--s900);font-weight:600}
    .mp-list{display:flex;flex-direction:column;gap:6px}
    .mp-li{display:flex;align-items:center;gap:9px;padding:8px 10px;border:1px solid var(--s200);border-radius:9px;cursor:pointer;transition:border-color .12s,background .12s}
    .mp-li:hover{border-color:var(--s300);background:var(--s50)}
    .mp-li .d{width:7px;height:7px;border-radius:50%;flex-shrink:0}
    .mp-li .lt{flex:1;min-width:0;font-size:12.5px;font-weight:500}
    .mp-li .ls{font-size:11px;color:var(--s500)}
    .mp-note{font-size:12px;color:var(--s500);line-height:1.5}
    .mp-kv{display:grid;grid-template-columns:auto 1fr;gap:6px 14px;font-size:12px}
    .mp-kv .k{color:var(--s400);font-family:'Geist Mono',monospace;font-size:9.5px;text-transform:uppercase;letter-spacing:.08em;align-self:center}
    .mp-kv .vv{color:var(--s900);font-weight:500;text-align:right}
    .mp-reset{font-family:'Geist Mono',monospace;font-size:9.5px;text-transform:uppercase;letter-spacing:.1em;color:var(--s500);display:inline-flex;align-items:center;gap:6px;cursor:pointer}
    .mp-reset:hover{color:var(--s900)}
    @media(max-width:980px){.maplayout{grid-template-columns:1fr}.mappanel{position:static}}
    `;
    document.head.appendChild(el('style', { id: 'map-css', html: css }));
  }

  // dimension palette
  const DIM = {
    evidence:     { label: 'Evidence',     color: '#047857', icon: 'wallet' },
    trust:        { label: 'Trust',        color: '#4338ca', icon: 'shield' },
    timeline:     { label: 'Timeline',     color: '#0e7490', icon: 'calendar' },
    organization: { label: 'Organization', color: '#9a3412', icon: 'org' },
    opportunity:  { label: 'Opportunity',  color: '#7e22ce', icon: 'search' },
  };
  const stateDot = (st) => ({
    verified: '#047857', sealed: '#047857', active: '#047857', ready: '#047857', done: '#047857',
    pending: '#b45309', gap: '#b45309', open: '#b45309',
    access: '#4338ca', contradicted: '#be123c',
  }[st] || '#94a3b8');

  // build graph model from ECO
  function buildModel() {
    const D = window.ECO;
    const hubs = [
      { id: 'evidence', leaves: [
        { id: 'identity', label: 'Identity', st: 'verified', meta: 'NPPES · T4' },
        { id: 'license', label: 'CA License', st: 'pending', meta: 'renew 38d · T3' },
        { id: 'nccpa', label: 'Board cert', st: 'verified', meta: 'NCCPA · T4' },
        { id: 'sanctions', label: 'Sanctions', st: 'verified', meta: 'OIG · clear' },
        { id: 'npdb', label: 'Adverse hx', st: 'access', meta: 'NPDB · gated' },
      ]},
      { id: 'trust', leaves: [
        { id: 't4', label: 'T4 sealed', st: 'verified', meta: '4 lanes' },
        { id: 't3', label: 'T3 registry', st: 'verified', meta: '6 lanes' },
        { id: 't2', label: 'T2 federated', st: 'pending', meta: '2 lanes' },
      ]},
      { id: 'timeline', leaves: [
        { id: 'enum', label: 'Enumerated', st: 'verified', meta: 'Jan 2025' },
        { id: 'fellow', label: 'Fellowship', st: 'verified', meta: 'UCLA 2024' },
        { id: 'hire', label: 'Hired · Cedar', st: 'verified', meta: 'Feb 2025' },
        { id: 'renew', label: 'License renew', st: 'pending', meta: 'in 38 days' },
      ]},
      { id: 'organization', leaves: [
        { id: 'cedar', label: 'Cedar Health', st: 'active', meta: 'Employer' },
        { id: 'ucla', label: 'UCLA Med', st: 'verified', meta: 'Training' },
        { id: 'westernu', label: 'Western U.', st: 'verified', meta: 'Degree' },
        { id: 'nccpaO', label: 'NCCPA', st: 'verified', meta: 'Authority' },
      ]},
      { id: 'opportunity', leaves: [
        { id: 'op1', label: 'Sr PA · Ortho', st: 'ready', meta: '92% · Cedar' },
        { id: 'op2', label: 'Sports Med PA', st: 'gap', meta: '86% · CAQ gap' },
        { id: 'op3', label: 'Lead PA · Joint', st: 'gap', meta: '78% · NV gap' },
      ]},
    ];
    return hubs;
  }

  // panel content per selection
  function panelFor(sel, model) {
    const D = window.ECO;
    if (!sel || sel.type === 'center') {
      return {
        kindIcon: 'person', kind: 'Clinician · the subject',
        title: D.provider.name, sub: D.provider.credential + ' · ' + D.provider.specialty,
        body: [
          { kv: [['NPI', D.provider.npi], ['Location', D.provider.location], ['Career health', D.health.score + ' · ' + D.health.label], ['Status', 'Conditional Ready ▲ +' + D.health.delta]] },
          { note: 'The map traces every dimension of your career back to one identity. Click a hub to expand it, or any node to see how it connects.' },
          { listTitle: 'Five dimensions', list: model.map(h => ({
            id: h.id, label: DIM[h.id].label, sub: h.leaves.length + ' nodes', color: DIM[h.id].color, target: { type: 'hub', id: h.id } })) },
        ],
      };
    }
    if (sel.type === 'hub') {
      const h = model.find(x => x.id === sel.id);
      const d = DIM[sel.id];
      const hubNotes = {
        evidence: 'What you can prove. Each credential carries a source, a freshness window, and a trust tier.',
        trust: 'How authoritative your record is — the published T1→T4 ladder, counted across every lane.',
        timeline: 'Your career of record, as dated events. One timeline; every stream reads it.',
        organization: 'The institutions you are connected to — employers, training, and the authorities that vouch for you.',
        opportunity: 'Roles projected from your owned evidence. Never a stored match — recomputed from what is fresh.',
      };
      return {
        kindIcon: d.icon, kind: 'Dimension', accent: d.color,
        title: d.label, sub: h.leaves.length + ' connected nodes',
        body: [
          { note: hubNotes[sel.id] },
          { listTitle: d.label + ' nodes', list: h.leaves.map(l => ({
            id: l.id, label: l.label, sub: l.meta, dot: stateDot(l.st), target: { type: 'leaf', hubId: sel.id, id: l.id } })) },
        ],
      };
    }
    // leaf
    const h = model.find(x => x.id === sel.hubId);
    const leaf = h.leaves.find(l => l.id === sel.id);
    const d = DIM[sel.hubId];
    return {
      kindIcon: d.icon, kind: d.label + ' · node', accent: d.color,
      title: leaf.label, sub: leaf.meta,
      body: [
        { chipState: leaf.st },
        { kv: [['Dimension', d.label], ['Status', leaf.st], ['Connects to', D.provider.name]] },
        { note: leafNote(sel.hubId, leaf) },
      ],
    };
  }

  function leafNote(hubId, leaf) {
    return ({
      evidence: 'A primary-source credential in your owned ledger. Its freshness feeds Career Health and gates which roles you can be matched to.',
      trust: 'A band of the trust ladder. Higher tiers are sealed by the issuing authority itself and cannot be forged.',
      timeline: 'A dated event on your career of record. Mobility reads the timeline to compute readiness over time.',
      organization: 'An institution edge in your work graph, verified against a registry of record.',
      opportunity: 'A role projected from your fresh evidence. The gap, if any, is the exact credential that would unlock it.',
    })[hubId] || '';
  }

  let MODEL, SELECTION;

  window.renderMap = function () {
    styleOnce();
    MODEL = buildModel();
    SELECTION = { type: 'center' };
    const D = window.ECO;

    const v = el('div', { class: 'view' });
    v.appendChild(el('div', { class: 'pagehead' },
      el('div', null,
        el('div', { class: 'lead' }, icon('map', 12), 'Career Map · how everything connects'),
        el('h1', null, 'One clinician, ', el('em', null, 'five dimensions.')),
        el('div', { class: 'sub' }, 'Every credential, trust band, dated event, institution and opportunity traces back to a single identity. Click any node to trace its connections.')),
      el('div', { class: 'ra' }, chip('active', 'interactive'))));

    const canvas = el('div', { class: 'card mapcanvas' });
    const panel = el('div', { class: 'card mappanel' });
    v.appendChild(el('div', { class: 'maplayout' }, canvas, panel));

    drawGraph(canvas);
    drawPanel(panel);
    return v;
  };

  // ── geometry + draw ──
  const W = 1000, H = 680, CX = 500, CY = 340, HUBR = 196, LEAFR = 312;
  const hubAngles = { evidence: -90, trust: -18, opportunity: 54, organization: 126, timeline: 198 };

  function pol(angDeg, r) {
    const a = (angDeg * Math.PI) / 180;
    return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
  }

  let nodeEls = {}, edgeEls = [];

  function drawGraph(canvas) {
    nodeEls = {}; edgeEls = [];
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img' });
    const gEdges = s('g', { class: 'edges' });
    const gNodes = s('g', { class: 'nodes' });
    svg.appendChild(gEdges); svg.appendChild(gNodes);

    // positions
    const positions = {}; // id -> {x,y}
    positions['center'] = [CX, CY];
    MODEL.forEach(h => {
      const ha = hubAngles[h.id];
      positions['hub:' + h.id] = pol(ha, HUBR);
      const n = h.leaves.length;
      const spread = Math.min(58, 22 + n * 8); // total degrees
      h.leaves.forEach((l, i) => {
        const off = n === 1 ? 0 : (-spread / 2 + (spread * i) / (n - 1));
        positions['leaf:' + h.id + ':' + l.id] = pol(ha + off, LEAFR);
      });
    });

    // edges: center→hub, hub→leaf
    MODEL.forEach(h => {
      edgeEls.push(addEdge(gEdges, positions['center'], positions['hub:' + h.id], 'center', 'hub:' + h.id, DIM[h.id].color));
      h.leaves.forEach(l => {
        edgeEls.push(addEdge(gEdges, positions['hub:' + h.id], positions['leaf:' + h.id + ':' + l.id], 'hub:' + h.id, 'leaf:' + h.id + ':' + l.id, DIM[h.id].color));
      });
    });

    // leaf nodes
    MODEL.forEach(h => {
      h.leaves.forEach(l => {
        const [x, y] = positions['leaf:' + h.id + ':' + l.id];
        nodeEls['leaf:' + h.id + ':' + l.id] = addPill(gNodes, x, y, l.label, {
          small: true, dot: stateDot(l.st), border: DIM[h.id].color,
          onClick: () => select({ type: 'leaf', hubId: h.id, id: l.id }),
        });
      });
    });
    // hub nodes
    MODEL.forEach(h => {
      const [x, y] = positions['hub:' + h.id];
      nodeEls['hub:' + h.id] = addPill(gNodes, x, y, DIM[h.id].label, {
        hub: true, fill: DIM[h.id].color,
        onClick: () => select({ type: 'hub', id: h.id }),
      });
    });
    // center node
    nodeEls['center'] = addCenter(gNodes, CX, CY, window.ECO.provider, () => select({ type: 'center' }));

    canvas.appendChild(svg);
    canvas.appendChild(el('div', { class: 'maphint' }, 'click to trace · click center to reset'));
    const legend = el('div', { class: 'maplegend' });
    Object.keys(DIM).forEach(k => legend.appendChild(
      el('span', null, el('i', { style: { background: DIM[k].color } }), DIM[k].label)));
    canvas.appendChild(legend);

    applySelection();
  }

  function addEdge(g, [x1, y1], [x2, y2], from, to, color) {
    const p = s('path', { class: 'edge', d: `M${x1} ${y1} L${x2} ${y2}` });
    g.appendChild(p);
    return { p, from, to, color };
  }

  function addPill(g, x, y, label, opts) {
    const padX = opts.hub ? 16 : 12;
    const fs = opts.hub ? 14 : 12;
    const w = Math.max(opts.hub ? 96 : 78, label.length * (opts.hub ? 8.6 : 7) + padX * 2 + (opts.dot ? 12 : 0) + (opts.hub ? 18 : 0));
    const hgt = opts.hub ? 38 : 30;
    const node = s('g', { class: 'node', transform: `translate(${x},${y})` });
    const rect = s('rect', {
      class: 'pill-bg', x: -w / 2, y: -hgt / 2, width: w, height: hgt, rx: hgt / 2,
      fill: opts.hub ? opts.fill : '#ffffff',
      stroke: opts.hub ? opts.fill : (opts.border || '#cbd5e1'),
      'stroke-width': opts.hub ? 0 : 1.4,
    });
    node.appendChild(rect);
    let tx = 0;
    if (opts.hub) {
      // icon dot
      const dot = s('circle', { cx: -w / 2 + 18, cy: 0, r: 4.5, fill: 'rgba(255,255,255,.9)' });
      node.appendChild(dot);
      tx = 7;
    } else if (opts.dot) {
      node.appendChild(s('circle', { cx: -w / 2 + 13, cy: 0, r: 4, fill: opts.dot }));
      tx = 7;
    }
    const t = s('text', {
      x: tx, y: 0.5, 'text-anchor': 'middle', 'dominant-baseline': 'middle',
      'font-size': fs, 'font-weight': opts.hub ? 600 : 500,
      fill: opts.hub ? '#fff' : '#0f172a', 'letter-spacing': '-0.01em',
    }, label);
    node.appendChild(t);
    node.appendChild(s('rect', { class: 'hit', x: -w / 2 - 4, y: -hgt / 2 - 4, width: w + 8, height: hgt + 8, rx: hgt / 2 }));
    node.addEventListener('click', opts.onClick);
    g.appendChild(node);
    return { node, rect, w, hgt };
  }

  function addCenter(g, x, y, p, onClick) {
    const node = s('g', { class: 'node', transform: `translate(${x},${y})` });
    node.appendChild(s('circle', { r: 52, fill: '#fff', stroke: '#e2e8f0', 'stroke-width': 8 }));
    node.appendChild(s('circle', { class: 'pill-bg', r: 44, fill: '#0f172a' }));
    node.appendChild(s('text', { y: -3, 'text-anchor': 'middle', 'dominant-baseline': 'middle', 'font-size': 24, 'font-weight': 600, fill: '#fff' }, p.initials));
    node.appendChild(s('text', { y: 18, 'text-anchor': 'middle', 'dominant-baseline': 'middle', 'font-size': 9.5, 'font-weight': 500, fill: '#94a3b8', 'letter-spacing': '0.08em' }, p.credential));
    node.appendChild(s('circle', { class: 'hit', r: 56 }));
    node.addEventListener('click', onClick);
    g.appendChild(node);
    return { node };
  }

  // ── selection / highlight ──
  function select(sel) { SELECTION = sel; applySelection(); const panel = document.querySelector('.mappanel'); if (panel) drawPanel(panel); }

  function relatedSet(sel) {
    // returns set of node ids + edge predicate
    if (!sel || sel.type === 'center') return null; // null = show all bright
    const ids = new Set(['center']);
    if (sel.type === 'hub') {
      ids.add('hub:' + sel.id);
      const h = MODEL.find(x => x.id === sel.id);
      h.leaves.forEach(l => ids.add('leaf:' + sel.id + ':' + l.id));
    } else if (sel.type === 'leaf') {
      ids.add('hub:' + sel.hubId);
      ids.add('leaf:' + sel.hubId + ':' + sel.id);
    }
    return ids;
  }

  function applySelection() {
    const ids = relatedSet(SELECTION);
    // nodes
    Object.entries(nodeEls).forEach(([id, n]) => {
      n.node.classList.toggle('dim', ids ? !ids.has(id) : false);
    });
    // edges
    edgeEls.forEach(e => {
      const inSet = ids ? (ids.has(e.from) && ids.has(e.to)) : false;
      e.p.classList.toggle('dim', ids ? !inSet : false);
      e.p.classList.toggle('hl', inSet);
      e.p.style.stroke = inSet ? e.color : '';
    });
  }

  // ── panel ──
  function drawPanel(panel) {
    panel.innerHTML = '';
    const info = panelFor(SELECTION, MODEL);
    panel.appendChild(el('div', { class: 'mp-head' },
      el('div', { class: 'mp-kind', style: info.accent ? { color: info.accent } : null }, icon(info.kindIcon, 12), info.kind),
      el('div', { class: 'mp-title' }, info.title),
      el('div', { class: 'mp-sub' }, info.sub)));

    const body = el('div', { class: 'mp-body' });
    info.body.forEach(b => {
      if (b.chipState) body.appendChild(el('div', null, chip(b.chipState)));
      if (b.note) body.appendChild(el('div', { class: 'mp-note' }, b.note));
      if (b.kv) {
        const kv = el('div', { class: 'mp-kv' });
        b.kv.forEach(([k, val]) => { kv.appendChild(el('div', { class: 'k' }, k)); kv.appendChild(el('div', { class: 'vv' }, val)); });
        body.appendChild(kv);
      }
      if (b.list) {
        if (b.listTitle) body.appendChild(el('div', { class: 'eyebrow', style: { margin: '2px 0 0' } }, b.listTitle));
        const list = el('div', { class: 'mp-list' });
        b.list.forEach(it => list.appendChild(el('div', { class: 'mp-li', onclick: () => select(it.target) },
          el('span', { class: 'd', style: { background: it.dot || it.color || '#94a3b8' } }),
          el('span', { class: 'lt' }, it.label),
          el('span', { class: 'ls' }, it.sub))));
        body.appendChild(list);
      }
    });
    if (SELECTION && SELECTION.type !== 'center') {
      body.appendChild(el('div', { class: 'divider' }));
      body.appendChild(el('div', { class: 'mp-reset', onclick: () => select({ type: 'center' }) }, icon('person', 12), 'Back to clinician'));
    }
    panel.appendChild(body);
  }
})();
