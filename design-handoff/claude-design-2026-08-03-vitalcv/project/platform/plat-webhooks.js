/* ══════════════════════════════════════════════════════════════════════════
   plat-webhooks.js — D3 · Webhook Center (#/webhooks)
   Endpoints · event subscriptions · payload inspector · delivery log.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  const { el, icon, chip, pagehead, copyBtn, jsonHL, toast } = window.UI;

  function styleOnce() {
    if (document.getElementById('wh-css')) return;
    const css = `
    .wh-2{display:grid;grid-template-columns:1.35fr 1fr;gap:14px;align-items:start}
    .wh-eps{padding:6px}
    .ephead{display:flex;align-items:center;justify-content:space-between;padding:12px 12px 10px}
    .ep-item{display:flex;align-items:center;gap:13px;padding:13px 12px;border-radius:11px;transition:.1s}
    .ep-item:hover{background:var(--s50)}
    .ep-item .eg{height:36px;width:36px;border-radius:10px;display:grid;place-items:center;flex-shrink:0;background:var(--s100);color:var(--s600)}
    .ep-item.live .eg{background:var(--keep-bg);color:var(--keep)}
    .ep-item.degraded .eg{background:var(--seam-bg);color:var(--seam)}
    .ep-item .eu{font-family:'Geist Mono',monospace;font-size:12.5px;font-weight:500;color:var(--s900);letter-spacing:-.01em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .ep-item .em{font-size:11px;color:var(--s500);margin-top:3px;display:flex;gap:4px 11px;flex-wrap:wrap}
    .ep-item .em b{color:var(--s800);font-weight:600}
    .ep-item .er{display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex-shrink:0}
    .ep-item .esr{font-family:'Geist Mono',monospace;font-size:10px;color:var(--s500)}

    .signbox{padding:16px;display:flex;flex-direction:column;gap:11px}
    .signbox .sl{font-size:12px;color:var(--s600);line-height:1.5}
    .secretrow{display:flex;align-items:center;gap:9px;background:var(--s950);border-radius:10px;padding:11px 13px}
    .secretrow code{font-family:'Geist Mono',monospace;font-size:12px;color:var(--ink-code);flex:1;letter-spacing:.02em}
    .secretrow .copybtn{background:transparent;border-color:transparent;color:var(--s400);padding:4px}
    .secretrow .copybtn:hover{color:#fff}
    .secretrow .reveal{color:var(--s400);padding:4px;border-radius:6px}
    .secretrow .reveal:hover{color:#fff}

    .ev-list{padding:6px}
    .ev-item{display:flex;align-items:center;gap:13px;padding:13px 12px;border-radius:11px}
    .ev-item:hover{background:var(--s50)}
    .ev-item.sel{background:var(--s100)}
    .ev-item .ei{height:34px;width:34px;border-radius:9px;background:var(--s900);color:#fff;display:grid;place-items:center;flex-shrink:0}
    .ev-item .et{font-family:'Geist Mono',monospace;font-size:12.5px;font-weight:600;color:var(--s900);cursor:pointer}
    .ev-item .ed{font-size:11.5px;color:var(--s500);margin-top:2px;line-height:1.4;max-width:46ch}

    .payload-wrap{display:grid;grid-template-columns:1.1fr 1fr;gap:14px;align-items:start;margin-top:14px}

    .deliv .code-ok{color:var(--keep)} .deliv .code-warn{color:var(--seam)} .deliv .code-bad{color:var(--cut)}
    .deliv .ccode{font-family:'Geist Mono',monospace;font-weight:600;font-size:12px}
    .deliv .retry{font-family:'Geist Mono',monospace;font-size:9.5px;text-transform:uppercase;letter-spacing:.08em;color:var(--blue);display:inline-flex;align-items:center;gap:5px;cursor:pointer}
    .deliv .retry:hover{text-decoration:underline}

    @media(max-width:1100px){.wh-2{grid-template-columns:1fr}.payload-wrap{grid-template-columns:1fr}}
    `;
    document.head.appendChild(el('style', { id: 'wh-css', html: css }));
  }

  let secretShown = false;

  window.renderWebhooks = function () {
    styleOnce();
    const D = window.PLAT;
    const v = el('div', { class: 'view' });

    v.appendChild(pagehead({
      lead: 'Webhook Center · push, never poll', leadIcon: 'webhook',
      title: 'Webhooks.',
      sub: 'Subscribe an endpoint to record events and VitalCV will deliver a signed payload the moment something changes — evidence, recognition, trust, organization, and career milestones.',
      right: el('button', { class: 'btn btn-pri', onclick: () => openEndpointModal() }, icon('plus', 14), 'Add endpoint'),
    }));

    // ── endpoints + signing ──
    const eps = el('div', { class: 'card wh-eps' },
      el('div', { class: 'ephead' },
        el('div', { class: 'eyebrow', style: { margin: 0 } }, icon('link', 12), 'Endpoints'),
        el('span', { class: 'mono muted', style: { fontSize: '10px' } }, D.endpoints.length + ' configured')));
    D.endpoints.forEach(e => {
      eps.appendChild(el('div', { class: 'ep-item ' + e.status },
        el('div', { class: 'eg' }, icon(e.status === 'degraded' ? 'bolt' : 'link', 16)),
        el('div', { style: { flex: 1, minWidth: 0 } },
          el('div', { class: 'eu' }, e.url),
          el('div', { class: 'em' },
            el('span', null, el('b', null, e.events), ' events'),
            el('span', null, 'last ', el('b', null, e.lastDelivery)),
            el('span', null, el('b', null, e.successRate), ' delivered'))),
        el('div', { class: 'er' }, chip(e.status), el('span', { class: 'esr', onclick: () => toast('Endpoint settings'), style: { cursor: 'pointer' } }, 'manage'))));
    });

    const sign = el('div', { class: 'card signbox' },
      el('div', { class: 'eyebrow', style: { margin: 0 } }, icon('lock', 12), 'Signing secret'),
      el('div', { class: 'sl' }, 'Every delivery is signed with HMAC-SHA256 in the ', el('span', { class: 'mono', style: { color: 'var(--s900)' } }, 'VitalCV-Signature'), ' header. Verify it before trusting a payload.'),
      (function () {
        const secret = 'whsec_3f9a1c7d8e2b6045aa19c2f0';
        const codeEl = el('code', null, secretShown ? secret : '••••••••••••••••••••••••');
        const eye = el('button', { class: 'reveal', title: 'Reveal' }, icon(secretShown ? 'eyeoff' : 'eye', 15));
        eye.addEventListener('click', () => { secretShown = !secretShown; codeEl.textContent = secretShown ? secret : '••••••••••••••••••••••••'; eye.innerHTML = ''; eye.appendChild(icon(secretShown ? 'eyeoff' : 'eye', 15)); });
        return el('div', { class: 'secretrow' }, codeEl, eye, copyBtn(secret, {}));
      })(),
      el('button', { class: 'btn btn-soft btn-sm', style: { alignSelf: 'flex-start' }, onclick: () => toast('Secret rotated · old secret valid 24h', 'cut') }, icon('refresh', 13), 'Rotate secret'));

    v.appendChild(el('div', { class: 'wh-2' }, eps, sign));

    // ── event catalog + payload inspector ──
    v.appendChild(el('div', { class: 'eyebrow rule', style: { marginTop: '26px' } }, icon('grid', 12), 'Event types', el('span', { class: 'num' }, '· subscribe & inspect')));

    let selectedEvent = D.events[0];

    const evList = el('div', { class: 'card ev-list' });
    D.events.forEach(ev => {
      const togg = el('div', { class: 'tog' + (ev.subscribed ? ' on' : '') });
      togg.addEventListener('click', (e) => {
        e.stopPropagation();
        ev.subscribed = !ev.subscribed;
        togg.classList.toggle('on', ev.subscribed);
        toast(ev.subscribed ? 'Subscribed to ' + ev.type : 'Unsubscribed from ' + ev.type, ev.subscribed ? null : 'cut');
      });
      const item = el('div', { class: 'ev-item', data: { ev: ev.type } },
        el('div', { class: 'ei' }, icon(ev.icon, 16)),
        el('div', { style: { flex: 1, minWidth: 0 } },
          el('div', { class: 'et' }, ev.type),
          el('div', { class: 'ed' }, ev.desc)),
        togg);
      item.addEventListener('click', () => { selectedEvent = ev; renderPayload(); });
      evList.appendChild(item);
    });

    const payloadPane = el('div', { class: 'card', style: { overflow: 'hidden' } });

    function renderPayload() {
      evList.querySelectorAll('.ev-item').forEach(i => i.classList.toggle('sel', i.dataset.ev === selectedEvent.type));
      payloadPane.innerHTML = '';
      payloadPane.className = 'code';
      payloadPane.appendChild(el('div', { class: 'chead' },
        el('span', { class: 'ct' }, icon('webhook', 12), selectedEvent.type),
        copyBtn(() => JSON.stringify(selectedEvent.sample, null, 2), { label: 'Copy payload' })));
      payloadPane.appendChild(el('pre', { html: jsonHL(selectedEvent.sample) }));
    }
    setTimeout(renderPayload, 0);

    v.appendChild(el('div', { class: 'payload-wrap' }, evList, payloadPane));

    // ── delivery log ──
    v.appendChild(el('div', { class: 'eyebrow rule', style: { marginTop: '26px' } }, icon('clock', 12), 'Recent deliveries', el('span', { class: 'num' }, '· last 24h')));
    const dl = el('div', { class: 'card deliv', style: { padding: '14px 4px 4px' } });
    const t = el('table', { class: 'tbl' },
      el('thead', null, el('tr', null,
        el('th', null, 'Event'), el('th', null, 'Endpoint'), el('th', null, 'Status'),
        el('th', null, 'Response'), el('th', null, 'Latency'), el('th', { style: { textAlign: 'right' } }, 'When'))));
    const tb = el('tbody', null);
    D.deliveries.forEach(d => {
      const codeCls = d.code < 300 ? 'code-ok' : d.code < 500 ? 'code-warn' : 'code-bad';
      tb.appendChild(el('tr', { class: 'hov' },
        el('td', null, el('span', { class: 'mono', style: { fontWeight: 600, color: 'var(--s900)' } }, d.event)),
        el('td', { class: 'mono muted' }, d.endpoint),
        el('td', null, chip(d.status)),
        el('td', null, el('span', { class: 'ccode ' + codeCls }, String(d.code)),
          (d.status === 'failed' || d.status === 'retrying') ? el('span', { class: 'retry', onclick: () => toast('Redelivering ' + d.event) }, '  ', icon('refresh', 11), 'retry') : null),
        el('td', { class: 'mono muted' }, d.ms),
        el('td', { class: 'mono muted', style: { textAlign: 'right' } }, d.when)));
    });
    t.appendChild(tb);
    dl.appendChild(t);
    v.appendChild(dl);

    return v;
  };

  function openEndpointModal() {
    const { el, icon, toast } = window.UI;
    const root = document.getElementById('modalRoot');
    const D = window.PLAT;
    const picked = new Set(['evidence.updated']);

    function close() { root.innerHTML = ''; }
    const scrim = el('div', { class: 'scrim' });
    scrim.addEventListener('click', (e) => { if (e.target === scrim) close(); });

    const grid = el('div', { class: 'scopegrid' });
    D.events.forEach(ev => {
      const cell = el('div', { class: 'scopepick' + (picked.has(ev.type) ? ' on' : '') },
        el('div', { class: 'cbx' }, icon('check', 11)),
        el('span', { class: 'sc' }, ev.type));
      cell.addEventListener('click', () => {
        if (picked.has(ev.type)) picked.delete(ev.type); else picked.add(ev.type);
        cell.classList.toggle('on', picked.has(ev.type));
      });
      grid.appendChild(cell);
    });

    const modal = el('div', { class: 'modal' },
      el('div', { class: 'mhead' },
        el('div', null, el('h3', null, 'Add webhook endpoint'), el('p', null, "We'll send a signed test event on save.")),
        el('button', { class: 'x', onclick: close }, icon('code', 16))),
      el('div', { class: 'mbody' },
        el('div', { class: 'field' }, el('label', null, 'Endpoint URL'),
          el('input', { type: 'text', value: 'https://', placeholder: 'https://hooks.example.com/vitalcv' })),
        el('div', { class: 'field' }, el('label', null, 'Subscribe to events'), grid)),
      el('div', { class: 'mfoot' },
        el('button', { class: 'btn btn-soft', onclick: close }, 'Cancel'),
        el('button', { class: 'btn btn-pri', onclick: () => { close(); toast('Endpoint added · test event sent to ' + picked.size + ' event' + (picked.size > 1 ? 's' : '')); } }, icon('check', 14), 'Add endpoint')));

    scrim.appendChild(modal);
    root.appendChild(scrim);
  }
})();
