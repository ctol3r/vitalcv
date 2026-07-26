/* ══════════════════════════════════════════════════════════════════════════
   ci-cards.js — shared presentation primitives for Career Intelligence
   The health ring, dimension bars, sparkline, and stream rows are reused across
   Today, Insights, Actions, Goals and Notifications.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  const { el, icon, chip, delta } = window.UI;

  const TONE_VAR = { good: 'var(--keep)', watch: 'var(--seam)', gate: 'var(--blue)', risk: 'var(--cut)', ghost: 'var(--s400)' };

  function styleOnce() {
    if (document.getElementById('ci-cards-css')) return;
    const css = `
    /* health ring */
    .hring{position:relative;flex-shrink:0;border-radius:50%}
    .hring .hc{position:absolute;background:#fff;border-radius:50%}
    .hring .hv{position:absolute;inset:0;display:grid;place-items:center;text-align:center}
    .hring .hv b{font-weight:600;letter-spacing:-.04em;line-height:1;font-variant-numeric:tabular-nums}
    .hring .hv .hl{font-family:'Geist Mono',monospace;font-size:8px;text-transform:uppercase;letter-spacing:.1em;color:var(--s400);margin-top:3px}

    /* sparkline */
    .spark{display:flex;align-items:flex-end;gap:3px;height:30px}
    .spark i{flex:1;background:var(--s200);border-radius:2px 2px 0 0;min-height:3px}
    .spark i.hi{background:var(--keep)}

    /* dimension bar */
    .dimrow{display:flex;align-items:center;gap:11px;padding:9px 0;border-top:1px solid var(--rule-soft)}
    .dimrow:first-child{border-top:0}
    .dimrow .dic{height:28px;width:28px;border-radius:8px;display:grid;place-items:center;flex-shrink:0;border:1px solid var(--s200);color:var(--s600)}
    .dimrow .dx{flex:1;min-width:0}
    .dimrow .dnm{font-size:12.5px;font-weight:600;letter-spacing:-.01em;display:flex;align-items:center;justify-content:space-between;gap:8px}
    .dimrow .dnm .dval{font-family:'Geist Mono',monospace;font-size:11px;color:var(--s500)}
    .dimrow .dnm .dval b{color:var(--s900)}
    .dbar{height:6px;border-radius:4px;background:var(--s100);margin-top:6px;position:relative;overflow:hidden}
    .dbar i{position:absolute;left:0;top:0;bottom:0;border-radius:4px}
    .dbar .med{position:absolute;top:-2px;bottom:-2px;width:2px;background:var(--s400);border-radius:2px}

    /* stream row (feed / today / notifications) */
    .srow{display:flex;gap:12px;padding:13px 14px;border:1px solid var(--s200);border-radius:12px;background:#fff;align-items:flex-start;text-align:left;width:100%;transition:border-color .12s,box-shadow .12s;position:relative}
    .srow:hover{border-color:var(--s300);box-shadow:0 4px 14px -10px rgba(15,23,42,.3)}
    .srow.unread::after{content:"";position:absolute;left:0;top:14px;bottom:14px;width:3px;border-radius:0 3px 3px 0;background:var(--accent,var(--s400))}
    .srow .sic{height:34px;width:34px;border-radius:9px;display:grid;place-items:center;flex-shrink:0}
    .srow .sx{flex:1;min-width:0}
    .srow .stop{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
    .srow .stitle{font-size:13.5px;font-weight:600;letter-spacing:-.012em;line-height:1.3}
    .srow .sdet{font-size:12px;color:var(--s600);line-height:1.5;margin-top:5px;text-wrap:pretty}
    .srow .sfoot{display:flex;align-items:center;gap:12px;margin-top:9px;flex-wrap:wrap}
    .srow .smeta{font-family:'Geist Mono',monospace;font-size:8.5px;text-transform:uppercase;letter-spacing:.1em;color:var(--s400);font-weight:600}
    .srow .swhen{font-family:'Geist Mono',monospace;font-size:9.5px;color:var(--s400);white-space:nowrap;flex-shrink:0}
    .srow .scta{font-family:'Geist Mono',monospace;font-size:9.5px;text-transform:uppercase;letter-spacing:.08em;font-weight:600;display:inline-flex;align-items:center;gap:5px}
    .srow .scta:hover{text-decoration:none}

    /* metric tile */
    .mtile{border:1px solid var(--s200);border-radius:12px;padding:13px 14px;background:#fff;display:flex;flex-direction:column;gap:5px}
    .mtile .mnum{font-size:25px;font-weight:600;letter-spacing:-.035em;font-variant-numeric:tabular-nums;line-height:1;display:flex;align-items:baseline;gap:7px}
    .mtile .mlab{font-family:'Geist Mono',monospace;font-size:8.5px;text-transform:uppercase;letter-spacing:.1em;color:var(--s500);font-weight:600}
    .mtile .mhint{font-size:11px;color:var(--s500);line-height:1.4}
    `;
    document.head.appendChild(el('style', { id: 'ci-cards-css', html: css }));
  }

  // big composite-health ring; tone drives color, optional center label
  function healthRing(score, tone, size, label) {
    size = size || 120;
    const deg = Math.round(score * 3.6);
    const inset = Math.round(size * 0.13);
    const fs = Math.round(size * 0.30);
    const col = TONE_VAR[tone] || 'var(--keep)';
    return el('div', { class: 'hring', style: {
      height: size + 'px', width: size + 'px',
      background: `conic-gradient(${col} ${deg}deg, var(--s200) ${deg}deg)`,
    } },
      el('div', { class: 'hc', style: { inset: inset + 'px' } }),
      el('div', { class: 'hv' },
        el('b', { style: { fontSize: fs + 'px' } }, String(score)),
        label ? el('div', { class: 'hl' }, label) : null));
  }

  // mini sparkline; last bar highlighted
  function sparkline(series) {
    const max = Math.max(...series), min = Math.min(...series) - 4;
    return el('div', { class: 'spark' },
      series.map((v, i) => el('i', {
        class: i === series.length - 1 ? 'hi' : '',
        style: { height: Math.round(((v - min) / (max - min)) * 100) + '%' },
      })));
  }

  // dimension bar with field-median marker
  function dimBar(d) {
    const col = d.value >= d.median ? 'var(--keep)' : 'var(--seam)';
    const trendChip = d.trend === 'rising' ? delta(1, { suffix: '' }) : null;
    return el('div', { class: 'dimrow' },
      el('div', { class: 'dic' }, icon(d.icon, 15)),
      el('div', { class: 'dx' },
        el('div', { class: 'dnm' }, el('span', null, d.label),
          el('span', { class: 'dval' }, el('b', null, String(d.value)), ' / ', String(d.median), ' med')),
        el('div', { class: 'dbar' },
          el('i', { style: { width: d.value + '%', background: col } }),
          el('span', { class: 'med', style: { left: d.median + '%' } }))));
  }

  function metricTile(num, label, hint, deltaN) {
    return el('div', { class: 'mtile' },
      el('div', { class: 'mnum' }, num, deltaN != null ? delta(deltaN) : null),
      el('div', { class: 'mlab' }, label),
      hint ? el('div', { class: 'mhint' }, hint) : null);
  }

  // unified stream row — used by Today and Notifications
  function streamRow(n) {
    const meta = window.CI.streamMeta[n.stream] || { label: n.stream, icon: 'dot' };
    const col = TONE_VAR[n.sev] || 'var(--s400)';
    const bg = ({ good: 'var(--keep-bg)', watch: 'var(--seam-bg)', gate: 'var(--blue-bg)', risk: 'var(--cut-bg)', info: 'var(--s100)' })[n.sev] || 'var(--s100)';
    const node = el('div', { class: 'srow' + (n.unread ? ' unread' : ''), style: { '--accent': col } },
      el('div', { class: 'sic', style: { background: bg, color: col } }, icon(meta.icon, 17)),
      el('div', { class: 'sx' },
        el('div', { class: 'stop' },
          el('span', { class: 'stitle' }, n.title),
          n.tier ? window.UI.tierChip(n.tier) : null),
        el('div', { class: 'sdet' }, n.detail),
        el('div', { class: 'sfoot' },
          el('span', { class: 'smeta' }, n.meta),
          n.cta ? el('a', { class: 'scta', href: n.route || '#', style: { color: col } }, n.cta, icon('arrow', 11)) : null)),
      el('div', { class: 'swhen' }, n.ago || n.when));
    return node;
  }

  window.CICARDS = { styleOnce, healthRing, sparkline, dimBar, metricTile, streamRow, TONE_VAR };
})();
