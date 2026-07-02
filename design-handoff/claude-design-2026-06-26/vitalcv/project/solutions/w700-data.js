/* ═══════════════════════════════════════════════════════════════════════
   VitalCV · Wave 700 — Solutions data
   One Professional Trust Infrastructure, told ten ways.
   • OUTCOMES   — the hub, organized around what people achieve (D4)
   • SOLUTIONS  — all ten roles (directory) + five full landing pages (D2)
                  each with journey (D3), outcomes (D4), workflow, ROI (D5)
   Consumed by w700.js. Icons via window.VICON (vitalcv.js).
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
  "use strict";

  /* ── formatting helpers ─────────────────────────────────────── */
  function money(n){
    n = Math.round(n);
    if(n >= 1e9) return '$' + (n/1e9).toFixed(n>=1e10?0:1) + 'b';
    if(n >= 1e6) return '$' + (n/1e6).toFixed(n>=1e7?0:1) + 'm';
    if(n >= 1e3) return '$' + (n/1e3).toFixed(n>=1e4?0:0) + 'k';
    return '$' + n;
  }
  function num(n){ return Math.round(n).toLocaleString('en-US'); }
  function moneyFull(n){ return '$' + Math.round(n).toLocaleString('en-US'); }

  /* ════════════════════════════════════════════════════════════
     OUTCOMES — the platform, organized around measurable results (D4)
     Each outcome is served by the same record, for several roles.
     ════════════════════════════════════════════════════════════ */
  const OUTCOMES = [
    {
      key:'start', name:'Start clinicians faster', icon:'clock',
      tag:'Time-to-start',
      h:'Turn a 103-day ramp into a <em>36-day</em> start.',
      sub:'A fully-licensed clinician used to wait a full quarter before billing under their own name. When the federal evidence is already signed, privileging and enrollment run in parallel — and the start happens in weeks.',
      big:'−67', u:'days', cap:'median time-to-bill saved, every transition',
      who:[
        {role:'health-systems', icon:'building', nm:'Health Systems', sub:'Capture the ramp revenue you were leaving on the table'},
        {role:'clinicians', icon:'user', nm:'Clinicians', sub:'Bill under your own name in weeks, not months'},
        {role:'staffing', icon:'route', nm:'Staffing Firms', sub:'Place the same week, recover the idle-day margin'},
      ],
    },
    {
      key:'dedupe', name:'Reduce duplicate verification', icon:'shield',
      tag:'Verify once',
      h:'Verify <em>once,</em> at the source. Replay everywhere after.',
      sub:'The same federal facts get re-verified at every door — by every employer, payer, and survey. VitalCV signs the answer once and lets everyone downstream replay it, instead of re-collecting it.',
      big:'0', u:'re-runs', cap:'primary-source checks duplicated after signing',
      who:[
        {role:'credentialing', icon:'shield', nm:'Credentialing Teams', sub:'Replay signed receipts instead of re-running PSV'},
        {role:'health-systems', icon:'building', nm:'Health Systems', sub:'Read the chain other systems already confirmed'},
        {role:'payers', icon:'money', nm:'Payers', sub:'Enroll against shared, verified evidence'},
      ],
    },
    {
      key:'readiness', name:'Increase workforce readiness', icon:'spark',
      tag:'Always ready',
      h:'A workforce that stays <em>survey-ready,</em> continuously.',
      sub:'Expirables lapse quietly when monitoring is manual — and every lapse is a billing stop. A continuously-verified chain keeps licenses, DEA, and boards current, and keeps the audit ledger always-on.',
      big:'7', u:'yr', cap:'replayable ledger, mapped to standards',
      who:[
        {role:'credentialing', icon:'shield', nm:'Credentialing Teams', sub:'NCQA / Joint Commission prep becomes a query'},
        {role:'medical-groups', icon:'network', nm:'Medical Groups', sub:'Continuous monitoring without extra headcount'},
        {role:'health-systems', icon:'building', nm:'Health Systems', sub:'Decisions written to a permanent audit ledger'},
      ],
    },
    {
      key:'trust', name:'Improve trust', icon:'badge',
      tag:'Verifiable outside the issuer',
      h:'Proof that <em>doesn’t need us</em> to be true.',
      sub:'Every receipt is replayable against the original federal source, on anyone’s machine, with no VitalCV in the loop. That property — verifiability outside the issuer — is what turns a résumé into evidence.',
      big:'T1→T4', u:'', cap:'evidence-weighted trust, not a self-reported claim',
      who:[
        {role:'recruiters', icon:'target', nm:'Recruiters', sub:'Source on verified signal, not unconfirmed résumés'},
        {role:'medical-schools', icon:'grad', nm:'Medical Schools', sub:'The record is signed and portable from day one'},
        {role:'payers', icon:'money', nm:'Payers', sub:'Directories that stay accurate between cycles'},
      ],
    },
    {
      key:'grow', name:'Grow careers', icon:'crown',
      tag:'Reputation compounds',
      h:'A career that <em>compounds</em> instead of resetting.',
      sub:'Today a clinician’s reputation is trapped in whichever portal gathered it last. On VitalCV every milestone attaches to one owned chain — recognition, mobility, and opportunity build on each other for a lifetime.',
      big:'1', u:'record', cap:'owned by the clinician, carried for life',
      who:[
        {role:'clinicians', icon:'user', nm:'Clinicians', sub:'Own the career you earned — portable forever'},
        {role:'medical-schools', icon:'grad', nm:'Medical Schools', sub:'Alumni carry their own proof into practice'},
        {role:'recruiters', icon:'target', nm:'Recruiters', sub:'Reach pre-credentialed clinicians directly'},
      ],
    },
  ];

  /* ════════════════════════════════════════════════════════════
     SOLUTIONS — ten roles. Five carry a full landing page.
     ════════════════════════════════════════════════════════════ */
  const SOL = {

    /* ─────────────────────────── CLINICIANS ─────────────────── */
    'clinicians':{
      name:'Clinicians', kind:'The people', icon:'user', page:'For Clinicians.html',
      dirLede:'Own the verified career you earned — portable for a lifetime.',
      hero:{
        eyebrow:'Built for <b>clinicians</b>',
        h1:'The career you earned, finally <em>yours</em> — and portable for life.',
        lede:'Every credential you earn is signed at the source and owned by <b>you.</b> Walk into any new system pre-verified, carry your reputation with you, and never re-upload the same document twice.',
        proofs:[
          {b:'−67 days', t:'to your first claim'},
          {b:'0', t:'documents re-uploaded'},
          {b:'7-year', t:'replayable proof'},
        ],
        panel:{ name:'Dr. Dana Okafor', sub:'NPI 1043829176 · Cardiology', verified:'Verified',
          stats:[
            {k:'Time-to-bill', v:'36', u:'d', delta:'−67', n:'vs the 103-day industry norm'},
            {k:'Trust tier', v:'T3', n:'evidence-weighted standing'},
            {k:'Records owned', v:'19', n:'signed credentials, carried by you'},
            {k:'Re-uploads', v:'0', n:'signed once, at the source'},
          ],
          foot:'Replayable for 7 years — by any verifier, without VitalCV' },
      },
      journey:{
        intro:'From your first day of training to the height of your career, the same record gains weight, mobility, and signal. <b>Select a stage.</b>',
        stages:[
          { nm:'Evidence', ix:'Yr 0', title:'It starts as <em>signed evidence,</em> not a PDF.',
            desc:'The moment you matriculate, enrollment, exams, and rotations are signed at the source. These are the first links in a chain that will <b>never be re-collected.</b>',
            gain:'First receipt issued · replayable 7 yrs',
            events:[
              {t:'Enrollment verified',s:'AAMC · LCME program',icon:'grad',key:true},
              {t:'USMLE Step 1 · Pass',s:'NBME · signed',icon:'file',key:true},
              {t:'Clinical rotations',s:'4 sites · attested',icon:'steth'},
            ]},
          { nm:'Recognition', ix:'Yr 5', title:'A national identity, <em>issued once.</em>',
            desc:'Your NPI is issued and bound to the verified chain. Board progress and procedure logs accrue automatically — the evidence employers would otherwise re-request, <b>already signed and portable.</b>',
            gain:'Enrollment resolves in 2 days, not weeks',
            events:[
              {t:'NPI issued & bound',s:'NPPES · 1043829176',icon:'badge',key:true},
              {t:'Residency match',s:'NRMP · ACGME',icon:'file',key:true},
              {t:'Supervised log',s:'1,240 attested',icon:'steth'},
            ]},
          { nm:'Career Growth', ix:'Yr 9', title:'Credentialed <em>once.</em> Trusted everywhere after.',
            desc:'Board certification, full licensure, and DEA register against the chain. This is where it pays off: you move to a new system in <b>days, not the industry-standard 103.</b>',
            gain:'Time-to-bill drops to 36 days · −67d captured',
            events:[
              {t:'Board certification',s:'ABMS · signed',icon:'badge',key:true},
              {t:'Unrestricted license',s:'PECOS · 3 states',icon:'lic',key:true},
              {t:'DEA registration',s:'Active · II–V',icon:'dea'},
            ]},
          { nm:'Mobility', ix:'Yr 14', title:'Move without <em>starting over.</em>',
            desc:'When you change systems, the new employer replays your receipts instead of re-collecting documents. Privileging and payer enrollment advance in parallel — <b>your reputation moves with you, untouched.</b>',
            gain:'Privileging + enrollment run in parallel',
            events:[
              {t:'Hospital privileges',s:'Cedar Health · 3 days',icon:'building',key:true},
              {t:'Payer enrollment',s:'Parallel · replayed',icon:'money',key:true},
              {t:'Prior chain',s:'Carried · unmodified',icon:'replay'},
            ]},
          { nm:'Opportunity', ix:'Yr 17', title:'The right role finds a <em>trusted</em> record.',
            desc:'A verified, differentiated identity is matchable. Roles, panels, leadership, and locum surface against real signal — and you respond <b>pre-credentialed, instantly.</b>',
            gain:'Reputation becomes portable, owned signal',
            events:[
              {t:'Medical directorship',s:'Cardiology · attested',icon:'crown',key:true},
              {t:'Peer references',s:'12 verified',icon:'user',key:true},
              {t:'Matched opportunities',s:'Pre-credentialed',icon:'target'},
            ]},
        ],
      },
      outcomes:{
        intro:'Not a feature list — the things that actually change for your career.',
        cards:[
          {v:'−67', u:'d', h:'Bill under your own name, sooner.', s:'Every move used to cost a quarter of unpaid waiting. Arrive pre-verified and start in weeks.', src:'median, per transition', feature:true},
          {v:'0', h:'Never re-upload a credential again.', s:'Your federal evidence is signed once, at the source. No portal ever re-collects it.', src:'documents re-collected'},
          {v:'You', h:'Own a record that outlives any employer.', s:'The chain is yours, not your hospital’s. Carry it across every door for a lifetime.', src:'record ownership'},
          {v:'T1→T4', h:'Reputation that compounds into signal.', s:'Each verified milestone raises evidence-weighted standing instead of resetting at the next job.', src:'trust tier'},
          {v:'7', u:'yr', h:'Proof anyone can replay, without us.', s:'Every receipt is verifiable against the original federal source for seven years.', src:'replayable window'},
          {v:'1', h:'One identity, from first rotation to emeritus.', s:'A single continuous record spans your whole career — no breaks, no rebuilds.', src:'lifetime record'},
        ],
      },
      workflow:{
        now:{ lbl:'Today', tag:'serial · manual', steps:['Apply · attach CV','Re-upload every credential, again','Wait on primary-source verification','Privileging committee','Payer enrollment — in series'], foot:'~103 days to first claim' },
        next:{ lbl:'With VitalCV', tag:'replay · parallel', steps:['Arrive pre-verified — chain already signed','New system replays your receipts','Privileging + enrollment run in parallel','Carry the record on, untouched','Reputation compounds T1 → T4'], foot:'36 days · owned for life' },
      },
      roi:{
        title:'What a portable record is <em>worth</em> to you.',
        lede:'Most physicians change systems several times. Each move used to mean weeks of unpaid waiting. Drag the sliders for your own career.',
        accent:'Lifetime income reclaimed',
        inputs:[
          {key:'moves', label:'System changes over your career', min:2, max:12, step:1, def:6, unit:''},
          {key:'days', label:'Days saved per move', min:30, max:90, step:1, def:67, unit:'d'},
          {key:'income', label:'Your daily billing', min:1500, max:8000, step:100, def:4200, unit:'$', money:true},
        ],
        compute(v){
          const reclaimed = v.moves * v.days * v.income;
          return {
            headline:money(reclaimed), pre:'', u:'',
            cap:'in billing you’d otherwise lose to <b>unpaid verification waits</b> across your career.',
            breaks:[
              {k:'Days reclaimed', v:num(v.moves*v.days), u:'d'},
              {k:'Per move', v:money(v.days*v.income), u:''},
            ],
            foot:'Assumes you start ~'+v.days+' days sooner at each of '+v.moves+' moves.',
          };
        },
      },
      cta:{ h:'Your career is already verified. Start carrying it.', primary:'Open Career Wallet', primaryHref:'../career-wallet/Career Wallet.html' },
    },

    /* ─────────────────────────── RECRUITERS ─────────────────── */
    'recruiters':{
      name:'Recruiters', kind:'Talent', icon:'target', page:'For Recruiters.html',
      dirLede:'Source candidates who are already verified — signal, not résumés.',
      hero:{
        eyebrow:'Built for <b>recruiters</b>',
        h1:'Source on <em>verified trust,</em> not on unconfirmed résumés.',
        lede:'Verification happens after the offer — so pipelines fill with claims nobody has checked. VitalCV lets you <b>search on real, evidence-weighted signal</b> and present replayable proof before you ever spend a screen.',
        proofs:[
          {b:'Verified-first', t:'every candidate'},
          {b:'4%', t:'fall-through, from 22%'},
          {b:'T1–T4', t:'trust ranking'},
        ],
        panel:{ name:'Cardiology · 14 matches', sub:'Pipeline · verified signal', verified:'Live',
          stats:[
            {k:'Fall-through', v:'4', u:'%', delta:'−18', n:'gaps caught before the offer'},
            {k:'Pre-credentialed', v:'9', u:'/14', n:'ready to present today'},
            {k:'Avg trust tier', v:'T3', n:'evidence-weighted shortlist'},
            {k:'Re-key CVs', v:'0', n:'no claims to fact-check'},
          ],
          foot:'Each candidate arrives with a replayable, signed chain' },
      },
      journey:{
        intro:'Walk a single requisition from a noisy pipeline to a pre-credentialed hire. <b>Select a step.</b>',
        stages:[
          { nm:'Search', ix:'01', title:'Search on <em>signal,</em> not on keywords.',
            desc:'Instead of ranking résumés by guesswork, filter the market by evidence-weighted trust tier, specialty, and verified license state. <b>Every result is already confirmed at the source.</b>',
            gain:'Pipeline is verified before first contact',
            events:[
              {t:'Verified pool',s:'Trust signal · T1–T4',icon:'target',key:true},
              {t:'Specialty + state',s:'PECOS-confirmed',icon:'lic',key:true},
              {t:'No claims to vet',s:'Evidence, not CVs',icon:'shield'},
            ]},
          { nm:'Shortlist', ix:'02', title:'Shortlist the <em>pre-credentialed</em> first.',
            desc:'Rank by verified standing and credential-readiness, not by who wrote the best summary. You spend your screens on fit — <b>the facts are already settled.</b>',
            gain:'Screens go to fit, not fact-checking',
            events:[
              {t:'Ranked by trust',s:'Evidence-weighted',icon:'badge',key:true},
              {t:'Readiness flagged',s:'9 of 14 ready',icon:'check',key:true},
              {t:'Gaps visible',s:'Before the offer',icon:'file'},
            ]},
          { nm:'Present', ix:'03', title:'Hand over <em>replayable</em> proof.',
            desc:'Present each candidate with a signed chain the hiring system can replay itself — no PSV scramble, no “we’ll verify later.” <b>Your slate arrives pre-trusted.</b>',
            gain:'Hiring system replays, doesn’t re-collect',
            events:[
              {t:'Signed chain attached',s:'Replayable proof',icon:'replay',key:true},
              {t:'System verifies',s:'On its own machine',icon:'building',key:true},
              {t:'No PSV restart',s:'Move to offer',icon:'route'},
            ]},
          { nm:'Place', ix:'04', title:'Fill the seat <em>before</em> a gap can surface.',
            desc:'Because credential gaps were caught up front, offers don’t collapse during verification. The search doesn’t restart from zero — <b>it closes.</b>',
            gain:'Late-stage fall-through removed',
            events:[
              {t:'Offer holds',s:'No gap surprises',icon:'check',key:true},
              {t:'Faster close',s:'Days, not cycles',icon:'clock',key:true},
              {t:'Reusable record',s:'Carries onward',icon:'replay'},
            ]},
        ],
      },
      outcomes:{
        intro:'The numbers a recruiting leader actually reports on.',
        cards:[
          {v:'4', u:'%', delta:'−18', h:'Fall-through caught before the offer.', s:'Credential gaps surface in search, not weeks into PSV, so offers stop collapsing late.', src:'fall-through rate', feature:true},
          {v:'0', h:'No résumé fact-checking.', s:'You source on confirmed evidence instead of re-keying and re-verifying claims.', src:'CVs re-verified'},
          {v:'T1–T4', h:'Rank candidates by real standing.', s:'Evidence-weighted trust tiers let you shortlist before spending a single screen.', src:'trust ranking'},
          {v:'2×', h:'More screens go to fit.', s:'When the facts are settled up front, your time moves from verification to evaluation.', src:'screen efficiency'},
          {v:'Days', h:'Close faster on a verified slate.', s:'Pre-credentialed candidates move straight to offer instead of waiting on verification.', src:'time-to-fill'},
          {v:'1', h:'Reusable record after placement.', s:'The verified chain carries onward, so the next search starts warmer.', src:'portable proof'},
        ],
      },
      workflow:{
        now:{ lbl:'Today', tag:'post-offer gamble', steps:['Screen résumés on trust','Phone screen','Extend offer','Verify — discover gaps','Restart the search'], foot:'Verification is a post-offer gamble' },
        next:{ lbl:'With VitalCV', tag:'verified-first', steps:['Search on verified trust signal','Shortlist pre-credentialed clinicians','Present replayable proof','Move to fit, not fact-checking','Fill the seat faster'], foot:'Verified-first, every candidate' },
      },
      roi:{
        title:'What ending late fall-through is <em>worth.</em>',
        lede:'Every collapsed offer is a search you run twice. Set your volume and watch the wasted re-searches disappear.',
        accent:'Recruiting waste removed / yr',
        inputs:[
          {key:'placements', label:'Placements per year', min:20, max:600, step:10, def:120, unit:''},
          {key:'fall', label:'Current fall-through rate', min:5, max:40, step:1, def:22, unit:'%'},
          {key:'cost', label:'Cost to run one search', min:2000, max:30000, step:500, def:9000, unit:'$', money:true},
        ],
        compute(v){
          const newFall = 4;
          const avoided = v.placements * Math.max(0, v.fall - newFall) / 100;
          const saved = avoided * v.cost;
          return {
            headline:money(saved), pre:'', u:'',
            cap:'in <b>duplicate searches</b> avoided by catching credential gaps before the offer.',
            breaks:[
              {k:'Searches not re-run', v:num(avoided), u:'/yr'},
              {k:'Fall-through', v:newFall+'%', u:'now'},
            ],
            foot:'Models fall-through dropping from '+v.fall+'% to ~4% on a verified-first pipeline.',
          };
        },
      },
      cta:{ h:'Stop verifying after the offer. Source verified.', primary:'Open Recruiter OS', primaryHref:'../recruiter/Recruiter OS.html' },
    },

    /* ─────────────────────────── HEALTH SYSTEMS ─────────────── */
    'health-systems':{
      name:'Health Systems', kind:'Enterprise', icon:'building', page:'For Health Systems.html', feature:true,
      dirLede:'Extend the record, never modify the core. A verified pipeline + 7-yr ledger.',
      hero:{
        eyebrow:'Built for <b>health systems</b>',
        h1:'Extend the record. <em>Never</em> modify the core.',
        lede:'Every new hire burns a quarter of billable time to onboarding while you re-do verification someone else already finished. Read the clinician’s verified chain instead — and capture <b>$278k+ of ramp revenue per physician.</b>',
        proofs:[
          {b:'36 days', t:'to first claim, from 103'},
          {b:'$278k+', t:'captured per MD'},
          {b:'7-year', t:'audit ledger'},
        ],
        panel:{ name:'Cedar Health System', sub:'Onboarding · 80 MDs / yr', verified:'Pipeline',
          stats:[
            {k:'Time-to-bill', v:'36', u:'d', delta:'−67', n:'from the 103-day norm'},
            {k:'Per-MD captured', v:'$278', u:'k+', n:'recovered ramp revenue'},
            {k:'Duplicate PSV', v:'0', n:'read the chain, don’t re-run it'},
            {k:'Audit retention', v:'7', u:'yr', n:'replayable decision ledger'},
          ],
          foot:'Your attestations extend the chain — the clinician keeps the core' },
      },
      journey:{
        intro:'Follow one hire from discovery to a billing clinician — the enterprise path. <b>Select a step.</b>',
        stages:[
          { nm:'Discovery', ix:'01', title:'Meet a candidate who’s <em>already</em> verified.',
            desc:'Instead of a résumé, the clinician arrives with a signed federal chain. You see verified license state, board status, and DEA before the first conversation — <b>no PSV to schedule.</b>',
            gain:'Verified pipeline, before outreach',
            events:[
              {t:'Verified chain',s:'Signed at source',icon:'shield',key:true},
              {t:'License + boards',s:'PECOS · ABMS',icon:'lic',key:true},
              {t:'No PSV backlog',s:'Already attested',icon:'check'},
            ]},
          { nm:'Verification', ix:'02', title:'Replay the proof — <em>don’t</em> re-collect it.',
            desc:'Your team replays the clinician’s receipts against the original sources, on your own systems. The federal facts other employers confirmed are read, not re-run. <b>Extend the chain; never modify the core.</b>',
            gain:'Duplicate primary-source verification → 0',
            events:[
              {t:'Receipts replayed',s:'On your machine',icon:'replay',key:true},
              {t:'Attestations added',s:'Extend, not modify',icon:'badge',key:true},
              {t:'Audit ledger',s:'Your decisions logged',icon:'file'},
            ]},
          { nm:'Hiring', ix:'03', title:'Privilege and enroll <em>in parallel.</em>',
            desc:'Because the evidence is settled, privileging committee and payer enrollment no longer run in series. The slowest path through onboarding gets <b>cut from months to weeks.</b>',
            gain:'Serial onboarding becomes parallel',
            events:[
              {t:'Privileging',s:'Evidence-ready',icon:'building',key:true},
              {t:'Payer enrollment',s:'Parallel · replayed',icon:'money',key:true},
              {t:'Committee',s:'Decisions logged',icon:'badge'},
            ]},
          { nm:'Credential Readiness', ix:'04', title:'Stay <em>survey-ready</em> by default.',
            desc:'Expirables are monitored continuously and every decision is written to a replayable ledger mapped to standards. NCQA and Joint Commission prep stops being a fire drill — <b>it becomes a query.</b>',
            gain:'Audit prep → a query, not a scramble',
            events:[
              {t:'Expirables monitored',s:'License · DEA · boards',icon:'clock',key:true},
              {t:'Standards-mapped',s:'NCQA · TJC',icon:'shield',key:true},
              {t:'7-yr ledger',s:'Replayable',icon:'replay'},
            ]},
          { nm:'Start', ix:'05', title:'A billing clinician in <em>36 days.</em>',
            desc:'The clinician bills under their own name in weeks, not a quarter. You capture the ramp revenue that used to leak away — and their identity stays portable for the next system. <b>−67 days, captured, not promised.</b>',
            gain:'$278k+ ramp revenue captured per MD',
            events:[
              {t:'First claim',s:'Day 36',icon:'money',key:true},
              {t:'Revenue captured',s:'$278k+ per MD',icon:'chart',key:true},
              {t:'Identity portable',s:'Carries onward',icon:'route'},
            ]},
        ],
      },
      outcomes:{
        intro:'The line items a CFO and a CMO both care about.',
        cards:[
          {v:'$278', u:'k+', h:'Ramp revenue captured per physician.', s:'Every day a licensed MD can’t bill is lost revenue. Starting 67 days sooner recovers most of it.', src:'per MD, per hire', feature:true},
          {v:'36', u:'d', delta:'−67', h:'Time-to-bill, from 103 days.', s:'Privileging and enrollment run in parallel once the evidence is already signed.', src:'median time-to-bill'},
          {v:'0', h:'Duplicate primary-source verification.', s:'Read the verified chain other systems and the source already confirmed — don’t re-run it.', src:'PSV re-runs'},
          {v:'7', u:'yr', h:'A replayable audit ledger you own.', s:'Every credentialing decision is written down and mapped to standards, defensible for years.', src:'audit retention'},
          {v:'Parallel', h:'Onboarding stops running in series.', s:'The slowest path — enrollment, privileging, committee — collapses into concurrent tracks.', src:'process model'},
          {v:'Portable', h:'Clinician identity stays theirs.', s:'You extend the record and keep your own ledger; the core never moves out from under the clinician.', src:'extends · never modifies'},
        ],
      },
      workflow:{
        now:{ lbl:'Today', tag:'serial · duplicated', steps:['Collect documents','Primary-source verification','Credentialing committee','Privileging','Payer enrollment — months, serial'], foot:'~$278k per MD left on the table' },
        next:{ lbl:'With VitalCV', tag:'replay · parallel', steps:['Read the clinician’s verified chain','Attest — never modify the core','Privilege + enroll in parallel','Decisions written to your audit ledger','Clinician identity stays portable'], foot:'A verified pipeline + a 7-year ledger' },
      },
      roi:{
        title:'The ramp revenue you’re <em>leaving on the table.</em>',
        lede:'Every day a licensed physician can’t bill is revenue gone. Set your hiring volume and current time-to-bill.',
        accent:'Ramp revenue captured / yr',
        inputs:[
          {key:'mds', label:'Physicians hired per year', min:10, max:500, step:5, def:80, unit:''},
          {key:'days', label:'Current time-to-bill', min:60, max:180, step:1, def:103, unit:'d'},
          {key:'rev', label:'Daily revenue per physician', min:1500, max:12000, step:100, def:5800, unit:'$', money:true},
        ],
        compute(v){
          const target = 36;
          const saved = Math.max(0, v.days - target);
          const perMD = saved * v.rev;
          const annual = perMD * v.mds;
          return {
            headline:money(annual), pre:'', u:'',
            cap:'in <b>ramp revenue</b> recovered by starting every physician '+saved+' days sooner.',
            breaks:[
              {k:'Captured per MD', v:money(perMD), u:''},
              {k:'Days saved', v:num(saved), u:'d'},
            ],
            foot:'Models time-to-bill falling from '+v.days+' to 36 days across '+v.mds+' hires.',
          };
        },
      },
      cta:{ h:'Stop re-verifying. Capture the ramp.', primary:'See the Employer Pipeline', primaryHref:'../Employer Pipeline.html' },
    },

    /* ─────────────────────────── STAFFING ───────────────────── */
    'staffing':{
      name:'Staffing Firms', kind:'Networks', icon:'route', page:'For Staffing Firms.html',
      dirLede:'Place clinicians in days, not weeks. Verify once, place many.',
      hero:{
        eyebrow:'Built for <b>staffing firms</b>',
        h1:'Place clinicians in <em>days</em> — verify once, place many.',
        lede:'A credential packet gets rebuilt for every assignment, and every facility re-verifies the same locum you placed last month. Carry <b>one portable verified packet</b> and recover the idle-day margin you’re losing today.',
        proofs:[
          {b:'Days', t:'time-to-place, not weeks'},
          {b:'Once', t:'verify, then replay'},
          {b:'↑ fill', t:'less idle time'},
        ],
        panel:{ name:'Locum · Hospitalist', sub:'Assignment packet · portable', verified:'Reusable',
          stats:[
            {k:'Time-to-place', v:'Days', n:'reuse across facilities'},
            {k:'Idle days', v:'1', u:'/asgmt', delta:'−5', n:'from ~6 days waiting'},
            {k:'Re-verification', v:'1×', n:'then replay everywhere'},
            {k:'Fill rate', v:'↑', n:'clinicians billing sooner'},
          ],
          foot:'One signed packet, replayed at every facility' },
      },
      journey:{
        intro:'Follow one locum from packet to placement — then watch it reused. <b>Select a step.</b>',
        stages:[
          { nm:'Onboard', ix:'01', title:'Build the packet <em>once.</em>',
            desc:'Assemble the clinician’s evidence a single time, signed at the source. This portable packet is the asset you reuse — <b>not paperwork you rebuild for every assignment.</b>',
            gain:'Packet assembled once, owned by the clinician',
            events:[
              {t:'Signed packet',s:'Source-verified',icon:'shield',key:true},
              {t:'License + DEA',s:'PECOS · active',icon:'lic',key:true},
              {t:'Portable',s:'Carries to any site',icon:'route'},
            ]},
          { nm:'Match', ix:'02', title:'Offer a <em>pre-verified</em> clinician.',
            desc:'Present the assignment with the verified packet attached. The facility sees confirmed evidence up front, so there’s no “we’ll credential them when they arrive.”',
            gain:'Facilities see verified evidence first',
            events:[
              {t:'Packet attached',s:'To the submission',icon:'file',key:true},
              {t:'Trust signal',s:'Evidence-weighted',icon:'badge',key:true},
              {t:'No surprises',s:'Gaps visible early',icon:'check'},
            ]},
          { nm:'Replay', ix:'03', title:'The facility <em>replays,</em> doesn’t re-verify.',
            desc:'Instead of running primary-source verification from scratch, the facility replays the signed receipts on its own systems. The verification you did <b>carries — it doesn’t reset.</b>',
            gain:'Facility PSV from scratch → replay',
            events:[
              {t:'Receipts replayed',s:'Facility-side',icon:'replay',key:true},
              {t:'Reused across sites',s:'Same chain',icon:'route',key:true},
              {t:'Days, not weeks',s:'To cleared',icon:'clock'},
            ]},
          { nm:'Place', ix:'04', title:'Bill the <em>same week.</em>',
            desc:'With clearance in days, the clinician starts almost immediately — and you recover the idle days that used to eat the margin you were hired to protect. <b>More placements, less waiting.</b>',
            gain:'Idle-day margin recovered',
            events:[
              {t:'Cleared in days',s:'Replay, not re-run',icon:'clock',key:true},
              {t:'Margin recovered',s:'Idle days cut',icon:'money',key:true},
              {t:'Reuse next site',s:'Verify once',icon:'replay'},
            ]},
        ],
      },
      outcomes:{
        intro:'What a placement leader watches every week.',
        cards:[
          {v:'5', u:'d', delta:'recovered', h:'Idle days cut per assignment.', s:'Clearance in days instead of weeks means the clinician bills almost immediately.', src:'idle days saved', feature:true},
          {v:'1×', h:'Verify once, place many.', s:'The same signed packet is replayed at every facility instead of rebuilt each time.', src:'verifications per packet'},
          {v:'Days', h:'Time-to-place, not weeks.', s:'Facilities replay receipts rather than running PSV from scratch.', src:'time-to-place'},
          {v:'↑', h:'Higher fill rate.', s:'Less idle time per clinician means more billable placements across the roster.', src:'fill rate'},
          {v:'$', h:'Recover the idle-day margin.', s:'Every day a clinician waits on verification is un-billed margin — VitalCV gives it back.', src:'margin per placement'},
          {v:'Portable', h:'One packet, owned by the clinician.', s:'The verified record carries across assignments and firms — the work compounds.', src:'reusable evidence'},
        ],
      },
      workflow:{
        now:{ lbl:'Today', tag:'rebuilt per placement', steps:['Assemble the credential packet','Verify the packet','Submit to the facility','Facility re-verifies from scratch','Finally place'], foot:'Time-to-place measured in weeks' },
        next:{ lbl:'With VitalCV', tag:'verify once · replay', steps:['Carry one portable verified packet','Facility replays the receipts','Reuse the same chain across sites','Place the same week','Recover the idle-day margin'], foot:'Verify once, place many' },
      },
      roi:{
        title:'The idle-day margin you’re <em>giving back.</em>',
        lede:'Every day a placed clinician waits on a facility’s verification is margin you don’t bill. Set your roster and the idle gap.',
        accent:'Idle-day margin recovered / yr',
        inputs:[
          {key:'placements', label:'Placements per year', min:50, max:2000, step:25, def:400, unit:''},
          {key:'idle', label:'Idle days waiting on verification', min:1, max:14, step:1, def:6, unit:'d'},
          {key:'margin', label:'Daily margin per placement', min:200, max:1500, step:25, def:650, unit:'$', money:true},
        ],
        compute(v){
          const target = 1;
          const recovered = Math.max(0, v.idle - target);
          const annual = v.placements * recovered * v.margin;
          return {
            headline:money(annual), pre:'', u:'',
            cap:'in <b>idle-day margin</b> recovered by clearing placements in a day instead of '+v.idle+'.',
            breaks:[
              {k:'Days cut / placement', v:num(recovered), u:'d'},
              {k:'Per placement', v:money(recovered*v.margin), u:''},
            ],
            foot:'Models idle days dropping from '+v.idle+' to ~1 across '+num(v.placements)+' placements.',
          };
        },
      },
      cta:{ h:'Verify once. Place many. Recover the margin.', primary:'Open Opportunity Network', primaryHref:'../opportunity-network/Opportunity Network.html' },
    },

    /* ─────────────────────────── MEDICAL SCHOOLS ────────────── */
    'medical-schools':{
      name:'Medical Schools', kind:'Education', icon:'grad', page:'For Medical Schools.html',
      dirLede:'The record begins on day one — signed once, owned by the graduate.',
      hero:{
        eyebrow:'Built for <b>medical schools</b>',
        h1:'The record begins on <em>day one</em> — and the registrar load ends.',
        lede:'Your registrar answers verification requests for a graduate’s entire career — by hand, for decades. Sign enrollment, exams, and rotations once, and let <b>alumni carry their own portable proof.</b>',
        proofs:[
          {b:'≈90%', t:'requests eliminated'},
          {b:'Day one', t:'the record starts'},
          {b:'For life', t:'alumni own it'},
        ],
        panel:{ name:'Office of the Registrar', sub:'Verification requests · annual', verified:'Signed',
          stats:[
            {k:'Manual requests', v:'↓90', u:'%', n:'replaced by replay'},
            {k:'Alumni record', v:'Portable', n:'carried into practice'},
            {k:'Issued', v:'Once', n:'enrollment · exams · rotations'},
            {k:'Downstream', v:'Faster', n:'credentialing by replay'},
          ],
          foot:'Signed once at graduation — replayable for the graduate’s career' },
      },
      journey:{
        intro:'Follow a single graduate from matriculation to a decades-long career — without a single manual letter. <b>Select a step.</b>',
        stages:[
          { nm:'Matriculate', ix:'01', title:'Sign the record at the <em>source.</em>',
            desc:'Enrollment, exams, and rotations are signed and timestamped the moment they happen. The registrar’s authority is captured once — <b>not re-issued every time someone asks.</b>',
            gain:'First receipts issued at matriculation',
            events:[
              {t:'Enrollment signed',s:'LCME program',icon:'grad',key:true},
              {t:'Exams · rotations',s:'Timestamped',icon:'file',key:true},
              {t:'Registrar authority',s:'Captured once',icon:'badge'},
            ]},
          { nm:'Graduate', ix:'02', title:'Hand the graduate a <em>portable</em> record.',
            desc:'On graduation the chain belongs to the alumnus. They walk into residency and credentialing with their own signed proof — <b>and your office is no longer the bottleneck.</b>',
            gain:'Graduate owns a verifiable chain',
            events:[
              {t:'Record conferred',s:'Owned by alumnus',icon:'check',key:true},
              {t:'Portable proof',s:'Carries into practice',icon:'route',key:true},
              {t:'No issuer lock-in',s:'School not in the loop',icon:'shield'},
            ]},
          { nm:'Replay', ix:'03', title:'Downstream credentialing <em>replays</em> you.',
            desc:'When a hospital or board needs to confirm enrollment years later, they replay the signed receipt against the record — instead of mailing the registrar a request, a fee, and a delay. <b>The letter disappears.</b>',
            gain:'Manual verification letters → replay',
            events:[
              {t:'Receipt replayed',s:'By the verifier',icon:'replay',key:true},
              {t:'No registrar letter',s:'Request eliminated',icon:'file',key:true},
              {t:'No fee, no delay',s:'Instant confirm',icon:'clock'},
            ]},
          { nm:'For life', ix:'04', title:'Requests approach <em>zero</em> — for decades.',
            desc:'Across an alumnus’s entire career, the same signed evidence answers every verification automatically. The registrar load that used to span decades <b>collapses to near nothing.</b>',
            gain:'Decades of registrar load eliminated',
            events:[
              {t:'Lifetime replay',s:'Career-long',icon:'replay',key:true},
              {t:'Registrar freed',s:'≈90% fewer requests',icon:'spark',key:true},
              {t:'Alumni served better',s:'Instant, no fee',icon:'user'},
            ]},
        ],
      },
      outcomes:{
        intro:'What changes for the registrar — and for every alumnus.',
        cards:[
          {v:'90', u:'%', h:'Manual verification requests eliminated.', s:'Once the record is signed and portable, downstream verifiers replay it instead of writing your office.', src:'request volume', feature:true},
          {v:'Portable', h:'Alumni carry their own proof.', s:'Graduates own a verifiable chain they take into residency, credentialing, and practice.', src:'record ownership'},
          {v:'Day 1', h:'The record starts at matriculation.', s:'Enrollment, exams, and rotations are signed as they happen — not reconstructed later.', src:'when it begins'},
          {v:'Once', h:'Issue the authority a single time.', s:'The registrar’s confirmation is captured once and replayed forever, with no re-issuing.', src:'issuance'},
          {v:'Faster', h:'Downstream credentialing speeds up.', s:'Hospitals and boards confirm enrollment by replay, so your alumni start sooner.', src:'graduate outcomes'},
          {v:'$0', h:'No fees, no delay for alumni.', s:'The verification letter, the fee, and the wait all disappear from the graduate’s path.', src:'alumnus cost'},
        ],
      },
      workflow:{
        now:{ lbl:'Today', tag:'manual · fee-bound', steps:['Receive a verification request','Pull the registrar record','Issue a manual letter','Charge a fee · add delay','Repeat for decades'], foot:'A lifetime of registrar load' },
        next:{ lbl:'With VitalCV', tag:'signed once · replay', steps:['Sign enrollment, exams, rotations once','Graduate with a portable record','Alumni carry their own proof','Downstream credentialing replays it','Registrar requests approach zero'], foot:'Signed once, owned by the graduate' },
      },
      roi:{
        title:'The registrar hours you’re <em>spending</em> on letters.',
        lede:'Every verification request is staff time your office never gets back. Set your annual volume and handling time.',
        accent:'Administrative cost removed / yr',
        inputs:[
          {key:'reqs', label:'Verification requests per year', min:200, max:20000, step:100, def:4200, unit:''},
          {key:'mins', label:'Minutes to handle each', min:10, max:60, step:1, def:28, unit:'m'},
          {key:'rate', label:'Loaded staff cost per hour', min:25, max:80, step:1, def:42, unit:'$', money:true},
        ],
        compute(v){
          const elim = 0.9;
          const hours = v.reqs * elim * v.mins / 60;
          const saved = hours * v.rate;
          return {
            headline:money(saved), pre:'', u:'',
            cap:'in <b>registrar staff time</b> returned by replacing manual letters with replay.',
            breaks:[
              {k:'Hours returned', v:num(hours), u:'/yr'},
              {k:'Requests eliminated', v:num(v.reqs*elim), u:''},
            ],
            foot:'Models ~90% of '+num(v.reqs)+' requests answered by replay instead of by hand.',
          };
        },
      },
      cta:{ h:'Sign the record once. Free the registrar for good.', primary:'See a career unfold', primaryHref:'../experience/VitalCV Experience.html#journey' },
    },

    /* ── directory-only roles (in the platform, deep-dive on hub) ── */
    'medical-groups':{ name:'Medical Groups', kind:'Enterprise', icon:'network',
      dirLede:'Onboard physicians without the back-office — continuous monitoring, lean team.' },
    'credentialing':{ name:'Credentialing Teams', kind:'Operations', icon:'shield',
      dirLede:'Stop re-collecting what’s already proven. Audit prep becomes a query.' },
    'residency':{ name:'Residency Programs', kind:'Education', icon:'steth',
      dirLede:'Verify incoming residents by replay — and sign training as it happens.' },
    'societies':{ name:'Professional Societies', kind:'Membership', icon:'laurel',
      dirLede:'Confirm member standing against signed evidence, not self-reported claims.' },
    'payers':{ name:'Payers', kind:'Networks', icon:'money',
      dirLede:'Enroll providers against verified evidence — directories that stay accurate.' },
  };

  /* directory display order = the ten from the brief */
  const DIR_ORDER = ['clinicians','recruiters','health-systems','medical-groups','credentialing','staffing','medical-schools','residency','societies','payers'];

  window.W700 = { OUTCOMES, SOL, DIR_ORDER, money, num, moneyFull };
})();
