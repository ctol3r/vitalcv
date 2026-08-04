/* ══════════════════════════════════════════════════════════════════════════
   ci-goals.js — Goals · clinician-defined ambitions, tracked against the ledger
   The clinician names where they want to go (Medical Director, another state,
   academic appointment…) and the engine reads the owned record to show real
   progress: what they already have, what they still need, the next move.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  const { el, icon, chip } = window.UI;

  function styleOnce() {
    if (document.getElementById('ci-goals-css')) return;
    const css = `
    .gl-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-bottom:16px}
    .glcard{padding:0;overflow:hidden;display:flex;flex-direction:column}
    .glcard .ghead{padding:16px 17px;display:flex;align-items:flex-start;gap:13px;border-bottom:1px solid var(--rule-soft)}
    .glcard .gic{height:40px;width:40px;border-radius:11px;display:grid;place-items:center;flex-shrink:0;background:var(--s900);color:#fff}
    .glcard .gtt{flex:1;min-width:0}
    .glcard .gtitle{font-size:15.5px;font-weight:600;letter-spacing:-.02em;line-height:1.15}
    .glcard .gaim{font-size:11.5px;color:var(--s500);margin-top:3px;line-height:1.4}
    .glcard .gring{flex-shrink:0;text-align:center}

    .gprog{padding:14px 17px;border-bottom:1px solid var(--rule-soft)}
    .gprog .gpl{display:flex;align-items:center;justify-content:space-between;font-family:'Geist Mono',monospace;font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:var(--s500);font-weight:600;margin-bottom:8px}
    .gprog .gpl b{color:var(--s900);font-size:15px;letter-spacing:-.02em}
    .gbar{height:8px;border-radius:5px;background:var(--s100);overflow:hidden;position:relative}
    .gbar i{position:absolute;left:0;top:0;bottom:0;border-radius:5px;background:linear-gradient(90deg,var(--keep),#0ea371)}
    .gmeta{display:flex;gap:14px;margin-top:10px;font-family:'Geist Mono',monospace;font-size:9.5px;color:var(--s500)}
    .gmeta b{color:var(--s700)}

    .ghave{padding:14px 17px;display:grid;grid-template-columns:1fr 1fr;gap:14px}
    .ghave .gcol .gcl{font-family:'Geist Mono',monospace;font-size:8.5px;text-transform:uppercase;letter-spacing:.12em;font-weight:600;margin-bottom:9px;display:flex;align-items:center;gap:6px}
    .ghave .gli{display:flex;gap:8px;align-items:flex-start;font-size:11.5px;color:var(--s700);line-height:1.4;padding:4px 0}
    .ghave .gli svg{flex-shrink:0;margin-top:2px}

    .gnext{margin-top:auto;padding:13px 17px;background:var(--s50);border-top:1px solid var(--rule-soft);display:flex;align-items:center;gap:11px}
    .gnext .gnx{flex:1;min-width:0}
    .gnext .gnl{font-family:'Geist Mono',monospace;font-size:8px;text-transform:uppercase;letter-spacing:.13em;color:var(--s400);font-weight:600}
    .gnext .gnt{font-size:12px;color:var(--s900);font-weight:500;margin-top:3px;line-height:1.4}

    .gl-add{padding:17px;display:flex;flex-direction:column;gap:13px}
    .gl-sugg{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
    .sugg{border:1px dashed var(--s300);border-radius:11px;padding:13px;text-align:left;background:var(--s50);transition:.12s;display:flex;flex-direction:column;gap:6px}
    .sugg:hover{border-color:var(--s900);background:#fff}
    .sugg .sgic{height:30px;width:30px;border-radius:8px;display:grid;place-items:center;background:#fff;border:1px solid var(--s200);color:var(--s700)}
    .sugg .sgt{font-size:13px;font-weight:600;letter-spacing:-.01em}
    .sugg .sga{font-size:11px;color:var(--s500);line-height:1.4}
    .sugg .sgadd{font-family:'Geist Mono',monospace;font-size:8.5px;text-transform:uppercase;letter-spacing:.08em;color:var(--s500);display:flex;align-items:center;gap:5px;margin-top:2px}
    .gl-custom{display:flex;gap:9px;align-items:center;border-top:1px solid var(--rule-soft);padding-top:13px}
    .gl-custom input{flex:1;height:40px;border:1px solid var(--s200);border-radius:10px;padding:0 13px;font-family:inherit;font-size:13px;color:var(--s900);background:#fff;outline:none}
    .gl-custom input:focus{border-color:var(--s400)}
    .gl-custom input::placeholder{color:var(--s400)}
    @media(max-width:900px){.gl-grid{grid-template-columns:1fr}.gl-sugg{grid-template-columns:1fr}}
    `;
    document.head.appendChild(el('style', { id: 'ci-goals-css', html: css }));
  }

  // session-added goals (built from suggestions / custom input)
  const added = [];

  window.renderGoals = function () {
    styleOnce();
    window.CICARDS.styleOnce();
    const D = window.CI;
    const v = el('div', { class: 'view' });

    const allGoals = () => [...D.goals, ...added];

    v.appendChild(el('div', { class: 'pagehead' },
      el('div', null,
        el('div', { class: 'lead' }, icon('flag', 12), 'Career Intelligence · goals'),
        el('h1', null, 'Where you ', el('em', null, 'want to go')),
        el('div', { class: 'sub' }, 'Name an ambition and the engine reads your owned record against it — showing what you already hold, what is still missing, and the single next move that closes the most distance.')),
      el('div', { class: 'ra' }, chip('good', allGoals().length + ' tracked'))));

    const grid = el('div', { class: 'gl-grid' });
    function paintGrid() { grid.innerHTML = ''; allGoals().forEach(g => grid.appendChild(goalCard(g, D))); }
    paintGrid();
    v.appendChild(grid);

    // define a new goal
    v.appendChild(el('div', { class: 'eyebrow rule', style: { margin: '6px 0 14px' } },
      icon('plus', 12), 'Define a new goal', el('span', { class: 'num' }, '· the engine will start tracking it')));
    v.appendChild(addPanel(D, () => paintGrid(), added));

    return v;
  };

  function goalCard(g, D) {
    const C = window.CICARDS;
    return el('div', { class: 'card glcard' },
      el('div', { class: 'ghead' },
        el('div', { class: 'gic' }, icon(g.icon, 19)),
        el('div', { class: 'gtt' },
          el('div', { class: 'gtitle' }, g.title),
          el('div', { class: 'gaim' }, g.aim)),
        el('div', { class: 'gring' }, C.healthRing(g.match, g.match >= 75 ? 'good' : g.match >= 55 ? 'watch' : 'gate', 52, 'match'))),
      el('div', { class: 'gprog' },
        el('div', { class: 'gpl' }, el('span', null, 'Progress'), el('b', null, g.progress + '%')),
        el('div', { class: 'gbar' }, el('i', { style: { width: g.progress + '%' } })),
        el('div', { class: 'gmeta' },
          el('span', null, 'Horizon · ', el('b', null, g.horizon)),
          el('span', null, 'Match · ', el('b', null, g.match + '%')),
          el('span', null, 'Feeds · ', el('b', null, g.dims.map(d => D.dim[d] ? D.dim[d].label : d).join(' · '))))),
      el('div', { class: 'ghave' },
        el('div', { class: 'gcol' },
          el('div', { class: 'gcl', style: { color: 'var(--keep)' } }, icon('check', 11), 'You already have'),
          g.have.map(h => el('div', { class: 'gli' }, el('span', { style: { color: 'var(--keep)' } }, icon('check', 13)), h))),
        el('div', { class: 'gcol' },
          el('div', { class: 'gcl', style: { color: 'var(--seam)' } }, icon('clock', 11), 'Still need'),
          g.need.map(n => el('div', { class: 'gli' }, el('span', { style: { color: 'var(--seam)' } }, icon('plus', 13)), n)))),
      el('div', { class: 'gnext' },
        el('div', { class: 'gnx' },
          el('div', { class: 'gnl' }, 'Next move'),
          el('div', { class: 'gnt' }, g.next)),
        el('a', { class: 'btn btn-soft', href: '#/actions' }, 'Act', icon('arrow', 13))));
  }

  function addPanel(D, repaint, added) {
    const input = el('input', { type: 'text', placeholder: 'e.g. Open a cardiology practice in Nevada…',
      onkeydown: (e) => { if (e.key === 'Enter') commit(input.value); } });

    function commit(title) {
      title = (title || '').trim();
      if (!title) return;
      added.push(makeGoal({ title, aim: 'Custom goal · the engine will map your evidence to it', icon: 'flag' }));
      input.value = '';
      repaint();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    return el('div', { class: 'card gl-add' },
      el('div', { class: 'gl-sugg' },
        D.goalSuggestions.map(s => el('button', { class: 'sugg', onclick: () => {
          added.push(makeGoal({ title: s.title, aim: s.aim, icon: s.icon })); repaint();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } },
          el('div', { class: 'sgic' }, icon(s.icon, 15)),
          el('div', { class: 'sgt' }, s.title),
          el('div', { class: 'sga' }, s.aim),
          el('div', { class: 'sgadd' }, icon('plus', 10), 'Add & track')))),
      el('div', { class: 'gl-custom' },
        input,
        el('button', { class: 'btn btn-pri', onclick: () => commit(input.value) }, icon('plus', 13), 'Add goal')));
  }

  // build a plausible tracked goal from a title — the engine "maps" it to the record
  function makeGoal(seed) {
    const progress = 18 + Math.floor(Math.random() * 22);
    const match = 50 + Math.floor(Math.random() * 28);
    return {
      id: 'g-custom-' + Date.now(),
      icon: seed.icon || 'flag', status: 'active', title: seed.title, aim: seed.aim,
      horizon: '12–24 months', progress, match, dims: ['authority', 'clinical'],
      have: ['Owned evidence ledger', 'Authority dimension at 88', '4-year continuity'],
      need: ['Engine is mapping requirements…', 'Surfacing the gating evidence'],
      next: 'The engine is reading your record against this goal — refined steps appear shortly.',
    };
  }
})();
