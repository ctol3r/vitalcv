/* ═══════════════════════════════════════════════════════════════════════
   VitalCV · Wave 900 — Professional Trust Cloud · core
   Icon extension (adds cloud/code/webhook/etc to the base set),
   live counters, op-bar nav state. Depends on vitalcv.js (window.VICON).
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
  "use strict";
  const base = window.VICON || function(){return '';};

  /* extra glyphs the cloud surfaces need, in the same stroke register */
  const EX = {
    cloud:'<path d="M7 18a4 4 0 01-.5-7.97A5.5 5.5 0 0117.5 9.5 4 4 0 0117 18z"/>',
    code:'<path d="M9 8l-4 4 4 4M15 8l4 4-4 4"/>',
    webhook:'<path d="M9 8a3 3 0 114.5 2.6l2.2 3.8M7 15a3 3 0 105.2 1.5h4.4M16.5 13a3 3 0 11-3.7 4.4"/>',
    pulse:'<path d="M3 12h4l2-6 4 12 2-6h6"/>',
    bolt:'<path d="M13 3L5 13h6l-1 8 8-10h-6z"/>',
    gauge:'<path d="M4 18a8 8 0 1116 0"/><path d="M12 18l4-5"/><circle cx="12" cy="18" r="1.2"/>',
    box:'<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
    compass:'<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
    grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    medal:'<circle cx="12" cy="14" r="6"/><path d="M12 11v3l2 1.5M9 3l2.5 5M15 3l-2.5 5"/>',
    book:'<path d="M4 4.5A2.5 2.5 0 016.5 2H20v16H6.5A2.5 2.5 0 004 20.5z"/><path d="M4 20.5A2.5 2.5 0 016.5 18H20"/>',
    handshake:'<path d="M8 12l2.5-2.5a2 2 0 012.8 0L17 13M8 12l-3 3M17 13l3-3M12 8l4 4M11 17l1.5 1.5a2 2 0 002.8-2.8"/>',
  };
  function ic(name, sz){
    sz = sz || 18;
    if(EX[name]) return `<svg width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${EX[name]}</svg>`;
    return base(name, sz);
  }
  window.CICON = ic;

  /* ── live count-up + a couple of live-tick counters ── */
  function initCounters(){
    const els = Array.from(document.querySelectorAll('[data-count]'));
    els.forEach(el=>{
      const target = parseFloat(el.dataset.count);
      const dec = (el.dataset.dec|0);
      const dur = 1100, t0 = performance.now();
      function step(t){
        const p = Math.min(1,(t-t0)/dur);
        const e = 1-Math.pow(1-p,3);
        el.textContent = (target*e).toLocaleString('en-US',{minimumFractionDigits:dec,maximumFractionDigits:dec});
        if(p<1) requestAnimationFrame(step);
        else el.textContent = target.toLocaleString('en-US',{minimumFractionDigits:dec,maximumFractionDigits:dec});
      }
      requestAnimationFrame(step);
    });
    document.querySelectorAll('[data-live]').forEach(live=>{
      let n = parseFloat(live.dataset.count)||0;
      const lo = +live.dataset.lo || 1, hi = +live.dataset.hi || 3;
      setInterval(()=>{ n += Math.floor(Math.random()*(hi-lo+1))+lo; live.textContent = n.toLocaleString('en-US'); }, 2600);
    });
  }
  // expose so dynamically-rendered surfaces (status cards) can animate injected counters
  window.__cloudCounters = initCounters;

  /* ── nav scroll state + mobile toggle ── */
  function initNav(){
    const nav = document.getElementById('nav');
    if(nav){
      const onScroll = ()=> nav.classList.toggle('stuck', window.scrollY>8);
      window.addEventListener('scroll', onScroll, {passive:true}); onScroll();
    }
    const links = document.getElementById('navlinks');
    const toggle = document.getElementById('navtoggle');
    if(toggle && links){
      toggle.addEventListener('click', ()=> links.classList.toggle('open'));
      links.querySelectorAll('a').forEach(a=> a.addEventListener('click', ()=> links.classList.remove('open')));
    }
  }

  /* ── scroll reveal ── */
  function initReveal(){
    const els = document.querySelectorAll('.reveal');
    if(!('IntersectionObserver' in window)){ els.forEach(e=>e.classList.add('in')); return; }
    const io = new IntersectionObserver(es=>{
      es.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); } });
    },{rootMargin:'0px 0px -8% 0px',threshold:.08});
    els.forEach(e=>io.observe(e));
  }

  /* ── render any inline [data-icon] placeholders ── */
  function paintIcons(){
    document.querySelectorAll('[data-icon]').forEach(el=> el.innerHTML = ic(el.dataset.icon, +el.dataset.sz||18));
  }

  function boot(){ paintIcons(); initCounters(); initNav(); initReveal(); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
