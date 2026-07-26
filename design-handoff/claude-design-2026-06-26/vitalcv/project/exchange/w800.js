/* ═══════════════════════════════════════════════════════════════════════
   VitalCV · Wave 800 — Trust Exchange · interactions
   Live Trust Map (network graph) · Trust Marketplace · Issuer & Verifier
   portal workspaces · live network counters.
   Depends on vitalcv.js (window.VICON) loaded first.
   Every render fn no-ops if its container is absent → one file, three pages.
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
  "use strict";
  const svg = window.VICON || function(){return '';};
  const $  = (s,r)=> (r||document).querySelector(s);
  const $$ = (s,r)=> Array.from((r||document).querySelectorAll(s));

  /* ════════════════════════════════════════════════════════════
     LIVE NETWORK COUNTERS — count-up + a live tick
     ════════════════════════════════════════════════════════════ */
  function initCounters(){
    const els = $$('[data-count]');
    if(!els.length) return;
    els.forEach(el=>{
      const target = parseFloat(el.dataset.count);
      const dec = (el.dataset.dec|0);
      const dur = 1100, t0 = performance.now();
      function step(t){
        const p = Math.min(1,(t-t0)/dur);
        const e = 1-Math.pow(1-p,3);
        const val = target*e;
        el.textContent = val.toLocaleString('en-US',{minimumFractionDigits:dec,maximumFractionDigits:dec});
        if(p<1) requestAnimationFrame(step);
        else el.textContent = target.toLocaleString('en-US',{minimumFractionDigits:dec,maximumFractionDigits:dec});
      }
      requestAnimationFrame(step);
    });
    // a single live-incrementing counter (evidence flowing today)
    const live = $('[data-live]');
    if(live){
      let n = parseFloat(live.dataset.count)||0;
      setInterval(()=>{ n += Math.floor(Math.random()*3)+1; live.textContent = n.toLocaleString('en-US'); }, 2600);
    }
  }

  /* ════════════════════════════════════════════════════════════
     LIVE TRUST MAP — directed network: Issuer → Evidence →
     Professional → Organization → Career.  (Wave 800 · D5)
     ════════════════════════════════════════════════════════════ */
  const TM_W = 1200, TM_H = 470, BW = 158, BH = 56;
  const COLX = [98, 352, 600, 850, 1102];

  const TM_NODES = [
    // col 0 — issuers
    {id:'iss_school',  col:0, y:58,  t:'Medical School', s:'AAMC · LCME', icon:'grad',
      d:{kind:'Issuer · accredited', h:'Mountain State School of Medicine', p:'Signs the foundational credential — degree, transcript, and enrollment dates — at the moment of conferral. The first link every later verifier replays against.', chips:['Diploma','Transcript','Enrollment','T1 source']}},
    {id:'iss_res',     col:0, y:158, t:'Residency', s:'NRMP · ACGME', icon:'steth',
      d:{kind:'Issuer · training program', h:'Cedar Health Internal Medicine', p:'Attests completed training, supervised hours, and program standing. Issued once, it replaces the verification letters every future employer would otherwise re-request.', chips:['Training','Supervised hrs','Program standing','T2 source']}},
    {id:'iss_board',   col:0, y:258, t:'Specialty Board', s:'ABMS', icon:'badge',
      d:{kind:'Issuer · certifying board', h:'American Board of Internal Medicine', p:'Issues board certification as a signed attestation bound to the professional’s NPI — the differentiated signal that distinguishes one clinician from the next.', chips:['Board cert','MOC status','NPI-bound','T3 source']}},
    {id:'iss_hosp',    col:0, y:358, t:'Hospital', s:'Cedar Health', icon:'building',
      d:{kind:'Issuer · credentialing org', h:'Cedar Health System', p:'Grants privileges and confirms standing. As an issuer it extends the chain; it never modifies the core record the clinician owns.', chips:['Privileges','DEA confirm','Standing','Extends core']}},
    // col 1 — evidence
    {id:'ev_train',    col:1, y:108, t:'Training verified', s:'signed receipt', icon:'file',
      d:{kind:'Evidence · signed', h:'Training & education receipt', p:'A cryptographic receipt carrying the source, the question asked, and the timestamp — replayable for 7 years by any verifier, with no VitalCV in the loop.', chips:['Replayable 7 yrs','No PHI stored','SHA-256 sealed']}},
    {id:'ev_cert',     col:1, y:235, t:'Board certified', s:'signed receipt', icon:'badge',
      d:{kind:'Evidence · signed', h:'Certification receipt', p:'The board’s attestation, signed at the source and bound to the NPI. Verifiers accept the receipt instead of phoning the board.', chips:['NPI-bound','Source-signed','Accept, don’t re-ask']}},
    {id:'ev_priv',     col:1, y:362, t:'Privileges granted', s:'signed receipt', icon:'shield',
      d:{kind:'Evidence · signed', h:'Privileges & DEA receipt', p:'Standing, privileges, and DEA confirmation as one sealed receipt. Freshness is tracked so a verifier always knows how current it is.', chips:['Freshness tracked','DEA confirmed','Sealed']}},
    // col 2 — professional (center)
    {id:'pro',         col:2, y:208, t:'Dr. A. Okonkwo', s:'NPI 1043829176', icon:'user', center:true,
      d:{kind:'Professional · owner', h:'The clinician owns the chain', p:'Every signed receipt flows into one portable identity owned by the clinician — not by any employer, board, or VitalCV. They carry it from organization to organization, never re-collecting a thing.', chips:['Owns the record','Portable','19 signed items','Trust T3']}},
    // col 3 — organizations
    {id:'org_emp',     col:3, y:108, t:'Employer', s:'verifies by replay', icon:'building',
      d:{kind:'Organization · verifier', h:'Hires by replay, not re-collection', p:'A new employer verifies by replaying receipts against the original federal evidence — credentialing-by-proxy. Onboarding that took a quarter resolves in days.', chips:['−67 days','Replay-verified','Audit-locked']}},
    {id:'org_payer',   col:3, y:235, t:'Payer', s:'PECOS enrollment', icon:'money',
      d:{kind:'Organization · verifier', h:'Enrollment in parallel, not in series', p:'The payer enrolls against the same attested evidence the employer used — no duplicated verification, no waiting in line behind privileging.', chips:['Parallel enrol','PECOS','No re-keying']}},
    {id:'org_staff',   col:3, y:362, t:'Staffing', s:'locum network', icon:'route',
      d:{kind:'Organization · verifier', h:'Deploys pre-credentialed', p:'A staffing network places a clinician who is already verified — the locum assignment opens the day the receipt is accepted, not weeks later.', chips:['Pre-credentialed','Instant placement','Network-wide']}},
    // col 4 — career
    {id:'car_role',    col:4, y:108, t:'Leadership', s:'Section Chief', icon:'crown',
      d:{kind:'Career · outcome', h:'Reputation compounds into authority', p:'Leadership roles attach to the same identity. Trust is no longer just verified — it is differentiated, portable signal the clinician carries forward.', chips:['Directorship','Verified peer refs','Portable signal']}},
    {id:'car_panel',   col:4, y:235, t:'Opportunity', s:'matched on signal', icon:'target',
      d:{kind:'Career · outcome', h:'The right role finds a trusted record', p:'Panels, roles, and appointments surface against real verified signal instead of a re-keyed résumé — and the clinician responds pre-credentialed.', chips:['Signal-matched','Pre-credentialed','No re-keyed CV']}},
    {id:'car_research', col:4, y:362, t:'Research & society', s:'professional society', icon:'laurel',
      d:{kind:'Career · outcome', h:'The record outlives the practice', p:'Research output, society membership, and emeritus standing extend the same chain — a complete career, replayable against its original sources for as long as the receipts live.', chips:['Society member','Research-linked','Legacy chain']}},
  ];

  const TM_EDGES = [
    ['iss_school','ev_train'], ['iss_res','ev_train'],
    ['iss_board','ev_cert'], ['iss_hosp','ev_priv'],
    ['ev_train','pro'], ['ev_cert','pro'], ['ev_priv','pro'],
    ['pro','org_emp'], ['pro','org_payer'], ['pro','org_staff'],
    ['org_emp','car_role'], ['org_payer','car_panel'], ['org_staff','car_research'],
  ];

  function tmNode(id){ return TM_NODES.find(n=>n.id===id); }
  function edgePath(e){
    const a=tmNode(e[0]), b=tmNode(e[1]);
    const ax=COLX[a.col]+BW/2, ay=a.y+BH/2;
    const bx=COLX[b.col]-BW/2, by=b.y+BH/2;
    const mx=(ax+bx)/2;
    return `M${ax},${ay} C${mx},${ay} ${mx},${by} ${bx},${by}`;
  }

  function renderTrustMap(){
    const stage = document.getElementById('trustmap');
    if(!stage) return;

    // edges
    let edgesSVG='', pulseSVG='';
    TM_EDGES.forEach((e,i)=>{
      const d = edgePath(e);
      const a = tmNode(e[0]);
      edgesSVG += `<path class="tm-edge" id="tme-${i}" data-from="${e[0]}" data-to="${e[1]}" d="${d}"/>`;
      // a pulse travelling the edge; staggered by source column → a left-to-right wave
      const begin = (a.col*0.7).toFixed(2);
      pulseSVG += `<circle class="tm-pulse" r="3.4" opacity="0.9">
        <animateMotion dur="2.8s" begin="${begin}s" repeatCount="indefinite" path="${d}"/>
        <animate attributeName="opacity" values="0;0.95;0.95;0" keyTimes="0;0.15;0.8;1" dur="2.8s" begin="${begin}s" repeatCount="indefinite"/>
      </circle>`;
    });

    // nodes
    let nodesSVG='';
    TM_NODES.forEach(n=>{
      const x=COLX[n.col]-BW/2, y=n.y;
      nodesSVG += `<g class="tm-node ${n.center?'center':''}" data-id="${n.id}" transform="translate(${x},${y})">
        <rect class="nd-box" x="0" y="0" width="${BW}" height="${BH}" rx="11"/>
        <rect class="nd-ic" x="13" y="13" width="30" height="30" rx="8"/>
        <g class="nd-glyph" transform="translate(19,19) scale(0.75)">${svg(n.icon,24).replace(/<svg[^>]*>|<\/svg>/g,'')}</g>
        <text class="nd-t" x="54" y="26">${n.t}</text>
        <text class="nd-s" x="54" y="41">${n.s.toUpperCase()}</text>
      </g>`;
    });

    stage.innerHTML = `<svg viewBox="0 0 ${TM_W} ${TM_H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Live trust map">
      <g class="tm-edges">${edgesSVG}</g>
      <g class="tm-pulses">${pulseSVG}</g>
      <g class="tm-nodes">${nodesSVG}</g>
    </svg>`;

    const detail = document.getElementById('mapdetail');
    const edgeEls = $$('.tm-edge', stage);
    const nodeEls = $$('.tm-node', stage);

    // adjacency (directed)
    const out={}, inc={};
    TM_EDGES.forEach(e=>{ (out[e[0]]=out[e[0]]||[]).push(e[1]); (inc[e[1]]=inc[e[1]]||[]).push(e[0]); });
    function reach(start,map){ const seen=new Set(),q=[start]; while(q.length){const c=q.shift(); (map[c]||[]).forEach(nx=>{ if(!seen.has(nx)){seen.add(nx);q.push(nx);} });} return seen; }

    function select(id){
      if(!id){ // reset
        edgeEls.forEach(p=>p.classList.remove('lit','dim'));
        nodeEls.forEach(g=>g.classList.remove('sel','dim'));
        if(detail) detail.innerHTML = defaultDetail();
        return;
      }
      const up=reach(id,inc), down=reach(id,out);
      const live=new Set([id,...up,...down]);
      nodeEls.forEach(g=> g.classList.toggle('dim', !live.has(g.dataset.id)) );
      nodeEls.forEach(g=> g.classList.toggle('sel', g.dataset.id===id) );
      edgeEls.forEach(p=>{
        const on = live.has(p.dataset.from) && live.has(p.dataset.to);
        p.classList.toggle('lit', on);
        p.classList.toggle('dim', !on);
      });
      const n=tmNode(id);
      if(detail) detail.innerHTML = `
        <div class="dh">${svg('shield',13)} ${n.d.kind}</div>
        <h4>${n.d.h}</h4>
        <p>${n.d.p}</p>
        <div class="dchips">${n.d.chips.map((c,i)=>`<span class="dchip ${i===n.d.chips.length-1?'ok':''}">${c}</span>`).join('')}</div>`;
    }
    function defaultDetail(){
      return `<div class="dh">${svg('network',13)} The network, live</div>
        <h4>Trust flows left to right — and is owned in the middle</h4>
        <p>Issuers sign evidence. Evidence flows into the professional, who owns it. Organizations verify by replay, and a career compounds. <b style="color:var(--p300)">Select any node</b> to trace its trust path end to end.</p>
        <div class="dchips"><span class="dchip">${TM_NODES.length} nodes</span><span class="dchip">${TM_EDGES.length} verified links</span><span class="dchip ok">Live</span></div>`;
    }

    nodeEls.forEach(g=>{
      g.addEventListener('click',()=> select(g.dataset.id));
      g.addEventListener('mouseenter',()=>{ if(window.matchMedia('(hover:hover)').matches) select(g.dataset.id); });
    });
    stage.addEventListener('mouseleave',()=> select(null));
    select(null);
  }

  /* ════════════════════════════════════════════════════════════
     TRUST MARKETPLACE — directory of trusted issuers (Wave 800 · D4)
     ════════════════════════════════════════════════════════════ */
  const ISSUERS = [
    {nm:'NPPES Registry', cat:'gov', kind:'Federal source', mark:'N', tier:'T1', gov:true,
      caps:['Identity','NPI binding','Active status'], ev:[['Provider identity','NPI'],['Enumeration date','signed']],
      cov:'National · all 50 states', fresh:'high', freshT:'Real-time'},
    {nm:'OIG / LEIE', cat:'gov', kind:'Federal source', mark:'O', tier:'T1', gov:true,
      caps:['Exclusion screen','Sanctions'], ev:[['Exclusion status','clear'],['Reinstatement','tracked']],
      cov:'National', fresh:'high', freshT:'Daily'},
    {nm:'PECOS', cat:'gov', kind:'Federal source', mark:'P', tier:'T1', gov:true,
      caps:['Medicare enrol','Reassignment'], ev:[['Enrollment','active'],['Revalidation','dated']],
      cov:'National', fresh:'mid', freshT:'90-day'},
    {nm:'American Board of Internal Medicine', cat:'board', kind:'Certifying board', mark:'A', tier:'T2',
      caps:['Board cert','MOC status'], ev:[['Certification','signed'],['MOC','current']],
      cov:'National · ABMS member', fresh:'high', freshT:'Live'},
    {nm:'American Board of Surgery', cat:'board', kind:'Certifying board', mark:'S', tier:'T2',
      caps:['Board cert','Re-cert'], ev:[['Certification','signed'],['Subspecialty','linked']],
      cov:'National · ABMS member', fresh:'high', freshT:'Live'},
    {nm:'Mountain State School of Medicine', cat:'school', kind:'Medical school · LCME', mark:'M', tier:'T2',
      caps:['Degree','Transcript','Enrollment'], ev:[['MD conferral','signed'],['Transcript','sealed']],
      cov:'Institution · LCME', fresh:'high', freshT:'On confer'},
    {nm:'Cedar Health Residency', cat:'training', kind:'ACGME program', mark:'C', tier:'T3',
      caps:['Training','Supervised hrs','Standing'], ev:[['Completion','attested'],['Hours','1,240 logged']],
      cov:'Program · ACGME', fresh:'mid', freshT:'Annual'},
    {nm:'Cedar Health System', cat:'hospital', kind:'Credentialing org', mark:'H', tier:'T3',
      caps:['Privileges','DEA confirm','Standing'], ev:[['Privileges','granted'],['Standing','good']],
      cov:'12 facilities · 3 states', fresh:'mid', freshT:'180-day'},
    {nm:'State Medical Board · CA', cat:'board', kind:'State licensing board', mark:'CA', tier:'T1',
      caps:['Licensure','Disciplinary'], ev:[['License','unrestricted'],['Actions','none']],
      cov:'California', fresh:'high', freshT:'Daily'},
    {nm:'DEA Registration', cat:'gov', kind:'Federal source', mark:'D', tier:'T1', gov:true,
      caps:['Controlled-sub reg','Schedule'], ev:[['Registration','active'],['Schedules','II–V']],
      cov:'National', fresh:'mid', freshT:'Annual'},
    {nm:'American College of Cardiology', cat:'society', kind:'Professional society', mark:'C', tier:'T3',
      caps:['Membership','Fellowship','CME'], ev:[['FACC status','signed'],['CME credits','tracked']],
      cov:'National · society', fresh:'low', freshT:'Self-report'},
    {nm:'Veritas Locum Network', cat:'training', kind:'Staffing · verifier', mark:'V', tier:'T3',
      caps:['Placement','Re-verify'], ev:[['Assignments','logged'],['Re-verify','30-day']],
      cov:'Multi-state network', fresh:'mid', freshT:'30-day'},
  ];
  const MKT_CATS = [
    {k:'all', t:'All issuers'}, {k:'gov', t:'Federal sources'}, {k:'board', t:'Boards'},
    {k:'school', t:'Medical schools'}, {k:'training', t:'Training & staffing'},
    {k:'hospital', t:'Hospitals'}, {k:'society', t:'Societies'},
  ];

  function renderMarketplace(){
    const grid = document.getElementById('marketgrid');
    const filt = document.getElementById('marketfilters');
    const search = document.getElementById('marketsearch');
    if(!grid) return;

    if(filt){
      filt.innerHTML = MKT_CATS.map((c,i)=>{
        const n = c.k==='all'? ISSUERS.length : ISSUERS.filter(x=>x.cat===c.k).length;
        return `<button class="mf ${i===0?'on':''}" data-cat="${c.k}">${c.t}<span class="ct">${n}</span></button>`;
      }).join('');
    }

    grid.innerHTML = ISSUERS.map(s=>`
      <div class="icard ${s.gov?'gov':''}" data-cat="${s.cat}" data-nm="${s.nm.toLowerCase()}">
        <div class="ic-top">
          <div class="ic-mark">${s.mark}</div>
          <div class="ic-id">
            <div class="ic-nm">${s.nm}</div>
            <div class="ic-kind">${s.kind}</div>
          </div>
          <div class="ic-tier"><span class="tier"><span class="cd"></span>${s.tier}</span></div>
        </div>
        <div class="ic-caps">
          <div class="ic-lbl">Verification capabilities</div>
          <div class="ic-chips">${s.caps.map(c=>`<span class="ic-chip">${c}</span>`).join('')}</div>
        </div>
        <div class="ic-evt">
          ${s.ev.map(e=>`<div class="ic-ev">${svg('check',14)}<span>${e[0]}</span><span class="em">${e[1]}</span></div>`).join('')}
        </div>
        <div class="ic-foot">
          <span class="ic-cov">${svg('pin',13)}${s.cov}</span>
          <span class="fresh ${s.fresh}"><span class="fbar"><i></i></span><span class="ft">${s.freshT}</span></span>
        </div>
      </div>`).join('');

    let curCat='all', curQ='';
    function apply(){
      $$('.icard',grid).forEach(c=>{
        const okCat = curCat==='all' || c.dataset.cat===curCat;
        const okQ = !curQ || c.dataset.nm.includes(curQ);
        c.classList.toggle('hidden', !(okCat&&okQ));
      });
    }
    if(filt){
      $$('.mf',filt).forEach(b=> b.addEventListener('click',()=>{
        $$('.mf',filt).forEach(x=>x.classList.remove('on')); b.classList.add('on');
        curCat=b.dataset.cat; apply();
      }));
    }
    if(search){ search.addEventListener('input',()=>{ curQ=search.value.trim().toLowerCase(); apply(); }); }
  }

  /* ════════════════════════════════════════════════════════════
     PORTAL TABS (issuer + verifier workspaces)
     ════════════════════════════════════════════════════════════ */
  function initTabs(){
    $$('.pw-tabs').forEach(tabs=>{
      const ws = tabs.closest('.pworkspace') || document;
      $$('.pw-tab',tabs).forEach(tab=> tab.addEventListener('click',()=>{
        $$('.pw-tab',tabs).forEach(x=>x.classList.remove('on')); tab.classList.add('on');
        $$('.pw-pane',ws).forEach(p=>p.classList.toggle('on', p.dataset.pane===tab.dataset.tab));
      }));
    });
  }

  /* ════════════════════════════════════════════════════════════
     ISSUER WORKSPACE — pick evidence type → sign & issue → receipt
     ════════════════════════════════════════════════════════════ */
  const EVTYPES = [
    {id:'degree', n:'Degree & transcript', s:'On conferral', icon:'grad'},
    {id:'training', n:'Training completion', s:'ACGME attested', icon:'steth'},
    {id:'board', n:'Board certification', s:'NPI-bound', icon:'badge'},
    {id:'priv', n:'Privileges & standing', s:'180-day', icon:'shield'},
    {id:'license', n:'License & DEA', s:'State + federal', icon:'lic'},
    {id:'cme', n:'CME & MOC', s:'Cycle tracked', icon:'spark'},
  ];
  function hex(n){ let s=''; const c='0123456789abcdef'; for(let i=0;i<n;i++) s+=c[Math.floor(Math.random()*16)]; return s; }
  function renderIssuer(){
    const wrap = document.getElementById('evtypes');
    if(!wrap) return;
    wrap.innerHTML = EVTYPES.map((e,i)=>`
      <button class="evtype ${i===2?'on':''}" data-id="${e.id}">
        <span class="et-ic">${svg(e.icon,16)}</span>
        <span class="et-tx"><span class="et-n">${e.n}</span><span class="et-s">${e.s}</span></span>
      </button>`).join('');
    let sel = EVTYPES[2];
    $$('.evtype',wrap).forEach(b=> b.addEventListener('click',()=>{
      $$('.evtype',wrap).forEach(x=>x.classList.remove('on')); b.classList.add('on');
      sel = EVTYPES.find(e=>e.id===b.dataset.id);
    }));

    const btn = document.getElementById('issueBtn');
    const rcpt = document.getElementById('signedRcpt');
    const ledger = document.getElementById('issuerLedger');
    if(btn) btn.addEventListener('click',()=>{
      btn.classList.add('busy'); btn.innerHTML = `${svg('clock',15)} Signing at source…`;
      setTimeout(()=>{
        const id = 'ev_'+hex(6);
        const ts = new Date().toISOString().replace('T',' ').slice(0,19)+'Z';
        if(rcpt){
          rcpt.classList.add('show');
          rcpt.innerHTML = `
            <div class="sr-h">${svg('check',15)} Evidence signed & issued — replayable for 7 years</div>
            <div class="sr-rows">
              <div class="sr-r"><div class="k">Evidence</div><div class="v">${sel.n}</div></div>
              <div class="sr-r"><div class="k">Receipt id</div><div class="v">${id}</div></div>
              <div class="sr-r"><div class="k">Source signature</div><div class="v">sha256:${hex(40)}</div></div>
              <div class="sr-r"><div class="k">Issued</div><div class="v">${ts}</div></div>
            </div>`;
        }
        if(ledger){
          const row = document.createElement('div');
          row.className='ledrow';
          row.innerHTML = `
            <span class="lr-ic">${svg(sel.icon,15)}</span>
            <span class="lr-tx"><div class="lr-n">${sel.n}</div><div class="lr-s">${id} · Dr. A. Okonkwo · NPI 1043829176</div></span>
            <span class="lr-meta"><span class="chip chip-ok"><span class="cd"></span>Issued</span><div class="lr-when">just now</div></span>`;
          ledger.insertBefore(row, ledger.firstChild);
          const tab = document.querySelector('.pw-tab[data-tab="ledger"] .ct');
          if(tab) tab.textContent = (parseInt(tab.textContent||'0',10)+1);
        }
        btn.classList.remove('busy'); btn.innerHTML = `${svg('badge',15)} Sign &amp; issue evidence`;
      }, 1100);
    });
  }

  /* ════════════════════════════════════════════════════════════
     VERIFIER WORKSPACE — review (expand replay) → accept
     ════════════════════════════════════════════════════════════ */
  function renderVerifier(){
    const inbox = document.getElementById('verifierInbox');
    if(!inbox) return;
    $$('.vreq',inbox).forEach(req=>{
      const reviewBtn = $('.js-review',req);
      const acceptBtn = $('.js-accept',req);
      if(reviewBtn) reviewBtn.addEventListener('click',()=>{
        req.classList.toggle('open');
        reviewBtn.textContent = req.classList.contains('open') ? 'Hide replay' : 'Review';
      });
      if(acceptBtn) acceptBtn.addEventListener('click',()=>{
        req.classList.add('acc');
        const act = $('.vh-act',req);
        if(act) act.innerHTML = `<span class="vh-state">${svg('check',13)} Accepted</span>`;
        const tab = document.querySelector('.pw-tab[data-tab="freshness"] .ct');
        // bump accepted count if present
        const cnt = document.getElementById('acceptedCount');
        if(cnt) cnt.textContent = (parseInt(cnt.textContent||'0',10)+1);
      });
    });
  }

  /* ── boot ── */
  function boot(){
    initCounters();
    renderTrustMap();
    renderMarketplace();
    initTabs();
    renderIssuer();
    renderVerifier();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
