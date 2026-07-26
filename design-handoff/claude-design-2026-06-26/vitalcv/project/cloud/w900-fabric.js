/* ═══════════════════════════════════════════════════════════════════════
   VitalCV · Wave 900 — Trust Fabric (D3)
   Interactive vertical flow. Eight stages, trust compounds and flows:
   Professional → Evidence → Recognition → Trust → Exchange →
   Organizations → Career → Applications.
   No-ops if #fabflow is absent → safe to load on every cloud page.
   ═══════════════════════════════════════════════════════════════════════ */
(function(){
  "use strict";
  const ic = window.CICON || window.VICON || function(){return '';};

  const STAGES = [
    { key:'pro', n:'Professional', role:'the owner', icon:'user', trust:'18', pct:18,
      ix:'01 / 08',
      title:'It starts with a <em>person</em>, not a profile.',
      lead:'A clinician\u2019s identity is established at the source and bound to their NPI. From this single anchor, every downstream layer attaches — and the professional owns all of it, not any employer, board, or VitalCV.',
      feats:[ {k:'Anchor',v:'NPI-bound identity'}, {k:'Owned by',v:'The clinician — portable'}, {k:'PHI stored',v:'None, by validation'}, {k:'Starts at',v:'Matriculation'} ],
      out:'Identity anchored' },
    { key:'evidence', n:'Evidence', role:'signed at source', icon:'file', trust:'31', pct:31,
      ix:'02 / 08',
      title:'Every fact becomes a <em>signed receipt.</em>',
      lead:'Schools, boards, hospitals, and federal registries answer one authoritative question and sign the answer with the source, the question, and the timestamp. Evidence accrues to the identity automatically — a receipt, never a screenshot.',
      feats:[ {k:'Sources',v:'NPPES · OIG · PECOS · ABMS'}, {k:'Output',v:'Cryptographic receipt'}, {k:'Replayable',v:'7 years, any verifier'}, {k:'Re-collected',v:'Never again'} ],
      out:'Receipts issued' },
    { key:'recognition', n:'Recognition', role:'differentiated signal', icon:'medal', trust:'52', pct:52,
      ix:'03 / 08',
      title:'Standing that <em>distinguishes</em> one clinician.',
      lead:'Leadership roles, quality outcomes, peer references, research, and society standing attach to the same chain. Trust stops being merely \u201cverified\u201d and becomes differentiated — the signal that separates one professional from the next.',
      feats:[ {k:'Signals',v:'Roles · outcomes · refs'}, {k:'Research',v:'Output linked to chain'}, {k:'Societies',v:'Fellowship & standing'}, {k:'Result',v:'Portable reputation'} ],
      out:'Reputation compounds' },
    { key:'trust', n:'Trust', role:'verifiable outside the issuer', icon:'shield', trust:'68', pct:68,
      ix:'04 / 08',
      title:'Proof that <em>doesn\u2019t need us</em> to be true.',
      lead:'Each receipt is replayable by anyone, against the original federal evidence, on a different machine, with no VitalCV in the loop. That property — verifiability outside the issuer — is the whole point. Trust accumulates into evidence-weighted tiers.',
      feats:[ {k:'Model',v:'Cryptographic attestation'}, {k:'Authority',v:'Stays with the source'}, {k:'Tiers',v:'T1 \u2192 T4, evidence-weighted'}, {k:'Needs VitalCV',v:'No — replays standalone'} ],
      out:'Trust state: verified' },
    { key:'exchange', n:'Exchange', role:'the shared network', icon:'network', trust:'79', pct:79,
      ix:'05 / 08',
      title:'One network every participant <em>shares.</em>',
      lead:'Issuers, professionals, and verifiers meet on a single exchange with no center to capture. Trust, once issued, flows downstream untouched — the residency trusts the school, the board trusts the residency, the employer trusts the board. None re-collect a thing.',
      feats:[ {k:'Participants',v:'Issuers · pros · verifiers'}, {k:'Flow',v:'Downstream, untouched'}, {k:'Center',v:'None to capture'}, {k:'Accepted by',v:'Replay, not phone calls'} ],
      out:'Trust flows the network' },
    { key:'orgs', n:'Organizations', role:'build on the record', icon:'building', trust:'87', pct:87,
      ix:'06 / 08',
      title:'Health systems <em>build on</em> the chain.',
      lead:'Employers, payers, staffing firms, and health systems read, attest to, and extend the record — they never modify the core. Each verifies by replay instead of re-collecting documents, turning a quarter of onboarding into days.',
      feats:[ {k:'Principle',v:'Extends · never modifies core'}, {k:'Verifies by',v:'Replay — \u221267 days'}, {k:'Gets',v:'Pipeline + audit ledger'}, {k:'Clinician keeps',v:'A portable identity'} ],
      out:'Org decisions audit-locked' },
    { key:'career', n:'Career', role:'compounds over decades', icon:'route', trust:'93', pct:93,
      ix:'07 / 08',
      title:'A career that <em>compounds</em>, never repeats.',
      lead:'Across every transition — student to resident to attending to executive — the same chain carries forward. Nothing is re-verified at any move. Trust built once at the source keeps paying off for an entire 35-year career.',
      feats:[ {k:'Spans',v:'Student \u2192 emeritus, unbroken'}, {k:'At each move',v:'Zero re-verification'}, {k:'Mobility',v:'Days, not a quarter'}, {k:'Legacy',v:'Replayable for years' } ],
      out:'Career, continuous' },
    { key:'apps', n:'Applications', role:'run on the cloud', icon:'grid', trust:'97', pct:97,
      ix:'08 / 08',
      title:'Every workforce app runs <em>on top.</em>',
      lead:'Career OS, Recruiter OS, Organization OS, Credentialing OS, Education OS — and every future partner application — are built on the same trust fabric. They don\u2019t each rebuild verification; they inherit it. The cloud is the substrate; the apps are the surface.',
      feats:[ {k:'Built on',v:'Identity \u2192 trust \u2192 exchange'}, {k:'Inherit',v:'Verification, not rebuild it'}, {k:'Surface',v:'APIs · SDKs · webhooks · embeds'}, {k:'Open to',v:'Partner developers'} ],
      out:'The platform, realized' },
  ];

  function renderFabric(){
    const flow = document.getElementById('fabflow');
    const detail = document.getElementById('fabdetail');
    if(!flow || !detail) return;

    flow.innerHTML = STAGES.map((s,i)=>`
      <button class="fabnode" data-i="${i}">
        <span class="fn-ix mono">${String(i+1).padStart(2,'0')}</span>
        <span class="fn-ic">${ic(s.icon,19)}</span>
        <span class="fn-tx">
          <span class="fn-nm">${s.n}</span>
          <span class="fn-role">${s.role}</span>
        </span>
        <span class="fn-trust"><span class="tn">${s.trust}</span><span class="tl">trust</span></span>
        <span class="fab-conn" style="--d:${(i*0.3).toFixed(2)}s"></span>
      </button>`).join('');

    function select(i){
      const s = STAGES[i];
      flow.querySelectorAll('.fabnode').forEach((b,bi)=> b.classList.toggle('on', bi===i));
      detail.innerHTML = `
        <div class="fd-h">
          <div>
            <div class="ix mono">${ic('layers',13)} STAGE ${s.ix} · ${s.role}</div>
            <h3>${s.title}</h3>
          </div>
          <div class="ico">${ic(s.icon,24)}</div>
        </div>
        <div class="fd-b">
          <p class="lead">${s.lead}</p>
          <div class="fab-compound">
            <div class="fc-meter">
              <div class="fc-track"><i style="width:${s.pct}%"></i></div>
              <div class="fc-lbl"><span>Compounded trust at this layer</span><span>${s.pct}/100</span></div>
            </div>
            <div class="fc-n">${s.trust}</div>
          </div>
          <div class="fab-feat">
            ${s.feats.map(f=>`<div class="f"><div class="fk">${ic('check',12)}${f.k}</div><div class="fv">${f.v}</div></div>`).join('')}
          </div>
        </div>
        <div class="fd-f">
          <span>${i>0?`flows from ${STAGES[i-1].n}`:'the origin of the chain'}</span>
          <span class="out">${ic('check',14)}${s.out}</span>
        </div>`;
    }

    flow.querySelectorAll('.fabnode').forEach(b=>{
      b.addEventListener('click',()=>select(+b.dataset.i));
      b.addEventListener('mouseenter',()=>{ if(window.matchMedia('(hover:hover)').matches) select(+b.dataset.i); });
    });
    select(0);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', renderFabric);
  else renderFabric();
})();
