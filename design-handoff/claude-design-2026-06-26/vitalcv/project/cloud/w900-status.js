/* ═══════════════════════════════════════════════════════════════════════
   VitalCV · Wave 900 — Platform Status (D5)
   Real-time platform dashboard: evidence activity, recognition events,
   trust exchanges, API usage, integrations, platform health.
   No-ops if #statmetrics is absent.
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
  "use strict";
  const ic = window.CICON || window.VICON || function(){return '';};
  const rnd = (a,b)=> a + Math.random()*(b-a);

  /* sparkline path from an array of 0..1 values */
  function sparkPath(vals, w, h){
    const n = vals.length, step = w/(n-1);
    let d='', f='';
    vals.forEach((v,i)=>{ const x=i*step, y=h-(v*(h-4))-2; d += (i?'L':'M')+x.toFixed(1)+','+y.toFixed(1)+' '; });
    f = d + `L${w},${h} L0,${h} Z`;
    return {line:d.trim(), fill:f.trim()};
  }
  function spark(seed){
    const vals = []; let v = rnd(.4,.6);
    for(let i=0;i<24;i++){ v += rnd(-.16,.18); v = Math.max(.12,Math.min(.96,v)); vals.push(v); }
    const W=180,H=42, p = sparkPath(vals,W,H);
    const id = 'sf'+seed;
    return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><defs>
      <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#6366f1" stop-opacity=".45"/>
        <stop offset="1" stop-color="#6366f1" stop-opacity="0"/>
      </linearGradient></defs>
      <path class="sf" style="fill:url(#${id})" d="${p.fill}"/>
      <path class="sl" d="${p.line}"/></svg>`;
  }

  const METRICS = [
    { nm:'Evidence activity', sub:'receipts signed', icon:'file', acc:true, v:4731231, dec:0, live:[2,6], meta:'signed today \u00b7 ', delta:'+12.4%' },
    { nm:'Recognition events', sub:'standing attested', icon:'medal', acc:false, v:18204, dec:0, live:[1,3], meta:'this week \u00b7 ', delta:'+6.1%' },
    { nm:'Trust exchanges', sub:'accepted by replay', icon:'shield', acc:false, v:28940, dec:0, live:[1,4], meta:'verifications today \u00b7 ', delta:'+9.0%' },
    { nm:'API usage', sub:'platform calls', icon:'code', acc:true, v:9.62, dec:2, u:'M', live:null, meta:'calls / 24h \u00b7 ', delta:'+3.7%' },
    { nm:'Integrations', sub:'webhooks delivered', icon:'webhook', acc:false, v:1240880, dec:0, live:[3,9], meta:'p99 184ms \u00b7 ', delta:'99.98%' },
    { nm:'Platform health', sub:'composite SLA', icon:'gauge', acc:false, v:99.99, dec:2, u:'%', live:null, meta:'30-day uptime \u00b7 ', delta:'all systems go' },
  ];

  function renderMetrics(){
    const wrap = document.getElementById('statmetrics');
    if(!wrap) return;
    wrap.innerHTML = METRICS.map((m,i)=>`
      <div class="statcard ${m.acc?'acc':''}">
        <div class="st-h">
          <div class="st-ic">${ic(m.icon,19)}</div>
          <div><div class="st-nm">${m.nm}</div><div class="st-sub">${m.sub}</div></div>
          <div class="st-state"><span class="chip-live"><span class="cd"></span>Live</span></div>
        </div>
        <div class="st-v"><span data-count="${m.v}"${m.dec?` data-dec="${m.dec}"`:''}${m.live?` data-live data-lo="${m.live[0]}" data-hi="${m.live[1]}"`:''}>${m.v}</span>${m.u?`<span class="u">${m.u}</span>`:''}</div>
        <div class="st-meta">${m.meta}<span class="up">${m.delta}</span></div>
        <div class="spark">${spark(i)}</div>
      </div>`).join('');
  }

  /* activity feed — ticking events */
  const FEED_KINDS = [
    {cls:'ev',  icon:'file',     verb:'Evidence signed',     who:['Mountain State SoM','American Board of Internal Medicine','Cedar Health IM','Bayview University'], what:['Board certification','MD conferral','Training completion','DEA confirmation','Privileges granted']},
    {cls:'rec', icon:'medal',    verb:'Recognition attested',who:['American College of Cardiology','Cedar Health System','Northstar Medical Group'], what:['Medical directorship','Fellowship status','Peer reference','Quality outcome']},
    {cls:'tr',  icon:'shield',   verb:'Trust exchanged',     who:['Summit Health Plan','Veritas Locum','Harbor Children\u2019s','Meridian Staffing'], what:['Accepted by replay','PECOS enrollment','Privilege verification','Re-verification']},
    {cls:'api', icon:'webhook',  verb:'Webhook delivered',   who:['Career OS','Recruiter OS','Credentialing OS','Lattice Scheduling'], what:['evidence.signed','trust.accepted','recognition.added','identity.updated']},
  ];
  const pick = a => a[Math.floor(Math.random()*a.length)];
  function npi(){ let s=''; for(let i=0;i<10;i++) s+=Math.floor(Math.random()*10); return s; }
  function feedRow(fresh){
    const k = pick(FEED_KINDS);
    return `<div class="feedrow${fresh?' fresh':''}">
      <span class="fr-ic ${k.cls}">${ic(k.icon,15)}</span>
      <span class="fr-tx"><span class="fr-n"><b>${k.verb}</b> \u00b7 ${pick(k.what)}</span><span class="fr-s">${pick(k.who)} \u00b7 NPI ${npi()}</span></span>
      <span class="fr-when mono">${fresh?'now':(Math.floor(Math.random()*58)+1)+'s'}</span>
    </div>`;
  }
  function renderFeed(){
    const feed = document.getElementById('statfeed');
    if(!feed) return;
    feed.innerHTML = Array.from({length:8}, ()=>feedRow(false)).join('');
    setInterval(()=>{
      feed.insertAdjacentHTML('afterbegin', feedRow(true));
      while(feed.children.length>8) feed.removeChild(feed.lastChild);
    }, 2400);
  }

  /* systems / integrations status */
  const SYS = [
    {nm:'NPPES federal source', s:'identity \u00b7 enumeration', icon:'badge', state:'ok', lat:'42ms'},
    {nm:'OIG / LEIE screening', s:'exclusions \u00b7 sanctions', icon:'shield', state:'ok', lat:'61ms'},
    {nm:'PECOS enrollment', s:'medicare \u00b7 reassignment', icon:'money', state:'deg', lat:'320ms'},
    {nm:'ABMS certification', s:'boards \u00b7 MOC status', icon:'badge', state:'ok', lat:'38ms'},
    {nm:'Receipt replay engine', s:'verification \u00b7 7-yr', icon:'replay', state:'ok', lat:'11ms'},
    {nm:'Webhook delivery', s:'integrations \u00b7 p99', icon:'webhook', state:'ok', lat:'184ms'},
    {nm:'Developer API gateway', s:'rest \u00b7 sdk \u00b7 keys', icon:'code', state:'ok', lat:'29ms'},
  ];
  function renderSystems(){
    const list = document.getElementById('statsystems');
    if(!list) return;
    list.innerHTML = SYS.map(x=>`
      <div class="sysrow">
        <span class="sy-ic">${ic(x.icon,15)}</span>
        <span class="sy-tx"><div class="sy-n">${x.nm}</div><div class="sy-s">${x.s}</div></span>
        <span class="sy-state ${x.state}"><span class="cd"></span>${x.state==='ok'?'Operational':'Degraded'}</span>
        <span class="sy-lat mono">${x.lat}</span>
      </div>`).join('');
  }

  /* 90-day uptime ribbon */
  function renderUptime(){
    const rib = document.getElementById('statuptime');
    if(!rib) return;
    let html='';
    for(let i=0;i<90;i++){
      const r = Math.random();
      const cls = r>0.985 ? 'dn' : (r>0.95 ? 'deg' : '');
      html += `<i class="${cls}" title="day ${90-i}"></i>`;
    }
    rib.innerHTML = html;
  }

  function boot(){ renderMetrics(); renderFeed(); renderSystems(); renderUptime();
    // counters are initialised by w900-core after DOM paint; re-run for injected nodes
    if(window.__cloudCounters) window.__cloudCounters();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
