/* ══════════════════════════════════════════════════════════════════════════
   plat-keys.js — D4 · API Keys (#/keys)
   Developer credential management: generate · rotate · revoke · audit.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  const { el, icon, chip, pagehead, copyBtn, toast } = window.UI;

  // live, mutable copy so generate/rotate/revoke persist across re-renders
  let KEYS = null;
  let AUDIT = null;

  function styleOnce() {
    if (document.getElementById('keys-css')) return;
    const css = `
    .keys-2{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:18px}
    .keys-stat{padding:15px 16px}
    .keys-stat .k{font-family:'Geist Mono',monospace;font-size:8.5px;text-transform:uppercase;letter-spacing:.1em;color:var(--s400);font-weight:600;display:flex;align-items:center;gap:6px}
    .keys-stat .v{font-size:24px;font-weight:600;letter-spacing:-.03em;margin-top:5px}
    .keys-stat .s{font-size:11px;color:var(--s500);margin-top:1px}

    .keytbl .kn{font-weight:600;letter-spacing:-.01em;color:var(--s900)}
    .keytbl .kpfx{font-family:'Geist Mono',monospace;font-size:11.5px;color:var(--s700);display:flex;align-items:center;gap:7px}
    .keytbl .kpfx .dots{color:var(--s400)}
    .keytbl .kenv{font-family:'Geist Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:.06em;font-weight:600;padding:2px 7px;border-radius:5px}
    .keytbl .kenv-live{color:var(--keep);background:var(--keep-bg);box-shadow:inset 0 0 0 1px var(--keep-line)}
    .keytbl .kenv-sandbox{color:var(--blue);background:var(--blue-bg);box-shadow:inset 0 0 0 1px var(--blue-line)}
    .keytbl .kscopes{display:flex;flex-wrap:wrap;gap:4px}
    .keytbl .ksc{font-family:'Geist Mono',monospace;font-size:9.5px;color:var(--s600);background:var(--s100);border-radius:5px;padding:2px 6px}
    .keytbl tr.revoked td{opacity:.55}
    .keytbl tr.revoked .kn{text-decoration:line-through;text-decoration-color:var(--s300)}
    .kacts{display:flex;align-items:center;gap:5px;justify-content:flex-end}
    .iconbtn{height:30px;width:30px;border-radius:8px;border:1px solid var(--s200);background:var(--s50);color:var(--s500);display:grid;place-items:center;transition:.12s}
    .iconbtn:hover{background:#fff;border-color:var(--s300);color:var(--s900)}
    .iconbtn.danger:hover{color:var(--cut);border-color:var(--cut-line);background:var(--cut-bg)}

    .audit-row{display:flex;align-items:center;gap:13px;padding:12px 12px;border-top:1px solid var(--rule-soft)}
    .audit-row:first-child{border-top:0}
    .audit-row .ad{height:30px;width:30px;border-radius:8px;display:grid;place-items:center;flex-shrink:0}
    .audit-row .ad.keep{background:var(--keep-bg);color:var(--keep)}
    .audit-row .ad.pending{background:var(--seam-bg);color:var(--seam)}
    .audit-row .ad.cut{background:var(--cut-bg);color:var(--cut)}
    .audit-row .aa{font-family:'Geist Mono',monospace;font-size:12px;font-weight:600;color:var(--s900)}
    .audit-row .am{font-size:11.5px;color:var(--s500);margin-top:1px}
    .audit-row .am b{color:var(--s700);font-weight:600}
    .audit-row .aw{font-family:'Geist Mono',monospace;font-size:10px;color:var(--s400);white-space:nowrap;flex-shrink:0}

    .newkey{background:var(--s950);border-radius:11px;padding:14px;display:flex;flex-direction:column;gap:11px}
    .newkey .nl{font-family:'Geist Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:var(--s400);font-weight:600;display:flex;align-items:center;gap:6px}
    .newkey .nk{display:flex;align-items:center;gap:9px;background:#0b1220;border:1px solid #1e293b;border-radius:9px;padding:11px 13px}
    .newkey .nk code{font-family:'Geist Mono',monospace;font-size:12.5px;color:#86efac;flex:1;overflow:hidden;text-overflow:ellipsis;letter-spacing:.02em}
    .newkey .nk .copybtn{background:transparent;border-color:transparent;color:var(--s400)}
    .newkey .nk .copybtn:hover{color:#fff}
    .warnbar{display:flex;align-items:flex-start;gap:9px;background:var(--seam-bg);border:1px solid var(--seam-line);border-radius:9px;padding:11px 12px;font-size:12px;color:var(--seam);line-height:1.45}
    .warnbar svg{flex-shrink:0;margin-top:1px}

    @media(max-width:1080px){.keys-2{grid-template-columns:1fr}.keytbl .hidesm{display:none}}
    `;
    document.head.appendChild(el('style', { id: 'keys-css', html: css }));
  }

  window.renderKeys = function () {
    styleOnce();
    if (!KEYS) KEYS = window.PLAT.keys.map(k => ({ ...k, scopes: [...k.scopes] }));
    if (!AUDIT) AUDIT = window.PLAT.audit.map(a => ({ ...a }));

    const v = el('div', { class: 'view' });

    v.appendChild(pagehead({
      lead: 'API Keys · server-to-server credentials', leadIcon: 'key',
      title: 'API keys.',
      sub: 'Generate scoped credentials, rotate them with a grace window, and revoke instantly. Every key action is written to an immutable audit trail.',
      right: el('button', { class: 'btn btn-pri', onclick: () => openGenerate() }, icon('plus', 14), 'Generate key'),
    }));

    const active = KEYS.filter(k => k.status === 'active').length;
    const test = KEYS.filter(k => k.status === 'test').length;
    const revoked = KEYS.filter(k => k.status === 'revoked').length;
    v.appendChild(el('div', { class: 'keys-2' },
      kstat('key', 'Active keys', String(active), 'live · in use'),
      kstat('test', 'Test keys', String(test), 'sandbox only'),
      kstat('trash', 'Revoked', String(revoked), 'no longer valid')));

    // ── key table ──
    const card = el('div', { class: 'card keytbl', style: { padding: '14px 4px 4px' } });
    const tableWrap = el('div', { id: 'keyTableWrap' });
    card.appendChild(tableWrap);
    v.appendChild(card);

    function renderTable() {
      tableWrap.innerHTML = '';
      const t = el('table', { class: 'tbl' },
        el('thead', null, el('tr', null,
          el('th', null, 'Name'), el('th', null, 'Key'), el('th', null, 'Env'),
          el('th', { class: 'hidesm' }, 'Scopes'), el('th', { class: 'hidesm' }, 'Last used'),
          el('th', null, 'Status'), el('th', { style: { textAlign: 'right' } }, ''))));
      const tb = el('tbody', null);
      KEYS.forEach(k => {
        const isRevoked = k.status === 'revoked';
        tb.appendChild(el('tr', { class: 'hov' + (isRevoked ? ' revoked' : '') },
          el('td', null, el('div', { class: 'kn' }, k.name), el('div', { class: 'mono muted', style: { fontSize: '10px', marginTop: '2px' } }, 'created ' + k.created)),
          el('td', null, el('div', { class: 'kpfx' }, k.prefix, el('span', { class: 'dots' }, '••••'),
            !isRevoked ? copyBtn(k.prefix + 'XXXXXXXX', { cls: 'ghost', size: 12 }) : null)),
          el('td', null, el('span', { class: 'kenv kenv-' + (k.env === 'sandbox' ? 'sandbox' : 'live') }, k.env)),
          el('td', { class: 'hidesm' }, el('div', { class: 'kscopes' }, k.scopes.map(s => el('span', { class: 'ksc' }, s)))),
          el('td', { class: 'hidesm mono muted' }, k.lastUsed),
          el('td', null, chip(k.status)),
          el('td', null, el('div', { class: 'kacts' },
            isRevoked ? el('span', { class: 'mono muted', style: { fontSize: '10px' } }, 'revoked') : [
              el('button', { class: 'iconbtn', title: 'Rotate', onclick: () => rotateKey(k) }, icon('refresh', 14)),
              el('button', { class: 'iconbtn danger', title: 'Revoke', onclick: () => revokeKey(k) }, icon('trash', 14)),
            ]))));
      });
      t.appendChild(tb);
      tableWrap.appendChild(t);
    }

    function rotateKey(k) {
      const newPrefix = (k.env === 'sandbox' ? 'vck_test_' : 'vck_live_') + Math.random().toString(36).slice(2, 8);
      k.prefix = newPrefix;
      k.lastUsed = 'just now';
      AUDIT.unshift({ id: 'au_' + Date.now(), action: 'key.rotated', key: newPrefix, actor: 'You', when: 'just now', detail: 'rotated · 24h grace window', tone: 'pending' });
      renderTable(); renderAudit();
      toast('Key rotated · previous key valid for 24h', 'cut');
      openRevealKey(newPrefix + Math.random().toString(36).slice(2, 14), 'Rotated key', 'The previous secret keeps working for 24 hours to let you roll over.');
    }
    function revokeKey(k) {
      k.status = 'revoked';
      AUDIT.unshift({ id: 'au_' + Date.now(), action: 'key.revoked', key: k.prefix, actor: 'You', when: 'just now', detail: 'manual revoke · ' + k.name, tone: 'failed' });
      renderTable(); renderAudit();
      toast('Key revoked — requests will now fail', 'cut');
    }

    // ── audit log ──
    v.appendChild(el('div', { class: 'eyebrow rule', style: { marginTop: '26px' } }, icon('clock', 12), 'Key audit trail', el('span', { class: 'num' }, '· immutable')));
    const auditCard = el('div', { class: 'card', style: { padding: '6px 8px' } });
    const auditWrap = el('div', { id: 'keyAuditWrap' });
    auditCard.appendChild(auditWrap);
    v.appendChild(auditCard);

    function renderAudit() {
      auditWrap.innerHTML = '';
      AUDIT.forEach(a => {
        auditWrap.appendChild(el('div', { class: 'audit-row' },
          el('div', { class: 'ad ' + a.tone }, icon(auditIcon(a.action), 15)),
          el('div', { style: { flex: 1, minWidth: 0 } },
            el('div', { class: 'aa' }, a.action),
            el('div', { class: 'am' }, el('b', null, a.key), ' · ', a.detail, ' · by ', a.actor)),
          el('div', { class: 'aw' }, a.when)));
      });
    }

    // generate flow → adds a key
    window.__addKey = function (name, env, scopes) {
      const prefix = (env === 'sandbox' ? 'vck_test_' : 'vck_live_') + Math.random().toString(36).slice(2, 8);
      KEYS.unshift({ id: 'k_' + Date.now(), name, prefix, env, scopes, created: 'just now', lastUsed: 'never', status: env === 'sandbox' ? 'test' : 'active' });
      AUDIT.unshift({ id: 'au_' + Date.now(), action: 'key.created', key: prefix, actor: 'You', when: 'just now', detail: env + ' · ' + scopes.join(' · '), tone: 'verified' });
      renderTable(); renderAudit();
      return prefix + Math.random().toString(36).slice(2, 14);
    };

    setTimeout(() => { renderTable(); renderAudit(); }, 0);
    return v;
  };

  function kstat(ic, k, val, s) {
    return el('div', { class: 'card keys-stat' }, el('div', { class: 'k' }, icon(ic, 11), k), el('div', { class: 'v' }, val), el('div', { class: 's' }, s));
  }
  function auditIcon(action) {
    return { 'key.used': 'check', 'key.created': 'plus', 'key.rotated': 'refresh', 'key.revoked': 'trash', 'scope.granted': 'lock' }[action] || 'key';
  }

  /* ── generate modal ─────────────────────────────────────────────────── */
  function openGenerate() {
    const root = document.getElementById('modalRoot');
    const D = window.PLAT;
    const picked = new Set(['evidence:read']);
    let env = 'live';

    function close() { root.innerHTML = ''; }
    const scrim = el('div', { class: 'scrim' });
    scrim.addEventListener('click', (e) => { if (e.target === scrim) close(); });

    const nameInput = el('input', { type: 'text', placeholder: 'e.g. Onboarding service' });

    const envSeg = el('div', { class: 'tabs', style: { display: 'inline-flex' } });
    ['live', 'sandbox'].forEach(e => {
      const b = el('button', { class: e === env ? 'on' : '' }, icon(e === 'live' ? 'bolt' : 'cube', 13), e === 'live' ? 'Live' : 'Sandbox');
      b.addEventListener('click', () => { env = e; envSeg.querySelectorAll('button').forEach(x => x.classList.remove('on')); b.classList.add('on'); });
      envSeg.appendChild(b);
    });

    const grid = el('div', { class: 'scopegrid' });
    D.scopes.forEach(s => {
      const cell = el('div', { class: 'scopepick' + (picked.has(s.scope) ? ' on' : '') },
        el('div', { class: 'cbx' }, icon('check', 11)), el('span', { class: 'sc' }, s.scope));
      cell.addEventListener('click', () => { if (picked.has(s.scope)) picked.delete(s.scope); else picked.add(s.scope); cell.classList.toggle('on', picked.has(s.scope)); });
      grid.appendChild(cell);
    });

    const modal = el('div', { class: 'modal' },
      el('div', { class: 'mhead' },
        el('div', null, el('h3', null, 'Generate API key'), el('p', null, "You'll see the full secret once — store it immediately.")),
        el('button', { class: 'x', onclick: close }, icon('code', 16))),
      el('div', { class: 'mbody' },
        el('div', { class: 'field' }, el('label', null, 'Key name'), nameInput),
        el('div', { class: 'field' }, el('label', null, 'Environment'), envSeg),
        el('div', { class: 'field' }, el('label', null, 'Scopes'), grid)),
      el('div', { class: 'mfoot' },
        el('button', { class: 'btn btn-soft', onclick: close }, 'Cancel'),
        el('button', { class: 'btn btn-pri', onclick: () => {
          const name = nameInput.value.trim() || 'Untitled key';
          const secret = window.__addKey(name, env, [...picked]);
          close();
          openRevealKey(secret, name, 'This secret will never be shown again. Copy it into your secret manager now.');
        } }, icon('key', 14), 'Generate')));

    scrim.appendChild(modal);
    root.appendChild(scrim);
  }

  /* ── reveal-once modal (used by generate + rotate) ──────────────────── */
  function openRevealKey(secret, title, note) {
    const root = document.getElementById('modalRoot');
    function close() { root.innerHTML = ''; }
    const scrim = el('div', { class: 'scrim' });
    scrim.addEventListener('click', (e) => { if (e.target === scrim) close(); });

    const modal = el('div', { class: 'modal' },
      el('div', { class: 'mhead' },
        el('div', null, el('h3', null, title + ' created'), el('p', null, 'Copy your new secret below.')),
        el('button', { class: 'x', onclick: close }, icon('code', 16))),
      el('div', { class: 'mbody' },
        el('div', { class: 'newkey' },
          el('div', { class: 'nl' }, icon('key', 11), 'secret key'),
          el('div', { class: 'nk' }, el('code', null, secret), copyBtn(secret, { label: 'Copy' }))),
        el('div', { class: 'warnbar', style: { marginTop: '13px' } }, icon('lock', 14), note)),
      el('div', { class: 'mfoot' },
        el('button', { class: 'btn btn-pri', onclick: () => { close(); toast('Key stored — done'); } }, icon('check', 14), "I've stored it")));

    scrim.appendChild(modal);
    root.appendChild(scrim);
  }
  window.__openRevealKey = openRevealKey;
})();
