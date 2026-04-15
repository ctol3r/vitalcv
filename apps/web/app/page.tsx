import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CheckCircle2, FileCheck, Play, ShieldCheck } from 'lucide-react';
import HomePageClient from './HomePageClient';
import { PassportPreviewCard } from '@/components/passport/PassportPreviewCard';

export const metadata: Metadata = {
  title: { absolute: 'VitalCV — Stop Starting Over. Start Ready.' },
  description:
    'Enter your NPI to see what\'s checked, what\'s missing, and what could delay your next role — using real federal sources. Credential readiness infrastructure for healthcare.',
  openGraph: {
    title: 'VitalCV — Stop Starting Over. Start Ready.',
    description:
      'Enter your NPI to see what\'s checked, what\'s missing, and what could delay your next role. Credential readiness infrastructure.',
    url: 'https://vitalcv.com',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VitalCV — Stop Starting Over. Start Ready.',
    description:
      'Enter your NPI to see what\'s checked, what\'s missing, and what could delay your next role. Credential readiness infrastructure.',
  },
};

export default function HomePage() {
  return (
    <>
      <div className="relative">
        <HomePageClient />
        {/* Right-side hero passport preview — desktop only, no data side-effects.
            Shows at lg breakpoint (≥1024px) where there is reliably whitespace
            next to the hero. Subtle entrance animation composes with the existing
            keyframe library. */}
        <aside
          aria-label="Sample passport preview"
          className="pointer-events-none absolute right-6 top-24 hidden w-[360px] animate-fade-in-up lg:block"
          style={{ animationDelay: '120ms' }}
        >
          <div className="pointer-events-auto">
            <PassportPreviewCard demo />
          </div>
        </aside>
      </div>

      {/* ─── Below-the-fold — three sections, exactly ─────────────── */}

      {/* Section 1 — How it works: Check → Prove → Start */}
      <section
        aria-labelledby="how-it-works-heading"
        className="border-t border-border bg-background px-4 py-16 sm:py-24"
      >
        <div className="mx-auto w-full max-w-5xl">
          <h2
            id="how-it-works-heading"
            className="text-foreground text-2xl sm:text-3xl font-semibold tracking-tight"
          >
            How it works
          </h2>
          <p className="mt-3 max-w-xl text-sm text-muted-foreground">
            One inevitable flow: verify against the sources that actually decide, prove it to the employer that actually needs it, start the role you&apos;re actually ready for.
          </p>

          <ol className="mt-10 grid gap-5 sm:grid-cols-3">
            {[
              {
                step: '01',
                icon: CheckCircle2,
                title: 'Check',
                body: 'Enter your NPI. VitalCV queries NPPES, OIG/LEIE, and CMS PECOS against real federal records. No self-attestation.',
              },
              {
                step: '02',
                icon: ShieldCheck,
                title: 'Prove',
                body: 'Your passport snapshot is an inspectable object — source, status, timestamp, limitation — not a branded score.',
              },
              {
                step: '03',
                icon: Play,
                title: 'Start',
                body: 'Share the snapshot with an employer or hiring system. No second round of document chase-downs.',
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <li
                  key={item.step}
                  className="rounded-2xl border border-border bg-card p-5"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono text-muted-foreground/60 tracking-widest">
                      {item.step}
                    </span>
                    <Icon aria-hidden="true" className="h-4 w-4 text-foreground/70" />
                  </div>
                  <h3 className="mt-3 text-base font-semibold text-foreground">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    {item.body}
                  </p>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* Section 2 — Trust strip: the actual sources used */}
      <section
        aria-labelledby="sources-heading"
        className="border-t border-border bg-muted/30 px-4 py-12"
      >
        <div className="mx-auto w-full max-w-5xl">
          <h2
            id="sources-heading"
            className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
          >
            Sources checked
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {[
              {
                name: 'NPPES',
                long: 'National Plan & Provider Enumeration System',
                scope: 'Identity',
              },
              {
                name: 'OIG / LEIE',
                long: 'Office of Inspector General — List of Excluded Individuals',
                scope: 'Safety',
              },
              {
                name: 'CMS PECOS',
                long: 'Provider Enrollment, Chain, and Ownership System',
                scope: 'Enrollment',
              },
            ].map((src) => (
              <div
                key={src.name}
                className="flex items-start gap-3 rounded-xl border border-border bg-card px-4 py-3"
              >
                <ShieldCheck
                  aria-hidden="true"
                  className="mt-0.5 h-4 w-4 shrink-0 text-foreground/60"
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {src.name}
                  </p>
                  <p className="text-xs text-muted-foreground/80 mt-0.5 leading-snug">
                    {src.long}
                  </p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                    {src.scope}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-5 text-[11px] text-muted-foreground/60 leading-relaxed">
            Only publicly available federal and state data. No PHI. No self-attested claims promoted to verified status.
          </p>
        </div>
      </section>

      {/* Section 3 — Product snapshot: the passport object itself */}
      <section
        aria-labelledby="product-snapshot-heading"
        className="border-t border-border bg-background px-4 py-16 sm:py-20"
      >
        <div className="mx-auto grid w-full max-w-5xl gap-10 lg:grid-cols-[1fr_380px] lg:items-center">
          <div>
            <h2
              id="product-snapshot-heading"
              className="text-foreground text-2xl sm:text-3xl font-semibold tracking-tight"
            >
              An inspectable object, not a score
            </h2>
            <p className="mt-3 max-w-lg text-sm text-muted-foreground leading-relaxed">
              Each row is a real check against a real source. Status, timestamp, and any limitation are exposed — so employers can trust what they see, and clinicians can see what employers will trust.
            </p>
            <ul className="mt-6 space-y-2 text-sm text-foreground/80">
              {[
                'Source attribution on every claim',
                'Timestamp of the last completed check',
                'Explicit blockers — not glossed',
                'Access-required sources are marked, not hidden',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <FileCheck
                    aria-hidden="true"
                    className="mt-0.5 h-4 w-4 shrink-0 text-foreground/50"
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/passport"
              className="mt-7 inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-xs font-semibold text-background transition-opacity hover:opacity-90"
            >
              See your snapshot
              <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div>
            <PassportPreviewCard demo />
          </div>
        </div>
      </section>
    </>
  );
}
