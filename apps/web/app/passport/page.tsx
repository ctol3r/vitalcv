import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Passport — VitalCV',
  description: 'Your portable proof of authority. Identity, readiness, and credentials in one object.',
};

/**
 * /passport — top-level Passport entry point.
 *
 * Jobs doctrine: "turn the passport into an object people love."
 * Three visible objects: Passport · Proof · Start
 * Every section answers: what is proven | what is blocked | what is next
 *
 * This page is the concept + entry surface.
 * Actual clinician passports live at /passport/[id] (existing).
 * Authenticated clinicians are linked to /holder/home for their live passport.
 *
 * Mobile: full-width stack, clean hierarchy, no overflow.
 */

// ── Demo passport mock ────────────────────────────────────────────────────────

const DEMO_SECTIONS = [
  {
    id: 'identity',
    title: 'Identity',
    icon: '⬡',
    items: [
      { label: 'Name', value: 'Dr. Sarah Chen, MD', verified: true },
      { label: 'NPI', value: '1234567890', verified: true },
      { label: 'Specialty', value: 'Emergency Medicine', verified: true },
      { label: 'State', value: 'California', verified: true },
    ],
  },
  {
    id: 'readiness',
    title: 'Readiness',
    icon: '◈',
    items: [
      { label: 'Readiness Score', value: '84 / 100', verified: true },
      { label: 'Trust Level', value: 'L3 — Primary Source Verified', verified: true },
      { label: 'Status', value: 'Interview Ready', verified: true },
      { label: 'Last Updated', value: 'March 2026', verified: false },
    ],
  },
  {
    id: 'proof',
    title: 'Proof',
    icon: '✦',
    items: [
      { label: 'CA Medical License', value: 'Active — expires Nov 2027', verified: true },
      { label: 'DEA Registration', value: 'Active', verified: true },
      { label: 'Board Certification', value: 'ABEM — Emergency Medicine', verified: true },
      { label: 'Hospital Privileges', value: 'Not on file', verified: false },
    ],
  },
] as const;

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PassportPage() {
  return (
    <div className="min-h-screen bg-vt-surface-ops-base text-white">

      {/* ── Hero ── */}
      <section className="px-4 sm:px-6 pt-12 sm:pt-20 pb-8 text-center">
        <div className="mx-auto max-w-2xl">
          <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.3em] text-white/30">
            VCV Passport
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight mb-4">
            Your proof.<br className="hidden sm:block" /> Portable. Verified. Yours.
          </h1>
          <p className="text-base sm:text-lg text-white/50 leading-relaxed max-w-lg mx-auto">
            One object. Every credential that matters.
            Share it in an interview. Submit it with an application.
            Let it speak for you.
          </p>
        </div>
      </section>

      {/* ── Demo passport card ── */}
      <section className="px-4 sm:px-6 py-6 sm:py-8">
        <div className="mx-auto max-w-2xl">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/25 text-center">
            Example Passport — Demo
          </p>

          <div className="rounded-2xl border border-white/10 bg-white/3 overflow-hidden">
            {/* Passport header */}
            <div className="px-5 sm:px-6 py-5 bg-gradient-to-r from-emerald-950/40 to-transparent border-b border-white/6 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/20 flex items-center justify-center text-xl font-bold text-emerald-300/60 shrink-0">
                  SC
                </div>
                <div>
                  <p className="font-semibold text-white">Dr. Sarah Chen</p>
                  <p className="text-xs text-white/40">MD · Emergency Medicine · California</p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] text-emerald-400 font-semibold">Interview Ready</span>
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-2xl font-bold text-white">84</p>
                <p className="text-[9px] text-white/30 uppercase tracking-wide">Readiness</p>
              </div>
            </div>

            {/* Sections */}
            {DEMO_SECTIONS.map((section, si) => (
              <div key={section.id} className={si > 0 ? 'border-t border-white/6' : ''}>
                <div className="px-5 sm:px-6 py-3 bg-white/2 flex items-center gap-2">
                  <span className="text-white/30 text-xs">{section.icon}</span>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">
                    {section.title}
                  </p>
                </div>
                <div className="divide-y divide-white/4">
                  {section.items.map((item) => (
                    <div key={item.label} className="flex items-center justify-between gap-3 px-5 sm:px-6 py-3">
                      <p className="text-xs text-white/40">{item.label}</p>
                      <div className="flex items-center gap-2">
                        <p className={`text-sm text-right ${item.verified ? 'text-white/80' : 'text-white/25'}`}>
                          {item.value}
                        </p>
                        {item.verified && (
                          <span className="text-emerald-500/60 text-xs">✓</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Share strip */}
            <div className="px-5 sm:px-6 py-4 border-t border-white/6 bg-white/2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <p className="text-xs text-white/30">
                Signed · SHA-256 verified · 24h TTL
              </p>
              <Link
                href="/get-ready"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                Get your Passport →
              </Link>
            </div>
          </div>

          <p className="mt-2 text-center text-[10px] text-white/20">
            Demo only — real credentials require sign-in
          </p>
        </div>
      </section>

      {/* ── What the Passport does ── */}
      <section className="px-4 sm:px-6 py-8 sm:py-12">
        <div className="mx-auto max-w-2xl">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                title: 'Passport',
                body: 'Identity and readiness — who you are and what you are cleared to do.',
                cta: null,
                accent: 'border-emerald-500/15',
              },
              {
                title: 'Proof',
                body: 'Evidence and trust artifacts — licenses, certs, and primary source verifications.',
                cta: null,
                accent: 'border-sky-500/15',
              },
              {
                title: 'Start',
                body: 'The next accepted path — employer-visible readiness, blockers surfaced early.',
                cta: null,
                accent: 'border-violet-500/15',
              },
            ].map((item) => (
              <div key={item.title} className={`rounded-xl border ${item.accent} bg-white/2 p-4 sm:p-5`}>
                <p className="text-sm font-bold text-white mb-2">{item.title}</p>
                <p className="text-xs text-white/40 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTAs ── */}
      <section className="px-4 sm:px-6 py-8 sm:py-12">
        <div className="mx-auto max-w-md flex flex-col gap-3">
          <Link
            href="/get-ready"
            className="flex items-center justify-center min-h-[56px] rounded-2xl bg-emerald-500 text-sm font-bold text-white hover:bg-emerald-400 transition-all active:scale-[0.98] shadow-[0_0_30px_rgba(16,185,129,0.15)]"
          >
            Create My Passport
          </Link>
          <Link
            href="/sign-in"
            className="flex items-center justify-center min-h-[48px] rounded-2xl border border-white/12 text-sm font-medium text-white/60 hover:text-white hover:border-white/25 transition-all"
          >
            Sign In to My Profile
          </Link>
          <p className="text-center text-xs text-white/25">
            Already have a Passport?{' '}
            <Link href="/explore" className="text-white/40 hover:text-white underline underline-offset-2 transition-colors">
              Explore opportunities
            </Link>
          </p>
        </div>
      </section>

      {/* ── Trust statement ── */}
      <section className="px-4 sm:px-6 py-10 border-t border-white/6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-white/20 text-sm leading-relaxed max-w-lg mx-auto">
            "You've already done the hard work.<br />
            Your proof should move with you."
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm text-white/25">
            <Link href="/interview" className="hover:text-white transition-colors">Interview Mode</Link>
            <span className="text-white/10">·</span>
            <Link href="/explore" className="hover:text-white transition-colors">Find Opportunities</Link>
            <span className="text-white/10">·</span>
            <Link href="/developers" className="hover:text-white transition-colors">Developers</Link>
          </div>
        </div>
      </section>

    </div>
  );
}
