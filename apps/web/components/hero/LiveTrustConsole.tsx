'use client';

/**
 * LiveTrustConsole — Hero
 *
 * Doctrine: one headline, one input, one CTA.
 * No columns, no animated pipeline, no stats strip.
 * NPI input IS the primary interaction — submit routes to /get-ready?npi=...
 * Full-width single column so input + button are visible immediately on mobile.
 */

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

export function LiveTrustConsole() {
  const [npi, setNpi] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const dest =
      /^\d{10}$/.test(npi.trim())
        ? `/get-ready?npi=${npi.trim()}`
        : '/get-ready';
    router.push(dest);
  }

  return (
    <section
      className="relative"
      style={{ background: '#080e1a' }}
    >
      {/* Subtle radial — no green wash above fold */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 55% 40% at 50% 45%, rgba(16,185,129,0.05) 0%, transparent 70%)',
        }}
      />

      <div className="relative z-10 mx-auto w-full max-w-xl px-4 sm:px-6 pt-16 sm:pt-20 pb-14 sm:pb-18">

        {/* Headline */}
        <h1 className="text-[clamp(2rem,5vw,3.5rem)] font-bold leading-[1.08] tracking-tight text-white mb-4">
          Get cleared to work
          <br />
          <span className="text-emerald-400">in hours, not months.</span>
        </h1>

        {/* Subline */}
        <p className="text-sm sm:text-base text-white/50 mb-8 leading-relaxed">
          Your credentials verified once. Accepted everywhere.
        </p>

        {/* NPI input + single CTA */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            maxLength={10}
            value={npi}
            onChange={e => setNpi(e.target.value.replace(/\D/g, ''))}
            placeholder="Enter your NPI number"
            aria-label="NPI number"
            className="flex-1 min-w-0 rounded-xl border border-white/12 bg-white/5 px-4 py-3.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500/40 focus:bg-white/7 transition-colors"
          />
          <button
            type="submit"
            className="shrink-0 rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 px-5 py-3.5 font-semibold text-white text-sm shadow-[0_0_28px_rgba(16,185,129,0.2)] transition-all active:scale-95 whitespace-nowrap"
          >
            Get Verified
          </button>
        </form>

        <p className="mt-3 text-[11px] text-white/25">
          No login required to preview · Under 24 hours
        </p>

      </div>
    </section>
  );
}
