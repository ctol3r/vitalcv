/* ═══════════════════════════════════════════════════════════════════════
   VitalCV · Wave 900 — Application Marketplace (D4)
   Applications built on VitalCV: Career OS, Recruiter OS, Organization OS,
   Credentialing OS, Education OS, and future partner applications.
   No-ops if #appgrid is absent.
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
  "use strict";
  const ic = window.CICON || window.VICON || function(){return '';};

  const APPS = [
    { nm:'Career OS', by:'VitalCV · first-party', icon:'compass', acc:true, tier:'Live',
      desc:'The operating system for a healthcare career. A clinician sees what they have, where they stand, and what\u2019s next — all on the trust they own.',
      built:[['user','Identity'],['file','Evidence'],['route','Career']],
      metric:['38K','clinicians'], href:'../eco/VitalCV Ecosystem.html' },
    { nm:'Recruiter OS', by:'VitalCV · first-party', icon:'target', acc:false, tier:'Live',
      desc:'Source, match, and engage pre-verified clinicians on real signed signal — not a re-keyed r\u00e9sum\u00e9. Candidates respond pre-credentialed.',
      built:[['network','Exchange'],['shield','Trust'],['medal','Recognition']],
      metric:['2.2K','recruiters'], href:'../recruiter/Recruiter OS.html' },
    { nm:'Organization OS', by:'VitalCV · first-party', icon:'building', acc:false, tier:'Live',
      desc:'Run a health system\u2019s workforce on the record — pipeline, attestations, and a permanent audit ledger of every decision the org makes.',
      built:[['building','Organizations'],['shield','Trust'],['code','Developers']],
      metric:['310','organizations'], href:'../org-os/Organization OS.html' },
    { nm:'Credentialing OS', by:'VitalCV · first-party', icon:'shield', acc:true, tier:'Live',
      desc:'The entire credentialing workflow on replay-verified evidence. Accept by replay, track freshness, and cut time-to-bill from 103 days to 36.',
      built:[['file','Evidence'],['shield','Trust'],['replay','Replay']],
      metric:['\u221267','days to bill'], href:'../exchange/Verifier Portal.html' },
    { nm:'Education OS', by:'VitalCV · first-party', icon:'book', acc:false, tier:'Live',
      desc:'Schools and programs issue signed degrees, transcripts, and training evidence at the source — and watch it flow, owned by the learner.',
      built:[['grad','Identity'],['file','Evidence'],['badge','Issuer']],
      metric:['28','schools'], href:'../exchange/Issuer Portal.html' },
    { nm:'Lattice Scheduling', by:'Lattice Health · partner', icon:'plug', acc:false, tier:'Partner',
      desc:'A partner application that schedules only pre-credentialed clinicians, calling the verification API before any shift is published.',
      built:[['webhook','Integrations'],['code','Developers'],['shield','Trust']],
      metric:['84K','shifts / mo'], href:'../platform/VitalCV Platform.html' },
  ];

  function renderMarket(){
    const grid = document.getElementById('appgrid');
    if(!grid) return;

    const cards = APPS.map(a=>`
      <div class="appcard ${a.acc?'acc':''}">
        <a class="app-link" href="${a.href}" aria-label="Open ${a.nm}"></a>
        <div class="app-top">
          <div class="app-ic">${ic(a.icon,24)}</div>
          <div class="app-id">
            <div class="app-nm">${a.nm}</div>
            <div class="app-by">${a.by}</div>
          </div>
          <div class="app-tier"><span class="chip ${a.tier==='Partner'?'chip-ghost':'chip-ok'}"><span class="cd"></span>${a.tier}</span></div>
        </div>
        <div class="app-body"><div class="app-desc">${a.desc}</div></div>
        <div class="app-built">
          <div class="lbl">Built on</div>
          <div class="app-chips">${a.built.map(b=>`<span class="app-chip">${ic(b[0],12)}${b[1]}</span>`).join('')}</div>
        </div>
        <div class="app-foot">
          <span class="app-metric"><b>${a.metric[0]}</b> ${a.metric[1]}</span>
          <a class="app-open" href="${a.href}">Open <svg class="arrow" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
        </div>
      </div>`).join('');

    // a "build your own" future-partner slot
    const slot = `
      <div class="appcard partner empty">
        <div class="app-empty-in">
          <div class="ee-ic">${ic('code',22)}</div>
          <div class="ee-t">Your application here</div>
          <div class="ee-s">Build on the same identity, evidence, and trust the first-party apps use — APIs, SDKs, webhooks, and embeds.</div>
          <div class="ee-b">Open the developer platform \u2192</div>
        </div>
        <a class="app-link" href="../platform/VitalCV Platform.html" aria-label="Open developer platform"></a>
      </div>`;

    grid.innerHTML = cards + slot;
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', renderMarket);
  else renderMarket();
})();
