/* ═══════════════════════════════════════════════════════════════════════
   VitalCV Solutions Hub · W500-D2
   Eight audiences. One verified record.
   Each: the problem · today's workflow · the workflow with VitalCV · ROI.
   Depends on vitalcv.js for window.VICON (icon set), nav + reveal.
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
  "use strict";
  const icon = (n,s)=> (window.VICON ? window.VICON(n,s||18) : '');

  /* ── the eight audiences ────────────────────────────────────── */
  const SOL = [
    {
      key:'clinicians', name:'Clinicians', icon:'user', kind:'The people',
      lede:'Own the career you earned.',
      head:'A clinician’s identity is rebuilt from scratch at <em>every</em> door — even though the license, the boards, and the DEA never changed.',
      problems:[
        {t:'Re-verified at every move',s:'Each new employer re-collects and re-doubts the same federal facts the last one already confirmed.'},
        {t:'Fourteen weeks unpaid',s:'A licensed physician waits ~14 weeks before billing under their own name at a new system.'},
        {t:'Reputation trapped in portals',s:'Your proof lives inside whichever HR system gathered it last. None of it is portable.'},
      ],
      now:{ label:'Today', steps:[
        'Apply · attach CV',
        'Re-upload every credential, again',
        'Wait on primary-source verification',
        'Privileging committee',
        'Payer enrollment — in series',
      ], foot:'~103 days to first claim' },
      next:{ label:'With VitalCV', steps:[
        'Arrive pre-verified — chain already signed',
        'New system replays your receipts',
        'Privileging + enrollment run in parallel',
        'Carry the record to the next door, untouched',
        'Reputation compounds T1 → T4',
      ], foot:'36 days · owned for life' },
      roi:[
        {k:'Time-to-bill',v:'36',u:'d',note:'−67 days per move'},
        {k:'Documents re-uploaded',v:'0',note:'signed once, at the source'},
        {k:'Record ownership',v:'You',note:'portable for a lifetime'},
      ],
      link:{label:'Open Career Wallet', href:'../career-wallet/Career Wallet.html'},
    },
    {
      key:'recruiters', name:'Recruiters', icon:'target', kind:'Talent',
      lede:'Source candidates who are already verified.',
      head:'Verification happens <em>after</em> the offer — so pipelines fill with résumés no one has actually confirmed.',
      problems:[
        {t:'Unverifiable pipelines',s:'A résumé is a claim, not proof. Real verification only starts once an offer is out.'},
        {t:'Late-stage fall-through',s:'Credential gaps surface during PSV — weeks in — and the search restarts from zero.'},
        {t:'Trust isn’t a signal',s:'There’s no way to rank candidates by verified standing before you spend a screen on them.'},
      ],
      now:{ label:'Today', steps:[
        'Screen résumés on trust',
        'Phone screen',
        'Extend offer',
        'Verify — discover gaps',
        'Restart the search',
      ], foot:'Verification is a post-offer gamble' },
      next:{ label:'With VitalCV', steps:[
        'Search on verified trust signal',
        'Shortlist pre-credentialed clinicians',
        'Present replayable proof to the hiring system',
        'Move straight to fit, not to fact-checking',
        'Fill the seat faster',
      ], foot:'Verified-first, every candidate' },
      roi:[
        {k:'Pipeline',v:'Verified',note:'signal, not claims'},
        {k:'Fall-through',v:'↓',note:'gaps caught before offer'},
        {k:'Trust ranking',v:'T1–T4',note:'evidence-weighted'},
      ],
      link:{label:'Open Recruiter OS', href:'../recruiter/Recruiter OS.html'},
    },
    {
      key:'health-systems', name:'Health Systems', icon:'building', kind:'Enterprise', feature:true,
      lede:'Extend the record. Never modify the core.',
      head:'Every new hire burns a quarter of billable time to onboarding — and the system re-does primary-source verification someone else already completed.',
      problems:[
        {t:'103-day time-to-bill',s:'Revenue ramps slowly while a fully-licensed clinician waits on serial verification and enrollment.'},
        {t:'Duplicated PSV',s:'You re-verify federal facts that other systems — and the source itself — have already confirmed.'},
        {t:'Audit exposure',s:'Credentialing decisions live across portals with no single, replayable ledger to defend them.'},
      ],
      now:{ label:'Today', steps:[
        'Collect documents',
        'Primary-source verification',
        'Credentialing committee',
        'Privileging',
        'Payer enrollment — months, serial',
      ], foot:'~$278k per MD left on the table' },
      next:{ label:'With VitalCV', steps:[
        'Read the clinician’s verified chain',
        'Attest — never modify the core',
        'Privilege + enroll in parallel',
        'Decisions written to your own audit ledger',
        'Clinician identity stays portable',
      ], foot:'A verified pipeline, plus a 7-year ledger' },
      roi:[
        {k:'Time-to-bill',v:'36',u:'d',note:'from 103 days'},
        {k:'Per-MD captured',v:'$278',u:'k+',note:'recovered ramp revenue'},
        {k:'Audit retention',v:'7',u:'yr',note:'replayable ledger'},
      ],
      link:{label:'See the Employer Pipeline', href:'../Employer Pipeline.html'},
    },
    {
      key:'medical-groups', name:'Medical Groups', icon:'network', kind:'Enterprise',
      lede:'Onboard physicians without the back-office.',
      head:'A small credentialing team carries the same federal burden as a hospital — with a fraction of the people and no room for a lapse.',
      problems:[
        {t:'Big burden, lean team',s:'Spreadsheet-driven tracking can’t keep pace with hires, locums, and re-credentialing cycles.'},
        {t:'Expirables slip',s:'Licenses, DEA, and boards lapse quietly when monitoring is manual — and a lapse is a billing stop.'},
        {t:'Locum churn',s:'Short-term clinicians are re-verified for every rotation, eating the margin they were hired to protect.'},
      ],
      now:{ label:'Today', steps:[
        'Track credentials in spreadsheets',
        'Manual primary-source checks',
        'Chase reminders by hand',
        'Discover lapses after the fact',
        'Absorb the compliance risk',
      ], foot:'Onboarding measured in weeks' },
      next:{ label:'With VitalCV', steps:[
        'Read one continuous verified chain',
        'Expirables monitored automatically',
        'Locums reuse a portable packet',
        'Onboard in days, not weeks',
        'Run lean — the source does the work',
      ], foot:'Continuous monitoring, no extra headcount' },
      roi:[
        {k:'Onboarding',v:'Days',note:'not weeks'},
        {k:'Expirable lapses',v:'↓',note:'monitored continuously'},
        {k:'Back-office',v:'Lean',note:'no PSV re-runs'},
      ],
      link:{label:'Open Workspace Graph', href:'../workspace-graph/Workspace Graph.html'},
    },
    {
      key:'staffing', name:'Staffing Firms', icon:'route', kind:'Networks',
      lede:'Place clinicians in days, not weeks.',
      head:'A credential packet is rebuilt for every assignment — and every facility re-verifies the same locum you placed last month.',
      problems:[
        {t:'Packets rebuilt per placement',s:'The same evidence is re-collected for each assignment, each facility, each time.'},
        {t:'Days idle = margin lost',s:'Every day a clinician waits on verification is a day of un-billed placement.'},
        {t:'No reuse across facilities',s:'Verification done for one site can’t be carried to the next — the work doesn’t compound.'},
      ],
      now:{ label:'Today', steps:[
        'Assemble the credential packet',
        'Verify the packet',
        'Submit to the facility',
        'Facility re-verifies from scratch',
        'Finally place',
      ], foot:'Time-to-place measured in weeks' },
      next:{ label:'With VitalCV', steps:[
        'Carry one portable verified packet',
        'Facility replays the receipts',
        'Reuse the same chain across assignments',
        'Place the same week',
        'Recover the idle-day margin',
      ], foot:'Verify once, place many' },
      roi:[
        {k:'Time-to-place',v:'Days',note:'reuse across sites'},
        {k:'Re-verification',v:'Once',note:'then replay'},
        {k:'Fill rate',v:'↑',note:'less idle time'},
      ],
      link:{label:'Open Opportunity Network', href:'../opportunity-network/Opportunity Network.html'},
    },
    {
      key:'credentialing', name:'Credentialing Teams', icon:'shield', kind:'Operations',
      lede:'Stop re-collecting what’s already proven.',
      head:'Credentialing redoes the same primary-source work on every cycle — and then scrambles to assemble it again for the audit.',
      problems:[
        {t:'Redundant PSV',s:'Each hire and each re-cred re-runs verification the source already answered and signed.'},
        {t:'Audit prep is a scramble',s:'Evidence for NCQA and Joint Commission is reassembled by hand, file by file, under deadline.'},
        {t:'Manual standards mapping',s:'Mapping evidence to standards is a person’s full-time job, repeated every survey.'},
      ],
      now:{ label:'Today', steps:[
        'Gather documents',
        'Primary-source verify each source',
        'File the evidence',
        'Re-verify at re-credentialing',
        'Scramble to assemble the audit',
      ], foot:'PSV repeated every cycle' },
      next:{ label:'With VitalCV', steps:[
        'Replay signed receipts',
        'Evidence mapped to standards',
        'Re-credential by replay',
        'Audit-ready ledger, always on',
        'Survey prep becomes a query',
      ], foot:'NCQA / Joint Commission, mapped' },
      roi:[
        {k:'PSV',v:'Reused',note:'not re-run'},
        {k:'Audit',v:'Ready',note:'standards-mapped ledger'},
        {k:'Manual work',v:'↓',note:'replay, don’t re-collect'},
      ],
      link:{label:'See Verifier Replay', href:'../Verifier Replay.html'},
    },
    {
      key:'medical-schools', name:'Medical Schools', icon:'grad', kind:'Education',
      lede:'The record begins on day one.',
      head:'A registrar fields verification requests for a graduate’s entire career — every enrollment, rotation, and exam, by hand, for decades.',
      problems:[
        {t:'Decades of requests',s:'Long after graduation, the registrar answers verification letters for enrollment and exams — one at a time.'},
        {t:'Manual, fee-bound, slow',s:'Each request is a letter, a fee, and a delay that lands on the alumnus downstream.'},
        {t:'Evidence stays locked in',s:'The school holds the proof; the graduate can’t carry it into credentialing on their own.'},
      ],
      now:{ label:'Today', steps:[
        'Receive a verification request',
        'Pull the registrar record',
        'Issue a manual letter',
        'Charge a fee · add delay',
        'Repeat for decades',
      ], foot:'A lifetime of registrar load' },
      next:{ label:'With VitalCV', steps:[
        'Sign enrollment, exams, rotations once',
        'Graduate with a portable verified record',
        'Alumni carry their own proof',
        'Downstream credentialing replays it',
        'Registrar requests approach zero',
      ], foot:'Signed once, owned by the graduate' },
      roi:[
        {k:'Registrar load',v:'↓↓',note:'requests eliminated'},
        {k:'Alumni record',v:'Portable',note:'carried for life'},
        {k:'Downstream',v:'Faster',note:'credentialing by replay'},
      ],
      link:{label:'See a career unfold', href:'../experience/VitalCV Experience.html#journey'},
    },
    {
      key:'payers', name:'Payers', icon:'money', kind:'Networks',
      lede:'Enroll providers against verified evidence.',
      head:'Provider enrollment is slow, directories drift out of date, and the same PSV is duplicated against every hospital in the network.',
      problems:[
        {t:'Slow enrollment',s:'Applications crawl through serial verification before a provider can be loaded to the network.'},
        {t:'Directory inaccuracy',s:'Stale provider data drives access complaints and regulatory exposure under CMS accuracy rules.'},
        {t:'Duplicated verification',s:'You re-verify the same federal facts the hospitals — and the source — already confirmed.'},
      ],
      now:{ label:'Today', steps:[
        'Collect the enrollment application',
        'Primary-source verify',
        'Load to the directory',
        'Re-verify periodically',
        'Watch the data go stale',
      ], foot:'Directories drift between cycles' },
      next:{ label:'With VitalCV', steps:[
        'Replay the provider’s verified chain',
        'Enroll against signed evidence',
        'Subscribe to chain events for changes',
        'Directory stays continuously accurate',
        'Share evidence — stop duplicating PSV',
      ], foot:'Continuous accuracy, shared proof' },
      roi:[
        {k:'Enrollment',v:'Faster',note:'replay, not re-collect'},
        {k:'Directory',v:'Accurate',note:'event-driven updates'},
        {k:'Duplicate PSV',v:'↓',note:'shared verified evidence'},
      ],
      link:{label:'Explore the platform', href:'../platform/VitalCV Platform.html'},
    },
  ];

  /* ── render hub cards ───────────────────────────────────────── */
  function renderHub(){
    const grid = document.getElementById('solhub');
    if(!grid) return;
    grid.innerHTML = SOL.map((s,i)=>`
      <button class="solcard${s.feature?' feature':''}" data-i="${i}">
        <span class="sc-ic">${icon(s.icon,20)}</span>
        <span class="sc-kind mono">${s.kind}</span>
        <span class="sc-nm">${s.name}</span>
        <span class="sc-lede">${s.lede}</span>
        <span class="sc-go">${icon('route',13)} Problems · workflows · ROI</span>
      </button>`).join('');
    grid.querySelectorAll('.solcard').forEach(b=>{
      b.addEventListener('click',()=>{ select(+b.dataset.i); scrollToDetail(); });
    });
  }

  /* ── render rail ────────────────────────────────────────────── */
  function renderRail(){
    const rail = document.getElementById('solrail');
    if(!rail) return;
    rail.innerHTML = SOL.map((s,i)=>`
      <button class="railitem" data-i="${i}">
        <span class="ri-ic">${icon(s.icon,16)}</span>
        <span class="ri-tx"><span class="ri-nm">${s.name}</span><span class="ri-kind mono">${s.kind}</span></span>
      </button>`).join('');
    rail.querySelectorAll('.railitem').forEach(b=>{
      b.addEventListener('click',()=> select(+b.dataset.i));
    });
  }

  /* ── render the detail panel for one audience ───────────────── */
  function renderDetail(i){
    const s = SOL[i];
    const el = document.getElementById('soldetail');
    if(!el) return;
    el.innerHTML = `
      <div class="sd-head">
        <div class="sd-tag"><span class="sd-ic">${icon(s.icon,22)}</span><span class="mono">${s.kind} · 0${i+1} / 08</span></div>
        <h2 class="sd-lede">${s.lede}</h2>
        <p class="sd-frame">${s.head}</p>
      </div>

      <div class="sd-block">
        <div class="sd-bt"><span class="mono">The problem</span><span class="sd-rule"></span></div>
        <div class="probgrid">
          ${s.problems.map(p=>`
            <div class="probcard">
              <div class="pc-x">${icon('clock',15)}</div>
              <div class="pc-t">${p.t}</div>
              <div class="pc-s">${p.s}</div>
            </div>`).join('')}
        </div>
      </div>

      <div class="sd-block">
        <div class="sd-bt"><span class="mono">The workflow</span><span class="sd-rule"></span></div>
        <div class="flowwrap">
          <div class="flowcol now">
            <div class="fc-h"><span class="fc-lbl">${s.now.label}</span><span class="chip chip-ghost"><span class="cd"></span>serial · manual</span></div>
            <ol class="fc-steps">
              ${s.now.steps.map(t=>`<li><span class="fc-n mono"></span><span>${t}</span></li>`).join('')}
            </ol>
            <div class="fc-foot now">${icon('clock',14)}<span>${s.now.foot}</span></div>
          </div>
          <div class="flowarrow">${icon('route',18)}</div>
          <div class="flowcol next">
            <div class="fc-h"><span class="fc-lbl">${s.next.label}</span><span class="chip chip-acc"><span class="cd"></span>replay · parallel</span></div>
            <ol class="fc-steps">
              ${s.next.steps.map(t=>`<li><span class="fc-n mono"></span><span>${t}</span></li>`).join('')}
            </ol>
            <div class="fc-foot next">${icon('check',14)}<span>${s.next.foot}</span></div>
          </div>
        </div>
      </div>

      <div class="sd-block">
        <div class="sd-bt"><span class="mono">The ROI</span><span class="sd-rule"></span></div>
        <div class="roigrid">
          ${s.roi.map(r=>`
            <div class="roicard">
              <div class="rc-k mono">${r.k}</div>
              <div class="rc-v">${r.v}${r.u?`<span class="u">${r.u}</span>`:''}</div>
              <div class="rc-n">${r.note}</div>
            </div>`).join('')}
        </div>
        <a class="sd-link" href="${s.link.href}">${s.link.label} <svg class="arrow" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
      </div>`;
    // number the steps
    el.querySelectorAll('.flowcol').forEach(col=>{
      col.querySelectorAll('.fc-n').forEach((n,idx)=> n.textContent = String(idx+1).padStart(2,'0'));
    });
  }

  let cur = -1;
  function select(i){
    if(i===cur) return;
    cur = i;
    document.querySelectorAll('#solrail .railitem').forEach((b,bi)=> b.classList.toggle('on', bi===i));
    document.querySelectorAll('#solhub .solcard').forEach((b,bi)=> b.classList.toggle('on', bi===i));
    renderDetail(i);
  }
  function scrollToDetail(){
    const t = document.getElementById('soldeep');
    if(t) window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - 84, behavior:'smooth' });
  }

  function boot(){
    renderHub();
    renderRail();
    select(2); // open on Health Systems — the enterprise payoff
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
