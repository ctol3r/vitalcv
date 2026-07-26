/* ══════════════════════════════════════════════════════════════════════════
   plat-embeds.js — D5 · Embed Experience (#/embeds)
   Embeddable widgets — Career Card · Recognition Badge · Readiness · Org Verify.
   Pick a widget, theme & size it, preview it live, copy the embed snippet.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  const { el, icon, chip, pagehead, copyBtn, jsonHL, toast } = window.UI;

  function styleOnce() {
    if (document.getElementById('emb-css')) return;
    const css = `
    .emb-2{display:grid;grid-template-columns:268px 1fr;gap:14px;align-items:start}
    .emb-pick{padding:8px}
    .emb-pi{display:flex;align-items:center;gap:12px;padding:12px 11px;border-radius:11px;cursor:pointer;transition:.1s}
    .emb-pi:hover{background:var(--s50)}
    .emb-pi.on{background:var(--s900)}
    .emb-pi.on .epi-ic{background:#fff;color:var(--s900)}
    .emb-pi.on .epi-t{color:#fff}
    .emb-pi.on .epi-d{color:var(--s400)}
    .emb-pi .epi-ic{height:36px;width:36px;border-radius:10px;background:var(--s100);color:var(--s700);display:grid;place-items:center;flex-shrink:0;transition:.1s}
    .emb-pi .epi-t{font-size:13.5px;font-weight:600;letter-spacing:-.01em}
    .emb-pi .epi-d{font-size:11px;color:var(--s500);margin-top:2px;line-height:1.35}

    .emb-stage{display:flex;flex-direction:column;gap:0;overflow:hidden}
    .emb-toolbar{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:14px 16px;border-bottom:1px solid var(--s200);flex-wrap:wrap}
    .emb-toolbar .tl{display:flex;flex-direction:column;gap:3px}
    .emb-toolbar .tl .tt{font-size:15px;font-weight:600;letter-spacing:-.02em}
    .emb-toolbar .tl .td{font-size:11.5px;color:var(--s500)}
    .emb-controls{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
    .ctl{display:flex;align-items:center;gap:7px}
    .ctl .cl{font-family:'Geist Mono',monospace;font-size:8.5px;text-transform:uppercase;letter-spacing:.1em;color:var(--s400);font-weight:600}
    .seg{display:flex;border:1px solid var(--s200);border-radius:8px;overflow:hidden;background:var(--s50)}
    .seg button{padding:5px 11px;font-size:11.5px;font-weight:600;color:var(--s500);text-transform:capitalize}
    .seg button.on{background:#fff;color:var(--s900)}

    .emb-canvas{padding:36px;display:grid;place-items:center;min-height:300px;background:
      radial-gradient(circle at 1px 1px, rgba(148,163,184,.25) 1px, transparent 0) 0 0/18px 18px,
      var(--s50);transition:background .2s}
    .emb-canvas.dark{background:
      radial-gradient(circle at 1px 1px, rgba(148,163,184,.14) 1px, transparent 0) 0 0/18px 18px,
      #0b1220}

    /* ── widget chrome (shared) — this is what an embed actually looks like ── */
    .vw{--vw-bg:#fff;--vw-fg:#0f172a;--vw-mut:#64748b;--vw-line:#e2e8f0;--vw-soft:#f8fafc;
      background:var(--vw-bg);color:var(--vw-fg);border:1px solid var(--vw-line);border-radius:14px;
      font-family:'Geist',sans-serif;box-shadow:0 12px 34px -18px rgba(15,23,42,.28);overflow:hidden}
    .vw.dark{--vw-bg:#0f172a;--vw-fg:#f1f5f9;--vw-mut:#94a3b8;--vw-line:#1e293b;--vw-soft:#020617;border-color:#1e293b}
    .vw .vw-foot{display:flex;align-items:center;gap:6px;padding:9px 14px;border-top:1px solid var(--vw-line);font-family:'Geist Mono',monospace;font-size:8.5px;text-transform:uppercase;letter-spacing:.1em;color:var(--vw-mut)}
    .vw .vw-foot svg{color:var(--keep)}
    .vw .vw-foot .pw{margin-left:auto}

    /* career card */
    .vw-cc{width:380px}
    .vw-cc.md{width:300px}
    .vw-cc .cc-top{padding:18px;display:flex;gap:13px;align-items:flex-start}
    .vw-cc .cc-av{height:48px;width:48px;border-radius:12px;background:var(--vw-fg);color:var(--vw-bg);display:grid;place-items:center;font-weight:600;font-size:17px;flex-shrink:0;font-family:'Geist Mono',monospace}
    .vw-cc .cc-nm{font-size:17px;font-weight:600;letter-spacing:-.02em}
    .vw-cc .cc-cr{font-family:'Geist Mono',monospace;font-size:10px;color:var(--vw-mut);text-transform:uppercase;letter-spacing:.06em;margin-top:3px}
    .vw-cc .cc-grid{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--vw-line);border-top:1px solid var(--vw-line)}
    .vw-cc .cc-cell{background:var(--vw-bg);padding:13px 16px}
    .vw-cc .cc-k{font-family:'Geist Mono',monospace;font-size:8px;text-transform:uppercase;letter-spacing:.1em;color:var(--vw-mut);font-weight:600}
    .vw-cc .cc-v{font-size:17px;font-weight:600;letter-spacing:-.02em;margin-top:3px;display:flex;align-items:center;gap:6px}
    .vw-cc .cc-v .gd{color:var(--keep)}

    /* recognition badge */
    .vw-rb{width:300px;text-align:center}
    .vw-rb.sm{width:230px}
    .vw-rb .rb-top{padding:22px 18px 16px;display:flex;flex-direction:column;align-items:center;gap:11px}
    .vw-rb .rb-seal{height:60px;width:60px;border-radius:50%;background:var(--keep-bg);color:var(--keep);display:grid;place-items:center;box-shadow:inset 0 0 0 1.5px var(--keep-line)}
    .vw-rb.dark .rb-seal{background:rgba(4,120,87,.18)}
    .vw-rb .rb-kind{font-size:15px;font-weight:600;letter-spacing:-.015em}
    .vw-rb .rb-note{font-size:11.5px;color:var(--vw-mut);line-height:1.45;max-width:30ch}
    .vw-rb .rb-iss{font-family:'Geist Mono',monospace;font-size:9px;color:var(--vw-mut);text-transform:uppercase;letter-spacing:.07em;border-top:1px solid var(--vw-line);padding:11px 0;margin:0 18px}

    /* readiness widget */
    .vw-rw{width:300px}
    .vw-rw.sm{width:240px}.vw-rw.lg{width:360px}
    .vw-rw .rw-top{padding:18px;display:flex;align-items:center;gap:16px}
    .vw-rw .rw-ring{position:relative;height:74px;width:74px;flex-shrink:0;border-radius:50%}
    .vw-rw .rw-ring .in{position:absolute;inset:8px;background:var(--vw-bg);border-radius:50%;display:grid;place-items:center}
    .vw-rw .rw-ring .in b{font-size:22px;font-weight:600;letter-spacing:-.03em}
    .vw-rw .rw-lab{font-size:15px;font-weight:600;letter-spacing:-.02em}
    .vw-rw .rw-sub{font-size:11.5px;color:var(--vw-mut);margin-top:3px;line-height:1.4}
    .vw-rw .rw-stats{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--vw-line);border-top:1px solid var(--vw-line)}
    .vw-rw .rw-st{background:var(--vw-bg);padding:11px 16px}
    .vw-rw .rw-st .k{font-family:'Geist Mono',monospace;font-size:8px;text-transform:uppercase;letter-spacing:.1em;color:var(--vw-mut);font-weight:600}
    .vw-rw .rw-st .v{font-size:15px;font-weight:600;margin-top:2px}

    /* org verify */
    .vw-ov{width:320px}
    .vw-ov.sm{width:250px}
    .vw-ov .ov-top{padding:18px;display:flex;align-items:center;gap:13px}
    .vw-ov .ov-mk{height:44px;width:44px;border-radius:11px;background:var(--keep-bg);color:var(--keep);display:grid;place-items:center;flex-shrink:0;box-shadow:inset 0 0 0 1.5px var(--keep-line)}
    .vw-ov.dark .ov-mk{background:rgba(4,120,87,.18)}
    .vw-ov .ov-nm{font-size:15px;font-weight:600;letter-spacing:-.018em;display:flex;align-items:center;gap:7px}
    .vw-ov .ov-st{font-size:11.5px;color:var(--keep);font-weight:500;margin-top:2px;display:flex;align-items:center;gap:5px}
    .vw-ov .ov-meta{font-family:'Geist Mono',monospace;font-size:9.5px;color:var(--vw-mut);border-top:1px solid var(--vw-line);padding:11px 18px;display:flex;justify-content:space-between}

    .emb-code{margin-top:14px}
    .emb-optnote{font-size:11.5px;color:var(--s500);margin-top:10px;display:flex;align-items:center;gap:7px}
    @media(max-width:1080px){.emb-2{grid-template-columns:1fr}}
    `;
    document.head.appendChild(el('style', { id: 'emb-css', html: css }));
  }

  let sel = 'career-card';
  let theme = 'light';
  let size = null;

  window.renderEmbeds = function () {
    styleOnce();
    const D = window.PLAT;
    const v = el('div', { class: 'view' });

    v.appendChild(pagehead({
      lead: 'Embeds · the record, anywhere', leadIcon: 'layers',
      title: 'Embeddable widgets.',
      sub: 'Drop a verifiable piece of the record into any page — a careers site, an intranet, a directory. Configure it here, copy one line of HTML, done.',
      right: chip('live', '4 widgets · GA'),
    }));

    const picker = el('div', { class: 'card emb-pick' });
    D.widgets.forEach(w => {
      const item = el('div', { class: 'emb-pi' + (w.id === sel ? ' on' : ''), data: { w: w.id } },
        el('div', { class: 'epi-ic' }, icon(w.icon, 17)),
        el('div', { style: { flex: 1, minWidth: 0 } }, el('div', { class: 'epi-t' }, w.name), el('div', { class: 'epi-d' }, w.desc)));
      item.addEventListener('click', () => { sel = w.id; size = null; renderStage(); });
      picker.appendChild(item);
    });

    const stage = el('div', { class: 'card emb-stage', id: 'embStage' });

    function renderStage() {
      const w = D.widgets.find(x => x.id === sel);
      if (!size || !w.sizes.includes(size)) size = w.defaultSize;
      picker.querySelectorAll('.emb-pi').forEach(p => p.classList.toggle('on', p.dataset.w === sel));
      stage.innerHTML = '';

      // toolbar
      const sizeSeg = el('div', { class: 'seg' });
      w.sizes.forEach(s => {
        const b = el('button', { class: s === size ? 'on' : '' }, s);
        b.addEventListener('click', () => { size = s; renderStage(); });
        sizeSeg.appendChild(b);
      });
      const themeSeg = el('div', { class: 'seg' });
      ['light', 'dark'].forEach(t => {
        const b = el('button', { class: t === theme ? 'on' : '' }, t);
        b.addEventListener('click', () => { theme = t; renderStage(); });
        themeSeg.appendChild(b);
      });

      stage.appendChild(el('div', { class: 'emb-toolbar' },
        el('div', { class: 'tl' }, el('div', { class: 'tt' }, w.name), el('div', { class: 'td' }, 'Live preview · renders against subject vc_sub_1346053246')),
        el('div', { class: 'emb-controls' },
          el('div', { class: 'ctl' }, el('span', { class: 'cl' }, 'Size'), sizeSeg),
          el('div', { class: 'ctl' }, el('span', { class: 'cl' }, 'Theme'), themeSeg))));

      // canvas with the actual widget
      const canvas = el('div', { class: 'emb-canvas' + (theme === 'dark' ? ' dark' : '') });
      canvas.appendChild(buildWidget(sel, theme, size));
      stage.appendChild(canvas);
    }

    setTimeout(renderStage, 0);
    v.appendChild(el('div', { class: 'emb-2' }, picker, stage));

    // ── embed code ──
    v.appendChild(el('div', { class: 'eyebrow rule', style: { marginTop: '24px' } }, icon('code', 12), 'Embed code', el('span', { class: 'num' }, '· one line, no build step')));

    const codeWrap = el('div', { id: 'embCodeWrap' });
    v.appendChild(codeWrap);

    function renderCode() {
      codeWrap.innerHTML = '';
      const snippet = `<script src="https://embed.vitalcv.com/v1.js"><\/script>\n<vitalcv-${sel}\n  subject="vc_sub_1346053246"\n  theme="${theme}"\n  size="${size}"\n  publishable-key="vcp_live_8f31a2"><\/vitalcv-${sel}>`;
      const box = el('div', { class: 'code emb-code' },
        el('div', { class: 'chead' },
          el('span', { class: 'ct' }, icon('code', 12), 'HTML · ' + sel),
          copyBtn(snippet, { label: 'Copy embed' })),
        el('pre', { html: hlHtml(snippet) }));
      codeWrap.appendChild(box);
      codeWrap.appendChild(el('div', { class: 'emb-optnote' }, icon('lock', 12),
        'Uses a publishable key — safe to expose. The widget only ever reads what the subject has chosen to make portable.'));
    }
    // re-render code whenever stage changes — hook into renderStage via observer
    const origRenderStage = renderStage;
    renderStage = function () { origRenderStage(); renderCode(); };
    setTimeout(renderCode, 0);

    return v;
  };

  /* ── actual widget renderers (this is the embed) ─────────────────────── */
  function buildWidget(id, theme, size) {
    const dk = theme === 'dark' ? ' dark' : '';
    const foot = el('div', { class: 'vw-foot' }, icon('shield', 11), 'Verified by VitalCV', el('span', { class: 'pw' }, 'vitalcv.com'));

    if (id === 'career-card') {
      return el('div', { class: 'vw vw-cc ' + size + dk },
        el('div', { class: 'cc-top' },
          el('div', { class: 'cc-av' }, 'MM'),
          el('div', null,
            el('div', { class: 'cc-nm' }, 'Macie Miller, PA-C'),
            el('div', { class: 'cc-cr' }, 'Orthopedic Surgery · Irvine, CA'))),
        el('div', { class: 'cc-grid' },
          ccCell('Verified credentials', '9', 'gd', 'check'),
          ccCell('Trust standing', 'T4', null),
          ccCell('Evidence fresh', '72%', null),
          ccCell('Career Health', '68', 'gd', 'spark')),
        foot.cloneNode(true));
    }
    if (id === 'recognition-badge') {
      return el('div', { class: 'vw vw-rb ' + size + dk },
        el('div', { class: 'rb-top' },
          el('div', { class: 'rb-seal' }, icon('badge', 30)),
          el('div', { class: 'rb-kind' }, 'Clinical Excellence'),
          el('div', { class: 'rb-note' }, 'Recognized by Cedar Health System for sustained outcomes in orthopedic surgical care.')),
        el('div', { class: 'rb-iss' }, 'Issued Jun 2026 · signed · rec_5b2e'),
        foot.cloneNode(true));
    }
    if (id === 'readiness-widget') {
      const ring = el('div', { class: 'rw-ring', style: { background: 'conic-gradient(var(--keep) 245deg, var(--vw-line) 245deg)' } },
        el('div', { class: 'in' }, el('b', null, '68')));
      return el('div', { class: 'vw vw-rw ' + size + dk },
        el('div', { class: 'rw-top' }, ring,
          el('div', null,
            el('div', { class: 'rw-lab' }, 'Conditional Ready'),
            el('div', { class: 'rw-sub' }, 'Career Health 68 · ▲ +6 in 30 days'))),
        el('div', { class: 'rw-stats' },
          rwStat('Qualified now', '14 roles'),
          rwStat('Within reach', '+41 reqs')),
        foot.cloneNode(true));
    }
    // org verify
    return el('div', { class: 'vw vw-ov ' + size + dk },
      el('div', { class: 'ov-top' },
        el('div', { class: 'ov-mk' }, icon('shield', 22)),
        el('div', null,
          el('div', { class: 'ov-nm' }, 'Cedar Health System'),
          el('div', { class: 'ov-st' }, icon('check', 13), 'Verified organization'))),
      el('div', { class: 'ov-meta' }, el('span', null, 'org_cedar_8f31'), el('span', null, 'since Feb 2025')),
      foot.cloneNode(true));
  }

  function ccCell(k, val, gd, ic) {
    return el('div', { class: 'cc-cell' },
      el('div', { class: 'cc-k' }, k),
      el('div', { class: 'cc-v' }, ic ? icon(ic, 14) : null, el('span', { class: gd || '' }, val)));
  }
  function rwStat(k, val) {
    return el('div', { class: 'rw-st' }, el('div', { class: 'k' }, k), el('div', { class: 'v' }, val));
  }

  // minimal HTML highlighter for embed snippet
  function hlHtml(str) {
    let s = str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    s = s.replace(/(&lt;\/?[a-z0-9-]+)/g, '<span class="kw">$1</span>')
         .replace(/([a-z-]+)=(&quot;|")/g, '<span class="fn">$1</span>=$2')
         .replace(/("[^"]*")/g, '<span class="str">$1</span>')
         .replace(/(&gt;)/g, '<span class="kw">$1</span>');
    return s;
  }
})();
