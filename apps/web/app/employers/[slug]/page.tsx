/**
 * Wave 186 — Employer Knowledge Layer
 * /employers/[slug] — Full employer profile with Ask panel
 */
import AskAboutEmployer from '@/components/employers/AskAboutEmployer';
import {
    Building2,
    ChevronRight,
    Clock,
    DollarSign,
    ExternalLink,
    Globe,
    ShieldCheck,
    Users,
    Zap
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

interface Props { params: Promise<{ slug: string }> }

// ── Canonical employer data (mirrors employerService.ts) ─────────────────────

interface EmployerProfile {
  slug: string; name: string; facilityType: string;
  tagline: string; description: string;
  states: string[]; specialties: string[];
  openRoles: number; trustScore: number;
  timeToStart: string; timeToOnboard: string;
  hiringStatus: string;
  hiringTypes: string[];
  requirements: Array<{ label: string; level: string; note?: string }>;
  clearToStartThreshold: string;
  payTransparency: boolean;
  payRange?: string | null;
  recentHires: number;
  website?: string | null;
  verifiedSince: string;
}

const EMPLOYERS: Record<string, EmployerProfile> = {
  'bay-area-cardiac-group': {
    slug: 'bay-area-cardiac-group',
    name: 'Bay Area Cardiac Group',
    facilityType: 'Specialty Cardiology Practice',
    tagline: "The Bay Area's premier interventional cardiology group.",
    description:
      'Bay Area Cardiac Group operates 4 facilities across San Francisco and the East Bay. We run a locums-friendly practice with rapid credentialing turnaround and a collaborative PA/NP team. Our credentialing coordinator handles all privilege applications within 5 business days.',
    states: ['CA'],
    specialties: ['Cardiology', 'Electrophysiology', 'Interventional Cardiology'],
    openRoles: 4,
    trustScore: 94,
    hiringStatus: 'HIRING_NOW',
    hiringTypes: ['Locums', 'Perm', 'Hybrid'],
    timeToStart: '2–3 weeks',
    timeToOnboard: '~5 business days',
    clearToStartThreshold: 'Active CA license + ABIM board certification + active DEA + malpractice insurance',
    payTransparency: true,
    payRange: '$310–$380/hr (locums); $420K–$500K (perm)',
    recentHires: 6,
    website: 'https://bayareacardiac.example.com',
    verifiedSince: '2023-06-01T00:00:00Z',
    requirements: [
      { label: 'CA Medical License', level: 'L3', note: 'Active, no restrictions' },
      { label: 'Board Certification', level: 'L3', note: 'ABIM Cardiology or equivalent' },
      { label: 'DEA Registration', level: 'L2', note: 'Active in CA' },
      { label: 'Malpractice Insurance', level: 'L2', note: 'Tail or occurrence-based' },
      { label: 'NPI Verified', level: 'L3' },
      { label: 'Sanctions Clear', level: 'L3' },
    ],
  },
  'mindbridge-health': {
    slug: 'mindbridge-health',
    name: 'MindBridge Health',
    facilityType: 'Telehealth Platform',
    tagline: 'Mental healthcare without geographic limits.',
    description:
      'MindBridge connects psychiatric and behavioral health specialists with patients across 14 states. We handle all credentialing coordination and payer enrollment. Clinicians typically start seeing patients within 7 days of completing their VitalCV profile.',
    states: ['CA', 'TX', 'FL', 'NY', 'WA', 'OR', 'CO', 'AZ', 'NV', 'IL', 'GA', 'NC', 'VA', 'MA'],
    specialties: ['Psychiatry', 'Psychology', 'Behavioral Health', 'Addiction Medicine'],
    openRoles: 12,
    trustScore: 91,
    hiringStatus: 'HIRING_NOW',
    hiringTypes: ['Telehealth', 'Locums', 'Part-time'],
    timeToStart: 'Flexible',
    timeToOnboard: '3–7 business days',
    clearToStartThreshold: 'Active state license in target state + DEA (or state CSOS equivalent) + NPI active',
    payTransparency: true,
    payRange: '$200–$270/hr',
    recentHires: 23,
    website: 'https://mindbridge.example.com',
    verifiedSince: '2023-09-15T00:00:00Z',
    requirements: [
      { label: 'State Medical License', level: 'L3', note: 'Active in target state' },
      { label: 'DEA Registration', level: 'L2' },
      { label: 'NPI Verified', level: 'L3' },
      { label: 'Board Certification', level: 'L2', note: 'Preferred, not required' },
      { label: 'Telehealth Platform Agreement', level: 'L1' },
    ],
  },
  'sacramento-medical-center': {
    slug: 'sacramento-medical-center',
    name: 'Sacramento Medical Center',
    facilityType: 'Hospital System',
    tagline: 'Northern California critical care — excellence without compromise.',
    description:
      'Sacramento Medical Center is a 620-bed Level II trauma center. We hire critical care, emergency, and internal medicine physicians and APPs on both locums and permanent tracks. Our medical staff office runs a streamlined credentialing workflow with a dedicated VitalCV integration.',
    states: ['CA'],
    specialties: ['Critical Care', 'Emergency Medicine', 'Internal Medicine', 'Hospitalist'],
    openRoles: 7,
    trustScore: 88,
    hiringStatus: 'HIRING_NOW',
    hiringTypes: ['Locums', 'Perm', 'PRN'],
    timeToStart: 'Immediate',
    timeToOnboard: '5–10 business days',
    clearToStartThreshold: 'Active CA license + board certification + BLS/ACLS + credentialing file complete',
    payTransparency: false,
    payRange: null,
    recentHires: 11,
    website: 'https://sacmedcenter.example.com',
    verifiedSince: '2022-11-01T00:00:00Z',
    requirements: [
      { label: 'CA Medical License', level: 'L3', note: 'Active, unrestricted' },
      { label: 'Board Certification', level: 'L3' },
      { label: 'BLS / ACLS', level: 'L3' },
      { label: 'DEA Registration', level: 'L2', note: 'Active in CA' },
      { label: 'Hospital Credentialing File', level: 'L3' },
      { label: 'NPI Verified', level: 'L3' },
      { label: 'Background Check', level: 'L2' },
    ],
  },
  'northwest-locums-alliance': {
    slug: 'northwest-locums-alliance',
    name: 'Northwest Locums Alliance',
    facilityType: 'Staffing / Locums Agency',
    tagline: 'Connecting credentialed clinicians with Pacific Northwest opportunities.',
    description:
      'NLA places board-certified physicians and APPs in rural and urban facilities across WA, OR, ID, and MT. We specialize in rapid placement with compliant credentialing support. Our average placement time is 9 days from first contact to first shift.',
    states: ['WA', 'OR', 'ID', 'MT'],
    specialties: ['Family Medicine', 'Internal Medicine', 'Emergency Medicine', 'Hospitalist', 'Pediatrics'],
    openRoles: 19,
    trustScore: 85,
    hiringStatus: 'ACTIVELY_HIRING',
    hiringTypes: ['Locums', 'Short-term'],
    timeToStart: '1–2 weeks',
    timeToOnboard: '3–5 business days',
    clearToStartThreshold: 'Active state license + current DEA + current malpractice coverage',
    payTransparency: true,
    payRange: '$150–$320/hr depending on specialty',
    recentHires: 34,
    website: 'https://nwlocums.example.com',
    verifiedSince: '2024-01-20T00:00:00Z',
    requirements: [
      { label: 'State License (target state)', level: 'L3' },
      { label: 'DEA Registration', level: 'L2' },
      { label: 'Malpractice Insurance', level: 'L2' },
      { label: 'NPI Verified', level: 'L3' },
      { label: 'NPDB Clear', level: 'L2' },
    ],
  },
  'kaiser-permanente-northern-california': {
    slug: 'kaiser-permanente-northern-california',
    name: 'Kaiser Permanente Northern California',
    facilityType: 'Integrated Health System',
    tagline: 'Delivering total health for 4.5 million members.',
    description:
      'Kaiser Permanente Northern California operates 21 hospitals and 260+ medical offices across Northern California. We hire permanent physicians and APPs across all specialties with robust onboarding, competitive salaries, and comprehensive benefits. Our integrated credentialing system connects directly with VitalCV for seamless verification.',
    states: ['CA'],
    specialties: ['All Specialties', 'Primary Care', 'Oncology', 'Surgery', 'Radiology', 'Psychiatry'],
    openRoles: 38,
    trustScore: 97,
    hiringStatus: 'ACTIVELY_HIRING',
    hiringTypes: ['Perm', 'Part-time'],
    timeToStart: '4–8 weeks',
    timeToOnboard: '10–15 business days',
    clearToStartThreshold: 'CA license + board certification + malpractice history review + KP privileging complete',
    payTransparency: false,
    payRange: null,
    recentHires: 89,
    website: 'https://kaiserpermanente.org',
    verifiedSince: '2021-03-01T00:00:00Z',
    requirements: [
      { label: 'CA Medical License', level: 'L3', note: 'Active, unrestricted' },
      { label: 'Board Certification', level: 'L3', note: 'Required for all specialties' },
      { label: 'DEA Registration', level: 'L2' },
      { label: 'Malpractice History', level: 'L3', note: 'Reviewed by credentialing committee' },
      { label: 'KP Privileging', level: 'L3', note: 'System-specific process, ~10 days' },
      { label: 'NPI Verified', level: 'L3' },
      { label: 'NPDB Clear', level: 'L3' },
    ],
  },
};

// ── Page ──────────────────────────────────────────────────────────────────────

function LevelBadge({ level }: { level: string }) {
  const color =
    level.startsWith('L3') ? 'bg-vt-success/15 text-vt-success ring-vt-success/30' :
    level.startsWith('L2') ? 'bg-vt-info/15    text-vt-info    ring-vt-info/30'    :
                             'bg-vt-neutral-800/20 text-vt-neutral-200 ring-vt-neutral-700';
  return (
    <span className={`rounded-full px-2 py-0.5 tag ring-1 ${color}`}>{level}</span>
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const e = EMPLOYERS[slug];
  if (!e) return { title: 'Employer Not Found — VitalCV' };
  return {
    title: `${e.name} — VitalCV`,
    description: e.tagline,
  };
}

export async function generateStaticParams() {
  return Object.keys(EMPLOYERS).map(slug => ({ slug }));
}

const HIRING_STATUS_COLORS: Record<string, string> = {
  HIRING_NOW: 'bg-green-500/20 text-green-400 border-green-500/30',
  ACTIVELY_HIRING: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  ACCEPTING_APPLICATIONS: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
};

const HIRING_STATUS_LABELS: Record<string, string> = {
  HIRING_NOW: 'Hiring Now',
  ACTIVELY_HIRING: 'Actively Hiring',
  ACCEPTING_APPLICATIONS: 'Accepting Applications',
};

export default async function EmployerProfilePage({ params }: Props) {
  const { slug } = await params;
  const employer = EMPLOYERS[slug];
  if (!employer) notFound();

  const levelColor: Record<string, string> = {
    L3: 'text-red-400 bg-red-500/10 border-red-500/20',
    L2: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
    L1: 'text-green-400 bg-green-500/10 border-green-500/20',
  };

  return (
    <div className="min-h-screen bg-ops-gradient text-white surface-operator">
      {/* Breadcrumb */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <nav className="flex items-center gap-2 text-xs text-white/40 mb-6">
          <Link href="/" className="hover:text-white/70 transition-colors">Home</Link>
          <span>/</span>
          <Link href="/employers" className="hover:text-white/70 transition-colors">Employers</Link>
          <span>/</span>
          <span className="text-white/60">{employer.name}</span>
        </nav>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Main content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Hero */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8">
              <div className="flex items-start gap-5">
                <div className="w-16 h-16 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-8 h-8 text-white/60" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-start gap-3 mb-2">
                    <h1 className="heading-xl font-bold text-white">{employer.name}</h1>
                    {employer.verifiedSince && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs mt-1">
                        <ShieldCheck className="w-3 h-3" /> Verified
                      </span>
                    )}
                  </div>
                  <p className="text-white/60">{employer.facilityType}</p>
                  <p className="text-white/80 mt-3 leading-relaxed">{employer.tagline}</p>

                  <div className="flex flex-wrap gap-3 mt-4">
                    <span className={`px-3 py-1 rounded-full text-sm border ${HIRING_STATUS_COLORS[employer.hiringStatus] ?? 'bg-white/10 text-white/40'}`}>
                      {HIRING_STATUS_LABELS[employer.hiringStatus] ?? employer.hiringStatus}
                    </span>
                    <span className="flex items-center gap-1 text-sm text-white/50">
                      <Users className="w-4 h-4" /> {employer.openRoles} open roles
                    </span>
                    <span className="flex items-center gap-1 text-sm text-white/50">
                      <Zap className="w-4 h-4" /> {employer.recentHires} recent hires
                    </span>
                    {employer.website && (
                      <a
                        href={employer.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        <Globe className="w-3 h-3" /> Website
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>

              <p className="text-white/70 mt-6 leading-relaxed">{employer.description}</p>
            </div>

            {/* What this employer requires from you */}
            <section className="rounded-3xl border border-vt-neutral-800/80 bg-vt-surface-ops-raised/30 p-8 shadow-[0_4px_30px_rgba(0,0,0,0.1)]">
              <h2 className="heading-sm mb-1 text-vt-neutral-100">
                What This Employer Requires From You
              </h2>
              <p className="body-sm mb-6 text-vt-neutral-800">
                Clear-to-start threshold: <span className="text-vt-neutral-200">{employer.clearToStartThreshold}</span>
              </p>
              <ul className="space-y-3">
                {employer.requirements.map((req) => (
                  <li key={req.label} className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 p-3 rounded-2xl bg-vt-surface-ops-base border border-vt-neutral-800/60">
                    <div className="flex items-center gap-3">
                      <div className="flex shrink-0 h-8 w-8 items-center justify-center rounded-xl bg-vt-success/10 text-vt-success ring-1 ring-vt-success/20">
                        <ShieldCheck className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="body-sm font-medium text-white">{req.label}</span>
                        {req.note && <span className="body-sm ml-2 text-vt-neutral-800 hidden sm:inline">— {req.note}</span>}
                      </div>
                    </div>
                    <LevelBadge level={req.level} />
                    {req.note && <span className="body-sm text-vt-neutral-800 w-full sm:hidden mt-1">{req.note}</span>}
                  </li>
                ))}
              </ul>
            </section>
            {/* Hiring details */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-lg font-semibold text-white mb-5">Hiring details</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Stat label="Time to Start" value={employer.timeToStart} icon={<Clock className="w-4 h-4" />} />
                <Stat label="Time to Onboard" value={employer.timeToOnboard} icon={<Zap className="w-4 h-4" />} />
                <Stat label="Hiring Types" value={employer.hiringTypes.join(', ')} icon={<Users className="w-4 h-4" />} />
                <Stat label="Trust Score" value={String(employer.trustScore)} icon={<ShieldCheck className="w-4 h-4" />} />
              </div>

              {employer.payTransparency && employer.payRange && (
                <div className="mt-5 p-4 rounded-xl bg-emerald-900/20 border border-emerald-500/20 flex items-start gap-3">
                  <DollarSign className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-emerald-400">Pay Transparency</p>
                    <p className="text-sm text-white/70 mt-1">{employer.payRange}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Specialties + States */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Coverage</h2>
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-white/40 mb-2">Specialties</p>
                  <div className="flex flex-wrap gap-2">
                    {employer.specialties.map(s => (
                      <span key={s} className="px-2 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-sm text-blue-400">{s}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-white/40 mb-2">States</p>
                  <div className="flex flex-wrap gap-2">
                    {employer.states.map(s => (
                      <span key={s} className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-sm text-white/60">{s}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Sidebar */}
          <div className="space-y-6">
            {/* Ask about this employer */}
            <AskAboutEmployer employerName={employer.name} employerSlug={employer.slug} />

            {/* Quick actions */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 space-y-3">
              <h3 className="text-sm font-semibold text-white/70">Quick actions</h3>
              <Link
                href={`/explore?employer=${employer.slug}`}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-colors"
              >
                <span>View Open Roles</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
              <Link
                href="/get-ready"
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-sm transition-all"
              >
                <span>Check My Readiness</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
              <Link
                href={`/employers?compare=${employer.slug}`}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-sm transition-all"
              >
                <span>Compare with Others</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Trust metadata */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <h3 className="text-sm font-semibold text-white/70 mb-3">Trust registry</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/40">Trust Score</span>
                  <span className="text-emerald-400 font-medium">{employer.trustScore}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Verified Since</span>
                  <span className="text-white/60">
                    {new Date(employer.verifiedSince).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Recent Hires</span>
                  <span className="text-white/60">{employer.recentHires}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/40">Pay Transparent</span>
                  <span className={employer.payTransparency ? 'text-emerald-400' : 'text-white/30'}>
                    {employer.payTransparency ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="p-3 rounded-xl bg-white/5 border border-white/8">
      <div className="flex items-center gap-1.5 text-white/40 text-xs mb-1">
        {icon} {label}
      </div>
      <p className="text-sm text-white/80 font-medium">{value}</p>
    </div>
  );
}
