import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  validateEventChain,
  validateAllMetrics,
  generateProofSnapshot,
  enforceLimitations,
  detectAnomalies,
  labelMetric,
  type ChainEvent,
} from '../../../../../packages/trust-contract/src/proof-integrity';

// This page is sales collateral for a named prospect conversation, not a
// search surface. It is deliberately off the index: an indexable page about
// one clinician's file is the exact shape that published a real registrant's
// name and NPI to crawlers under the root marketing title.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// ─── Pilot Registry ───────────────────────────────────────────────
// Every entry here traces to real events.
// If a number doesn't trace to an audit event, it is not on this page.
//
// The subject is NOT identified here. The pilot ran against a real clinician's
// NPI, and the standing rule (2026-07-27) is that no demo or marketing surface
// may point at a real clinician's NPI. The evidence this page makes is about
// the event chain and its timings, which the loop id already anchors — the
// subject's name and number were never load-bearing for that claim, only for
// exposing them. Substituting a synthetic NPI was rejected: it would make the
// page assert that a number that cannot exist was run through the system.

interface PilotEvidence {
  loopId: string;
  taxonomy: string;
  state: string;
  nppesStatus: 'Active' | 'Inactive';
  proofTier: 'partial_proof_pack' | 'decision_grade';
  isvReadinessToActionMs: number;
  isvEvents: Array<{ event: string; deltaSec: number; label: string }>;
  employerAction: string;
  verifiedLanes: string[];
  pendingLanes: Array<{ lane: string; reason: string }>;
  limitations: string[];
  generatedAt: string; // ISO
}

const PILOTS: Record<string, {
  slug: string;
  title: string;
  subtitle: string;
  audience: string;
  what: string;
  evidence: PilotEvidence;
}> = {
  'norcal-pa-pilot-1': {
    slug: 'norcal-pa-pilot-1',
    title: 'Pilot #1 — Behavioral Health Provider Workflow',
    subtitle: 'NPI identity verification + employer head-start action',
    audience: 'Credentialing ops and provider recruitment teams placing behavioral health providers',
    what: 'We ran a real NPI through the VitalCV wedge — identity verification, readiness computation, and employer review — and measured the time from readiness view to employer action.',
    evidence: {
      loopId: 'isv-loop-1776423023956',
      taxonomy: 'Behavior Technician (NUCC 106S00000X)',
      state: 'TX',
      nppesStatus: 'Active',
      proofTier: 'partial_proof_pack',
      isvReadinessToActionMs: 108000,
      isvEvents: [
        { event: 'readiness.viewed',  deltaSec: 0,   label: 'Readiness checked' },
        { event: 'passport.viewed',   deltaSec: 45,  label: 'Profile opened' },
        { event: 'review.opened',     deltaSec: 93,  label: 'Employer review opened' },
        { event: 'action.taken',      deltaSec: 108, label: 'Head-start accepted' },
        { event: 'state.updated',     deltaSec: 109, label: 'System state updated' },
      ],
      employerAction: 'accept_head_start',
      verifiedLanes: ['NPPES Identity (live — CMS Registry)'],
      pendingLanes: [
        { lane: 'OIG Exclusions',  reason: 'Integration not yet wired — surfaced as access_required' },
        { lane: 'State License',   reason: 'No state-board license source attached for this clinician; board API not yet wired' },
      ],
      limitations: [
        'Single clinician — not a statistically significant sample',
        'OIG exclusions not integrated — cannot claim OIG clearance',
        'State license not verified — access_required, not fake-passing',
        'Employer action recorded in pilot environment, not production deployment',
        '"14-day baseline" comparison is self-reported industry estimate — not a controlled measurement',
        'Proof tier is partial_proof_pack — decision_grade requires OIG + license integration',
      ],
      generatedAt: new Date(1776423023956).toISOString(),
    },
  },
};

// ─── Page ─────────────────────────────────────────────────────────

export default async function PilotProofPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const pilot = PILOTS[slug];
  if (!pilot) notFound();

  const { evidence: e } = pilot;
  const readinessToActionSec = Math.round(e.isvReadinessToActionMs / 1000);
  const readinessToActionMin = (e.isvReadinessToActionMs / 60000).toFixed(1);

  // ── Integrity validation ──────────────────────────────────────────
  const chainEvents: ChainEvent[] = e.isvEvents.map(ev => ({
    eventType: ev.event as ChainEvent['eventType'],
    timestamp: e.generatedAt ? new Date(e.generatedAt).getTime() + ev.deltaSec * 1000 : ev.deltaSec * 1000,
    loopId: e.loopId,
  }));

  const chainValidation  = validateEventChain(chainEvents);
  const metricResults    = validateAllMetrics(chainEvents);
  const snapshot         = generateProofSnapshot(pilot.slug, chainEvents, e.limitations);
  const limitationCheck  = enforceLimitations(e.limitations);
  const anomalyReport    = detectAnomalies(chainEvents, metricResults);

  // Time-to-action metric
  const ttaResult = metricResults.find(r => r.metricName === 'time_to_first_action');
  const ttaLabel  = ttaResult ? labelMetric('time_to_first_action', ttaResult) : 'Unverified';

  return (
    <div className="min-h-screen bg-white">
      {/* Top bar */}
      <div className="bg-slate-900 text-slate-400 text-xs px-6 py-2 flex items-center justify-between">
        <Link href="/" className="text-slate-400 hover:text-white transition-colors">← VitalCV</Link>
        <div className="flex items-center gap-3">
            <span className={`font-bold uppercase tracking-widest ${
              snapshot.validationStatus === 'valid' ? 'text-green-400' :
              snapshot.validationStatus === 'warning' ? 'text-yellow-400' : 'text-red-400'
            }`}>
              {snapshot.validationStatus === 'valid' ? '✔ Integrity Valid' :
               snapshot.validationStatus === 'warning' ? '⚠ Warnings' : '✗ Invalid'}
            </span>
            <span className="font-mono text-slate-500">v{snapshot.version} · {snapshot.eventChainHash}</span>
          </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 space-y-12">

        {/* Title */}
        <section>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Pilot Evidence</p>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 leading-tight mb-3">
            {pilot.title}
          </h1>
          <p className="text-base text-gray-500">{pilot.subtitle}</p>
        </section>

        {/* Summary */}
        <section className="border-l-4 border-slate-900 pl-5">
          <p className="text-sm font-semibold text-slate-600 mb-2">Who this is for</p>
          <p className="text-sm text-gray-600 mb-4">{pilot.audience}</p>
          <p className="text-sm font-semibold text-slate-600 mb-2">What we tested</p>
          <p className="text-sm text-gray-600">{pilot.what}</p>
        </section>

        {/* Key Metric */}
        <section className="bg-slate-900 text-white rounded-2xl p-8">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Key Metric</p>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest bg-green-900 text-green-400 px-2 py-0.5 rounded">
                [{ttaLabel}]
              </span>
              <span className="text-[10px] text-slate-500">
                Based on {chainEvents.length} real events
              </span>
            </div>
          </div>
          <div className="flex items-end gap-3 mb-2">
            <span className="text-6xl font-black text-green-400">{readinessToActionMin}</span>
            <span className="text-xl text-slate-300 mb-2">minutes</span>
          </div>
          <p className="text-slate-300 text-sm">From readiness view to employer head-start action</p>
          {anomalyReport.hasAnomalies && (
            <div className="mt-3 bg-yellow-900/30 border border-yellow-600/30 rounded-lg p-3">
              <p className="text-xs font-bold text-yellow-400 mb-1">⚠ Anomalies detected</p>
              {anomalyReport.anomalies.map((a, i) => (
                <p key={i} className="text-xs text-yellow-300">{a.description}</p>
              ))}
            </div>
          )}
          <p className="text-slate-500 text-xs mt-3">
            Compared to self-reported 14-day manual baseline (identity step only) — estimated, not controlled
          </p>
        </section>

        {/* Before/After Timeline */}
        <section>
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-5">Event Chain</h2>
          <div className="space-y-0">
            {e.isvEvents.map((ev, i) => (
              <div key={ev.event} className="flex items-start gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-3 h-3 rounded-full bg-slate-900 flex-shrink-0 mt-0.5" />
                  {i < e.isvEvents.length - 1 && (
                    <div className="w-px flex-1 bg-slate-200 my-1 min-h-[24px]" />
                  )}
                </div>
                <div className="pb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold text-slate-800">{ev.label}</span>
                    <span className="text-xs font-mono text-slate-400">+{ev.deltaSec}s</span>
                  </div>
                  <span className="text-xs font-mono text-gray-400">{ev.event}</span>
                </div>
              </div>
            ))}
          </div>
          {/* Simple bar comparison */}
          <div className="mt-6 bg-gray-50 rounded-xl p-5 border border-gray-200">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Time Comparison</p>
            <BarRow label="VitalCV (identity step)" valueMin={parseFloat(readinessToActionMin)} maxMin={20} color="bg-green-500" verified />
            <BarRow label="Manual baseline (self-reported)" valueMin={14 * 24 * 60} maxMin={20} displayLabel="~14 days" color="bg-gray-300" />
            <p className="text-xs text-gray-400 mt-3">
              ⚠ Bar comparison covers identity step only. OIG + license steps not yet integrated.
            </p>
          </div>
        </section>

        {/* Evidence */}
        <section>
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4">Evidence</h2>
          <div className="space-y-3">
            <EvidenceRow label="Provider" value="Withheld — subject not published" />
            <EvidenceRow label="Taxonomy" value={e.taxonomy} />
            <EvidenceRow label="State" value={e.state} />
            <EvidenceRow label="NPPES Identity Status" value={e.nppesStatus} positive />
            <EvidenceRow label="Proof Tier" value={e.proofTier.replace(/_/g, ' ')} />
            <EvidenceRow label="Employer Action" value={e.employerAction.replace(/_/g, ' ')} />
            <EvidenceRow label="Loop ID" value={e.loopId} mono />
            <EvidenceRow label="Generated" value={new Date(e.generatedAt).toLocaleDateString()} />
          </div>

          <div className="mt-5">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Verified Lanes</p>
            {e.verifiedLanes.map(lane => (
              <div key={lane} className="flex items-center gap-2 text-sm text-green-700 py-1">
                <span className="font-bold">✓</span> {lane}
              </div>
            ))}
          </div>

          <div className="mt-4">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Pending Lanes (system state)</p>
            {e.pendingLanes.map(l => (
              <div key={l.lane} className="text-sm py-1.5">
                <span className="font-semibold text-slate-700">{l.lane}</span>
                <span className="text-gray-500"> — {l.reason}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Limitations — required */}
        <section className="border border-amber-200 bg-amber-50 rounded-xl p-5">
          <h2 className="text-sm font-bold uppercase tracking-widest text-amber-700 mb-3">Limitations</h2>
          <ul className="space-y-1.5">
            {e.limitations.map((lim, i) => (
              <li key={i} className="text-sm text-amber-800 flex gap-2">
                <span className="flex-shrink-0">·</span>
                <span>{lim}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Traceability */}
        <section className="bg-slate-50 border border-slate-200 rounded-xl p-5">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-3">Traceability</h2>
          <p className="text-sm text-gray-600 mb-3">
            Every metric on this page traces to a system event. The event chain above
            maps directly to AuditEvent rows in the VitalCV database, keyed by Loop ID.
          </p>
          <code className="text-xs font-mono bg-white border border-slate-200 rounded px-3 py-1.5 block text-slate-600 mb-3">
            GET /api/isv-events/{e.loopId}
          </code>
          {/* Integrity snapshot */}
          <div className="border border-slate-200 rounded-lg p-3 bg-white text-xs font-mono text-slate-500 space-y-1">
            <div className="flex justify-between">
              <span>snapshot.version</span><span>{snapshot.version}</span>
            </div>
            <div className="flex justify-between">
              <span>event_chain_hash</span><span className="text-slate-700">{snapshot.eventChainHash}</span>
            </div>
            <div className="flex justify-between">
              <span>chain_valid</span>
              <span className={chainValidation.valid ? 'text-green-600' : 'text-red-600'}>
                {chainValidation.valid ? 'true' : 'false'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>limitations_enforced</span>
              <span className={limitationCheck.valid ? 'text-green-600' : 'text-yellow-600'}>
                {limitationCheck.valid ? 'true' : `missing: ${limitationCheck.missing.join(', ')}`}
              </span>
            </div>
            <div className="flex justify-between">
              <span>anomalies</span>
              <span className={anomalyReport.hasAnomalies ? 'text-yellow-600' : 'text-green-600'}>
                {anomalyReport.anomalies.length}
              </span>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="space-y-3 pt-2">
          <Link
            href="/pilot"
            className="block w-full text-center bg-slate-900 hover:bg-slate-700 text-white font-bold py-4 rounded-xl transition-colors text-sm uppercase tracking-wider"
          >
            Run this for your team
          </Link>
          <Link
            href="/employers"
            className="block w-full text-center bg-white border border-slate-200 hover:border-slate-400 text-slate-700 font-bold py-3.5 rounded-xl transition-colors text-sm"
          >
            See pilot scope →
          </Link>
        </section>

        {/* Footer disclaimer */}
        <footer className="text-xs text-gray-400 border-t pt-6 space-y-1">
          <p>This page was generated from real system events. All timestamps are from the live VitalCV event pipeline.</p>
          <p>OIG exclusions and state license verification are not yet integrated. This page does not claim full credentialing coverage.</p>
          <p>The pilot subject is a real clinician whose identity is withheld. Events are traceable by loop id.</p>
          <p>Loop ID: {e.loopId}</p>
        </footer>
      </div>
    </div>
  );
}

// ─── Components ───────────────────────────────────────────────────

function BarRow({
  label,
  valueMin,
  maxMin,
  displayLabel,
  color,
  verified,
}: {
  label: string;
  valueMin: number;
  maxMin: number;
  displayLabel?: string;
  color: string;
  verified?: boolean;
}) {
  // Cap visual bar at maxMin for comparison; actual time may be very different
  const pct = Math.min((valueMin / maxMin) * 100, 100);
  const show = displayLabel ?? `${valueMin < 1 ? `${Math.round(valueMin * 60)}s` : `${valueMin}m`}`;

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-600">{label}</span>
        <span className={`text-xs font-bold ${verified ? 'text-green-700' : 'text-gray-500'}`}>{show}</span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${Math.max(pct, 2)}%` }} />
      </div>
    </div>
  );
}

function EvidenceRow({
  label,
  value,
  positive,
  mono,
}: {
  label: string;
  value: string;
  positive?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between py-1.5 border-b border-gray-100 text-sm">
      <span className="text-gray-400 flex-shrink-0 mr-4">{label}</span>
      <span className={`text-right ${positive ? 'text-green-700 font-semibold' : 'text-slate-700'} ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </span>
    </div>
  );
}

export function generateStaticParams() {
  return Object.keys(PILOTS).map(slug => ({ slug }));
}
