// W245 — Career OS · clinician-first data layer.
// Adds the concrete backbone the five experiences read from: dated credentials with
// expiry, prioritized next actions, and the health/evidence/trust computations.
// Everything still projects from the same owned ledger (co-data.jsx). No new facts invented —
// these are the renewal dates and gates implied by the existing CareerEvents & sources.

const TODAY = new Date('2026-06-21');

function monthsUntil(iso) {
  if (!iso) return Infinity;
  const [y, m] = iso.split('-').map(Number);
  const d = new Date(y, (m || 1) - 1, 1);
  return Math.round((d - TODAY) / (1000 * 60 * 60 * 24 * 30.44));
}
function fmtMonth(iso) {
  if (!iso) return '—';
  const [y, m] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}
window.monthsUntil = monthsUntil;
window.fmtMonth = fmtMonth;

/* ====================== CREDENTIALS (the renewable evidence) ======================
   The licenses & certifications that carry an expiry. status derived from months-to-expiry. */
const CREDENTIALS = [
  { id: 'cr-npi',     label: 'NPI Enumeration',          kind: 'Identity · federal registry',  authority: 'NPPES · CMS',                    number: '1346053246', issued: '2022-04', expires: null,      dim: 'authority', source: 'nppes' },
  { id: 'cr-nccpa',   label: 'NCCPA Certification',      kind: 'National board certification',  authority: 'NCCPA',                          number: 'PA-C',       issued: '2022-08', expires: '2028-12', dim: 'authority', source: 'nccpa' },
  { id: 'cr-license', label: 'California PA License',     kind: 'State license to practice',     authority: 'Medical Board of California',    number: 'PA-052987',  issued: '2023-04', expires: '2027-04', dim: 'authority', source: 'cabrd' },
  { id: 'cr-dea',     label: 'DEA Registration',         kind: 'Federal · Schedules II–V',      authority: 'U.S. DEA',                       number: 'BM03…9127',  issued: '2025-01', expires: '2027-01', dim: 'authority', source: 'dea' },
  { id: 'cr-acls',    label: 'ACLS Provider',            kind: 'Advanced life support',         authority: 'American Heart Association',     number: '—',          issued: '2025-02', expires: '2027-02', dim: 'clinical',  source: 'mso' },
  { id: 'cr-bls',     label: 'BLS Provider',             kind: 'Basic life support',            authority: 'American Heart Association',     number: '—',          issued: '2025-02', expires: '2027-02', dim: 'clinical',  source: 'mso' },
];
// derive status: expired | expiring (<12mo) | current | evergreen
CREDENTIALS.forEach(c => {
  const mo = monthsUntil(c.expires);
  c.monthsLeft = mo;
  c.status = c.expires == null ? 'evergreen' : mo < 0 ? 'expired' : mo <= 12 ? 'expiring' : 'current';
});
window.CREDENTIALS = CREDENTIALS;

/* ====================== NEXT ACTIONS (what should I do next) ======================
   Prioritized, each tied to an owner + concrete impact. Derived from MISSING_EVIDENCE,
   expiring CREDENTIALS, and ADVANCEMENT_PATHS — never busywork. */
const NEXT_ACTIONS = [
  { id: 'na-npdb', tier: 'gate', title: 'Authorize the NPDB continuous query', owner: 'Employer-initiated', dim: 'authority',
    why: 'Federal law requires an authorized institution to run it. It is the one gate standing between your verified profile and most employers.',
    impact: 'Unblocks the adverse-history lane · gates most roles', icon: 'Lock', cta: 'Request from employer' },
  { id: 'na-license', tier: 'soon', title: 'Renew your California PA license', owner: 'You', dim: 'authority', due: '2027-04',
    why: 'Expires Apr 2027. Renewing before the freshness window closes keeps Authority green and avoids a gap on the record.',
    impact: 'Keeps Authority current · 10 months out', icon: 'Stamp', cta: 'Start renewal' },
  { id: 'na-pub', tier: 'grow', title: 'Publish a second peer-reviewed work', owner: 'You', dim: 'research',
    why: 'You have one publication on record. A second moves Research from below to above the anonymous field median.',
    impact: 'Research → above median', icon: 'Microscope', cta: 'Track progress' },
  { id: 'na-multistate', tier: 'grow', title: 'Add Nevada + Arizona licensure', owner: 'You', dim: 'authority',
    why: 'Compact-adjacent state licenses expand the radius your owned ledger can travel to without rebuilding anything.',
    impact: '+11 systems · ~380mi radius', icon: 'MapPin', cta: 'Explore' },
];
window.NEXT_ACTIONS = NEXT_ACTIONS;

const ACTION_TIER = {
  gate: { label: 'Gate',  chip: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20', dot: 'bg-indigo-600' },
  soon: { label: 'Soon',  chip: 'bg-amber-50 text-amber-800 ring-amber-600/20',    dot: 'bg-amber-500' },
  grow: { label: 'Grow',  chip: 'bg-slate-100 text-slate-600 ring-slate-300',      dot: 'bg-slate-400' },
};
window.ACTION_TIER = ACTION_TIER;

/* ====================== RISK FACTORS (what threatens standing) ====================== */
const RISK_FACTORS = [
  { id: 'rk-npdb', sev: 'gate', label: 'NPDB query not yet authorized', detail: 'An employer must run the continuous query before most hires can clear. Not a flaw in the record — a gate only an institution can open.', dim: 'authority' },
  { id: 'rk-dea',  sev: 'med',  label: 'DEA registration renews Jan 2027', detail: 'Federal prescribing authority expires in ~7 months. Routine renewal, but the soonest of the freshness windows.', dim: 'authority' },
  { id: 'rk-claim', sev: 'low', label: 'One closed malpractice claim on record', detail: 'Settled 2023, no admission of liability, fully disclosed. A verified adverse fact — surfaced plainly, never softened, and already resolved.', dim: 'clinical' },
];
window.RISK_FACTORS = RISK_FACTORS;
const RISK_SEV = {
  gate: { label: 'Gate',     ring: 'ring-indigo-600/20', text: 'text-indigo-700', bg: 'bg-indigo-50', dot: 'bg-indigo-600' },
  med:  { label: 'Watch',    ring: 'ring-amber-600/20',  text: 'text-amber-800',  bg: 'bg-amber-50',  dot: 'bg-amber-500' },
  low:  { label: 'Disclosed',ring: 'ring-slate-300',     text: 'text-slate-600',  bg: 'bg-slate-100', dot: 'bg-slate-400' },
};
window.RISK_SEV = RISK_SEV;

/* ====================== TRUST DIMENSIONS (how trust is computed) ======================
   Distinct from the 7 reputation dimensions. Trust = the belief evidence earns, along four axes. */
const TRUST_DIMENSIONS = [
  { key: 'provenance',    label: 'Provenance',    value: 92, blurb: 'How close the evidence sits to its issuing authority. Primary-sealed feeds (T4) score highest; self-asserted scores lowest.', note: '5 sources at T3–T4 · 2 primary-sealed' },
  { key: 'corroboration', label: 'Corroboration', value: 84, blurb: 'How many independent sources agree on the same fact. Identity and enrollment cross-confirm across NPPES, PECOS, and the partner network.', note: 'Cross-confirmed at 3 networks' },
  { key: 'freshness',     label: 'Freshness',     value: 88, blurb: 'How recently each fact was re-read. Trust decays with time; the engine re-queries before windows close.', note: 'All current · 1 re-query scheduled' },
  { key: 'coverage',      label: 'Coverage',      value: 78, blurb: 'How much of the career is source-backed versus asserted. One gated lane (NPDB) remains closed pending employer authorization.', note: '8 of 9 lanes open' },
];
window.TRUST_DIMENSIONS = TRUST_DIMENSIONS;

/* ====================== HEALTH COMPUTATION ====================== */
function computeHealth() {
  const sources = window.EVIDENCE_SOURCES || [];
  const verifiedSources = sources.filter(s => s.state === 'verified').length;
  const evidenceComplete = Math.round((verifiedSources / sources.length) * 100); // 8/9 = 89

  const trust = window.TRUST_DIMENSIONS.reduce((a, d) => a + d.value, 0) / window.TRUST_DIMENSIONS.length;
  const trustStrength = Math.round(trust); // ~86

  const readiness = (window.READINESS && window.READINESS.score) || 0; // 82

  const overall = Math.round(evidenceComplete * 0.30 + trustStrength * 0.30 + readiness * 0.40);
  const band = overall >= 85 ? 'Strong' : overall >= 70 ? 'Healthy' : overall >= 50 ? 'Developing' : 'Early';

  const riskCount = (window.RISK_FACTORS || []).length;
  const expiring = (window.CREDENTIALS || []).filter(c => c.status === 'expiring').length;

  return {
    overall, band,
    evidenceComplete, verifiedSources, totalSources: sources.length,
    trustStrength, readiness, riskCount, expiring,
    readinessReady: (window.READINESS.dimensions || []).filter(d => d.ready).length,
    readinessTotal: (window.READINESS.dimensions || []).length,
  };
}
window.computeHealth = computeHealth;
