/* ══════════════════════════════════════════════════════════════════════════
   rec-data.js — VitalCV Recruiter OS · W310 data model
   The flip side of the Career Ecosystem: where the candidate OS projects ONE
   subject across streams, the Recruiter OS projects MANY clinicians ranked by
   one question — who should I call?  Every field is a READ over evidence the
   clinicians already own; the recruiter never stores a record.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {

  // ── Operator context (the paying customer) ──────────────────────────────
  const operator = {
    org: 'Meridian Care Network',
    desk: 'Talent Acquisition',
    recruiter: 'Dana Whitfield',
    seat: 'Talent Partner',
    reqs: 6,
  };

  /* ── Candidate pool ──────────────────────────────────────────────────────
     bucket: ready | near | blocked | missing
     trust:  top sealed tier (T4 primary-sealed → T1 public)
     mobility.status: open | passive | closed
     why[]:  ranked reasons this clinician surfaced — the recruiter's "why"
  */
  const candidates = [
    {
      id: 'okafor', name: 'Naomi Okafor', credential: 'NP', specialty: 'Emergency Medicine',
      npi: '1932557081', location: 'Phoenix, AZ', exp: '8 yrs',
      readiness: 94, bucket: 'ready', trust: 'T4', evidenceFresh: 96, verified: 13, gaps: 0,
      comp: '$132–148K', avail: 'Immediate',
      mobility: { status: 'open', radius: '150 mi', states: ['AZ', 'NV', 'NM'], signal: 'Marked open to relocate · 3 days ago' },
      highlight: 'Fully credential-ready, sanctions-clean, open to relocate. Call first.',
      why: [
        { icon: 'check', t: 'Zero open gaps', d: 'All 13 credential lanes verified and fresh.' },
        { icon: 'shield', t: 'T4 on 5 lanes', d: 'Board cert, DEA, identity, sanctions, NPDB all primary-sealed.' },
        { icon: 'mobility', t: 'Newly mobility-open', d: 'Opened a 150-mile relocation radius 3 days ago.' },
      ],
      flags: [],
      evidenceItems: [
        { label: 'Board certification', source: 'AANP', state: 'verified', tier: 'T4', fresh: '21 days' },
        { label: 'DEA registration', source: 'DOJ-DEA', state: 'verified', tier: 'T4', fresh: '40 days' },
        { label: 'Sanctions screen', source: 'OIG / LEIE', state: 'verified', tier: 'T4', fresh: '4 days' },
        { label: 'Adverse history', source: 'NPDB', state: 'verified', tier: 'T4', fresh: '12 days' },
        { label: 'State licensure', source: 'AZ BON', state: 'verified', tier: 'T3', fresh: '30 days' },
        { label: 'BLS / ACLS / PALS', source: 'AHA', state: 'verified', tier: 'T3', fresh: '60 days' },
      ],
      trustLanes: [ ['Identity', 'T4'], ['Certification', 'T4'], ['Sanctions', 'T4'], ['Adverse history', 'T4'], ['Licensure', 'T3'] ],
      orgs: [
        { name: 'Banner Health', kind: 'employer', rel: 'Current employer', status: 'active' },
        { name: 'Maricopa Medical Center', kind: 'training', rel: 'EM-NP fellowship', status: 'verified' },
        { name: 'AANP', kind: 'authority', rel: 'Certifying body', status: 'sealed' },
      ],
      timeline: [
        { when: '3d ago', t: 'Opened relocation radius', d: '150 mi · AZ, NV, NM', tier: null },
        { when: '4d ago', t: 'Sanctions re-screened clean', d: 'OIG/LEIE April dataset', tier: 'T4' },
        { when: '12d ago', t: 'NPDB query cleared', d: 'No adverse reports', tier: 'T4' },
        { when: '21d ago', t: 'Board certification renewed', d: 'AANP · primary-sealed', tier: 'T4' },
      ],
    },
    {
      id: 'miller', name: 'Macie Miller', credential: 'PA-C', specialty: 'Orthopedic Surgery',
      npi: '1346053246', location: 'Irvine, CA', exp: '4 yrs',
      readiness: 68, bucket: 'near', trust: 'T4', evidenceFresh: 72, verified: 9, gaps: 2,
      comp: '$138–152K', avail: '30 days',
      mobility: { status: 'passive', radius: '60 mi', states: ['CA'], signal: '+41 requisitions within reach · 2 gaps to close' },
      highlight: 'Strong ortho profile — one license renewal and an employer mismatch from ready.',
      why: [
        { icon: 'shield', t: 'Board-sealed PA-C', d: 'NCCPA certification primary-sealed; DEA verified on file.' },
        { icon: 'mobility', t: '+41 reqs within reach', d: 'Closing 2 gaps unlocks orthopedic tracks across the network.' },
        { icon: 'target', t: 'Specialty match', d: 'Orthopedic surgery — directly on req MCN-ORTHO-04.' },
      ],
      flags: [
        { state: 'pending', t: 'CA PA license renews in 38 days', d: 'Renewal routed to candidate.' },
        { state: 'contradicted', t: 'Employer mismatch', d: 'Resume vs PECOS disagree on current employer.' },
      ],
      evidenceItems: [
        { label: 'Board certification', source: 'NCCPA', state: 'verified', tier: 'T4', fresh: '90 days' },
        { label: 'Identity', source: 'NPPES / CMS', state: 'verified', tier: 'T4', fresh: 'today' },
        { label: 'Sanctions screen', source: 'OIG / LEIE', state: 'verified', tier: 'T4', fresh: '6 days' },
        { label: 'DEA registration', source: 'DOJ-DEA', state: 'verified', tier: 'T3', fresh: '120 days' },
        { label: 'CA PA license', source: 'CA PA Board', state: 'pending', tier: 'T3', fresh: 'renews 38d' },
        { label: 'Current employer', source: 'Resume ⇄ PECOS', state: 'contradicted', tier: 'T2', fresh: 'today' },
      ],
      trustLanes: [ ['Identity', 'T4'], ['Certification', 'T4'], ['Sanctions', 'T4'], ['DEA', 'T3'], ['Licensure', 'T3'] ],
      orgs: [
        { name: 'Cedar Health System', kind: 'employer', rel: 'Current employer', status: 'active' },
        { name: 'UCLA Medical Center', kind: 'training', rel: 'Orthopedic PA fellowship', status: 'verified' },
        { name: 'NCCPA', kind: 'authority', rel: 'Certifying body', status: 'sealed' },
      ],
      timeline: [
        { when: '6h ago', t: 'Sanctions screen verified', d: 'No exclusions · April dataset', tier: 'T4' },
        { when: '2d ago', t: 'Employer edge contradicted', d: 'Resume vs PECOS disagree', tier: 'T2' },
        { when: '3d ago', t: 'CA PA license expiring in 38 days', d: 'Renewal auto-routed', tier: 'T3' },
        { when: '8d ago', t: 'Readiness rose +6', d: '62 → 68 after board cert refresh', tier: null },
      ],
    },
    {
      id: 'reyes', name: 'Daniel Reyes', credential: 'MD', specialty: 'Hospital Medicine',
      npi: '1457780024', location: 'Denver, CO', exp: '11 yrs',
      readiness: 91, bucket: 'ready', trust: 'T4', evidenceFresh: 93, verified: 15, gaps: 0,
      comp: '$255–290K', avail: '60 days',
      mobility: { status: 'open', radius: 'Nationwide', states: ['CO', 'TX', 'UT', 'AZ'], signal: 'Multi-state licensure · open nationwide' },
      highlight: 'Multi-state hospitalist, board-sealed, nationwide-open. Rare availability.',
      why: [
        { icon: 'mobility', t: 'Licensed in 4 states', d: 'CO, TX, UT, AZ — immediate multi-market deployment.' },
        { icon: 'check', t: 'Zero open gaps', d: '15 lanes verified; malpractice in force.' },
        { icon: 'shield', t: 'NPDB cleared', d: 'Institutional query returned clean 9 days ago.' },
      ],
      flags: [],
      evidenceItems: [
        { label: 'Board certification', source: 'ABIM', state: 'verified', tier: 'T4', fresh: '45 days' },
        { label: 'Multi-state licensure', source: 'Nursys / state boards', state: 'verified', tier: 'T3', fresh: '15 days' },
        { label: 'Adverse history', source: 'NPDB', state: 'verified', tier: 'T4', fresh: '9 days' },
        { label: 'Malpractice coverage', source: 'The Doctors Co.', state: 'verified', tier: 'T3', fresh: '30 days' },
        { label: 'DEA registration', source: 'DOJ-DEA', state: 'verified', tier: 'T3', fresh: '70 days' },
        { label: 'Sanctions screen', source: 'OIG / LEIE', state: 'verified', tier: 'T4', fresh: '6 days' },
      ],
      trustLanes: [ ['Identity', 'T4'], ['Certification', 'T4'], ['Sanctions', 'T4'], ['Adverse history', 'T4'], ['Licensure', 'T3'] ],
      orgs: [
        { name: 'UCHealth', kind: 'employer', rel: 'Current employer', status: 'active' },
        { name: 'Denver Health', kind: 'employer', rel: 'Prior · 2018–2022', status: 'verified' },
        { name: 'ABIM', kind: 'authority', rel: 'Certifying body', status: 'sealed' },
      ],
      timeline: [
        { when: '1d ago', t: 'Marked open · nationwide', d: 'Available 60 days', tier: null },
        { when: '9d ago', t: 'NPDB query cleared', d: 'No adverse reports', tier: 'T4' },
        { when: '15d ago', t: 'TX license added', d: 'Now 4-state', tier: 'T3' },
      ],
    },
    {
      id: 'haddad', name: 'Lena Haddad', credential: 'CRNA', specialty: 'Anesthesiology',
      npi: '1588220947', location: 'Seattle, WA', exp: '7 yrs',
      readiness: 89, bucket: 'ready', trust: 'T4', evidenceFresh: 90, verified: 12, gaps: 0,
      comp: '$210–240K', avail: 'Immediate',
      mobility: { status: 'open', radius: '300 mi', states: ['WA', 'OR'], signal: 'Actively interviewing · immediate availability' },
      highlight: 'Immediately available CRNA, actively interviewing. High-demand specialty.',
      why: [
        { icon: 'bolt', t: 'Immediate availability', d: 'No notice period — can start within two weeks.' },
        { icon: 'spark', t: 'Actively interviewing', d: 'Engaged with the market this week.' },
        { icon: 'check', t: 'Clean credential set', d: '12 lanes verified, NBCRNA sealed.' },
      ],
      flags: [],
      evidenceItems: [
        { label: 'Certification', source: 'NBCRNA', state: 'verified', tier: 'T4', fresh: '30 days' },
        { label: 'WA licensure', source: 'WA DOH', state: 'verified', tier: 'T3', fresh: '20 days' },
        { label: 'Sanctions screen', source: 'OIG / LEIE', state: 'verified', tier: 'T4', fresh: '6 days' },
        { label: 'DEA registration', source: 'DOJ-DEA', state: 'verified', tier: 'T3', fresh: '50 days' },
        { label: 'Adverse history', source: 'NPDB', state: 'verified', tier: 'T4', fresh: '25 days' },
      ],
      trustLanes: [ ['Identity', 'T4'], ['Certification', 'T4'], ['Sanctions', 'T4'], ['Adverse history', 'T4'], ['Licensure', 'T3'] ],
      orgs: [
        { name: 'Virginia Mason', kind: 'employer', rel: 'Current employer', status: 'active' },
        { name: 'NBCRNA', kind: 'authority', rel: 'Certifying body', status: 'sealed' },
      ],
      timeline: [
        { when: '2d ago', t: 'Re-engaged with market', d: 'Actively interviewing', tier: null },
        { when: '6d ago', t: 'Sanctions re-screened clean', d: 'OIG/LEIE', tier: 'T4' },
      ],
    },
    {
      id: 'voss', name: 'Erik Voss', credential: 'PA-C', specialty: 'Cardiology',
      npi: '1699330158', location: 'Austin, TX', exp: '6 yrs',
      readiness: 87, bucket: 'ready', trust: 'T3', evidenceFresh: 88, verified: 11, gaps: 0,
      comp: '$135–150K', avail: '30 days',
      mobility: { status: 'open', radius: '100 mi', states: ['TX'], signal: 'Opened to new roles · 6 days ago' },
      highlight: 'Cardiology PA, fully verified, recently opened to new roles.',
      why: [
        { icon: 'check', t: 'No open gaps', d: 'All lanes verified; references received.' },
        { icon: 'mobility', t: 'Recently market-open', d: 'Switched to open status 6 days ago.' },
        { icon: 'target', t: 'Specialty in demand', d: 'Cardiology PA — short supply in TX market.' },
      ],
      flags: [],
      evidenceItems: [
        { label: 'Board certification', source: 'NCCPA', state: 'verified', tier: 'T3', fresh: '80 days' },
        { label: 'TX licensure', source: 'TX Medical Board', state: 'verified', tier: 'T3', fresh: '40 days' },
        { label: 'Sanctions screen', source: 'OIG / LEIE', state: 'verified', tier: 'T4', fresh: '6 days' },
        { label: 'Peer references', source: 'Attesters', state: 'verified', tier: 'T2', fresh: '15 days' },
        { label: 'DEA registration', source: 'DOJ-DEA', state: 'verified', tier: 'T3', fresh: '90 days' },
      ],
      trustLanes: [ ['Identity', 'T4'], ['Certification', 'T3'], ['Sanctions', 'T4'], ['Licensure', 'T3'], ['References', 'T2'] ],
      orgs: [
        { name: 'Ascension Seton', kind: 'employer', rel: 'Current employer', status: 'active' },
        { name: 'NCCPA', kind: 'authority', rel: 'Certifying body', status: 'sealed' },
      ],
      timeline: [
        { when: '6d ago', t: 'Opened to new roles', d: '100 mi radius', tier: null },
        { when: '15d ago', t: 'Second reference received', d: '2 of 2 on file', tier: 'T2' },
      ],
    },
    {
      id: 'sato', name: 'Mina Sato', credential: 'NP', specialty: 'Psychiatric / Mental Health',
      npi: '1710440269', location: 'Portland, OR', exp: '9 yrs',
      readiness: 64, bucket: 'near', trust: 'T3', evidenceFresh: 70, verified: 10, gaps: 1,
      comp: '$128–142K', avail: '45 days',
      mobility: { status: 'open', radius: 'Telehealth', states: ['OR', 'WA', 'CA'], signal: 'Telehealth-ready · 3-state coverage' },
      highlight: 'Tri-state telehealth psych NP — one reference short of ready.',
      why: [
        { icon: 'mobility', t: 'Telehealth · 3 states', d: 'Licensed OR, WA, CA — broad virtual coverage.' },
        { icon: 'target', t: 'High-demand specialty', d: 'PMHNP supply is constrained nationally.' },
        { icon: 'clock', t: 'One gap from ready', d: 'Final peer reference outstanding.' },
      ],
      flags: [
        { state: 'pending', t: 'One reference outstanding', d: '2 of 3 received.' },
      ],
      evidenceItems: [
        { label: 'Certification', source: 'ANCC', state: 'verified', tier: 'T4', fresh: '35 days' },
        { label: 'OR / WA / CA licensure', source: 'State boards', state: 'verified', tier: 'T3', fresh: '25 days' },
        { label: 'Sanctions screen', source: 'OIG / LEIE', state: 'verified', tier: 'T4', fresh: '6 days' },
        { label: 'Peer references', source: 'Attesters', state: 'pending', tier: 'T2', fresh: '2 of 3' },
        { label: 'DEA registration', source: 'DOJ-DEA', state: 'verified', tier: 'T3', fresh: '60 days' },
      ],
      trustLanes: [ ['Identity', 'T4'], ['Certification', 'T4'], ['Sanctions', 'T4'], ['Licensure', 'T3'], ['References', 'T2'] ],
      orgs: [
        { name: 'Kaiser Permanente NW', kind: 'employer', rel: 'Current employer', status: 'active' },
        { name: 'ANCC', kind: 'authority', rel: 'Certifying body', status: 'sealed' },
      ],
      timeline: [
        { when: '1d ago', t: 'Added CA telehealth license', d: 'Now 3-state', tier: 'T3' },
        { when: '5d ago', t: 'Second reference received', d: '2 of 3', tier: 'T2' },
      ],
    },
    {
      id: 'bianchi', name: 'Carla Bianchi', credential: 'NP', specialty: 'Family Medicine',
      npi: '1821550370', location: 'Sacramento, CA', exp: '5 yrs',
      readiness: 61, bucket: 'near', trust: 'T3', evidenceFresh: 66, verified: 9, gaps: 1,
      comp: '$118–132K', avail: '30 days',
      mobility: { status: 'passive', radius: '75 mi', states: ['CA'], signal: 'Passive · responsive to direct outreach' },
      highlight: 'Family NP, clean record, one credential renewal pending.',
      why: [
        { icon: 'check', t: 'Sanctions-clean', d: 'OIG/LEIE clear; identity sealed.' },
        { icon: 'clock', t: 'One renewal pending', d: 'BLS lapses in 22 days — easily refreshed.' },
        { icon: 'target', t: 'Primary-care fit', d: 'Family medicine — high-volume req coverage.' },
      ],
      flags: [
        { state: 'pending', t: 'BLS lapses in 22 days', d: 'Renewal not yet on file.' },
      ],
      evidenceItems: [
        { label: 'Certification', source: 'AANP', state: 'verified', tier: 'T4', fresh: '40 days' },
        { label: 'CA licensure', source: 'CA BRN', state: 'verified', tier: 'T3', fresh: '30 days' },
        { label: 'Sanctions screen', source: 'OIG / LEIE', state: 'verified', tier: 'T4', fresh: '6 days' },
        { label: 'BLS / ACLS', source: 'AHA', state: 'pending', tier: 'T3', fresh: 'lapses 22d' },
      ],
      trustLanes: [ ['Identity', 'T4'], ['Certification', 'T4'], ['Sanctions', 'T4'], ['Licensure', 'T3'] ],
      orgs: [
        { name: 'Sutter Health', kind: 'employer', rel: 'Current employer', status: 'active' },
        { name: 'AANP', kind: 'authority', rel: 'Certifying body', status: 'sealed' },
      ],
      timeline: [
        { when: '4d ago', t: 'BLS expiry flagged', d: 'Lapses in 22 days', tier: 'T3' },
        { when: '12d ago', t: 'Sanctions re-screened clean', d: 'OIG/LEIE', tier: 'T4' },
      ],
    },
    {
      id: 'mwangi', name: 'Joseph Mwangi', credential: 'MD', specialty: 'Critical Care',
      npi: '1932667192', location: 'Houston, TX', exp: '14 yrs',
      readiness: 58, bucket: 'near', trust: 'T4', evidenceFresh: 64, verified: 13, gaps: 1,
      comp: '$310–360K', avail: '90 days',
      mobility: { status: 'passive', radius: '50 mi', states: ['TX'], signal: 'Long notice period · plan ahead' },
      highlight: 'Senior intensivist, board-sealed — long notice but worth the queue.',
      why: [
        { icon: 'shield', t: 'Deep T4 stack', d: 'Board, sanctions, identity, NPDB all primary-sealed.' },
        { icon: 'target', t: 'Scarce specialty', d: 'Critical-care intensivists are network-critical.' },
        { icon: 'clock', t: 'Malpractice renewal due', d: 'COI refresh outstanding — single gap.' },
      ],
      flags: [
        { state: 'pending', t: 'Malpractice COI outstanding', d: 'Renewal in progress.' },
      ],
      evidenceItems: [
        { label: 'Board certification', source: 'ABIM · Critical Care', state: 'verified', tier: 'T4', fresh: '50 days' },
        { label: 'TX licensure', source: 'TX Medical Board', state: 'verified', tier: 'T3', fresh: '35 days' },
        { label: 'Adverse history', source: 'NPDB', state: 'verified', tier: 'T4', fresh: '20 days' },
        { label: 'Sanctions screen', source: 'OIG / LEIE', state: 'verified', tier: 'T4', fresh: '6 days' },
        { label: 'Malpractice COI', source: 'Carrier', state: 'pending', tier: 'T3', fresh: 'renew 30d' },
      ],
      trustLanes: [ ['Identity', 'T4'], ['Certification', 'T4'], ['Sanctions', 'T4'], ['Adverse history', 'T4'], ['Licensure', 'T3'] ],
      orgs: [
        { name: 'Houston Methodist', kind: 'employer', rel: 'Current employer', status: 'active' },
        { name: 'ABIM', kind: 'authority', rel: 'Certifying body', status: 'sealed' },
      ],
      timeline: [
        { when: '3d ago', t: 'Malpractice COI flagged', d: 'Renewal due in 30 days', tier: 'T3' },
        { when: '20d ago', t: 'NPDB query cleared', d: 'No adverse reports', tier: 'T4' },
      ],
    },
    {
      id: 'delacruz', name: 'Rosa Dela Cruz', credential: 'RN', specialty: 'Critical Care / ICU',
      npi: '1043778283', location: 'San Diego, CA', exp: '6 yrs',
      readiness: 41, bucket: 'missing', trust: 'T3', evidenceFresh: 52, verified: 7, gaps: 3,
      comp: '$95–112K', avail: '30 days',
      mobility: { status: 'open', radius: '120 mi', states: ['CA'], signal: 'Open — but record needs institutional access' },
      highlight: 'Promising ICU RN, but NPDB and license lanes need institutional access.',
      why: [
        { icon: 'mobility', t: 'Open to move', d: 'Active 120-mile radius.' },
        { icon: 'eye', t: 'Needs institutional query', d: 'NPDB and multi-state lanes require your access.' },
        { icon: 'target', t: 'ICU coverage', d: 'Bedside critical-care — recurring req need.' },
      ],
      flags: [
        { state: 'missing', t: 'NPDB requires institutional query', d: 'Not yet run.' },
        { state: 'missing', t: 'Multi-state licensure unverified', d: 'Subscriber access required.' },
      ],
      evidenceItems: [
        { label: 'CA RN licensure', source: 'CA BRN', state: 'verified', tier: 'T3', fresh: '30 days' },
        { label: 'Certification', source: 'AACN · CCRN', state: 'verified', tier: 'T3', fresh: '60 days' },
        { label: 'Sanctions screen', source: 'OIG / LEIE', state: 'verified', tier: 'T4', fresh: '6 days' },
        { label: 'Adverse history', source: 'NPDB', state: 'access', tier: 'T4', fresh: '—' },
        { label: 'Multi-state licensure', source: 'Nursys', state: 'access', tier: 'T3', fresh: '—' },
      ],
      trustLanes: [ ['Identity', 'T4'], ['Certification', 'T3'], ['Sanctions', 'T4'], ['Licensure', 'T3'] ],
      orgs: [
        { name: 'Scripps Health', kind: 'employer', rel: 'Current employer', status: 'active' },
        { name: 'AACN', kind: 'authority', rel: 'Certifying body', status: 'verified' },
      ],
      timeline: [
        { when: '2d ago', t: 'Opened to relocation', d: '120 mi radius', tier: null },
        { when: '7d ago', t: 'NPDB access requested', d: 'Institutional query queued', tier: null },
      ],
    },
    {
      id: 'fischer', name: 'Anna Fischer', credential: 'PA-C', specialty: 'Dermatology',
      npi: '1154889394', location: 'Chicago, IL', exp: '5 yrs',
      readiness: 38, bucket: 'missing', trust: 'T2', evidenceFresh: 48, verified: 6, gaps: 3,
      comp: '$122–138K', avail: '60 days',
      mobility: { status: 'passive', radius: '40 mi', states: ['IL'], signal: 'Passive · evidence sparse, needs access' },
      highlight: 'Derm PA with a thin verified record — request evidence before calling.',
      why: [
        { icon: 'eye', t: 'Sparse evidence', d: 'Only 6 lanes verified — request the rest.' },
        { icon: 'target', t: 'Derm is hard to source', d: 'Worth the credential-build effort.' },
      ],
      flags: [
        { state: 'missing', t: 'DEA registration unverified', d: 'Not on file.' },
        { state: 'missing', t: 'Board cert needs primary source', d: 'Self-attested only.' },
      ],
      evidenceItems: [
        { label: 'IL licensure', source: 'IDFPR', state: 'verified', tier: 'T3', fresh: '30 days' },
        { label: 'Identity', source: 'NPPES / CMS', state: 'verified', tier: 'T4', fresh: 'today' },
        { label: 'Sanctions screen', source: 'OIG / LEIE', state: 'verified', tier: 'T4', fresh: '6 days' },
        { label: 'Board certification', source: 'Self-attested', state: 'access', tier: 'T1', fresh: '—' },
        { label: 'DEA registration', source: 'DOJ-DEA', state: 'access', tier: 'T3', fresh: '—' },
      ],
      trustLanes: [ ['Identity', 'T4'], ['Sanctions', 'T4'], ['Licensure', 'T3'], ['Certification', 'T1'] ],
      orgs: [
        { name: 'Northwestern Medicine', kind: 'employer', rel: 'Current employer', status: 'active' },
      ],
      timeline: [
        { when: '5d ago', t: 'Identity verified', d: 'NPPES match', tier: 'T4' },
        { when: '10d ago', t: 'Joined network', d: 'Building evidence', tier: null },
      ],
    },
    {
      id: 'park', name: 'Grace Park', credential: 'NP', specialty: 'Oncology',
      npi: '1265990405', location: 'Boston, MA', exp: '10 yrs',
      readiness: 44, bucket: 'missing', trust: 'T3', evidenceFresh: 55, verified: 8, gaps: 2,
      comp: '$140–158K', avail: '45 days',
      mobility: { status: 'open', radius: '80 mi', states: ['MA'], signal: 'Open — pending NPDB clearance' },
      highlight: 'Oncology NP, open to move — clear NPDB and she advances fast.',
      why: [
        { icon: 'mobility', t: 'Open to relocate', d: '80-mile radius active.' },
        { icon: 'target', t: 'Oncology specialty', d: 'Hard-to-fill, high-value track.' },
        { icon: 'eye', t: 'NPDB pending', d: 'Single institutional query stands between her and ready.' },
      ],
      flags: [
        { state: 'missing', t: 'NPDB query pending', d: 'Institutional access required.' },
      ],
      evidenceItems: [
        { label: 'Certification', source: 'ONCC', state: 'verified', tier: 'T4', fresh: '40 days' },
        { label: 'MA licensure', source: 'MA BORN', state: 'verified', tier: 'T3', fresh: '30 days' },
        { label: 'Sanctions screen', source: 'OIG / LEIE', state: 'verified', tier: 'T4', fresh: '6 days' },
        { label: 'Adverse history', source: 'NPDB', state: 'access', tier: 'T4', fresh: '—' },
      ],
      trustLanes: [ ['Identity', 'T4'], ['Certification', 'T4'], ['Sanctions', 'T4'], ['Licensure', 'T3'] ],
      orgs: [
        { name: 'Dana-Farber', kind: 'employer', rel: 'Current employer', status: 'active' },
        { name: 'ONCC', kind: 'authority', rel: 'Certifying body', status: 'sealed' },
      ],
      timeline: [
        { when: '3d ago', t: 'Opened to relocation', d: '80 mi radius', tier: null },
        { when: '6d ago', t: 'NPDB access requested', d: 'Query queued', tier: null },
      ],
    },
    {
      id: 'novak', name: 'Petra Novak', credential: 'MD', specialty: 'Emergency Medicine',
      npi: '1376110516', location: 'Las Vegas, NV', exp: '12 yrs',
      readiness: 22, bucket: 'blocked', trust: 'T4', evidenceFresh: 60, verified: 11, gaps: 1,
      comp: '$300–340K', avail: '—',
      mobility: { status: 'closed', radius: '—', states: ['NV'], signal: 'Do not advance — active sanctions flag' },
      highlight: 'Strong on paper but an OIG exclusion match is unresolved. Hold.',
      why: [
        { icon: 'flag', t: 'Sanctions flag', d: 'OIG/LEIE returned a possible-match — unresolved.' },
        { icon: 'shield', t: 'Otherwise board-sealed', d: 'Resolve the flag before any outreach.' },
      ],
      flags: [
        { state: 'blocked', t: 'OIG exclusion possible-match', d: 'Identity disambiguation required — do not advance.' },
      ],
      evidenceItems: [
        { label: 'Sanctions screen', source: 'OIG / LEIE', state: 'contradicted', tier: 'T4', fresh: 'today' },
        { label: 'Board certification', source: 'ABEM', state: 'verified', tier: 'T4', fresh: '50 days' },
        { label: 'NV licensure', source: 'NV Medical Board', state: 'verified', tier: 'T3', fresh: '30 days' },
        { label: 'Adverse history', source: 'NPDB', state: 'verified', tier: 'T4', fresh: '20 days' },
      ],
      trustLanes: [ ['Identity', 'T4'], ['Certification', 'T4'], ['Sanctions', 'T4'], ['Licensure', 'T3'] ],
      orgs: [
        { name: 'Sunrise Hospital', kind: 'employer', rel: 'Current employer', status: 'active' },
        { name: 'ABEM', kind: 'authority', rel: 'Certifying body', status: 'sealed' },
      ],
      timeline: [
        { when: 'today', t: 'Sanctions possible-match', d: 'OIG/LEIE flag raised', tier: 'T4' },
        { when: '20d ago', t: 'NPDB query cleared', d: 'No adverse reports', tier: 'T4' },
      ],
    },
    {
      id: 'abara', name: 'Tunde Abara', credential: 'PA-C', specialty: 'Orthopedic Surgery',
      npi: '1487221627', location: 'Riverside, CA', exp: '3 yrs',
      readiness: 28, bucket: 'blocked', trust: 'T2', evidenceFresh: 44, verified: 5, gaps: 2,
      comp: '$120–134K', avail: '—',
      mobility: { status: 'closed', radius: '—', states: ['CA'], signal: 'Blocked — expired core credential' },
      highlight: 'Ortho match on paper, but board certification has lapsed. Blocked.',
      why: [
        { icon: 'flag', t: 'Expired board cert', d: 'NCCPA certification lapsed — must recertify.' },
        { icon: 'target', t: 'Ortho-adjacent', d: 'Re-engage once recertified.' },
      ],
      flags: [
        { state: 'blocked', t: 'Board certification expired', d: 'NCCPA lapsed 3 months ago.' },
      ],
      evidenceItems: [
        { label: 'Board certification', source: 'NCCPA', state: 'contradicted', tier: 'T2', fresh: 'expired' },
        { label: 'CA licensure', source: 'CA PA Board', state: 'verified', tier: 'T3', fresh: '40 days' },
        { label: 'Sanctions screen', source: 'OIG / LEIE', state: 'verified', tier: 'T4', fresh: '6 days' },
      ],
      trustLanes: [ ['Identity', 'T4'], ['Sanctions', 'T4'], ['Licensure', 'T3'], ['Certification', 'T2'] ],
      orgs: [
        { name: 'Riverside Medical Clinic', kind: 'employer', rel: 'Current employer', status: 'active' },
      ],
      timeline: [
        { when: '4d ago', t: 'Board cert lapse detected', d: 'Expired 3 months ago', tier: 'T2' },
      ],
    },
    {
      id: 'tan', name: 'Wei Tan', credential: 'NP', specialty: 'Cardiology',
      npi: '1598332738', location: 'San Jose, CA', exp: '7 yrs',
      readiness: 85, bucket: 'ready', trust: 'T3', evidenceFresh: 86, verified: 11, gaps: 0,
      comp: '$130–146K', avail: '30 days',
      mobility: { status: 'open', radius: '90 mi', states: ['CA'], signal: 'Open · references just completed' },
      highlight: 'Cardiology NP, fully referenced, open in a tight Bay Area market.',
      why: [
        { icon: 'check', t: 'References complete', d: '3 of 3 received this week.' },
        { icon: 'mobility', t: 'Open to move', d: '90-mile radius.' },
        { icon: 'target', t: 'Cardiology fit', d: 'On req MCN-CARD-02.' },
      ],
      flags: [],
      evidenceItems: [
        { label: 'Certification', source: 'AACN', state: 'verified', tier: 'T4', fresh: '30 days' },
        { label: 'CA licensure', source: 'CA BRN', state: 'verified', tier: 'T3', fresh: '25 days' },
        { label: 'Sanctions screen', source: 'OIG / LEIE', state: 'verified', tier: 'T4', fresh: '6 days' },
        { label: 'Peer references', source: 'Attesters', state: 'verified', tier: 'T2', fresh: '3 days' },
        { label: 'DEA registration', source: 'DOJ-DEA', state: 'verified', tier: 'T3', fresh: '60 days' },
      ],
      trustLanes: [ ['Identity', 'T4'], ['Certification', 'T4'], ['Sanctions', 'T4'], ['Licensure', 'T3'], ['References', 'T2'] ],
      orgs: [
        { name: 'Stanford Health Care', kind: 'employer', rel: 'Current employer', status: 'active' },
        { name: 'AACN', kind: 'authority', rel: 'Certifying body', status: 'sealed' },
      ],
      timeline: [
        { when: '3d ago', t: 'Third reference received', d: '3 of 3 on file', tier: 'T2' },
        { when: '8d ago', t: 'Opened to new roles', d: '90 mi radius', tier: null },
      ],
    },
  ];

  // ── byId helper map ─────────────────────────────────────────────────────
  const byId = Object.fromEntries(candidates.map(c => [c.id, c]));

  // ── Pipeline summary (home) ─────────────────────────────────────────────
  const buckets = ['ready', 'near', 'blocked', 'missing'];
  const pipeline = {
    total: candidates.length,
    newThisWeek: 4,
    counts: Object.fromEntries(buckets.map(b => [b, candidates.filter(c => c.bucket === b).length])),
    specialties: ['Emergency Medicine', 'Orthopedic Surgery', 'Hospital Medicine', 'Critical Care', 'Cardiology', 'Anesthesiology'],
  };

  // ── Mobility signals — clinicians becoming reachable ────────────────────
  const mobilitySignals = [
    { id: 'okafor', when: '3d ago', t: 'Opened a 150-mile relocation radius', tag: 'New radius' },
    { id: 'reyes', when: '1d ago', t: 'Marked open nationwide · 4-state licensure', tag: 'Now open' },
    { id: 'voss', when: '6d ago', t: 'Switched to open-to-new-roles', tag: 'Now open' },
    { id: 'haddad', when: '2d ago', t: 'Actively interviewing · immediate availability', tag: 'Active' },
    { id: 'park', when: '3d ago', t: 'Opened to relocation · 80-mile radius', tag: 'New radius' },
  ];

  // ── Trust signals — records becoming more authoritative ─────────────────
  const trustSignals = [
    { id: 'okafor', when: '12d ago', t: 'NPDB query cleared — 5th lane reached T4', tier: 'T4' },
    { id: 'reyes', when: '15d ago', t: 'Added TX license — now 4-state authoritative', tier: 'T3' },
    { id: 'tan', when: '3d ago', t: 'References completed — record fully corroborated', tier: 'T2' },
    { id: 'miller', when: '6h ago', t: 'Sanctions sealed primary-source', tier: 'T4' },
  ];

  // ── Pool-wide activity feed ─────────────────────────────────────────────
  // kind: mobility | trust | evidence | review | flag
  const activity = [
    { id: 'okafor', kind: 'mobility', when: '3h ago', t: 'Naomi Okafor opened a 150-mile radius', d: 'Now reachable for AZ, NV and NM roles.', tier: null },
    { id: 'novak', kind: 'flag', when: '5h ago', t: 'Petra Novak hit an OIG possible-match', d: 'Auto-held from all pipelines pending disambiguation.', tier: 'T4' },
    { id: 'miller', kind: 'trust', when: '6h ago', t: 'Macie Miller sealed sanctions primary-source', d: 'Orthopedic PA — now T4 on 4 lanes.', tier: 'T4' },
    { id: 'tan', kind: 'evidence', when: '1d ago', t: 'Wei Tan completed all references', d: '3 of 3 received — cardiology NP now Ready.', tier: 'T2' },
    { id: 'reyes', kind: 'mobility', when: '1d ago', t: 'Daniel Reyes marked open nationwide', d: 'Multi-state hospitalist available in 60 days.', tier: null },
    { id: 'haddad', kind: 'mobility', when: '2d ago', t: 'Lena Haddad is actively interviewing', d: 'CRNA · immediate availability.', tier: null },
    { id: 'park', kind: 'review', when: '2d ago', t: 'Grace Park requested NPDB access', d: 'Oncology NP — one query from Ready.', tier: null },
    { id: 'abara', kind: 'flag', when: '4d ago', t: 'Tunde Abara board certification lapsed', d: 'Moved to Blocked until recertified.', tier: 'T2' },
  ];

  // ── Workspace — recruiter's tracked work ────────────────────────────────
  const workspace = {
    prospects: [
      { id: 'okafor', stage: 'Sourced', note: 'Top of EM list — open to relocate', added: '3d ago' },
      { id: 'reyes', stage: 'Shortlisted', note: 'Multi-state hospitalist for MCN-HOSP-01', added: '1d ago' },
      { id: 'haddad', stage: 'Shortlisted', note: 'CRNA · immediate start', added: '2d ago' },
      { id: 'tan', stage: 'Sourced', note: 'Cardiology NP, Bay Area', added: '3d ago' },
      { id: 'miller', stage: 'Watching', note: 'Ortho PA — re-check after license renewal', added: '8d ago' },
    ],
    conversations: [
      { id: 'okafor', state: 'replied', subject: 'EM-NP opening · Phoenix', last: 'Replied · wants a call Thu', when: '2h ago' },
      { id: 'haddad', state: 'scheduled', subject: 'CRNA · Seattle', last: 'Intro call scheduled Wed 3pm', when: '1d ago' },
      { id: 'reyes', state: 'sent', subject: 'Hospitalist · multi-site', last: 'Outreach sent — awaiting reply', when: '1d ago' },
      { id: 'voss', state: 'sent', subject: 'Cardiology PA · Austin', last: 'Outreach sent', when: '3d ago' },
    ],
    reviews: [
      { id: 'reyes', state: 'ready', note: 'Final credential pass complete — clear to present', when: '4h ago' },
      { id: 'miller', state: 'near', note: 'Holding for CA license renewal + employer reconcile', when: '1d ago' },
      { id: 'park', state: 'missing', note: 'Awaiting NPDB institutional query', when: '2d ago' },
      { id: 'novak', state: 'blocked', note: 'OIG possible-match — disambiguation requested', when: '5h ago' },
    ],
    opportunities: [
      { code: 'MCN-EM-03', role: 'Emergency Medicine NP', site: 'Phoenix Metro', matches: 3, ready: 2, status: 'open' },
      { code: 'MCN-HOSP-01', role: 'Hospitalist · MD', site: 'Multi-site · CO/TX', matches: 2, ready: 1, status: 'open' },
      { code: 'MCN-ORTHO-04', role: 'Orthopedic Surgery PA', site: 'Irvine, CA', matches: 2, ready: 0, status: 'open' },
      { code: 'MCN-CARD-02', role: 'Cardiology NP/PA', site: 'Bay Area', matches: 2, ready: 2, status: 'open' },
      { code: 'MCN-CRNA-01', role: 'CRNA · Anesthesia', site: 'Seattle', matches: 1, ready: 1, status: 'open' },
    ],
  };

  // ── Unified search index (⌘K) ───────────────────────────────────────────
  const searchIndex = [
    ...candidates.map(c => ({ type: 'clinician', id: c.id, title: `${c.name}, ${c.credential}`, sub: `${c.specialty} · ${c.location} · ${c.bucket}`, route: `#/review/${c.id}`, state: c.bucket })),
    ...workspace.opportunities.map(o => ({ type: 'opportunity', id: o.code, title: o.role, sub: `${o.code} · ${o.site} · ${o.matches} matched`, route: '#/workspace', state: 'open' })),
  ];

  window.REC = {
    operator, candidates, byId, pipeline, buckets,
    mobilitySignals, trustSignals, activity, workspace, searchIndex,
    build: 'vc.2026.06.24 · w310',
  };
})();
