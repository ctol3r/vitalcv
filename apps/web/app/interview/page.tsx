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

// ── Share confirmation mock ───────────────────────────────────

const SHARE_RECIPIENT = 'Kaiser Permanente';

// ── Share confirmation ────────────────────────────────────────

function ShareConfirmation({ recipient, sharedAt }: { recipient: string; sharedAt: Date }) {
  const time = sharedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  return (
    <div
      className="rounded-xl border border-emerald-500/25 bg-emerald-500/6 px-5 py-5"
      style={{ animation: 'fade-in-up 0.25s ease-out both' }}
    >
      {/* Check mark */}
      <div className="flex justify-center mb-4">
        <div className="h-10 w-10 rounded-full border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-center">
          <span className="text-emerald-400 text-lg leading-none">✓</span>
        </div>
      </div>

      {/* Rows */}
      <div className="space-y-3 mb-4">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/25">Shared with</span>
          <span className="text-sm font-semibold text-white">{recipient}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/25">Time</span>
          <span className="text-sm text-white/70">Just now · {time}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/25">Status</span>
          <span className="flex items-center gap-1.5 text-sm font-semibold text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Delivered
          </span>
        </div>
      </div>

      <div className="border-t border-white/6 pt-4">
        <Link
          href="/get-ready"
          className="block text-center w-full rounded-lg bg-white/6 hover:bg-white/10 px-4 py-2.5 text-xs font-semibold text-white/70 hover:text-white transition-colors"
        >
          Build my real profile →
        </Link>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────

export default function InterviewPage() {
  const [shared, setShared] = useState(false);
  const [sharedAt, setSharedAt] = useState<Date | null>(null);

  function handleShare() {
    setSharedAt(new Date());
    setShared(true);
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

          {/* CTA / Confirmation */}
          {!shared ? (
            <>
              <button
                type="button"
                onClick={handleShare}
                className="w-full rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 px-5 py-3.5 font-semibold text-white text-sm shadow-[0_0_28px_rgba(16,185,129,0.18)] transition-all active:scale-[0.98]"
              >
                Share with employer
              </button>
              <p className="mt-2.5 text-center text-[11px] text-white/20">
                Generates a signed link · Expires in 24h · No account needed to view
              </p>
            </>
          ) : (
            <ShareConfirmation recipient={SHARE_RECIPIENT} sharedAt={sharedAt!} />
          )}

        </div>
      </div>
    </div>
  );
}
