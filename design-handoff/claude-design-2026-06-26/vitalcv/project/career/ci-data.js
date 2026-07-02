/* ══════════════════════════════════════════════════════════════════════════
   ci-data.js — Career Intelligence Engine · W320 data model
   The clinician-facing flip side of the Recruiter OS. Where the recruiter OS
   projects MANY clinicians ranked by "who do I call?", this engine projects ONE
   subject — Macie Miller — across her own owned ledger and answers, before she
   asks: what changed, what it unlocks, and what to do next.
   Every field here is a READ over evidence she already owns (ported from the
   Career OS ledger, co-data + w245-data). The engine computes, never stores.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {

  const TODAY = new Date(2026, 5, 25); // Thursday, June 25 2026 (local-time, no UTC shift)
  const fmtDate = TODAY.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  // ── Subject ──────────────────────────────────────────────────────────────
  const me = {
    name: 'Macie Miller', credential: 'PA-C', specialty: 'Cardiology · Physician Assistant',
    npi: '1346053246', city: 'Los Angeles, CA', initials: 'MM', years: 4, enumerated: '2022',
    ledgerId: 'vcv-ledger:macie-miller:0x91f4',
  };

  // ── Career Health (composite read) ───────────────────────────────────────
  //  overall = evidence·0.30 + trust·0.30 + readiness·0.40 → 89·.3+86·.3+82·.4 ≈ 85
  const health = {
    overall: 85, band: 'Strong', delta: 3, // up 3 over the last 30 days
    pillars: [
      { key: 'evidence',  label: 'Evidence',  value: 89, delta: 2, sub: '8 of 9 lanes source-verified', tone: 'good' },
      { key: 'trust',     label: 'Trust',     value: 86, delta: 1, sub: 'Provenance 92 · freshness 88',  tone: 'good' },
      { key: 'readiness', label: 'Readiness', value: 82, delta: 4, sub: 'Market-ready · 2 gated reads',  tone: 'good' },
    ],
    history: [76, 78, 79, 81, 82, 84, 85], // last 7 reads
    asOf: '2026-06-25 06:00 UTC',
  };

  // ── The seven reputation dimensions (profile, never one score) ───────────
  const dimensions = [
    { key: 'authority',   label: 'Authority',   value: 88, median: 70, trend: 'steady', icon: 'badge', blurb: 'Standing to practice — licensure, certification, clean record.' },
    { key: 'clinical',    label: 'Clinical',    value: 74, median: 62, trend: 'rising', icon: 'shield', blurb: 'Credibility at the bedside — privileges, case volume, fellowship.' },
    { key: 'operational', label: 'Operational', value: 79, median: 58, trend: 'steady', icon: 'gauge',  blurb: 'Dependability at scale — tenure, continuity, reliability.' },
    { key: 'academic',    label: 'Academic',    value: 49, median: 46, trend: 'rising', icon: 'grad',   blurb: 'Training the next generation — precepting, faculty.' },
    { key: 'research',    label: 'Research',    value: 41, median: 48, trend: 'rising', icon: 'micro',  blurb: 'Contribution to the field — peer-reviewed scholarship.' },
    { key: 'service',     label: 'Service',     value: 36, median: 50, trend: 'rising', icon: 'users',  blurb: 'Stewardship of the profession — society, committees.' },
    { key: 'leadership',  label: 'Leadership',  value: 33, median: 52, trend: 'rising', icon: 'brief',  blurb: 'Responsibility entrusted — services led, scope of teams.' },
  ];
  const dim = Object.fromEntries(dimensions.map(d => [d.key, d]));

  // ── The notification feed — the single source the engine reads from ──────
  //  stream: evidence | trust | timeline | mobility | org | milestone | action
  //  sev:    good | watch | gate | risk | info
  //  Every item is high-value: a verified change, a gate, or a movement. No spam.
  const feed = [
    { id: 'n-okafor', stream: 'mobility', sev: 'good', when: 'Today · 06:02', ago: '4h ago', unread: true,
      title: 'You qualify for 14 open requisitions today',
      detail: 'Across 6 health systems in the partner network, weighted to your verified cardiology-PA profile. Two are a strong match.',
      meta: 'Mobility · GraphProjection', cta: 'See matches', route: '#/goals' },
    { id: 'n-readiness', stream: 'milestone', sev: 'good', when: 'Today · 06:00', ago: '4h ago', unread: true,
      title: 'Career Health rose to 85 — Strong',
      detail: 'Up 3 over the last 30 days. Readiness carried it (+4) after the certification re-seal and a clean sanctions read.',
      meta: 'Health · composite read', cta: 'Open Today', route: '#/today' },
    { id: 'n-oig', stream: 'trust', sev: 'good', when: 'Jun 18 · 02:14', ago: '7d ago', unread: true,
      title: 'OIG / LEIE monthly dataset re-read — no match',
      detail: 'Your sanction-clear status was re-confirmed against the June exclusion dataset. The adverse-screen lane stays fresh and green.',
      meta: 'Trust · freshness refresh', cta: null, route: null, tier: 'T4' },
    { id: 'n-pecos', stream: 'org', sev: 'good', when: 'Jun 11 · 09:00', ago: '14d ago', unread: false,
      title: 'Medicare enrollment re-confirmed at Cedar Health',
      detail: 'PECOS corroborated your active appointment — a second independent source now agrees with the MSO record.',
      meta: 'Organizations · corroboration', cta: null, route: null, tier: 'T3' },
    { id: 'n-license', stream: 'trust', sev: 'watch', when: 'May 30 · 14:05', ago: '26d ago', unread: false,
      title: 'California PA license freshness window approaching',
      detail: 'Your license is current through Apr 2027. A re-query is already scheduled before the window closes — no action needed yet, but renewal opens soon.',
      meta: 'Trust · decay watch', cta: 'View action', route: '#/actions' },
    { id: 'n-npdb', stream: 'evidence', sev: 'gate', when: 'Ongoing', ago: 'open gate', unread: true,
      title: 'NPDB continuous query is not yet authorized',
      detail: 'Federal law requires an authorized institution to run it. It is the one lane only an employer can open — and it gates most roles.',
      meta: 'Evidence · gated lane', cta: 'Request from employer', route: '#/actions' },
    { id: 'n-nccpa', stream: 'evidence', sev: 'good', when: 'Mar 4 · 11:22', ago: 'Mar 4', unread: false,
      title: 'NCCPA certification re-sealed at T4',
      detail: 'The primary-source signature was renewed — your board certification is back at the highest provenance tier and sets a permanent Authority floor.',
      meta: 'Evidence · primary-sealed', cta: null, route: null, tier: 'T4' },
    { id: 'n-or', stream: 'org', sev: 'info', when: 'Apr 8 · 18:41', ago: 'Apr 8', unread: false,
      title: 'Your passport was re-used at OR Medical Group (Irvine)',
      detail: 'A second institution read your owned record without you rebuilding anything — federated corroboration of your identity across the network.',
      meta: 'Organizations · federated read', cta: null, route: null },
    { id: 'n-society', stream: 'timeline', sev: 'good', when: 'Feb 2026', ago: 'Feb', unread: false,
      title: 'AAPA Cardiovascular caucus membership recorded',
      detail: 'A new verified event entered your timeline — early Service standing. Stewardship of the profession compounds over a career.',
      meta: 'Timeline · new event', cta: null, route: null, tier: 'T2' },
    { id: 'n-protocol', stream: 'timeline', sev: 'good', when: 'Oct 2025', ago: 'Oct', unread: false,
      title: 'Discharge-protocol lead opened your Leadership dimension',
      detail: 'Your first entrusted responsibility is on the record at Cedar Health. Leadership is now rising — the fastest-moving dimension this year.',
      meta: 'Timeline · new dimension', cta: 'See goals', route: '#/goals', tier: 'T2' },
  ];

  // ── Today's briefing — grouped reads of the feed + health, dated to today ─
  const briefing = {
    date: fmtDate,
    greeting: 'Good morning, Macie',
    line: 'Three things moved on your record since you last looked, and one gate is still worth a nudge.',
    counts: { changes: 3, gates: 1, unlocked: 14 },
  };

  // ── Insights — generated analysis, five families ─────────────────────────
  //  kind: opportunity | risk | readiness | milestone | trend
  const insights = [
    { id: 'in-reqs', kind: 'opportunity', icon: 'mobility', tone: 'good', confidence: 'High',
      head: '14 roles you qualify for today — 2 strong matches',
      body: 'Your verified profile clears the bar on 14 open requisitions across 6 systems. The Senior Cardiology PA track at a tertiary center is your strongest immediate fit at 86%.',
      stat: '14', statLabel: 'open reqs', basis: 'Weighted to authority + clinical + operational, within a 60-mile radius.', route: '#/goals', cta: 'Open goals' },
    { id: 'in-unlock', kind: 'opportunity', icon: 'bolt', tone: 'gate', confidence: 'Modeled',
      head: 'Multi-state licensure would surface +32 more matches',
      body: 'Adding Nevada and Arizona — both compact-adjacent — would expand your addressable radius to ~380 miles and unlock 11 additional systems without rebuilding any evidence.',
      stat: '+32', statLabel: 'roles unlocked', basis: 'Projected from the partner-network graph against your current dimensions.', route: '#/actions', cta: 'See the action' },
    { id: 'in-dea', kind: 'risk', icon: 'clock', tone: 'watch', confidence: 'Certain',
      head: 'DEA registration renews in ~7 months',
      body: 'Federal prescribing authority expires Jan 2027 — the soonest of your freshness windows. Routine to renew, but it is the first credential to age out, so it leads the risk queue.',
      stat: 'Jan 2027', statLabel: 'expiry', basis: 'Derived from the DEA registry read on file.', route: '#/actions', cta: 'Queue renewal' },
    { id: 'in-npdb', kind: 'risk', icon: 'lock', tone: 'gate', confidence: 'Certain',
      head: 'One gated lane stands between you and most employers',
      body: 'The NPDB continuous query can only be opened by an authorized institution. It is not a flaw in your record — it is a door only an employer holds the key to. Most roles wait behind it.',
      stat: '1 gate', statLabel: 'lane closed', basis: 'Coverage read: 8 of 9 evidence lanes open.', route: '#/actions', cta: 'Request access' },
    { id: 'in-ready', kind: 'readiness', icon: 'rise', tone: 'good', confidence: 'Measured',
      head: 'Readiness climbed +4 this quarter to 82',
      body: 'The certification re-seal and a clean sanctions read pushed you to market-ready. Three of five readiness dimensions are green; research and leadership are the two still emerging.',
      stat: '82', statLabel: 'market-ready', basis: 'Authority, clinical and operational all clear; conditional on two gated reads.', route: '#/today', cta: 'See health' },
    { id: 'in-authority', kind: 'readiness', icon: 'badge', tone: 'good', confidence: 'Measured',
      head: 'Authority sits 18 points above the field median',
      body: 'License, certification and DEA are all current and primary-sealed. Authority — at 88 against a 70 median — is your strongest dimension and the floor everything else builds on.',
      stat: '88', statLabel: 'vs 70 median', basis: 'Five verified events feed this dimension; two are primary-sealed.', route: '#/goals', cta: 'View profile' },
    { id: 'in-floors', kind: 'milestone', icon: 'star', tone: 'good', confidence: 'On record',
      head: 'You have set 5 permanent career floors',
      body: 'Board certified, licensed, first appointment, first publication, first entrusted leadership. Floors never fall — once reached, your standing can never drop below them.',
      stat: '5', statLabel: 'floors set', basis: 'Verified milestone events spanning 2022–2025.', route: '#/goals', cta: 'See milestones' },
    { id: 'in-lead', kind: 'milestone', icon: 'brief', tone: 'good', confidence: 'On record',
      head: 'Leadership dimension opened for the first time',
      body: 'Leading the cardiology discharge-protocol redesign was your first entrusted responsibility. It opened a dimension that was previously empty — and it is now rising faster than any other.',
      stat: 'New', statLabel: 'dimension', basis: 'Cedar Health service record, Oct 2025.', route: '#/goals', cta: 'Track leadership' },
    { id: 'in-research', kind: 'trend', icon: 'micro', tone: 'watch', confidence: 'Projected',
      head: 'Research is the one dimension below median',
      body: 'You hold one peer-reviewed publication. A second would move Research from 41 to above the 48 field median — the single highest-leverage move on your growth profile right now.',
      stat: '41', statLabel: 'vs 48 median', basis: 'Two research events on record; the field median is anonymous.', route: '#/actions', cta: 'See the move' },
    { id: 'in-trend', kind: 'trend', icon: 'rise', tone: 'good', confidence: 'Measured',
      head: 'Leadership and service are rising fastest',
      body: 'Over the last year your steepest gains were in the dimensions you entered most recently — leadership and service. Early dimensions compound the most; the curve is in your favor.',
      stat: '4 of 7', statLabel: 'rising', basis: 'Trend read across all seven dimensions, era over era.', route: '#/goals', cta: 'View trends' },
  ];

  // ── Action center — ranked by impact, every one explains why it matters ──
  //  tier: gate | soon | grow ; impact 0–100 drives the rank
  const actions = [
    { id: 'a-npdb', tier: 'gate', impact: 95, icon: 'lock', owner: 'Employer-initiated', dim: 'Authority',
      title: 'Authorize the NPDB continuous query',
      why: 'This is the single gate standing between your verified profile and most employers. Federal law means only an authorized institution can run it — so the move is to ask one to.',
      matters: 'Unblocks the adverse-history lane that gates the majority of roles you otherwise qualify for. Nothing else you can do raises your reachable market more.',
      effect: 'Coverage 78 → ~95 · unlocks gated roles', eta: 'One employer request', cta: 'Request from employer', done: false },
    { id: 'a-license', tier: 'soon', impact: 72, icon: 'stamp', owner: 'You', dim: 'Authority',
      title: 'Renew your California PA license',
      why: 'Your license expires Apr 2027. Renewing before the freshness window closes keeps Authority green and avoids any gap appearing on the record an employer reads.',
      matters: 'Authority is your strongest dimension and the floor under everything else. A lapse here would ripple into readiness and every role match at once.',
      effect: 'Keeps Authority at 88 · no freshness gap', eta: '~10 months out', cta: 'Start renewal', done: false },
    { id: 'a-dea', tier: 'soon', impact: 64, icon: 'badge', owner: 'You', dim: 'Authority',
      title: 'Queue your DEA registration renewal',
      why: 'Federal prescribing authority expires Jan 2027 — the soonest of all your freshness windows. Queuing it now means it renews itself before it can ever age out.',
      matters: 'DEA unlocks prescribing-eligible roles across systems. Letting it lapse would quietly drop you out of role matches you currently clear.',
      effect: 'Holds prescribing eligibility · earliest window', eta: '~7 months out', cta: 'Queue renewal', done: false },
    { id: 'a-pub', tier: 'grow', impact: 58, icon: 'micro', owner: 'You', dim: 'Research',
      title: 'Publish a second peer-reviewed work',
      why: 'You have one publication on record. Research sits at 41 against a 48 field median — a second work is the single move that crosses it from below to above.',
      matters: 'Research is your only below-median dimension. Lifting it opens academic and faculty tracks that are otherwise just out of reach.',
      effect: 'Research 41 → above median · opens faculty track', eta: '6–12 months', cta: 'Track progress', done: false },
    { id: 'a-multistate', tier: 'grow', impact: 54, icon: 'pin', owner: 'You', dim: 'Authority',
      title: 'Add Nevada + Arizona licensure',
      why: 'Both are compact-adjacent to California. Adding them expands the radius your owned ledger can travel to — your evidence comes with you, nothing to rebuild.',
      matters: 'Mobility is leverage. Two licenses surface 32 more role matches and an 11-system jump without touching the rest of your record.',
      effect: '+11 systems · ~380mi radius · +32 matches', eta: '3–4 months', cta: 'Explore', done: false },
    { id: 'a-acls', tier: 'grow', impact: 38, icon: 'refresh', owner: 'You', dim: 'Clinical',
      title: 'Refresh your ACLS attestation',
      why: 'Current through 2027, so there is no urgency — but a routine refresh keeps the clinical freshness window green well ahead of any decay.',
      matters: 'Small, cheap, and entirely in your control. Knocking it out now keeps Clinical from ever flickering amber on a recruiter\'s read.',
      effect: 'Keeps Clinical freshness green', eta: 'Half a day', cta: 'Schedule', done: false },
  ];

  // ── Goals — clinician-defined ambitions, tracked against the ledger ──────
  //  Each maps to advancement paths + the dimensions that feed it.
  const goals = [
    { id: 'g-director', icon: 'brief', status: 'active', title: 'Become a Medical Director',
      aim: 'Lead Advanced Practice Provider → service-line leadership',
      horizon: '12–24 months', progress: 48, match: 71,
      dims: ['leadership', 'operational', 'clinical'],
      have: ['Operational standing at 79', 'Clinical credibility proven', 'First entrusted protocol lead'],
      need: ['A second leadership appointment', 'Formal supervision of ≥3 APPs'],
      next: 'Take a second entrusted role — committee chair or service lead.' },
    { id: 'g-multistate', icon: 'pin', status: 'active', title: 'Practice in another state',
      aim: 'Multi-state licensure → mobility without rebuilding',
      horizon: '3–6 months', progress: 32, match: 88,
      dims: ['authority'],
      have: ['California license current', 'NCCPA cert is national', 'Owned ledger travels with you'],
      need: ['Nevada license application', 'Arizona license application'],
      next: 'Open the Nevada application — it is compact-adjacent and fastest.' },
    { id: 'g-academic', icon: 'grad', status: 'active', title: 'Earn an academic appointment',
      aim: 'Clinical faculty · PA program',
      horizon: '18–36 months', progress: 41, match: 58,
      dims: ['academic', 'research'],
      have: ['Preceptor record on file', 'Fellowship distinction conferred', 'Academic standing rising'],
      need: ['A faculty appointment', 'Sustained teaching load', 'A second publication'],
      next: 'Publish a second peer-reviewed work to clear the research bar.' },
    { id: 'g-specialist', icon: 'shield', status: 'active', title: 'Senior Cardiology PA · tertiary center',
      aim: 'Depth track at a higher-acuity center',
      horizon: '6–12 months', progress: 72, match: 86,
      dims: ['clinical', 'authority'],
      have: ['Cardiology fellowship', '4-year continuity', 'Clean, sealed record'],
      need: ['NPDB query (employer)', 'Reference refresh'],
      next: 'Clear the NPDB gate — it is the only thing between you and this track.' },
  ];

  // suggested goals the clinician can add (the "define a goal" affordance)
  const goalSuggestions = [
    { id: 's-research', icon: 'micro', title: 'Build a research record', aim: 'Move Research above the field median' },
    { id: 's-society', icon: 'users', title: 'Steward the profession', aim: 'Committee + guideline work in the AAPA' },
    { id: 's-caq', icon: 'badge', title: 'Earn the Cardiology CAQ', aim: 'Certificate of Added Qualifications' },
  ];

  const streamMeta = {
    evidence:  { label: 'Evidence',      icon: 'wallet' },
    trust:     { label: 'Trust',         icon: 'shield' },
    timeline:  { label: 'Timeline',      icon: 'feed' },
    mobility:  { label: 'Mobility',      icon: 'mobility' },
    org:       { label: 'Organizations', icon: 'org' },
    milestone: { label: 'Milestone',     icon: 'star' },
    action:    { label: 'Action',        icon: 'target' },
  };
  const insightKindMeta = {
    opportunity: { label: 'Opportunity unlocked', icon: 'mobility', tone: 'good' },
    risk:        { label: 'Credential risk',      icon: 'alert',    tone: 'watch' },
    readiness:   { label: 'Readiness',            icon: 'rise',     tone: 'good' },
    milestone:   { label: 'Milestone',            icon: 'star',     tone: 'good' },
    trend:       { label: 'Career trend',         icon: 'gauge',    tone: 'ghost' },
  };
  const actionTierMeta = {
    gate: { label: 'Gate', tone: 'gate', hint: 'Only an institution can open this' },
    soon: { label: 'Soon', tone: 'watch', hint: 'A window is approaching' },
    grow: { label: 'Grow', tone: 'ghost', hint: 'Builds standing over time' },
  };

  window.CI = {
    me, health, dimensions, dim, feed, briefing, insights, actions, goals, goalSuggestions,
    streamMeta, insightKindMeta, actionTierMeta,
    today: fmtDate,
    unread: () => feed.filter(n => n.unread).length,
    build: 'vc.2026.06.25 · w320',
  };
})();
