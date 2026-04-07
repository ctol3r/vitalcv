'use client';

/**
 * SandboxHero — brutalist hero section with NPI input and readiness preview.
 *
 * The shared Navbar (layout/Navbar.tsx) provides the header for all public pages.
 * This component only renders the hero content below it.
 */

import React, { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Shield, AlertCircle, FileText, Activity, Database, ShieldAlert } from 'lucide-react';

export function SandboxHero() {
  const router = useRouter();
  const [npi, setNpi] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    if (npi.length !== 10) {
      setError('NPI must be 10 digits.');
      return;
    }
    setLoading(true);
    setError(null);
    router.push(`/passport/${npi}`);
  };

  const handlePreviewClick = () => {
    const targetNpi = npi.length === 10 ? npi : '1003000126';
    router.push(`/passport/${targetNpi}`);
  };

  const isPlaceholder = !npi || npi.length !== 10;
  const displayNpi = isPlaceholder ? '1003000126' : npi;

  return (
    <section className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6 md:px-12 py-16 md:py-24 max-w-5xl w-full mx-auto">
      {/* Heading */}
      <h1 className="text-4xl md:text-6xl font-bold tracking-tighter mb-6 max-w-2xl uppercase text-[var(--vt-text-primary)]">
        Check clinician{' '}
        <span className="italic font-serif font-medium opacity-80">readiness</span>{' '}
        in seconds.
      </h1>
      <p className="text-lg opacity-60 mb-12 max-w-xl text-[var(--vt-text-primary)]">
        Source-backed truth for you and the employers you choose. Enter your NPI to start.
      </p>

      {/* NPI Input */}
      <form onSubmit={handleSearch} className="w-full max-w-md relative">
        <label htmlFor="npi-input" className="sr-only">NPI number (10 digits)</label>
        <input
          id="npi-input"
          type="text"
          value={npi}
          onChange={(e) => setNpi(e.target.value.replace(/\D/g, '').slice(0, 10))}
          placeholder="ENTER 10-DIGIT NPI"
          className="w-full bg-transparent border-b-2 border-[var(--vt-border)] py-4 px-2 text-2xl font-mono focus:outline-none focus:border-[var(--vt-accent)] transition-colors placeholder:opacity-20 uppercase text-[var(--vt-text-primary)]"
          aria-describedby={error ? 'npi-error' : undefined}
        />
        <button
          type="submit"
          disabled={loading || npi.length !== 10}
          className="absolute right-0 bottom-4 p-2 disabled:opacity-20 hover:scale-110 transition-transform text-[var(--vt-text-primary)]"
          aria-label="Submit NPI"
        >
          {loading ? (
            <div className="w-6 h-6 border-2 border-[var(--vt-accent)] border-t-transparent rounded-full animate-spin" />
          ) : (
            <ArrowRight className="w-6 h-6" />
          )}
        </button>
        {error && <p id="npi-error" role="alert" className="text-xs text-red-500 mt-2 text-left absolute -bottom-6">{error}</p>}
      </form>

      {/* Source Icons */}
      <div className="mt-24 grid grid-cols-2 md:grid-cols-4 gap-8 opacity-40 grayscale text-[var(--vt-text-primary)]">
        <div className="flex flex-col items-center gap-2">
          <Shield className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-widest">NPPES</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-widest">OIG/LEIE</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <FileText className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-widest">PECOS</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <Activity className="w-5 h-5" />
          <span className="text-[10px] font-bold uppercase tracking-widest">FSMB</span>
        </div>
      </div>

      {/* ReadinessPreview card */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Preview readiness check — continue to passport"
        className="mt-24 w-full max-w-3xl border border-[var(--vt-border)] p-8 bg-white/10 dark:bg-white/5 text-left relative group cursor-pointer hover:bg-white/20 dark:hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        onClick={handlePreviewClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handlePreviewClick(); } }}
      >
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-xl font-bold tracking-tight text-[var(--vt-text-primary)]">Check Readiness</h3>
              <span className="text-[8px] font-mono bg-amber-500/10 text-amber-600 px-1.5 py-0.5 border border-amber-500/20 uppercase tracking-tighter">
                Informational Only
              </span>
            </div>
            <p className="text-xs opacity-60 font-mono uppercase tracking-tight text-[var(--vt-text-primary)]">
              {isPlaceholder ? 'Identity Resolution Pending' : `NPI: ${displayNpi}`}
            </p>
          </div>
          <div className="text-[10px] font-bold uppercase tracking-widest border border-[var(--vt-border)] px-2 py-1 flex items-center gap-2 text-[var(--vt-text-primary)]">
            <Database className="w-3 h-3 opacity-40" />
            Public Record Check
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 opacity-60 font-mono text-[var(--vt-text-primary)]">
          <div className="border border-[var(--vt-border)] p-3 bg-white/10 dark:bg-white/5">
            <div className="text-[8px] font-bold uppercase tracking-widest opacity-40 mb-1">Identity</div>
            <div className="text-[10px] font-bold">VERIFIED</div>
          </div>
          <div className="border border-[var(--vt-border)] p-3 bg-white/10 dark:bg-white/5">
            <div className="text-[8px] font-bold uppercase tracking-widest opacity-40 mb-1">Sanctions</div>
            <div className="text-[10px] font-bold">CLEAR</div>
          </div>
          <div className="border border-[var(--vt-border)] p-3 bg-white/10 dark:bg-white/5">
            <div className="text-[8px] font-bold uppercase tracking-widest opacity-40 mb-1">Licensure</div>
            <div className="text-[10px] font-bold">CHECKED</div>
          </div>
          <div className="border border-[var(--vt-border)] p-3 bg-white/10 dark:bg-white/5">
            <div className="text-[8px] font-bold uppercase tracking-widest opacity-40 mb-1">Readiness</div>
            <div className="text-[10px] font-bold">84%</div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between text-[var(--vt-text-primary)]">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest group-hover:gap-4 transition-all">
            Continue to Passport <ArrowRight className="w-3 h-3" />
          </div>
          <div className="flex items-center gap-2 text-[8px] font-mono opacity-30 uppercase tracking-tighter">
            <ShieldAlert className="w-3 h-3" />
            No PII Transmitted in Preview Mode
          </div>
        </div>
      </div>

      {/* Explore Section */}
      <div className="mt-32 w-full max-w-5xl text-left border-t border-[var(--vt-border)] pt-12 text-[var(--vt-text-primary)]">
        <h3 className="text-xs font-bold uppercase tracking-[0.2em] opacity-40 mb-8">One Record, Three Uses</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="border border-[var(--vt-border)] p-6 hover:bg-white/10 dark:hover:bg-white/5 transition-colors group">
            <div className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-4 border border-[var(--vt-border)] inline-block px-2 py-1">For Clinicians</div>
            <h4 className="text-sm font-bold uppercase tracking-widest mb-2 group-hover:underline underline-offset-4">Own your credentials</h4>
            <p className="text-[10px] opacity-60 font-mono leading-relaxed">
              Generate your portable passport from federal sources. Share it once, and get hired in days instead of months.
            </p>
          </div>
          <Link href="/review/1003000126" className="border border-[var(--vt-border)] p-6 hover:bg-white/10 dark:hover:bg-white/5 transition-colors group block">
            <div className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-4 border border-[var(--vt-border)] inline-block px-2 py-1">For Employers</div>
            <h4 className="text-sm font-bold uppercase tracking-widest mb-2 group-hover:underline underline-offset-4">Make faster decisions</h4>
            <p className="text-[10px] opacity-60 font-mono leading-relaxed">
              Stop chasing missing documents. Review a source-backed decision posture and accept candidates immediately.
            </p>
          </Link>
          <div className="border border-[var(--vt-border)] p-6 hover:bg-white/10 dark:hover:bg-white/5 transition-colors group">
            <div className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-4 border border-[var(--vt-border)] inline-block px-2 py-1">For Ops & Partners</div>
            <h4 className="text-sm font-bold uppercase tracking-widest mb-2 group-hover:underline underline-offset-4">Integrate the Truth Layer</h4>
            <p className="text-[10px] opacity-60 font-mono leading-relaxed">
              Embed readiness scores directly into your ATS or credentialing system via our developer API.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
