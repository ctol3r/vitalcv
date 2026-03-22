'use client';

/**
 * Interview Mode — /interview
 *
 * Jobs doctrine: VCV must help the provider IN the interview, not just after it.
 * One magical moment: share one thing, employer instantly understands what is
 * proven, what is missing, what can proceed.
 *
 * This page is the entry point and explainer for Interview Mode.
 * Authenticated clinicians are directed to their real readiness data.
 * Unauthenticated visitors see a demo-grade preview + strong CTA.
 *
 * Mobile: full-width stack, bottom CTA, no horizontal overflow.
 */

import Link from 'next/link';
import { useState } from 'react';

// ── Demo readiness mock ───────────────────────────────────────────────────────

const DEMO_CLINICIAN = {
  name: 'Dr. Sarah Chen',
  specialty: 'Emergency Medicine',
  providerType: 'MD',
  state: 'California',
  readinessScore: 84,
  readinessLevel: 'L3',
  readinessStatus: 'Interview Ready',
};

const DEMO_PROOF = [
  { label: 'CA Medical License', status: 'VERIFIED', issuer: 'CA Medical Board', date: '2025-11-01' },
  { label: 'DEA Registration', status: 'VERIFIED', issuer: 'DEA Office', date: '2025-09-15' },
  { label: 'Board Certification', status: 'VERIFIED', issuer: 'ABEM', date: '2025-07-20' },
  { label: 'NPI Identity', status: 'VERIFIED', issuer: 'NPPES', date: '2026-01-03' },
  { label: 'Malpractice Insurance', status: 'PENDING', issuer: 'Self-reported', date: null },
  { label: 'Hospital Privileges', status: 'MISSING', issuer: null, date: null },
];

const DEMO_BLOCKERS = [
  { label: 'Malpractice proof pending verification', severity: 'medium' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, string> = {
  VERIFIED: 'text-emerald-400',
  PENDING: 'text-amber-400',
  MISSING: 'text-white/25',
};

const STATUS_DOT: Record<string, string> = {
  VERIFIED: 'bg-emerald-400',
  PENDING: 'bg-amber-400',
  MISSING: 'bg-white/15',
};

const LEVEL_RING: Record<string, string> = {
  L3: 'ring-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  L2: 'ring-sky-500/40 bg-sky-500/10 text-sky-300',
  L1: 'ring-amber-500/40 bg-amber-500/10 text-amber-300',
  L0: 'ring-red-500/40 bg-red-500/10 text-red-300',
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default function InterviewPage() {
  const [sharePressed, setSharePressed] = useState(false);
  const score = DEMO_CLINICIAN.readinessScore;
  const levelRing = LEVEL_RING[DEMO_CLINICIAN.readinessLevel] ?? LEVEL_RING.L0;

  return (
    <div className="min-h-screen bg-vt-surface-ops-base text-white">

      {/* ── Hero ── */}
      <section className="px-4 sm:px-6 pt-12 sm:pt-20 pb-8 sm:pb-12 text-center">
        <div className="mx-auto max-w-2xl">
          <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.3em] text-white/30">
            Interview Mode
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight mb-4">
            Interview with proof.<br className="hidden sm:block" /> Start with trust.
          </h1>
          <p className="text-base sm:text-lg text-white/50 leading-relaxed max-w-xl mx-auto">
            You've already done the hard work.<br />
            Your proof should move with you.
          </p>
        </div>
      </section>

      {/* ── Demo readiness card ── */}
      <section className="px-4 sm:px-6 py-6 sm:py-8">
        <div className="mx-auto max-w-2xl">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/25 text-center">
            Readiness Snapshot — Demo
          </p>

          <div className="rounded-2xl border border-white/10 bg-white/4 overflow-hidden">
            {/* Clinician identity */}
            <div className="px-5 sm:px-6 py-5 flex items-center gap-4 border-b border-white/6">
              <div className="h-12 w-12 rounded-xl bg-white/8 flex items-center justify-center text-lg font-bold text-white/60 shrink-0">
                {DEMO_CLINICIAN.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white">{DEMO_CLINICIAN.name}</p>
                <p className="text-xs text-white/40 mt-0.5">
                  {DEMO_CLINICIAN.providerType} · {DEMO_CLINICIAN.specialty} · {DEMO_CLINICIAN.state}
                </p>
              </div>
              <div className={`shrink-0 flex flex-col items-center justify-center rounded-xl px-3 py-2 ring-1 ${levelRing}`}>
                <span className="text-lg font-bold">{score}</span>
                <span className="text-[9px] uppercase tracking-wide opacity-70">{DEMO_CLINICIAN.readinessLevel}</span>
              </div>
            </div>

            {/* Score bar */}
            <div className="px-5 sm:px-6 py-3 border-b border-white/6">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] text-white/30 uppercase tracking-wide">Readiness</span>
                <span className="text-[10px] font-semibold text-emerald-400">{DEMO_CLINICIAN.readinessStatus}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-white/8 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                  style={{ width: `${score}%` }}
                />
              </div>
            </div>

            {/* Proof items */}
            <div className="divide-y divide-white/4">
              {DEMO_PROOF.map((item) => (
                <div key={item.label} className="flex items-center gap-3 px-5 sm:px-6 py-3">
                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${STATUS_DOT[item.status] ?? 'bg-white/15'}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${item.status === 'MISSING' ? 'text-white/25' : 'text-white/80'}`}>
                      {item.label}
                    </p>
                    {item.issuer && (
                      <p className="text-[10px] text-white/25 mt-0.5">{item.issuer}</p>
                    )}
                  </div>
                  <span className={`text-[10px] font-semibold uppercase tracking-wide ${STATUS_STYLE[item.status] ?? 'text-white/25'}`}>
                    {item.status}
                  </span>
                </div>
              ))}
            </div>

            {/* Blockers */}
            {DEMO_BLOCKERS.length > 0 && (
              <div className="px-5 sm:px-6 py-4 border-t border-white/6 bg-amber-500/4">
                <p className="text-[10px] font-bold uppercase tracking-wide text-amber-300/60 mb-2">Blockers</p>
                {DEMO_BLOCKERS.map((b) => (
                  <div key={b.label} className="flex items-center gap-2">
                    <span className="h-1 w-1 rounded-full bg-amber-400/60" />
                    <p className="text-xs text-amber-300/70">{b.label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Demo label */}
          <p className="mt-2 text-center text-[10px] text-white/20">
            Demo data — sign in to see your real readiness profile
          </p>
        </div>
      </section>

      {/* ── Three objects ── */}
      <section className="px-4 sm:px-6 py-6 sm:py-10">
        <div className="mx-auto max-w-2xl">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                icon: '✦',
                label: 'What is proven',
                body: 'Verified credentials — licenses, certifications, identity — from primary sources.',
                accent: 'text-emerald-400',
              },
              {
                icon: '◈',
                label: 'What is missing',
                body: 'Clear visibility into gaps before the conversation, not after the offer.',
                accent: 'text-amber-400',
              },
              {
                icon: '→',
                label: 'What can proceed',
                body: 'A shared start path — employer knows exactly what to expect on day one.',
                accent: 'text-sky-400',
              },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-white/6 bg-white/2 p-4 sm:p-5">
                <p className={`text-lg mb-2 ${item.accent}`}>{item.icon}</p>
                <p className="text-sm font-semibold text-white mb-1.5">{item.label}</p>
                <p className="text-xs text-white/40 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Share button ── */}
      <section className="px-4 sm:px-6 py-8 sm:py-12">
        <div className="mx-auto max-w-md flex flex-col gap-3">
          {sharePressed ? (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/6 px-5 py-6 text-center">
              <p className="text-emerald-400 font-semibold mb-1">Sign in to share your proof</p>
              <p className="text-xs text-white/40 mb-4">
                Get your real readiness profile and a shareable bundle link.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <Link
                  href="/get-ready"
                  className="flex-1 flex items-center justify-center min-h-[48px] rounded-xl bg-emerald-500 text-sm font-semibold text-white hover:bg-emerald-400 transition-colors px-5"
                >
                  Create my profile
                </Link>
                <Link
                  href="/sign-in"
                  className="flex-1 flex items-center justify-center min-h-[48px] rounded-xl border border-white/15 text-sm font-medium text-white/70 hover:text-white hover:border-white/30 transition-colors px-5"
                >
                  Sign in
                </Link>
              </div>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setSharePressed(true)}
                className="w-full flex items-center justify-center gap-2 min-h-[56px] rounded-2xl bg-emerald-500 text-sm font-bold text-white shadow-[0_0_30px_rgba(16,185,129,0.2)] hover:bg-emerald-400 transition-all active:scale-[0.98]"
              >
                Share My Readiness
                <span className="text-emerald-200 text-base">→</span>
              </button>
              <p className="text-center text-xs text-white/25">
                Generates a signed link · No employer account needed · Expires in 24h
              </p>
            </>
          )}
        </div>
      </section>

      {/* ── Footer strip ── */}
      <section className="px-4 sm:px-6 py-8 border-t border-white/6">
        <div className="mx-auto max-w-2xl flex flex-wrap items-center justify-between gap-4">
          <p className="text-xs text-white/25 max-w-xs">
            Interview Mode is part of the VitalCV trust layer.<br />
            Real data available after sign-in.
          </p>
          <div className="flex gap-4 text-sm text-white/30">
            <Link href="/passport" className="hover:text-white transition-colors">Passport</Link>
            <Link href="/get-ready" className="hover:text-white transition-colors">Get Started</Link>
            <Link href="/explore" className="hover:text-white transition-colors">Explore Jobs</Link>
          </div>
        </div>
      </section>

    </div>
  );
}
