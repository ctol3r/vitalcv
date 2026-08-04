/* ──────────────────────────────────────────────────────────────────────────
   career-graph.js — VitalCV · Wave 600
   The Career Graph: an 8-stage compounding trust curve, drawn in SVG with
   HTML node markers, a detail panel, count-up index, and keyboard walk.
   Plus: nav scroll state, scroll reveals, spine bar fills.
   ────────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  // Opt into entrance animations only once JS is alive. If transitions are
  // frozen/disabled, the failsafe below removes this class to snap content in.
  document.documentElement.classList.add('anim');

  /* ── stage data — Education → … → Legacy. y = cumulative trust (0..100) ── */
  var STAGES = [
    { key:'education',   n:'Education',     yr:'Yr −8',  hue:'var(--career)',   x:6,  y:9,
      micro:'Identity established',
      what:'Medical school, degrees, board exams. The clinician\u2019s professional identity is born here.',
      ev:['Diploma PSV','USMLE / COMLEX','School registrar'] },
    { key:'training',    n:'Training',      yr:'Yr −4',  hue:'var(--career)',   x:19, y:18,
      micro:'Competence witnessed',
      what:'Residency, fellowship and procedural logs. Skill is observed, supervised and recorded over years.',
      ev:['ACGME program','Case logs','Attestations'] },
    { key:'licensure',   n:'Licensure',     yr:'Yr 0',   hue:'var(--trust)',    x:32, y:30,
      micro:'Authority to practice',
      what:'State licenses, DEA, ABMS board certification. The legal authority to see a patient.',
      ev:['State board PSV','DEA','ABMS / specialty board'] },
    { key:'evidence',    n:'Evidence',      yr:'Yr 1',   hue:'var(--trust)',    x:45, y:44,
      micro:'Continuously attested',
      what:'NPI, OIG/LEIE, PECOS, NPDB. Federal facts checked at the source and kept current, not re-collected.',
      ev:['NPPES','OIG / LEIE','PECOS','NPDB'] },
    { key:'trust',       n:'Trust',         yr:'Yr 2',   hue:'var(--trust)',    x:57, y:58,
      micro:'Verifiable outside the issuer',
      what:'Each check becomes a signed, portable receipt the clinician owns — replayable by any verifier for seven years.',
      ev:['Signed receipt','Audit ledger','Replayable 7 yrs'] },
    { key:'orgs',        n:'Organizations', yr:'Yr 4',   hue:'var(--orgs)',     x:70, y:71,
      micro:'Accepted by institutions',
      what:'Hospital privileging and payer enrollment advance in parallel, because the underlying evidence is already attested.',
      ev:['Privileging','Payer enrollment','Acceptance receipt'] },
    { key:'leadership',  n:'Leadership',    yr:'Yr 9',   hue:'var(--platform)', x:83, y:84,
      micro:'Reputation compounds',
      what:'Committees, faculty appointments, mentorship and recognition. Standing accrues on a record that can be checked.',
      ev:['Appointments','Recognition','Mentorship'] },
    { key:'legacy',      n:'Legacy',        yr:'Yr 20+', hue:'var(--platform)', x:94, y:96,
      micro:'Trust that outlives any employer',
      what:'A lifetime ledger of verified practice — portable across every institution, durable beyond any single job.',
      ev:['Lifetime ledger','Portable','Issuer-independent'] }
  ];

  var VBW = 1000, VBH = 500, PAD_B = 64; // viewBox + bottom padding for the floor

  // convert stage (x%, y%) → viewBox coords. y grows upward from a baseline.
  function vx(s){ return (s.x/100) * VBW; }
  function vy(s){ return VBH - PAD_B - (s.y/100) * (VBH - PAD_B - 30); }

  // smooth-ish path through points (Catmull-Rom → cubic bezier)
  function smoothPath(pts){
    if(pts.length < 2) return '';
    var d = 'M' + pts[0][0].toFixed(1) + ',' + pts[0][1].toFixed(1);
    for(var i=0;i<pts.length-1;i++){
      var p0 = pts[i-1] || pts[i], p1 = pts[i], p2 = pts[i+1], p3 = pts[i+2] || p2;
      var c1x = p1[0] + (p2[0]-p0[0])/6, c1y = p1[1] + (p2[1]-p0[1])/6;
      var c2x = p2[0] - (p3[0]-p1[0])/6, c2y = p2[1] - (p3[1]-p1[1])/6;
      d += 'C' + c1x.toFixed(1)+','+c1y.toFixed(1)+' '+c2x.toFixed(1)+','+c2y.toFixed(1)+' '+p2[0].toFixed(1)+','+p2[1].toFixed(1);
    }
    return d;
  }

  var stage = document.getElementById('graphStage');
  var detail = document.getElementById('graphDetail');
  var active = 4; // default highlighted stage = Trust (the key primitive)
  var revealed = false;

  function buildSVG(){
    var pts = STAGES.map(function(s){ return [vx(s), vy(s)]; });
    var line = smoothPath(pts);
    var floorY = VBH - PAD_B;
    var area = line + ' L' + vx(STAGES[STAGES.length-1]).toFixed(1) + ',' + floorY +
               ' L' + vx(STAGES[0]).toFixed(1) + ',' + floorY + ' Z';

    var ticks = '';
    for(var t=1;t<=4;t++){
      var gy = floorY - (t/4)*(floorY-30);
      ticks += '<line x1="0" y1="'+gy.toFixed(1)+'" x2="'+VBW+'" y2="'+gy.toFixed(1)+'" stroke="rgba(255,255,255,.05)" stroke-dasharray="2 6"/>';
    }

    var svg =
      '<svg viewBox="0 0 '+VBW+' '+VBH+'" preserveAspectRatio="none" aria-hidden="true">'+
      '<defs>'+
        '<linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">'+
          '<stop offset="0%" stop-color="oklch(70% 0.15 280)" stop-opacity="0.30"/>'+
          '<stop offset="100%" stop-color="oklch(70% 0.15 280)" stop-opacity="0"/>'+
        '</linearGradient>'+
        '<linearGradient id="lineStroke" x1="0" y1="0" x2="1" y2="0">'+
          '<stop offset="0%" stop-color="oklch(73% 0.15 274)"/>'+
          '<stop offset="55%" stop-color="oklch(74% 0.14 200)"/>'+
          '<stop offset="100%" stop-color="oklch(72% 0.15 300)"/>'+
        '</linearGradient>'+
      '</defs>'+
      ticks+
      '<path id="gArea" d="'+area+'" fill="url(#areaFill)" opacity="0"/>'+
      '<path id="gLine" d="'+line+'" fill="none" stroke="url(#lineStroke)" stroke-width="2.5" '+
        'vector-effect="non-scaling-stroke" stroke-linecap="round"/>'+
      '</svg>';
    stage.insertAdjacentHTML('afterbegin', svg);

    // HTML node markers, positioned in % so they track the responsive SVG
    STAGES.forEach(function(s, i){
      var up = i % 2 === 1; // alternate caption above/below to avoid collisions
      var leftPct = (vx(s)/VBW)*100;
      var bottomPct = ((VBH - vy(s))/VBH)*100;
      var btn = document.createElement('button');
      btn.className = 'gnode' + (up ? ' up' : '');
      btn.style.left = leftPct + '%';
      btn.style.bottom = bottomPct + '%';
      btn.style.transform = up ? 'translate(-50%, 50%)' : 'translate(-50%, 50%)';
      btn.style.setProperty('--hue', s.hue);
      btn.setAttribute('data-i', i);
      btn.setAttribute('aria-label', s.n);
      btn.innerHTML =
        '<span class="cap"><span class="yr">'+s.yr+'</span><span class="nm">'+s.n+'</span></span>'+
        '<span class="pt"></span>';
      btn.addEventListener('click', function(){ setActive(i); });
      stage.appendChild(btn);
    });
  }

  function setActive(i){
    active = i;
    var s = STAGES[i];
    document.querySelectorAll('.gnode').forEach(function(n){
      n.classList.toggle('active', +n.getAttribute('data-i') === i);
    });
    detail.style.setProperty('--hue', s.hue);
    detail.innerHTML =
      '<div class="cell first">'+
        '<div class="idx">Stage 0'+(i+1)+' / 08</div>'+
        '<div class="stage-name"><span class="hd"></span>'+s.n+'</div>'+
        '<div class="stage-yr">'+s.yr+' · '+s.micro+'</div>'+
      '</div>'+
      '<div class="cell">'+
        '<div class="micro">What compounds</div>'+
        '<div class="ctext">'+s.what+'</div>'+
      '</div>'+
      '<div class="cell">'+
        '<div class="micro">Evidence signed here</div>'+
        '<div class="ctext"><b>Carried forward, never re-collected.</b></div>'+
        '<div class="chips">'+ s.ev.map(function(e){ return '<span class="chip">'+e+'</span>'; }).join('') +'</div>'+
      '</div>';
  }

  /* ── count-up trust index, gated on reveal ─────────────────────────────── */
  function countUp(el, target, ms){
    var start = performance.now();
    function tick(now){
      var p = Math.min((now-start)/ms, 1);
      var eased = 1 - Math.pow(1-p, 3);
      el.textContent = Math.round(eased*target);
      if(p<1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // Force the graph to its final, visible state without relying on transitions
  // (covers print/PDF/throttled-capture where CSS transitions never advance).
  function finalizeGraph(){
    var areaEl = document.getElementById('gArea');
    var lineEl = document.getElementById('gLine');
    if(lineEl){ lineEl.style.transition='none'; lineEl.style.strokeDasharray='none'; lineEl.style.strokeDashoffset='0'; }
    if(areaEl){ areaEl.style.transition='none'; areaEl.style.opacity='1'; }
    document.querySelectorAll('.gnode').forEach(function(n){
      n.style.transition='none'; n.style.opacity='1'; n.style.transform='translate(-50%,50%)';
    });
    if(revealed){
      var num = document.getElementById('trustNum');
      if(num) num.textContent = num.getAttribute('data-target') || '100';
    }
  }

  function revealGraph(){
    if(revealed) return; revealed = true;
    // belt-and-suspenders: if the draw/pop transitions never run, snap final
    setTimeout(finalizeGraph, 2000);
    var areaEl = document.getElementById('gArea');
    var lineEl = document.getElementById('gLine');
    if(lineEl){
      var len = lineEl.getTotalLength();
      lineEl.style.strokeDasharray = len;
      lineEl.style.strokeDashoffset = len;
      lineEl.style.transition = 'stroke-dashoffset 1.6s cubic-bezier(.4,.0,.2,1)';
      requestAnimationFrame(function(){ lineEl.style.strokeDashoffset = '0'; });
    }
    if(areaEl){ areaEl.style.transition = 'opacity 1.2s ease .5s'; requestAnimationFrame(function(){ areaEl.style.opacity = '1'; }); }

    // nodes pop in sequence
    var nodes = document.querySelectorAll('.gnode');
    nodes.forEach(function(n, idx){
      n.style.opacity = '0';
      n.style.transition = 'opacity .45s ease, transform .45s cubic-bezier(.2,.8,.2,1)';
      var base = n.classList.contains('up') ? 'translate(-50%,50%)' : 'translate(-50%,50%)';
      n.style.transform = base + ' scale(.4)';
      setTimeout(function(){
        n.style.opacity = '1';
        n.style.transform = base + ' scale(1)';
      }, 180 + idx*150);
    });

    var num = document.getElementById('trustNum');
    if(num) setTimeout(function(){ countUp(num, +num.getAttribute('data-target')||100, 1700); }, 200);
  }

  /* ── boot graph ────────────────────────────────────────────────────────── */
  if(stage){
    buildSVG();
    setActive(active);

    var gObs = new IntersectionObserver(function(es){
      es.forEach(function(e){ if(e.isIntersecting){ revealGraph(); gObs.disconnect(); } });
    }, { threshold:.35 });
    gObs.observe(document.getElementById('graphShell'));

    // keyboard walk when the graph region is near viewport
    document.addEventListener('keydown', function(e){
      if(e.key!=='ArrowLeft' && e.key!=='ArrowRight') return;
      var r = document.getElementById('graphShell').getBoundingClientRect();
      if(r.bottom < 0 || r.top > window.innerHeight) return;
      e.preventDefault();
      var ni = active + (e.key==='ArrowRight'?1:-1);
      if(ni<0) ni=STAGES.length-1; if(ni>STAGES.length-1) ni=0;
      setActive(ni);
    });
  }

  /* ── nav scrolled state ────────────────────────────────────────────────── */
  var nav = document.getElementById('nav');
  function onScroll(){ if(nav) nav.classList.toggle('scrolled', window.scrollY > 24); }
  onScroll(); window.addEventListener('scroll', onScroll, { passive:true });

  /* ── scroll reveals ────────────────────────────────────────────────────── */
  var rObs = new IntersectionObserver(function(es){
    es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); rObs.unobserve(e.target); } });
  }, { threshold:.12, rootMargin:'0px 0px -8% 0px' });
  document.querySelectorAll('.reveal').forEach(function(el){ rObs.observe(el); });
  // failsafe: never strand content invisible (paused tabs / screenshot tools)
  setTimeout(function(){
    document.querySelectorAll('.reveal:not(.in)').forEach(function(el){ el.classList.add('in'); });
    document.documentElement.classList.remove('anim'); // snap any frozen reveals to visible
    finalizeGraph();
  }, 2200);

  /* ── spine bars fill when in view ─────────────────────────────────────── */
  var spine = document.getElementById('spine');
  if(spine){
    var sObs = new IntersectionObserver(function(es){
      es.forEach(function(e){
        if(!e.isIntersecting) return;
        spine.querySelectorAll('.step').forEach(function(step, i){
          var p = step.style.getPropertyValue('--p') || '100%';
          setTimeout(function(){ var bar = step.querySelector('.bar i'); if(bar) bar.style.width = p; }, i*110);
        });
        sObs.disconnect();
      });
    }, { threshold:.3 });
    sObs.observe(spine);
  }

  /* ── smooth anchor + active nav link ──────────────────────────────────── */
  document.querySelectorAll('a[href^="#"]').forEach(function(a){
    a.addEventListener('click', function(e){
      var id = a.getAttribute('href'); if(id==='#') return;
      var t = document.querySelector(id);
      if(t){ e.preventDefault(); t.scrollIntoView({ behavior:'smooth', block:'start' }); }
    });
  });
})();
