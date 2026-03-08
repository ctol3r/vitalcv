/**
 * Wave 188 — Explore Opportunities Surface
 * /opportunities/[id] — Opportunity detail page
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  MapPin, Clock, DollarSign, Building2, ShieldCheck,
  Users, Zap, ChevronRight, ArrowLeft,
} from 'lucide-react';

interface Props { params: Promise<{ id: string }> }

// ── Canonical opportunity data ────────────────────────────────────────────────

interface OppDetail {
  id: string; title: string; facility: string; employerSlug: string;
  location: string; state: string; specialty: string;
  hiringType: string; startUrgency: string;
  payRange?: string; remote: boolean; recentHires: number;
  description: string;
  requirements: Array<{ label: string; level: string; note?: string }>;
  clearToStart: string;
  employerTrustScore: number;
}

const OPPS: Record<string, OppDetail> = {
  'opp-001': {
    id: 'opp-001', title: 'Locums Interventional Cardiologist',
    facility: 'Bay Area Cardiac Group', employerSlug: 'bay-area-cardiac-group',
    location: 'San Francisco, CA', state: 'CA', specialty: 'Cardiology',
    hiringType: 'Locums', startUrgency: 'Start in 2 weeks',
    payRange: '$310–$380/hr', remote: false, recentHires: 3,
    description: 'Locums interventional cardiology position covering cath lab and clinic. 2–4 week blocks available. Credentialing handled within 5 business days for VitalCV-prequalified candidates.',
    requirements: [
      { label: 'CA Medical License', level: 'L3', note: 'Active, no restrictions' },
      { label: 'ABIM Cardiology Board Certification', level: 'L3' },
      { label: 'DEA Registration (CA)', level: 'L2' },
      { label: 'Malpractice Insurance', level: 'L2' },
      { label: 'NPI Verified', level: 'L3' },
      { label: 'Sanctions Clear', level: 'L3' },
    ],
    clearToStart: 'CA license + ABIM board cert + active DEA + malpractice coverage',
    employerTrustScore: 94,
  },
  'opp-002': {
    id: 'opp-002', title: 'Perm Electrophysiologist',
    facility: 'Bay Area Cardiac Group', employerSlug: 'bay-area-cardiac-group',
    location: 'Oakland, CA', state: 'CA', specialty: 'Cardiology',
    hiringType: 'Permanent', startUrgency: 'Start within a month',
    payRange: '$420K–$500K/yr', remote: false, recentHires: 1,
    description: 'Full-time EP position with a growing interventional group. Partnership track after 2 years. Support staff and modern EP lab included.',
    requirements: [
      { label: 'CA Medical License', level: 'L3' },
      { label: 'ABIM Electrophysiology', level: 'L3' },
      { label: 'DEA Registration', level: 'L2' },
      { label: 'Malpractice Insurance', level: 'L3' },
      { label: 'NPI Verified', level: 'L3' },
      { label: 'Sanctions Clear', level: 'L3' },
    ],
    clearToStart: 'CA license + EP board cert + clean NPDB',
    employerTrustScore: 94,
  },
  'opp-003': {
    id: 'opp-003', title: 'Telehealth Psychiatrist',
    facility: 'MindBridge Health', employerSlug: 'mindbridge-health',
    location: 'Remote — CA licensed', state: 'CA', specialty: 'Psychiatry',
    hiringType: 'Telehealth', startUrgency: 'Flexible start',
    payRange: '$200–$270/hr', remote: true, recentHires: 8,
    description: 'Remote psychiatry with flexible scheduling. MindBridge handles payer enrollment and all credentialing coordination. You see patients — we handle the admin.',
    requirements: [
      { label: 'CA State Medical License', level: 'L3' },
      { label: 'DEA Registration', level: 'L2' },
      { label: 'NPI Verified', level: 'L3' },
      { label: 'Board Certification (preferred)', level: 'L1' },
    ],
    clearToStart: 'Active CA license + DEA + verified NPI',
    employerTrustScore: 91,
  },
  'opp-004': {
    id: 'opp-004', title: 'ICU / Critical Care NP',
    facility: 'Sacramento Medical Center', employerSlug: 'sacramento-medical-center',
    location: 'Sacramento, CA', state: 'CA', specialty: 'Critical Care',
    hiringType: 'Locums', startUrgency: 'Start immediately',
    payRange: '$120–$145/hr', remote: false, recentHires: 1,
    description: 'Urgent need for a critical care NP in a Level II trauma ICU. Immediate start preferred. Credentialing prioritized for VitalCV-verified candidates.',
    requirements: [
      { label: 'CA NP License', level: 'L3' },
      { label: 'AANP / ANCC Certification', level: 'L3' },
      { label: 'BLS', level: 'L3' },
      { label: 'ACLS', level: 'L3' },
      { label: 'NPI Verified', level: 'L3' },
      { label: 'Malpractice Insurance', level: 'L2' },
    ],
    clearToStart: 'CA NP license + ACLS + malpractice',
    employerTrustScore: 88,
  },
  'opp-005': {
    id: 'opp-005', title: 'Family Medicine — Rural WA',
    facility: 'Northwest Locums Alliance', employerSlug: 'northwest-locums-alliance',
    location: 'Eastern Washington', state: 'WA', specialty: 'Family Medicine',
    hiringType: 'Locums', startUrgency: 'Start in 2 weeks',
    payRange: '$180–$220/hr', remote: false, recentHires: 5,
    description: 'Rural family medicine locums in Eastern WA. Strong community, competitive pay, housing assistance available. NLA handles all credentialing at partner facilities.',
    requirements: [
      { label: 'WA Medical License', level: 'L3' },
      { label: 'DEA Registration', level: 'L2' },
      { label: 'Malpractice Insurance', level: 'L2' },
      { label: 'NPI Verified', level: 'L3' },
      { label: 'NPDB Clear', level: 'L2' },
    ],
    clearToStart: 'Active WA license + DEA + malpractice',
    employerTrustScore: 85,
  },
  'opp-006': {
    id: 'opp-006', title: 'Staff Internist — Perm',
    facility: 'Kaiser Permanente Northern California', employerSlug: 'kaiser-permanente-northern-california',
    location: 'Sacramento, CA', state: 'CA', specialty: 'Internal Medicine',
    hiringType: 'Permanent', startUrgency: 'Start within a month',
    remote: false, recentHires: 12,
    description: 'Kaiser Permanente is hiring permanent staff internists across NorCal facilities. Integrated EHR, competitive salary, full benefits, and physician-led culture.',
    requirements: [
      { label: 'CA Medical License', level: 'L3' },
      { label: 'ABIM Internal Medicine', level: 'L3' },
      { label: 'DEA Registration', level: 'L2' },
      { label: 'Malpractice History Review', level: 'L3' },
      { label: 'NPI Verified', level: 'L3' },
      { label: 'NPDB Clear', level: 'L3' },
    ],
    clearToStart: 'CA license + board cert + clean NPDB + KP privileging',
    employerTrustScore: 97,
  },
  'opp-007': {
    id: 'opp-007', title: 'Telepsychiatry — TX & FL',
    facility: 'MindBridge Health', employerSlug: 'mindbridge-health',
    location: 'Remote — TX or FL', state: 'TX', specialty: 'Psychiatry',
    hiringType: 'Telehealth', startUrgency: 'Flexible start',
    payRange: '$200–$270/hr', remote: true, recentHires: 4,
    description: 'Expand your psychiatric practice across TX and FL with MindBridge. Flexible scheduling, no admin burden.',
    requirements: [
      { label: 'TX or FL Medical License', level: 'L3' },
      { label: 'DEA Registration', level: 'L2' },
      { label: 'NPI Verified', level: 'L3' },
    ],
    clearToStart: 'Active TX or FL license + DEA + NPI',
    employerTrustScore: 91,
  },
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const opp = OPPS[id];
  if (!opp) return { title: 'Opportunity Not Found — VitalCV' };
  return { title: `${opp.title} — VitalCV`, description: opp.description };
}

export async function generateStaticParams() {
  return Object.keys(OPPS).map(id => ({ id }));
}

const LEVEL_COLOR: Record<string, string> = {
  L3: 'text-red-400 bg-red-500/10 border-red-500/20',
  L2: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  L1: 'text-green-400 bg-green-500/10 border-green-500/20',
};

export default async function OpportunityDetailPage({ params }: Props) {
  const { id } = await params;
  const opp = OPPS[id];
  if (!opp) notFound();

  return (
    <div className="min-h-screen bg-ops-gradient text-white surface-operator">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-white/40 mb-6">
          <Link href="/" className="hover:text-white/70 transition-colors">Home</Link>
          <span>/</span>
          <Link href="/explore" className="hover:text-white/70 transition-colors">Explore</Link>
          <span>/</span>
          <span className="text-white/60 truncate">{opp.title}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main */}
          <div className="lg:col-span-2 space-y-6">
            {/* Hero */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-7">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-7 h-7 text-white/50" />
                </div>
                <div className="flex-1">
                  <h1 className="heading-xl font-bold text-white">{opp.title}</h1>
                  <p className="text-white/60 mt-1">{opp.facility}</p>
                  <div className="flex flex-wrap gap-3 mt-3">
                    <span className="flex items-center gap-1 text-sm text-white/50">
                      <MapPin className="w-3.5 h-3.5" /> {opp.location}
                    </span>
                    <span className="flex items-center gap-1 text-sm text-white/50">
                      <Clock className="w-3.5 h-3.5" /> {opp.startUrgency}
                    </span>
                    {opp.payRange && (
                      <span className="flex items-center gap-1 text-sm text-white/50">
                        <DollarSign className="w-3.5 h-3.5" /> {opp.payRange}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-sm text-white/50">
                      <Users className="w-3.5 h-3.5" /> {opp.recentHires} hired recently
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-white/70 mt-5 leading-relaxed">{opp.description}</p>
            </div>

            {/* What this employer requires */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-lg font-semibold text-white mb-4">What this role requires from you</h2>
              <div className="space-y-2.5">
                {opp.requirements.map((req, i) => (
                  <div key={i} className="flex items-start justify-between gap-3 py-2 border-b border-white/5 last:border-0">
                    <div>
                      <p className="text-sm text-white/80">{req.label}</p>
                      {req.note && <p className="text-xs text-white/40 mt-0.5">{req.note}</p>}
                    </div>
                    <span className={`px-2 py-0.5 rounded border text-xs flex-shrink-0 ${LEVEL_COLOR[req.level] ?? ''}`}>
                      {req.level}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 rounded-xl bg-blue-900/20 border border-blue-500/20">
                <p className="text-sm text-white/60">
                  <span className="text-blue-400 font-medium">Clear-to-start: </span>
                  {opp.clearToStart}
                </p>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            {/* Apply CTA */}
            <div className="rounded-2xl border border-vt-success/30 bg-vt-success/5 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-vt-success" />
                <p className="text-sm font-semibold text-white">Apply with VitalCV</p>
              </div>
              <p className="text-xs text-white/50 leading-relaxed">
                Your verified credentials are shared instantly — no forms, no fax.
              </p>
              <Link
                href={`/get-ready?opportunity=${opp.id}`}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-vt-success text-black text-sm font-semibold hover:bg-vt-success/90 transition-colors"
              >
                Check My Readiness <ChevronRight className="w-4 h-4" />
              </Link>
              <Link
                href="/holder/share"
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-sm transition-all"
              >
                Share My Readiness
              </Link>
            </div>

            {/* Employer card */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs text-white/40 mb-3">Employer</p>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-white/50" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{opp.facility}</p>
                  <div className="flex items-center gap-1 text-xs text-emerald-400">
                    <ShieldCheck className="w-3 h-3" />
                    Trust score {opp.employerTrustScore}
                  </div>
                </div>
              </div>
              <Link
                href={`/employers/${opp.employerSlug}`}
                className="w-full flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm text-white/60 hover:text-white transition-all"
              >
                Learn about this employer <ChevronRight className="w-3 h-3" />
              </Link>
            </div>

            {/* Back */}
            <Link href="/explore" className="flex items-center gap-2 text-sm text-white/40 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back to Explore
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
