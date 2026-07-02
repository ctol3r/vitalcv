/* ═══════════════════════════════════════════════════════════════════════
   VitalCV · Wave 900 — Ecosystem Directory (D2)
   Every connected participant — medical schools, residencies, boards,
   staffing firms, health systems, payers, developer apps. Filter + search.
   No-ops if #dirgrid is absent.
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
  "use strict";
  const ic = window.CICON || window.VICON || function(){return '';};

  const CATS = [
    {k:'all',      t:'All participants', icon:'network'},
    {k:'school',   t:'Medical schools',  icon:'grad'},
    {k:'residency',t:'Residencies',      icon:'steth'},
    {k:'board',    t:'Boards',           icon:'badge'},
    {k:'staffing', t:'Staffing firms',   icon:'route'},
    {k:'system',   t:'Health systems',   icon:'building'},
    {k:'payer',    t:'Payers',           icon:'money'},
    {k:'app',      t:'Developer apps',   icon:'grid'},
  ];

  const ORGS = [
    // medical schools
    {nm:'Mountain State School of Medicine', cat:'school', kind:'Medical school · LCME', mark:'grad', role:'issuer', gov:false,
      desc:'Signs the foundational credential — degree, transcript, enrollment — at conferral.',
      stats:[['Graduates','12.4',{u:'K'}],['Receipts/yr','3.1',{u:'K'}],['Joined','2024']]},
    {nm:'Bayview University College of Medicine', cat:'school', kind:'Medical school · LCME', mark:'grad', role:'issuer',
      desc:'Issues sealed transcripts and MD conferrals bound to each clinician\u2019s identity anchor.',
      stats:[['Graduates','9.8',{u:'K'}],['Receipts/yr','2.4',{u:'K'}],['Joined','2025']]},
    {nm:'Atlantic College of Osteopathic Medicine', cat:'school', kind:'Medical school · COCA', mark:'grad', role:'issuer',
      desc:'DO-granting school issuing signed degree and rotation evidence on the exchange.',
      stats:[['Graduates','6.2',{u:'K'}],['Receipts/yr','1.6',{u:'K'}],['Joined','2025']]},
    // residencies
    {nm:'Cedar Health Internal Medicine', cat:'residency', kind:'ACGME program', mark:'steth', role:'both',
      desc:'Attests completed training and supervised hours; verifies incoming fellows by replay.',
      stats:[['Trainees','148'],['Hours logged','1.2',{u:'M'}],['Joined','2024']]},
    {nm:'Northwell Surgery Residency', cat:'residency', kind:'ACGME program', mark:'steth', role:'issuer',
      desc:'Signs training completion and procedure logs as portable, replayable receipts.',
      stats:[['Trainees','96'],['Programs','7'],['Joined','2025']]},
    {nm:'Pacific Pediatrics Program', cat:'residency', kind:'ACGME program', mark:'steth', role:'issuer',
      desc:'Issues attested standing that replaces the verification letters employers re-request.',
      stats:[['Trainees','72'],['Receipts/yr','410'],['Joined','2025']]},
    // boards
    {nm:'American Board of Internal Medicine', cat:'board', kind:'Certifying board · ABMS', mark:'badge', role:'issuer', gov:true,
      desc:'Issues board certification as a signed attestation bound to the professional\u2019s NPI.',
      stats:[['Diplomates','280',{u:'K'}],['Freshness','Live'],['Joined','2024']]},
    {nm:'American Board of Surgery', cat:'board', kind:'Certifying board · ABMS', mark:'badge', role:'issuer', gov:true,
      desc:'Signs certification and subspecialty status, linked directly to the trust chain.',
      stats:[['Diplomates','98',{u:'K'}],['Freshness','Live'],['Joined','2024']]},
    {nm:'State Medical Board · California', cat:'board', kind:'State licensing board', mark:'lic', role:'both', gov:true,
      desc:'Issues licensure and disciplinary status; verifies practitioners across jurisdictions.',
      stats:[['Licensees','145',{u:'K'}],['Freshness','Daily'],['Joined','2025']]},
    // staffing
    {nm:'Veritas Locum Network', cat:'staffing', kind:'Staffing firm · verifier', mark:'route', role:'verifier',
      desc:'Places clinicians who are already verified — assignments open the day a receipt is accepted.',
      stats:[['Placements','4.1',{u:'K'}],['Avg deploy','3',{u:'d'}],['Joined','2025']]},
    {nm:'Meridian Health Staffing', cat:'staffing', kind:'Staffing firm · verifier', mark:'route', role:'verifier',
      desc:'Re-verifies on a 30-day cycle by replaying receipts instead of re-collecting documents.',
      stats:[['Clinicians','2.7',{u:'K'}],['Re-verify','30',{u:'d'}],['Joined','2025']]},
    // health systems
    {nm:'Cedar Health System', cat:'system', kind:'Health system · 12 facilities', mark:'building', role:'both',
      desc:'Credentials by replay across 12 facilities; extends the record, never modifies the core.',
      stats:[['Facilities','12'],['Time-to-bill','36',{u:'d'}],['Joined','2024']]},
    {nm:'Northstar Medical Group', cat:'system', kind:'Health system · 8 facilities', mark:'building', role:'verifier',
      desc:'Onboards physicians in days by accepting attested evidence against the original sources.',
      stats:[['Facilities','8'],['Hires/yr','640'],['Joined','2025']]},
    {nm:'Harbor Children\u2019s Network', cat:'system', kind:'Health system · pediatric', mark:'building', role:'verifier',
      desc:'Verifies privileges and DEA confirmation by replay, audit-locked to the organization.',
      stats:[['Facilities','5'],['Time-to-bill','41',{u:'d'}],['Joined','2025']]},
    // payers
    {nm:'Summit Health Plan', cat:'payer', kind:'Payer · PECOS-linked', mark:'money', role:'verifier',
      desc:'Enrolls providers in parallel with privileging against the same attested evidence.',
      stats:[['Members','1.8',{u:'M'}],['Enroll time','\u221254',{u:'%'}],['Joined','2025']]},
    {nm:'Cascade Benefits', cat:'payer', kind:'Payer · regional', mark:'money', role:'verifier',
      desc:'Removes duplicated verification — no waiting in line behind credentialing.',
      stats:[['Members','920',{u:'K'}],['Networks','14'],['Joined','2025']]},
    // developer apps
    {nm:'Career OS', cat:'app', kind:'Application · first-party', mark:'compass', role:'app',
      desc:'The clinician-facing operating system for a healthcare career, built on the trust fabric.',
      stats:[['Active users','38',{u:'K'}],['Built on','5 APIs'],['Joined','2024']]},
    {nm:'Recruiter OS', cat:'app', kind:'Application · first-party', mark:'target', role:'app',
      desc:'Sources and engages pre-verified clinicians matched on real, signed trust signal.',
      stats:[['Recruiters','2.2',{u:'K'}],['Built on','4 APIs'],['Joined','2025']]},
    {nm:'Credentialing OS', cat:'app', kind:'Application · first-party', mark:'shield', role:'app',
      desc:'Runs an organization\u2019s entire credentialing workflow on replay-verified evidence.',
      stats:[['Orgs','310'],['Built on','6 APIs'],['Joined','2025']]},
    {nm:'Lattice Scheduling', cat:'app', kind:'Application · partner', mark:'plug', role:'app',
      desc:'Partner app that schedules only pre-credentialed clinicians via the verification API.',
      stats:[['Shifts/mo','84',{u:'K'}],['Built on','3 APIs'],['Joined','2026']]},
  ];

  const ROLE_LABEL = { issuer:'Issuer', verifier:'Verifier', both:'Issuer + verifier', app:'Application' };
  const ROLE_CLASS = { issuer:'issuer', verifier:'verifier', both:'both', app:'both' };

  function renderDirectory(){
    const grid = document.getElementById('dirgrid');
    const filt = document.getElementById('dirfilters');
    const search = document.getElementById('dirsearch');
    const countEl = document.getElementById('dircount');
    if(!grid) return;

    if(filt){
      filt.innerHTML = CATS.map((c,i)=>{
        const n = c.k==='all'? ORGS.length : ORGS.filter(x=>x.cat===c.k).length;
        return `<button class="df ${i===0?'on':''}" data-cat="${c.k}">${ic(c.icon,15)}${c.t}<span class="ct">${n}</span></button>`;
      }).join('');
    }

    grid.innerHTML = ORGS.map(o=>`
      <div class="orgcard ${o.gov?'gov':''}" data-cat="${o.cat}" data-nm="${o.nm.toLowerCase()}">
        <div class="oc-top">
          <div class="oc-mark">${ic(o.mark,22)}</div>
          <div class="oc-id">
            <div class="oc-nm">${o.nm}</div>
            <div class="oc-kind">${o.kind}</div>
          </div>
          <div class="oc-role"><span class="role-pill ${ROLE_CLASS[o.role]}"><span class="cd"></span>${ROLE_LABEL[o.role]}</span></div>
        </div>
        <div class="oc-body"><div class="oc-desc">${o.desc}</div></div>
        <div class="oc-stats">
          ${o.stats.map(s=>`<div class="oc-stat"><div class="sk">${s[0]}</div><div class="sv">${s[1]}${s[2]&&s[2].u?`<span class="u">${s[2].u}</span>`:''}</div></div>`).join('')}
        </div>
      </div>`).join('');

    let curCat='all', curQ='';
    function apply(){
      let shown=0;
      grid.querySelectorAll('.orgcard').forEach(c=>{
        const okCat = curCat==='all' || c.dataset.cat===curCat;
        const okQ = !curQ || c.dataset.nm.includes(curQ);
        const vis = okCat&&okQ;
        c.classList.toggle('hidden', !vis);
        if(vis) shown++;
      });
      if(countEl) countEl.textContent = shown;
    }
    if(filt){
      filt.querySelectorAll('.df').forEach(b=> b.addEventListener('click',()=>{
        filt.querySelectorAll('.df').forEach(x=>x.classList.remove('on')); b.classList.add('on');
        curCat=b.dataset.cat; apply();
      }));
    }
    if(search){ search.addEventListener('input',()=>{ curQ=search.value.trim().toLowerCase(); apply(); }); }
    apply();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', renderDirectory);
  else renderDirectory();
})();
