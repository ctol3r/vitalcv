'use client';

/**
 * /interview — Interview Mode
 *
 * One card. One CTA. User realizes: "this gives me an advantage."
 * No login required. Mock data. No clutter.
 */

import Link from 'next/link';
import { useState } from 'react';

// ── Mock proof card ───────────────────────────────────────────

const CLINICIAN = {
  name:      'Dr. John Smith',
  specialty: 'Emergency Medicine',
};

const READY = [
  'License verified',
  'Board certified',
];

const BLOCKED = [
  'DEA (CA)',
];

const START = '14–28 days';

// ── Shared link mock ──────────────────────────────────────────

const MOCK_LINK = 'vitalcv.com/p/demo-jsmith-8f4a';

// ── Page ─────────────────────────────────────────────────────

export default function InterviewPage() {
  const [shared, setShared] = useState(false);
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(`https://${MOCK_LINK}`).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: '#080e1a' }}
    >
      <div className="flex-1 flex flex-col items-center justify-start px-4 sm:px-6 pt-16 sm:pt-24 pb-16">
        <div className="w-full max-w-sm">

          {/* Header */}
          <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight mb-2 text-center">
            Use this in your
            <br />next interview.
          </h1>
          <p className="text-sm text-white/40 text-center mb-8">
            Share proof before the conversation starts.
          </p>

          {/* Proof card */}
          <div className="rounded-2xl border border-white/10 bg-white/4 overflow-hidden mb-4">

            {/* Identity */}
            <div className="px-5 py-4 border-b border-white/6">
              <p className="text-base font-bold text-white">{CLINICIAN.name}</p>
              <p className="text-xs text-white/40 mt-0.5">{CLINICIAN.specialty}</p>
            </div>

            {/* READY */}
            <div className="px-5 py-4 border-b border-white/6">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/25 mb-3">Ready</p>
              <div className="space-y-2">
                {READY.map(item => (
                  <div key={item} className="flex items-center gap-2.5">
                    <span className="text-emerald-400 text-sm leading-none">✔</span>
                    <span className="text-sm text-white/75">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* BLOCKED */}
            <div className="px-5 py-4 border-b border-white/6">
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/25 mb-3">Blocked</p>
              <div className="space-y-2">
                {BLOCKED.map(item => (
                  <div key={item} className="flex items-center gap-2.5">
                    <span className="text-amber-400 text-sm leading-none">✖</span>
                    <span className="text-sm text-white/75">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Estimated start */}
            <div className="px-5 py-3.5 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/25">
                Estimated start
              </span>
              <span className="text-sm font-bold text-white">~{START}</span>
            </div>

          </div>

          {/* CTA / Share state */}
          {!shared ? (
            <>
              <button
                type="button"
                onClick={() => setShared(true)}
                className="w-full rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 px-5 py-3.5 font-semibold text-white text-sm shadow-[0_0_28px_rgba(16,185,129,0.18)] transition-all active:scale-[0.98]"
              >
                Share with employer
              </button>
              <p className="mt-2.5 text-center text-[11px] text-white/20">
                Generates a signed link · Expires in 24h · No account needed to view
              </p>
            </>
          ) : (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/6 px-4 py-4">
              <p className="text-xs font-semibold text-emerald-400 mb-3">
                Your shareable link
              </p>
              {/* Mock link row */}
              <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/4 px-3 py-2.5 mb-3">
                <span className="flex-1 text-xs text-white/60 truncate font-mono">{MOCK_LINK}</span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="shrink-0 text-[10px] font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="text-[11px] text-white/30 mb-3">
                Demo link — sign in to generate your real proof bundle.
              </p>
              <Link
                href="/get-ready"
                className="block text-center w-full rounded-lg bg-white/8 hover:bg-white/12 px-4 py-2.5 text-xs font-semibold text-white transition-colors"
              >
                Build my real profile →
              </Link>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
