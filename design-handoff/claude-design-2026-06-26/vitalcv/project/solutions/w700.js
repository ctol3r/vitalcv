/* ═══════════════════════════════════════════════════════════════════════
   VitalCV · Wave 700 — Solutions engine
   Renders the solutions hub + the five role landing pages from W700 data.
   One platform, told ten ways. Depends on vitalcv.js (VICON, nav, reveal)
   and w700-data.js (window.W700).
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
  "use strict";
  const W = window.W700;
  if(!W) return;
  const icon = (n,s)=> (window.VICON ? window.VICON(n,s||18) : '');
  const ARROW = '<svg class="arrow" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  const CHK = (s)=> `<svg width="${s||16}" height="${s||16}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l4 4L19 6"/></svg>`;

  /* ════════════════════════════════════════════════════════════
     HUB · outcome switchboard (D4) + solutions directory (D1)
     ════════════════════════════════════════════════════════════ */
  function renderOutcomeSwitch(){
    const rail = document.getElementById('outcomeRail');
    const stage = document.getElementById('outcomeStage');
    if(!rail || !stage) return;
    const OUT = W.OUTCOMES;

    rail.innerHTML = OUT.map((o,i)=>`
      <button class="ob" data-i="${i}">
        <span class="ob-ic">${icon(o.icon,15)}</span>
        <span class="ob-tx">${o.name}</span>
      </button>`).join('');

    function pageHref(role){
      const s = W.SOL[role];
      return (s && s.page) ? s.page : 'VitalCV Solutions.html';
    }

    function select(i){
      const o = OUT[i];
      rail.querySelectorAll('.ob').forEach((b,bi)=> b.classList.toggle('on', bi===i));
      stage.innerHTML = `
        <div class="os-l">
          <div class="os-tag"><span class="n mono">OUTCOME ${String(i+1).padStart(2,'0')} / ${String(OUT.length).padStart(2,'0')}</span><span>·</span><span>${o.tag}</span></div>
          <h3>${o.h}</h3>
          <p class="os-sub">${o.sub}</p>
          <div class="os-metric">
            <div class="big">${o.big}${o.u?`<span class="u">${o.u}</span>`:''}</div>
            <div class="cap">${o.cap}</div>
          </div>
        </div>
        <div class="os-r">
          <div class="os-rh">Who reaches this outcome</div>
          ${o.who.map(w=>`
            <a class="os-who" href="${pageHref(w.role)}">
              <span class="wi">${icon(w.icon,17)}</span>
              <span class="wt"><span class="wn">${w.nm}</span><span class="ws">${w.sub}</span></span>
              <span class="wgo">${ARROW}</span>
            </a>`).join('')}
        </div>`;
    }
    rail.querySelectorAll('.ob').forEach(b=>{
      b.addEventListener('click',()=> select(+b.dataset.i));
      b.addEventListener('mouseenter',()=>{ if(window.matchMedia('(hover:hover)').matches) select(+b.dataset.i); });
    });
    select(0);
  }

  function renderDirectory(){
    const grid = document.getElementById('dirGrid');
    if(!grid) return;
    grid.innerHTML = W.DIR_ORDER.map(key=>{
      const s = W.SOL[key];
      const live = !!s.page;
      const href = live ? s.page : 'VitalCV Solutions.html';
      return `
      <a class="dircard${s.feature?' feature':''}" href="${href}">
        <span class="dc-ic">${icon(s.icon,20)}</span>
        <span class="dc-kind">${s.kind}</span>
        <span class="dc-nm">${s.name}</span>
        <span class="dc-lede">${s.dirLede}</span>
        <span class="dc-go ${live?'live':''}">${live?'Open solution':'In the platform'} ${live?ARROW:''}${live?'<span class="pg">page</span>':''}</span>
      </a>`;
    }).join('');
  }

  /* ════════════════════════════════════════════════════════════
     ROLE PAGE — build everything from data-role
     ════════════════════════════════════════════════════════════ */
  function buildHero(r){
    const h = r.hero;
    return `
    <section class="role-hero">
      <div class="grid-bg"></div>
      <div class="in">
        <div class="rh-copy reveal">
          <div class="rh-eyebrow"><span class="ic">${icon(r.icon,13)}</span>${h.eyebrow}</div>
          <h1>${h.h1}</h1>
          <p class="lede">${h.lede}</p>
          <div class="cta">
            <a class="btn btn-acc" href="#journey">See your journey ${ARROW}</a>
            <a class="btn btn-soft" href="#roi">Run the numbers</a>
          </div>
          <div class="proofs">
            ${h.proofs.map(p=>`<span class="pr">${CHK(15)}<b>${p.b}</b>${p.t}</span>`).join('')}
          </div>
        </div>
        <div class="rh-panel reveal d1">
          <div class="pt">
            <div class="ttl">
              <span class="pi">${icon(r.icon,20)}</span>
              <div><div class="pn">${h.panel.name}</div><div class="ps">${h.panel.sub}</div></div>
            </div>
            <div class="pv">${CHK(11)}${h.panel.verified}</div>
          </div>
          <div class="rh-stats">
            ${h.panel.stats.map(s=>`
              <div class="st">
                <div class="k">${s.k}</div>
                <div class="v">${s.v}${s.u?`<span class="u">${s.u}</span>`:''}${s.delta?`<span class="delta">${s.delta}</span>`:''}</div>
                <div class="n">${s.n}</div>
              </div>`).join('')}
          </div>
          <div class="pf">${icon('replay',14)}${h.panel.foot}</div>
        </div>
      </div>
    </section>`;
  }

  function buildJourney(r){
    const j = r.journey;
    return `
    <section class="journey-sec" id="journey">
      <div class="wrap">
        <div class="sechead reveal">
          <span class="eyebrow"><span class="num">→</span> Your solution journey</span>
          <h2 class="sectitle">One record, followed <em>step by step.</em></h2>
          <p class="seclede">${j.intro}</p>
        </div>
        <div class="jflow reveal d1">
          <div class="jflow-track" id="jflowTrack" style="grid-template-columns:repeat(${j.stages.length},1fr)"></div>
          <div class="jflow-panel" id="jflowPanel"></div>
        </div>
      </div>
    </section>`;
  }

  function wireJourney(r){
    const track = document.getElementById('jflowTrack');
    const panel = document.getElementById('jflowPanel');
    if(!track || !panel) return;
    const S = r.journey.stages;
    track.innerHTML = '<div class="base"></div><div class="prog" id="jflowProg"></div>' +
      S.map((s,i)=>`
        <button class="jstep" data-i="${i}">
          <span class="ring"></span>
          <span class="ix mono">${s.ix}</span>
          <span class="nm">${s.nm}</span>
        </button>`).join('');

    function select(i){
      const s = S[i];
      track.querySelectorAll('.jstep').forEach((b,bi)=>{
        b.classList.toggle('on', bi===i);
        b.classList.toggle('done', bi<=i);
      });
      const prog = document.getElementById('jflowProg');
      if(prog) prog.style.width = (i/(S.length-1)*100)+'%';
      panel.innerHTML = `
        <div class="jfp-l">
          <div class="jfp-tag"><span class="chip chip-acc"><span class="cd"></span>${s.nm}</span><span class="ix mono">Step ${String(i+1).padStart(2,'0')} / ${String(S.length).padStart(2,'0')}</span></div>
          <h3>${s.title}</h3>
          <p class="desc">${s.desc}</p>
          <div class="jfp-gain">${icon('spark',14)}${s.gain}</div>
        </div>
        <div class="jfp-r">
          <div class="jfp-rh"><span>Signed evidence · this step</span><span>${icon('shield',13)}</span></div>
          ${s.events.map(e=>`
            <div class="jfp-ev ${e.key?'key':''}">
              <span class="ic">${icon(e.icon,15)}</span>
              <span class="tx"><div class="et">${e.t}</div><div class="es">${e.s}</div></span>
              ${e.key?'<span class="tg chip chip-acc" style="font-size:9px">NEW</span>':'<span class="tg chip chip-ok"><span class="cd"></span>Held</span>'}
            </div>`).join('')}
        </div>`;
    }
    track.querySelectorAll('.jstep').forEach(b=> b.addEventListener('click',()=> select(+b.dataset.i)));
    select(0);
  }

  function buildRoleOutcomes(r){
    const o = r.outcomes;
    return `
    <section class="roleout-sec" id="outcomes">
      <div class="wrap">
        <div class="sechead reveal">
          <span class="eyebrow"><span class="num">→</span> Outcomes, not features</span>
          <h2 class="sectitle">Measured by what <em>changes,</em> not what we shipped.</h2>
          <p class="seclede">${o.intro}</p>
        </div>
        <div class="roleout-grid">
          ${o.cards.map((c,i)=>`
            <div class="rocard${c.feature?' feature':''} reveal${i%3?` d${i%3}`:''}">
              <div class="ro-v">${c.v}${c.u?`<span class="u">${c.u}</span>`:''}${c.delta?`<span class="delta">${c.delta}</span>`:''}</div>
              <div class="ro-h">${c.h}</div>
              <div class="ro-s">${c.s}</div>
              <div class="ro-src"><span class="cd"></span>${c.src}</div>
            </div>`).join('')}
        </div>
      </div>
    </section>`;
  }

  function buildWorkflow(r){
    const w = r.workflow;
    const col = (c, kind)=>`
      <div class="wfcol ${kind}">
        <div class="wf-h"><span class="wf-lbl">${c.lbl}</span><span class="chip ${kind==='next'?'chip-acc':'chip-ghost'}"><span class="cd"></span>${c.tag}</span></div>
        <ol class="wf-steps">
          ${c.steps.map((t,i)=>`<li><span class="wn">${String(i+1).padStart(2,'0')}</span><span>${t}</span></li>`).join('')}
        </ol>
        <div class="wf-foot">${kind==='next'?CHK(14):icon('clock',14)}<span>${c.foot}</span></div>
      </div>`;
    return `
    <section class="wf-sec">
      <div class="wrap">
        <div class="sechead reveal">
          <span class="eyebrow"><span class="num">→</span> The workflow, replaced</span>
          <h2 class="sectitle">From serial and manual to <em>replay and parallel.</em></h2>
          <p class="seclede">The same record turns a chain of waiting into a set of steps that run at once.</p>
        </div>
        <div class="wfwrap reveal d1">
          ${col(w.now,'now')}
          <div class="wf-arrow">${icon('route',20)}</div>
          ${col(w.next,'next')}
        </div>
      </div>
    </section>`;
  }

  function buildROI(r){
    const roi = r.roi;
    return `
    <section class="roi-sec" id="roi">
      <div class="grid-bg"></div>
      <div class="wrap">
        <div class="sechead reveal">
          <span class="eyebrow"><span class="num">→</span> Enterprise ROI</span>
          <h2 class="sectitle">${roi.title}</h2>
          <p class="seclede">${roi.lede}</p>
        </div>
        <div class="roi-grid reveal d1">
          <div class="roi-inputs">
            <div class="rih">${icon('chart',15)} Your inputs · drag to model</div>
            <div id="roiInputs"></div>
          </div>
          <div class="roi-out">
            <div class="glow"></div>
            <div class="ro-lbl">${roi.accent}</div>
            <div class="ro-headline" id="roiHeadline"></div>
            <div class="ro-cap" id="roiCap"></div>
            <div class="roi-break" id="roiBreak"></div>
            <div class="roi-foot" id="roiFoot">${CHK(14)}<span></span></div>
          </div>
        </div>
      </div>
    </section>`;
  }

  function wireROI(r){
    const roi = r.roi;
    const mount = document.getElementById('roiInputs');
    if(!mount) return;
    const vals = {};
    roi.inputs.forEach(inp=> vals[inp.key] = inp.def);

    function fmtVal(inp,val){
      if(inp.money) return W.money(val);
      if(inp.unit==='%') return val+'<span class="u">%</span>';
      if(inp.unit && inp.unit!=='$') return val+`<span class="u">${inp.unit}</span>`;
      return W.num(val);
    }
    function fmtScale(inp,val){
      if(inp.money) return W.money(val);
      return W.num(val)+(inp.unit&&inp.unit!=='$'&&inp.unit!=='%'?inp.unit:(inp.unit==='%'?'%':''));
    }

    mount.innerHTML = roi.inputs.map((inp,i)=>`
      <div class="rin">
        <div class="rin-top">
          <span class="rl">${inp.label}</span>
          <span class="rv" id="rv_${inp.key}">${fmtVal(inp,inp.def)}</span>
        </div>
        <input type="range" id="ri_${inp.key}" min="${inp.min}" max="${inp.max}" step="${inp.step}" value="${inp.def}" />
        <div class="rin-scale"><span>${fmtScale(inp,inp.min)}</span><span>${fmtScale(inp,inp.max)}</span></div>
      </div>`).join('');

    function recompute(){
      const out = roi.compute(vals);
      const hl = document.getElementById('roiHeadline');
      const cap = document.getElementById('roiCap');
      const brk = document.getElementById('roiBreak');
      const foot = document.querySelector('#roiFoot span');
      if(hl) hl.innerHTML = `${out.pre?`<span class="pre">${out.pre}</span>`:''}${out.headline}${out.u?`<span class="u">${out.u}</span>`:''}`;
      if(cap) cap.innerHTML = out.cap;
      if(brk) brk.innerHTML = out.breaks.map(b=>`<div class="rb"><div class="k">${b.k}</div><div class="v">${b.v}${b.u?`<span class="u">${b.u}</span>`:''}</div></div>`).join('');
      if(foot) foot.textContent = out.foot;
    }

    roi.inputs.forEach(inp=>{
      const el = document.getElementById('ri_'+inp.key);
      const label = document.getElementById('rv_'+inp.key);
      el.addEventListener('input',()=>{
        vals[inp.key] = +el.value;
        label.innerHTML = fmtVal(inp, +el.value);
        recompute();
      });
    });
    recompute();
  }

  function buildXsell(currentKey){
    const others = W.DIR_ORDER.filter(k=> k!==currentKey).slice(0,8);
    return `
    <section class="xsell-sec">
      <div class="wrap">
        <div class="sechead reveal">
          <span class="eyebrow"><span class="num">→</span> The same platform, every other role</span>
          <h2 class="sectitle">It’s built for you — and it’s the <em>same</em> trust infrastructure.</h2>
          <p class="seclede">Different story, different value, one verified record. The clinician owns it; everyone else reads, attests to, and builds on it.</p>
        </div>
        <div class="xgrid reveal d1">
          ${others.map(k=>{
            const s = W.SOL[k];
            const href = s.page ? s.page : 'VitalCV Solutions.html';
            return `<a class="xcard" href="${href}">
              <span class="xi">${icon(s.icon,17)}</span>
              <span class="xt"><span class="xn">${s.name}</span><span class="xs">${s.kind}</span></span>
            </a>`;
          }).join('')}
        </div>
      </div>
    </section>`;
  }

  function buildCTA(r){
    return `
    <section class="close">
      <div class="grid-bg"></div>
      <div class="in">
        <div class="reveal">
          <span class="eyebrow center">One platform, every role</span>
          <h2>${r.cta.h}</h2>
          <p>Run VitalCV on ten of your NPIs and watch a verified record carry itself across every door — clinician, recruiter, system, and payer reading one source of truth.</p>
          <div class="cta">
            <a class="btn btn-acc" href="../Pilot Intake.html">Run a pilot on 10 NPIs ${ARROW}</a>
            <a class="btn btn-line" href="${r.cta.primaryHref}">${r.cta.primary}</a>
          </div>
        </div>
      </div>
    </section>`;
  }

  function renderRolePage(){
    const main = document.getElementById('roleMain');
    if(!main) return;
    const key = main.dataset.role;
    const r = W.SOL[key];
    if(!r) return;
    document.title = `VitalCV · For ${r.name} — built on one verified record`;
    main.innerHTML =
      buildHero(r) +
      buildJourney(r) +
      buildRoleOutcomes(r) +
      buildWorkflow(r) +
      buildROI(r) +
      buildXsell(key) +
      buildCTA(r);
    wireJourney(r);
    wireROI(r);
    // re-observe reveals injected after vitalcv.js boot
    initReveal();
  }

  /* ── reveal (robust: in-view now → immediate, rest → observed, + failsafe) ── */
  function initReveal(){
    const els = [...document.querySelectorAll('.reveal:not(.in)')];
    if(!els.length) return;
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const inView = (e)=>{ const r = e.getBoundingClientRect(); return r.top < vh*0.92 && r.bottom > 0; };
    // anything already on screen shows at once (no fade-in dependency for above-fold)
    els.forEach(e=>{ if(inView(e)) e.classList.add('in'); });

    const rest = els.filter(e=>!e.classList.contains('in'));
    if('IntersectionObserver' in window){
      const io = new IntersectionObserver(ev=>{
        ev.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
      },{rootMargin:'0px 0px -8% 0px',threshold:.04});
      rest.forEach(e=>io.observe(e));
    } else {
      rest.forEach(e=>e.classList.add('in'));
    }
    // failsafe — never leave content stuck invisible
    setTimeout(()=> document.querySelectorAll('.reveal:not(.in)').forEach(e=>{
      if(inView(e)) e.classList.add('in');
    }), 1400);
    window.addEventListener('scroll', ()=>{
      document.querySelectorAll('.reveal:not(.in)').forEach(e=>{ if(inView(e)) e.classList.add('in'); });
    }, {passive:true});
  }

  function boot(){
    renderOutcomeSwitch();
    renderDirectory();
    renderRolePage();
    initReveal();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
