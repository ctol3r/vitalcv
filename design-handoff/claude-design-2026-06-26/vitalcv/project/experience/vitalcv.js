/* ═══════════════════════════════════════════════════════════════════════
   VitalCV Experience · interactions
   Career journey · system visualization · nav · scroll reveal
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
  "use strict";

  /* ── tiny icon set (stroke, 1.7) ───────────────────────────── */
  const I = {
    grad:'<path d="M3 8l9-4 9 4-9 4-9-4z"/><path d="M7 10v5c0 1 2.5 2.5 5 2.5s5-1.5 5-2.5v-5"/><path d="M21 8v5"/>',
    steth:'<path d="M6 3v5a4 4 0 008 0V3"/><path d="M6 3H4M14 3h2M10 16v2a4 4 0 008 0v-1"/><circle cx="18" cy="15" r="2"/>',
    badge:'<path d="M12 2l2.6 1.7L18 4l.8 3.3L21 10l-1.6 2.7L20 16l-3.2.8L14 20l-2-1.4L10 20l-2.8-1.2L4 18l.8-3.3L3 12l1.6-2.7L4 6l3.2-.8z"/><path d="M9 12l2 2 4-4"/>',
    crown:'<path d="M3 8l4 3 5-6 5 6 4-3v9H3z"/><path d="M3 20h18"/>',
    building:'<path d="M4 21V5a2 2 0 012-2h6a2 2 0 012 2v16"/><path d="M14 9h4a2 2 0 012 2v10M3 21h18"/><path d="M7 7h.01M7 11h.01M7 15h.01M11 7h.01M11 11h.01M11 15h.01"/>',
    laurel:'<path d="M12 3v18"/><path d="M12 6c-3 0-5 2-5 5M12 9c-2.5 0-4 1.5-4 4M12 6c3 0 5 2 5 5M12 9c2.5 0 4 1.5 4 4"/>',
    file:'<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/>',
    shield:'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    route:'<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8 16.5L16 7.5M6 15.5V9a3 3 0 013-3h3"/>',
    network:'<circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="19" r="2.5"/><circle cx="19" cy="19" r="2.5"/><path d="M12 7.5v4M10.5 13l-3.5 4M13.5 13l3.5 4"/>',
    target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
    spark:'<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18"/>',
    key:'<circle cx="8" cy="8" r="4"/><path d="M11 11l8 8M16 16l2-2M18 18l2-2"/>',
    check:'<path d="M5 12l4 4L19 6"/>',
    replay:'<path d="M3 12a9 9 0 109-9 9 9 0 00-7 3.5M3 3v4h4"/>',
    pin:'<path d="M12 21s7-5.6 7-11a7 7 0 00-14 0c0 5.4 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    lic:'<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8" cy="11" r="2"/><path d="M13 9h5M13 13h5M6 15h7"/>',
    dea:'<path d="M5 7h14M5 12h14M5 17h9"/><circle cx="18" cy="17" r="2.5"/>',
    user:'<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0114 0"/>',
    money:'<circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5a2.5 2 0 012.5-1.5c1.4 0 2.5.7 2.5 1.7s-1 1.5-2.5 1.8-2.5.8-2.5 1.8 1.1 1.7 2.5 1.7a2.5 2 0 002.5-1.5"/>',
    plug:'<path d="M9 2v6M15 2v6M7 8h10v3a5 5 0 01-10 0z"/><path d="M12 16v6"/>',
    chart:'<path d="M4 20V4M4 20h16"/><path d="M8 16l3-4 3 2 4-6"/>',
    layers:'<path d="M12 3l9 5-9 5-9-5 9-5z"/><path d="M3 13l9 5 9-5M3 17l9 5 9-5"/>',
  };
  function svg(name, sz){ sz=sz||18; return `<svg width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${I[name]||''}</svg>`; }
  window.VICON = svg;

  /* ════════════════════════════════════════════════════════════
     CAREER JOURNEY DATA — six stages, trust compounds at each
     ════════════════════════════════════════════════════════════ */
  const STAGES = [
    {
      key:'student', name:'Student', icon:'grad', year:'Yr 0–4',
      title:'The record <em>begins</em> before the first patient.',
      role:'Medical Student · MS-1 → MS-4',
      desc:'Identity is established at the source the moment a clinician matriculates. Every exam, rotation, and enrollment is signed and timestamped — the first links in a chain that will never be re-collected.',
      metrics:[ {k:'Signed evidence',v:'4',u:'items'}, {k:'Trust tier',v:'T1'}, {k:'Time-to-verify',v:'—'} ],
      score:'18', mobility:'Local',
      events:[
        {t:'Enrollment verified',s:'AAMC · LCME-accredited program',icon:'grad',state:'ok',isNew:true},
        {t:'USMLE Step 1 · Pass',s:'NBME · signed result',icon:'file',state:'ok',isNew:true},
        {t:'Clinical rotations',s:'4 sites · attested hours',icon:'steth',state:'ok',isNew:true},
        {t:'Background screen',s:'OIG/LEIE · clear',icon:'shield',state:'ok',isNew:true},
      ],
      replay:'First receipt issued. Replayable for 7 years — by any verifier, without VitalCV in the loop.'
    },
    {
      key:'resident', name:'Resident', icon:'steth', year:'Yr 5–8',
      title:'A national identity, <em>issued once.</em>',
      role:'Resident Physician · PGY-1 → PGY-4',
      desc:'The NPI is issued and bound to the verified chain. Training program, supervision, and procedure logs accrue automatically — the evidence that future employers would otherwise re-request, already signed and portable.',
      metrics:[ {k:'Signed evidence',v:'11',u:'items',d:'+7'}, {k:'Trust tier',v:'T2'}, {k:'Time-to-verify',v:'2',u:'days'} ],
      score:'47', mobility:'Regional',
      events:[
        {t:'NPI issued & bound',s:'NPPES · 1043829176',icon:'badge',state:'ok',isNew:true},
        {t:'Residency match',s:'NRMP · ACGME program',icon:'file',state:'ok',isNew:true},
        {t:'Supervised procedure log',s:'1,240 attested',icon:'steth',state:'ok',isNew:true},
        {t:'State training license',s:'Active · single state',icon:'lic',state:'ok'},
      ],
      replay:'Enrollment that used to take weeks now resolves in 2 days — the federal evidence is already attested.'
    },
    {
      key:'attending', name:'Attending', icon:'badge', year:'Yr 9–16',
      title:'Credentialed <em>once.</em> Trusted everywhere after.',
      role:'Attending Physician · Board-Certified',
      desc:'Board certification, full licensure, and DEA register against the chain. This is where credentialing-by-proxy pays off: a verified clinician moves to a new system in days, not the industry-standard 103.',
      metrics:[ {k:'Signed evidence',v:'19',u:'items',d:'+8'}, {k:'Trust tier',v:'T3'}, {k:'Time-to-bill',v:'36',u:'days',d:'−67'} ],
      score:'74', mobility:'Multi-state',
      events:[
        {t:'Board certification',s:'ABMS · signed attestation',icon:'badge',state:'ok',isNew:true},
        {t:'Unrestricted license',s:'PECOS · 3 states',icon:'lic',state:'ok',isNew:true},
        {t:'DEA registration',s:'Active · Schedule II–V',icon:'dea',state:'ok',isNew:true},
        {t:'Hospital privileges',s:'Cedar Health · granted',icon:'building',state:'ok',isNew:true},
      ],
      replay:'Time-to-bill drops to 36 days. The −67-day delta is captured, not promised.'
    },
    {
      key:'leader', name:'Leader', icon:'crown', year:'Yr 17–24',
      title:'Reputation that <em>compounds</em> into authority.',
      role:'Medical Director · Section Chief',
      desc:'Leadership, quality outcomes, and peer references attach to the same identity. Trust is no longer just "verified" — it is differentiated. The record now carries the signal that distinguishes one clinician from the next.',
      metrics:[ {k:'Signed evidence',v:'28',u:'items',d:'+9'}, {k:'Trust tier',v:'T4'}, {k:'Peer references',v:'12'} ],
      score:'88', mobility:'National',
      events:[
        {t:'Medical directorship',s:'Cardiology · attested role',icon:'crown',state:'ok',isNew:true},
        {t:'Quality outcomes',s:'CMS · top-decile signed',icon:'chart',state:'ok',isNew:true},
        {t:'Peer references',s:'12 verified attestations',icon:'user',state:'ok',isNew:true},
        {t:'Committee leadership',s:'P&T · credentialing chair',icon:'badge',state:'ok'},
      ],
      replay:'Reputation becomes portable signal — verifiable by any organization, owned by the clinician.'
    },
    {
      key:'executive', name:'Executive', icon:'building', year:'Yr 25–34',
      title:'One identity, <em>governing</em> across systems.',
      role:'Chief Medical Officer · System Executive',
      desc:'At the executive tier the same chain spans multiple organizations and jurisdictions. Governance roles, multi-state licensure, and board appointments are continuous — no re-verification at any transition.',
      metrics:[ {k:'Signed evidence',v:'41',u:'items',d:'+13'}, {k:'Trust tier',v:'T4+'}, {k:'Jurisdictions',v:'7'} ],
      score:'95', mobility:'Cross-system',
      events:[
        {t:'CMO appointment',s:'Cedar Health System · signed',icon:'building',state:'ok',isNew:true},
        {t:'Multi-state licensure',s:'7 states · continuous',icon:'lic',state:'ok',isNew:true},
        {t:'Governance & board seats',s:'3 verified appointments',icon:'crown',state:'ok',isNew:true},
        {t:'Specialty ROI signal',s:'System-level attested',icon:'money',state:'ok'},
      ],
      replay:'A career spanning seven jurisdictions, replayable end-to-end against the original federal sources.'
    },
    {
      key:'retirement', name:'Emeritus', icon:'laurel', year:'Yr 35+',
      title:'The record <em>outlives</em> the practice.',
      role:'Emeritus · Advisor · Mentor',
      desc:'The chain does not end at retirement — it becomes legacy. Emeritus status, mentorship, and consulting continue against an identity that remains verifiable for as long as the receipts are replayable: a complete, signed career.',
      metrics:[ {k:'Signed evidence',v:'46',u:'items',d:'+5'}, {k:'Career span',v:'35',u:'yrs'}, {k:'Replayable',v:'7',u:'yrs'} ],
      score:'97', mobility:'Legacy',
      events:[
        {t:'Emeritus status',s:'Conferred · signed',icon:'laurel',state:'ok',isNew:true},
        {t:'Mentorship & advisory',s:'14 clinicians sponsored',icon:'user',state:'ok',isNew:true},
        {t:'Consulting & locum',s:'On-demand · pre-verified',icon:'route',state:'ok',isNew:true},
        {t:'Complete career chain',s:'35 yrs · audit-locked',icon:'shield',state:'ok'},
      ],
      replay:'A whole career, sealed. Any regulator can replay any moment — decades later, without us.'
    },
  ];

  /* ════════════════════════════════════════════════════════════
     SYSTEM VISUALIZATION DATA — seven layers, each builds the next
     ════════════════════════════════════════════════════════════ */
  const LAYERS = [
    { key:'evidence', n:'Evidence', sub:'asked at the source', icon:'file',
      title:'Federal truth, <em>asked once.</em>',
      lead:'Every fact starts as a question to an authoritative source — NPPES, OIG/LEIE, PECOS, ABMS, state boards. The answer is signed with the source, the question, and the timestamp.',
      feats:[ {k:'Sources',v:'NPPES · OIG/LEIE · PECOS · ABMS'}, {k:'Output',v:'A signed receipt, not a screenshot'}, {k:'PHI stored',v:'None — ever, by validation'}, {k:'Owned by',v:'The clinician'} ],
      out:'Signed receipt issued' },
    { key:'trust', n:'Trust', sub:'verifiable outside the issuer', icon:'shield',
      title:'Proof that <em>doesn’t need us</em> to be true.',
      lead:'Each receipt is replayable by anyone, against the same federal evidence, on a different machine, with no VitalCV in the loop. That property — verifiability outside the issuer — is the whole product.',
      feats:[ {k:'Model',v:'Cryptographic attestation'}, {k:'Replayable for',v:'7 years, any verifier'}, {k:'Authority',v:'Stays with the source'}, {k:'Trust tiers',v:'T1 → T4, evidence-weighted'} ],
      out:'Trust state: verified' },
    { key:'timeline', n:'Timeline', sub:'the career, in order', icon:'clock',
      title:'A career laid out as a <em>chain.</em>',
      lead:'Receipts assemble into one chronological record — every credential, role, and transition linked to the one before it. The timeline is the clinician’s, and it is continuous across every employer.',
      feats:[ {k:'Structure',v:'Append-only, chain-linked'}, {k:'Spans',v:'Student → emeritus, unbroken'}, {k:'Each link',v:'auditEventId + prior hash'}, {k:'Gaps',v:'Visible, never silently filled'} ],
      out:'Continuous record built' },
    { key:'mobility', n:'Mobility', sub:'credentialing by proxy', icon:'route',
      title:'Move in <em>days,</em> not a quarter.',
      lead:'Because the federal evidence is already attested, a new employer verifies by replaying receipts instead of re-collecting documents. Payer enrollment and privileging advance in parallel, not in series.',
      feats:[ {k:'Time-to-bill',v:'103 → 36 days, cohort median'}, {k:'Delta',v:'−67 days per transition'}, {k:'Process',v:'Parallel, not serial'}, {k:'Re-collection',v:'Eliminated'} ],
      out:'−67 days to first claim' },
    { key:'orgs', n:'Organizations', sub:'extend, never modify', icon:'building',
      title:'Health systems build <em>on</em> the record.',
      lead:'Organizations read, attest to, and extend the chain — they never modify the core. The clinician’s identity stays theirs; the system gets a verified pipeline and a permanent audit trail of its own decisions.',
      feats:[ {k:'Principle',v:'Extends · never modifies core'}, {k:'For systems',v:'Verified pipeline + audit ledger'}, {k:'For clinicians',v:'Identity stays portable'}, {k:'Surface',v:'APIs · SDKs · webhooks · embeds'} ],
      out:'Org decisions audit-locked' },
    { key:'opportunities', n:'Opportunities', sub:'matched on verified signal', icon:'target',
      title:'The right role finds a <em>trusted</em> record.',
      lead:'A verified, differentiated identity is matchable. Opportunities — roles, panels, locum, leadership — surface against real signal instead of a re-keyed résumé, and a clinician can respond pre-credentialed.',
      feats:[ {k:'Matched on',v:'Verified trust signal'}, {k:'Response',v:'Pre-credentialed, instant'}, {k:'Network',v:'Opportunity graph'}, {k:'Noise',v:'Removed — no re-keyed CVs'} ],
      out:'Pre-verified candidate' },
    { key:'intelligence', n:'Career Intelligence', sub:'the system explains itself', icon:'spark',
      title:'A career that <em>knows</em> its next move.',
      lead:'On top of a verified, continuous, matchable record sits intelligence: specialty ROI, growth paths, gap detection, and benchmarks. The platform doesn’t just hold the career — it helps direct it.',
      feats:[ {k:'Signals',v:'Specialty ROI · growth paths'}, {k:'Detects',v:'Gaps before they cost time'}, {k:'Benchmarks',v:'Peer-anonymous, real'}, {k:'Outcome',v:'Decisions, not dashboards'} ],
      out:'Career, directed' },
  ];

  /* ════════════════════════════════════════════════════════════
     RENDER · CAREER JOURNEY
     ════════════════════════════════════════════════════════════ */
  function renderJourney(){
    const track = document.getElementById('jtrack');
    const panel = document.getElementById('jpanel');
    if(!track || !panel) return;

    track.innerHTML =
      '<div class="baseline"></div><div class="progress" id="jprog"></div>' +
      STAGES.map((s,i)=>`
        <button class="jstage" data-i="${i}" aria-label="${s.name}">
          <span class="dot"></span>
          <span class="yr mono">${s.year}</span>
          <span class="nm">${s.name}</span>
        </button>`).join('');

    function select(i){
      const s = STAGES[i];
      track.querySelectorAll('.jstage').forEach((b,bi)=>{
        b.classList.toggle('on', bi===i);
        b.classList.toggle('done', bi<=i);
      });
      const prog = document.getElementById('jprog');
      if(prog) prog.style.width = (i/(STAGES.length-1)*100)+'%';

      panel.innerHTML = `
        <div class="jpanel-l">
          <div class="jp-stage-tag">
            <span class="chip chip-acc"><span class="cd"></span>${s.name}</span>
            <span class="ix mono">Stage ${String(i+1).padStart(2,'0')} / 06 · ${s.year}</span>
          </div>
          <h3>${s.title}</h3>
          <div class="role mono">${s.role}</div>
          <p class="desc">${s.desc}</p>
          <div class="jp-metrics">
            ${s.metrics.map(m=>`
              <div class="jp-metric">
                <div class="k">${m.k}</div>
                <div class="v">${m.v}${m.u?`<span class="u">${m.u}</span>`:''}${m.d?`<span class="delta">${m.d}</span>`:''}</div>
              </div>`).join('')}
          </div>
        </div>
        <div class="jpanel-r">
          <div class="jp-evh"><span>Signed evidence · this stage</span><span>Trust ${s.score}/100</span></div>
          ${s.events.map(e=>`
            <div class="jp-ev ${e.isNew?'new':''}">
              <span class="ic">${svg(e.icon,15)}</span>
              <span class="ix2">
                <div class="et">${e.t}</div>
                <div class="es">${e.s}</div>
              </span>
              ${e.isNew?'<span class="tag chip chip-acc" style="font-size:9px">NEW</span>':'<span class="tag chip chip-ok"><span class="cd"></span>Held</span>'}
            </div>`).join('')}
          <div class="jp-replay">${svg('replay',15)}<span>${s.replay}</span></div>
        </div>`;
    }

    track.querySelectorAll('.jstage').forEach(b=>{
      b.addEventListener('click',()=>select(+b.dataset.i));
    });
    select(2); // open on Attending — the payoff stage
  }

  /* ════════════════════════════════════════════════════════════
     RENDER · SYSTEM VISUALIZATION
     ════════════════════════════════════════════════════════════ */
  function renderSystem(){
    const list = document.getElementById('syslayers');
    const stage = document.getElementById('sysstage');
    if(!list || !stage) return;

    list.innerHTML = LAYERS.map((l,i)=>`
      <button class="syslayer" data-i="${i}">
        <span class="ln mono">${String(i+1).padStart(2,'0')}</span>
        <span class="li">${svg(l.icon,18)}</span>
        <span class="lt">
          <span class="nm">${l.n}</span>
          <span class="sub">${l.sub}</span>
        </span>
        <span class="conn"></span>
      </button>`).join('');

    function select(i){
      const l = LAYERS[i];
      list.querySelectorAll('.syslayer').forEach((b,bi)=>{
        b.classList.toggle('on', bi===i);
        b.classList.toggle('done', bi<i);
      });
      stage.innerHTML = `
        <div class="sh">
          <div>
            <div class="ix mono">${svg('layers',13)} LAYER ${String(i+1).padStart(2,'0')} / 07 · ${l.sub}</div>
            <h3>${l.title}</h3>
          </div>
          <div class="ico">${svg(l.icon,24)}</div>
        </div>
        <div class="sb">
          <p class="lead">${l.lead}</p>
          <div class="feat">
            ${l.feats.map(f=>`<div class="f"><div class="fk">${svg('check',12)}${f.k}</div><div class="fv">${f.v}</div></div>`).join('')}
          </div>
        </div>
        <div class="sf">
          <span>${i>0?`builds on ${LAYERS[i-1].n}`:'the foundation'}</span>
          <span class="out">${svg('check',14)}${l.out}</span>
        </div>`;
    }

    list.querySelectorAll('.syslayer').forEach(b=>{
      b.addEventListener('click',()=>select(+b.dataset.i));
      b.addEventListener('mouseenter',()=>{ if(window.matchMedia('(hover:hover)').matches) select(+b.dataset.i); });
    });
    select(0);
  }

  /* ════════════════════════════════════════════════════════════
     NAV · scroll state, mobile toggle, active section
     ════════════════════════════════════════════════════════════ */
  function initNav(){
    const nav = document.getElementById('nav');
    const links = document.getElementById('navlinks');
    const toggle = document.getElementById('navtoggle');

    const onScroll = ()=> nav && nav.classList.toggle('stuck', window.scrollY>8);
    window.addEventListener('scroll', onScroll, {passive:true}); onScroll();

    if(toggle && links){
      toggle.addEventListener('click', ()=> links.classList.toggle('open'));
      links.querySelectorAll('a').forEach(a=> a.addEventListener('click', ()=> links.classList.remove('open')));
    }

    // active section highlight
    const secs = ['career','trust','growth','organizations','developers']
      .map(id=>document.getElementById(id)).filter(Boolean);
    const navById = {};
    (links?links.querySelectorAll('a'):[]).forEach(a=>{
      const h=a.getAttribute('href')||''; if(h.startsWith('#')) navById[h.slice(1)]=a;
    });
    if(secs.length && 'IntersectionObserver' in window){
      const io = new IntersectionObserver(es=>{
        es.forEach(e=>{
          if(e.isIntersecting){
            Object.values(navById).forEach(a=>a.classList.remove('on'));
            const a=navById[e.target.id]; if(a)a.classList.add('on');
          }
        });
      },{rootMargin:'-45% 0px -50% 0px'});
      secs.forEach(s=>io.observe(s));
    }
  }

  /* ════════════════════════════════════════════════════════════
     SCROLL REVEAL
     ════════════════════════════════════════════════════════════ */
  function initReveal(){
    const els = document.querySelectorAll('.reveal');
    if(!('IntersectionObserver' in window)){ els.forEach(e=>e.classList.add('in')); return; }
    const io = new IntersectionObserver(es=>{
      es.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
    },{rootMargin:'0px 0px -8% 0px',threshold:.08});
    els.forEach(e=>io.observe(e));
  }

  /* ── boot ── */
  function boot(){
    document.querySelectorAll('[data-icon]').forEach(el=> el.innerHTML = svg(el.dataset.icon, +el.dataset.sz||18));
    renderJourney();
    renderSystem();
    initNav();
    initReveal();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
