import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, Stethoscope, Building2 } from 'lucide-react';

/**
 * DualAudienceCta — the Anyscale/Palantir dual pre-footer: two clear entrances,
 * clinician and employer, so the page serves both sides of the marketplace
 * without muddying the single-purpose hero. Honest: no "pilot" language (pilots
 * are not yet enrolling); the employer preserves final credentialing authority.
 */
export function DualAudienceCta() {
  return (
    <section aria-label="Get started" data-home-dual-cta="" className="mz mt-16 grid gap-4 md:grid-cols-2">
      {/* Clinician */}
      <div className="flex flex-col rounded-[14px] border border-[var(--vt-border)] bg-[var(--vt-surface)] p-7">
        <span className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-[var(--vt-surface-subtle)] text-[var(--vt-text-primary)]">
          <Stethoscope size={18} aria-hidden="true" />
        </span>
        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--vt-text-muted)]">
          Clinicians
        </p>
        <h3 className="mt-2 text-[22px] font-semibold leading-tight text-[var(--vt-text-primary)]">
          See what&rsquo;s already connected to your identity
        </h3>
        <p className="mt-2 flex-1 text-[14px] leading-relaxed text-[var(--vt-text-secondary)]">
          Enter your NPI and read the evidence today — free, no account required.
        </p>
        <Link
          href="/#npi"
          className="mt-5 inline-flex w-fit items-center gap-2 rounded-[6px] px-4 py-2.5 text-[14px] font-semibold text-white"
          style={{ backgroundColor: 'var(--vt-text-primary)' }}
        >
          Check my readiness
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>

      {/* Employer */}
      <div className="flex flex-col rounded-[14px] border border-[var(--vt-border)] bg-[var(--vt-surface-subtle)] p-7">
        <span className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-[var(--vt-surface)] text-[var(--vt-text-primary)]">
          <Building2 size={18} aria-hidden="true" />
        </span>
        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--vt-text-muted)]">
          Employers
        </p>
        <h3 className="mt-2 text-[22px] font-semibold leading-tight text-[var(--vt-text-primary)]">
          Start review from evidence, not intake
        </h3>
        <p className="mt-2 flex-1 text-[14px] leading-relaxed text-[var(--vt-text-secondary)]">
          Open a candidate&rsquo;s source-backed packet and act on what&rsquo;s ready — you keep
          final credentialing authority.
        </p>
        <Link
          href="/employers"
          className="mt-5 inline-flex w-fit items-center gap-2 rounded-[6px] border border-[var(--vt-text-primary)] px-4 py-2.5 text-[14px] font-semibold text-[var(--vt-text-primary)] transition-colors hover:bg-[var(--vt-surface)]"
        >
          For employers
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

export default DualAudienceCta;
