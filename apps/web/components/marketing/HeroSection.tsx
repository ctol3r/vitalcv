/**
 * HeroSection — Wave 11: Antigravity Aesthetic
 *
 * Extracted + upgraded from the inline hero in app/page.tsx.
 * - tracking-tighter on H1 for a premium, editorial feel
 * - Massive 120px-blur bioluminescent backlight behind HeroAppPreview
 * - 3D isometric HeroAppPreview embedded beneath the CTAs
 *
 * This component is a server component — only HeroAppPreview (imported
 * as a client component boundary) uses client hooks.
 */

import Link from 'next/link';
import { ArrowRight, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NpiLookupInput } from '@/components/marketing/NpiLookupInput';
import { HeroAppPreview } from '@/components/marketing/HeroAppPreview';

export function HeroSection() {
  return (
    <section className="relative overflow-hidden pt-20 pb-32 px-6">
      {/* ── Hero copy ──────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--warm-charcoal)]/10 text-xs font-semibold uppercase tracking-widest text-[var(--mist-blue)] mb-8 bg-[var(--mist-blue)]/5">
          Infrastructure for Healthcare Credentialing
        </div>

        {/* H1 — tracking-tighter for editorial precision */}
        <h1 className="font-fraunces text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tighter text-[var(--warm-charcoal)] leading-[1.05]">
          Verified Once.
          <br className="hidden sm:block" />
          Accepted Everywhere.
        </h1>

        <p className="mt-6 text-lg md:text-xl text-[var(--warm-charcoal)]/70 max-w-2xl mx-auto leading-relaxed">
          VitalCV generates audit-ready credential artifacts that eliminate redundant
          primary source verification and reduce clinician onboarding from{' '}
          <span className="font-semibold text-[var(--warm-charcoal)]">months to days.</span>
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button asChild size="lg" className="gap-2 px-10 py-5 text-base">
            <Link href="/demo">
              Run Live Demo
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="gap-2 px-10 py-5 text-base">
            <Link href="/verifier">
              For Employers
              <Building2 className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="mt-6">
          <NpiLookupInput />
        </div>
      </div>

      {/* ── 3D App Preview + bioluminescent backlight ──────── */}
      <div className="relative mt-16 mx-auto max-w-4xl">
        {/* Bioluminescent glow — large, highly blurred, slow-breathing ellipse */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 animate-glow-breathe"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 50% 50%, oklch(0.68 0.12 180 / 0.22), transparent 70%)',
            filter: 'blur(120px)',
            transform: 'translateY(10%)',
          }}
        />
        {/* Secondary warm accent glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-10 left-1/4 right-1/4 z-0 h-40"
          style={{
            background:
              'radial-gradient(ellipse at center, oklch(0.65 0.14 155 / 0.12), transparent 70%)',
            filter: 'blur(60px)',
          }}
        />

        {/* The 3D isometric app preview — client component */}
        <div className="relative z-10">
          <HeroAppPreview />
        </div>
      </div>
    </section>
  );
}
