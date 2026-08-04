/* ══════════════════════════════════════════════════════════════════════════
   eco-data.js — VitalCV Provider Career Ecosystem · unified data model (W300)
   One subject (Macie Miller, PA-C) projected across every stream.
   Everything here is a READ over data the streams already own — never a
   new store. Consumed by every W300 surface.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  const provider = {
    name: 'Macie Miller',
    initials: 'MM',
    credential: 'PA-C',
    role: 'Physician Assistant',
    specialty: 'Orthopedic Surgery',
    npi: '1346053246',
    location: 'Irvine, CA',
    since: 'Enumerated Jan 2025',
  };

  // ── Career Health — the one composite read ──────────────────────────────
  const health = {
    score: 68,
    label: 'Conditional Ready',
    delta: +6,
    deltaWindow: '30 days',
    basis: 'Share of career standing on fresh, primary-source evidence',
    note: 'projected · never stored',
    // contributing reads, each a stream
    factors: [
      { k: 'Evidence', v: 72, tone: 'verified' },
      { k: 'Trust',    v: 81, tone: 'verified' },
      { k: 'Mobility', v: 54, tone: 'pending'  },
    ],
  };

  // ── Stream summary tiles (home) ─────────────────────────────────────────
  const streams = {
    evidence: {
      key: 'evidence', stream: '01', name: 'Evidence',
      headline: '14 credentials', sub: '68% fresh · primary-source',
      tone: 'verified', dot: 'verified',
      line: 'Your owned ledger — what you can prove, and how fresh it is.',
      stat: [ ['Verified','9'], ['Pending','2'], ['Needs access','2'], ['Contradicted','1'] ],
    },
    trust: {
      key: 'trust', stream: '02', name: 'Trust',
      headline: 'Authoritative', sub: 'T4 sealed on 4 lanes',
      tone: 'verified', dot: 'verified',
      line: 'How authoritative your record is — the published trust ladder.',
      stat: [ ['T4 sealed','4'], ['T3 registry','3'], ['T2 federated','1'], ['Open','0'] ],
    },
    mobility: {
      key: 'mobility', stream: '03', name: 'Mobility',
      headline: '2 gaps to close', sub: '+41 reqs within reach',
      tone: 'pending', dot: 'pending',
      line: 'Where your evidence can take you — readiness and the next move.',
      stat: [ ['Qualified now','14'], ['One step away','41'], ['States','1'], ['Radius','60mi'] ],
    },
    organizations: {
      key: 'organizations', stream: '04', name: 'Organizations',
      headline: 'Cedar Health', sub: 'Active · 5 connected orgs',
      tone: 'verified', dot: 'verified',
      line: 'The institutions you are connected to — your verified work graph.',
      stat: [ ['Employers','2'], ['Training','2'], ['Authorities','3'], ['Active','1'] ],
    },
    opportunities: {
      key: 'opportunities', stream: '05', name: 'Opportunities',
      headline: '3 fresh matches', sub: 'projected from owned evidence',
      tone: 'verified', dot: 'verified',
      line: 'Roles projected from your evidence — never a stored match.',
      stat: [ ['Fresh','3'], ['Watching','5'], ['Applied','1'], ['Saved','4'] ],
    },
  };

  // ── Evidence ledger ─────────────────────────────────────────────────────
  // state: verified | pending | access | contradicted
  // tier: T1 public · T2 federated · T3 authoritative · T4 primary-sealed
  const evidence = [
    { id: 'identity',  label: 'Identity', source: 'NPPES', authority: 'CMS', state: 'verified', tier: 'T4', fresh: 'today', detail: 'NPI 1346053246 · Type 1 · Active' },
    { id: 'sanctions', label: 'Sanctions screen', source: 'OIG / LEIE', authority: 'HHS-OIG', state: 'verified', tier: 'T4', fresh: '6 days', detail: 'No exclusions · April dataset' },
    { id: 'medicare',  label: 'Medicare enrollment', source: 'PECOS', authority: 'CMS', state: 'verified', tier: 'T3', fresh: '42 days', detail: 'Part B · reassignment active' },
    { id: 'nccpa',     label: 'Board certification', source: 'NCCPA', authority: 'NCCPA', state: 'verified', tier: 'T4', fresh: '90 days', detail: 'PA-C · primary-sealed' },
    { id: 'dea',       label: 'DEA registration', source: 'DEA', authority: 'DOJ-DEA', state: 'verified', tier: 'T3', fresh: '120 days', detail: 'Schedules II–V · exp 2027' },
    { id: 'bls',       label: 'BLS / ACLS', source: 'AHA', authority: 'AHA', state: 'verified', tier: 'T3', fresh: '60 days', detail: 'Both current · exp 2027' },
    { id: 'edu',       label: 'Education', source: 'Western U.', authority: 'Registrar', state: 'verified', tier: 'T3', fresh: '1 yr', detail: 'MS PA Studies · 2024' },
    { id: 'refs',      label: 'Peer references', source: 'Direct', authority: 'Attesters', state: 'verified', tier: 'T2', fresh: '40 days', detail: '2 of 3 received' },
    { id: 'malp',      label: 'Malpractice coverage', source: 'Carrier', authority: 'The Doctors Co.', state: 'verified', tier: 'T3', fresh: '30 days', detail: '$1M / $3M · in force' },
    { id: 'licensure', label: 'CA PA License', source: 'CA PA Board', authority: 'State of CA', state: 'pending', tier: 'T3', fresh: '— renew 38d', detail: 'Expires in 38 days · renewal routed' },
    { id: 'coi',       label: 'Insurance COI', source: 'Carrier', authority: 'The Doctors Co.', state: 'pending', tier: 'T3', fresh: '— renew 73d', detail: 'Renewal outstanding' },
    { id: 'npdb',      label: 'Adverse history', source: 'NPDB', authority: 'HRSA', state: 'access', tier: 'T4', fresh: '—', detail: 'Requires institutional query' },
    { id: 'multistate',label: 'Multi-state licensure', source: 'Nursys', authority: 'NCSBN', state: 'access', tier: 'T3', fresh: '—', detail: 'Subscriber access required' },
    { id: 'employer',  label: 'Current employer', source: 'Resume ⇄ PECOS', authority: 'Federated', state: 'contradicted', tier: 'T2', fresh: 'today', detail: 'Resume vs PECOS disagree' },
  ];

  // ── Trust ladder ────────────────────────────────────────────────────────
  const trustTiers = [
    { code: 'T4', label: 'Primary-Sealed', desc: 'Cryptographically signed by the issuing authority.', count: 4 },
    { code: 'T3', label: 'Authoritative', desc: 'Returned by the registry of record.', count: 6 },
    { code: 'T2', label: 'Federated', desc: 'Corroborated across the partner network.', count: 2 },
    { code: 'T1', label: 'Public', desc: 'Self-attested or scraped from public sources.', count: 0 },
  ];

  // ── Mobility ────────────────────────────────────────────────────────────
  const mobility = {
    qualifiedNow: 14,
    readiness: 68,
    unlocks: [
      { id: 'dea',   label: 'DEA already verified', sub: 'Schedule II–V authority on file', reqs: '+32', state: 'done' },
      { id: 'nccpa', label: 'Attach CAQ — Orthopaedics', sub: 'Specialty-gated requisitions', reqs: '+9', state: 'open' },
      { id: 'states',label: 'Add NV + AZ licensure', sub: 'Expands radius ~380 miles', reqs: '+11', state: 'open' },
    ],
  };

  // ── Organizations / network graph ───────────────────────────────────────
  // kind: employer | training | authority
  const orgs = [
    { id: 'cedar',    name: 'Cedar Health System', kind: 'employer', rel: 'Current employer', status: 'active', since: 'Feb 2025', detail: 'PA-C · Orthopedic Surgery · Irvine, CA', verified: true },
    { id: 'irm',      name: 'Irvine Regional Medical Group', kind: 'employer', rel: 'Medicare reassignment', status: 'verified', since: 'Jan 2025', detail: 'PECOS reassignment of benefits', verified: true },
    { id: 'westernu', name: 'Western U. of Health Sciences', kind: 'training', rel: 'Degree program', status: 'verified', since: '2022–2024', detail: 'MS · Physician Assistant Studies', verified: true },
    { id: 'ucla',     name: 'UCLA Medical Center', kind: 'training', rel: 'Postgraduate fellowship', status: 'verified', since: '2024', detail: 'Orthopedic PA fellowship', verified: true },
    { id: 'nccpa',    name: 'NCCPA', kind: 'authority', rel: 'Certifying body', status: 'sealed', since: '2024', detail: 'PA-C certification · primary-sealed', verified: true },
    { id: 'caboard',  name: 'CA PA Board', kind: 'authority', rel: 'Licensing authority', status: 'pending', since: '2023', detail: 'License renewal in 38 days', verified: true },
    { id: 'cms',      name: 'CMS · NPPES / PECOS', kind: 'authority', rel: 'Federal registry', status: 'verified', since: '2025', detail: 'Identity + Medicare enrollment', verified: true },
  ];

  // ── Career relationships (people) ───────────────────────────────────────
  const people = [
    { id: 'chen',   name: 'Daniel Chen, MD', rel: 'Supervising physician', org: 'Cedar Health', tone: 'verified', tag: 'Supervisor' },
    { id: 'rao',    name: 'Aditi Rao, MD', rel: 'Fellowship director', org: 'UCLA Medical Center', tone: 'verified', tag: 'Mentor' },
    { id: 'nair',   name: 'Priya Nair, MD', rel: 'Peer reference', org: 'UCLA', tone: 'verified', tag: 'Reference · received' },
    { id: 'greene', name: 'Samuel Greene, PA-C', rel: 'Peer reference', org: 'Cedar Health', tone: 'verified', tag: 'Reference · received' },
    { id: 'ortega', name: 'Rafael Ortega, MD', rel: 'Peer reference', org: 'Cedar Health', tone: 'pending', tag: 'Reference · outstanding' },
    { id: 'okafor', name: 'Jordan Okafor', rel: 'Credentialing lead', org: 'Cedar Health MSO', tone: 'verified', tag: 'Credentialer' },
  ];

  // ── Opportunities ───────────────────────────────────────────────────────
  const opportunities = [
    { id: 'op1', role: 'Senior PA · Orthopedic Surgery', org: 'Cedar Health System', match: 92, fresh: 'today', state: 'ready', miss: null, comp: '$138–152K', loc: 'Irvine, CA' },
    { id: 'op2', role: 'Orthopedic PA · Sports Medicine', org: 'OC Medical Center', match: 86, fresh: '2 days', state: 'gap', miss: 'CAQ Orthopaedics', comp: '$132–146K', loc: 'Newport Beach, CA' },
    { id: 'op3', role: 'Lead PA · Joint Replacement', org: 'Pacific Bone & Joint', match: 78, fresh: '5 days', state: 'gap', miss: 'NV licensure', comp: '$140–160K', loc: 'Las Vegas, NV' },
  ];

  // ── Ecosystem feed ──────────────────────────────────────────────────────
  // kind: evidence | trust | opportunity | organization | mobility
  const activity = [
    { id: 'a1', kind: 'evidence', when: '2h ago', t: 'Sanctions screen verified', d: 'OIG/LEIE April dataset · no exclusions found.', tier: 'T4', stream: 'Evidence' },
    { id: 'a2', kind: 'mobility', when: '6h ago', t: 'Mobility unlock available', d: 'DEA verification opens +32 requisitions across 4 systems.', tier: null, stream: 'Mobility' },
    { id: 'a3', kind: 'opportunity', when: '9h ago', t: '3 roles now match your evidence', d: 'Projected from fresh Wallet evidence — orthopedic PA tracks.', tier: null, stream: 'Opportunities' },
    { id: 'a4', kind: 'trust', when: '1d ago', t: 'Trust milestone · T4 reached', d: 'NCCPA certification sealed primary-source. 4 lanes now T4.', tier: 'T4', stream: 'Trust' },
    { id: 'a5', kind: 'organization', when: '2d ago', t: 'Cedar Health confirmed work history', d: 'Org graph edge verified against PECOS reassignment.', tier: 'T3', stream: 'Organizations' },
    { id: 'a6', kind: 'evidence', when: '3d ago', t: 'CA PA License expiring in 38 days', d: 'Renewal request auto-routed to you · authority lane.', tier: 'T3', stream: 'Evidence' },
    { id: 'a7', kind: 'trust', when: '4d ago', t: 'Federated observation logged', d: 'Passport re-used at OR Medical Group (Irvine) · cross-network.', tier: 'T2', stream: 'Trust' },
    { id: 'a8', kind: 'organization', when: '6d ago', t: 'New affiliation edge', d: 'UCLA fellowship verified against registrar attestation.', tier: 'T3', stream: 'Organizations' },
    { id: 'a9', kind: 'mobility', when: '8d ago', t: 'Readiness rose +6', d: 'Career Health 62 → 68 after sanctions + board cert refresh.', tier: null, stream: 'Mobility' },
    { id: 'a10', kind: 'opportunity', when: '11d ago', t: 'Saved role re-scored', d: 'Lead PA · Joint Replacement now 78% — NV licensure is the gap.', tier: null, stream: 'Opportunities' },
  ];

  // ── Unified search index ────────────────────────────────────────────────
  // type: evidence | organization | opportunity | person | event
  const searchIndex = [
    ...evidence.map(e => ({ type: 'evidence', id: e.id, title: e.label, sub: `${e.source} · ${e.tier} · ${e.state}`, route: '#/', state: e.state })),
    ...orgs.map(o => ({ type: 'organization', id: o.id, title: o.name, sub: `${o.rel} · ${o.status}`, route: '#/network', state: o.status })),
    ...opportunities.map(o => ({ type: 'opportunity', id: o.id, title: o.role, sub: `${o.org} · ${o.match}% match`, route: '#/', state: o.state })),
    ...people.map(p => ({ type: 'person', id: p.id, title: p.name, sub: `${p.rel} · ${p.org}`, route: '#/network', state: p.tone })),
    ...activity.map(a => ({ type: 'event', id: a.id, title: a.t, sub: `${a.stream} · ${a.when}`, route: '#/activity', state: a.kind })),
  ];

  window.ECO = {
    provider, health, streams, evidence, trustTiers, mobility,
    orgs, people, opportunities, activity, searchIndex,
    build: 'vc.2026.06.23 · w300',
  };
})();
