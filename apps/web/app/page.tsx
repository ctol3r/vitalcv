'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { motion, useInView } from 'framer-motion';
import { ArrowRight, Shield, Terminal, Zap, Eye, Link2, CheckCircle2 } from 'lucide-react';
import { useRef } from 'react';
import CountUp from 'react-countup';

import { RevealOnScroll } from '@/components/interaction/RevealOnScroll';
import { MagneticButton } from '@/components/interaction/MagneticButton';
import { TypingHeadline } from '@/components/interaction/TypingHeadline';

// Lazy-load heavy components
const CursorFollower = dynamic(
  () => import('@/components/interaction/CursorFollower').then((m) => ({ default: m.CursorFollower })),
  { ssr: false },
);
const NetworkParticles = dynamic(
  () => import('@/components/interaction/NetworkParticles').then((m) => ({ default: m.NetworkParticles })),
  { ssr: false },
);

/* ── Stat counter with IntersectionObserver trigger ─────────── */
function AnimatedStat({ end, suffix, label }: { end: number; suffix: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.5 });

  return (
    <div ref={ref} className="text-center">
      <p className="font-heading text-4xl font-bold text-[var(--ag-text)] sm:text-5xl">
        {isInView ? <CountUp end={end} duration={2.5} separator="," /> : '0'}
        <span className="text-[var(--ag-primary)]">{suffix}</span>
      </p>
      <p className="mt-2 text-sm text-[var(--ag-text-muted)]">{label}</p>
    </div>
  );
}

/* ── How It Works step ─────────────────────────────────────── */
function Step({
  number,
  title,
  description,
  icon: Icon,
}: {
  number: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="group relative flex flex-col items-center text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--ag-primary)]/10 transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-lg group-hover:shadow-[var(--ag-glow)]">
        <Icon className="h-6 w-6 text-[var(--ag-primary)]" />
      </div>
      <span className="mb-1 text-xs font-bold uppercase tracking-widest text-[var(--ag-accent)]">
        {number}
      </span>
      <h3 className="mb-2 text-lg font-semibold text-[var(--ag-text)]">{title}</h3>
      <p className="text-sm leading-relaxed text-[var(--ag-text-muted)]">{description}</p>
    </div>
  );
}

/* ── Glass card wrapper ────────────────────────────────────── */
function GlassCard({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-[var(--ag-glass-border)] bg-[var(--ag-glass)] p-6 shadow-[var(--ag-shadow-md)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--ag-shadow-lg)] ${className}`}
    >
      {children}
    </div>
  );
}

/* ── Wave 66: Antigravity UI ───────────────────────────────── */
export default function HomePage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[var(--ag-bg)] text-[var(--ag-text)]">
      <CursorFollower />

      {/* ─── 1. HERO ─────────────────────────────────────────── */}
      <section className="relative flex min-h-[90vh] items-center overflow-hidden px-6 pt-28 pb-20 sm:pt-36 sm:pb-28">
        {/* Particle background */}
        <div className="absolute inset-0" style={{ zIndex: 0 }}>
          <NetworkParticles />
        </div>

        {/* Ambient gradient */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'var(--ag-gradient-hero)', zIndex: 1 }}
          aria-hidden="true"
        />

        <div className="relative z-10 mx-auto max-w-5xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            {/* Eyebrow */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--ag-primary)]/15 bg-[var(--ag-primary)]/5 px-4 py-1.5">
              <Shield className="h-3.5 w-3.5 text-[var(--ag-primary)]" />
              <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-[var(--ag-primary)]">
                Zero-Trust Credentialing
              </span>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
          >
            <TypingHeadline />
          </motion.div>

          <motion.p
            className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[var(--ag-text-muted)]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            VitalCV automates primary source verification, anchors it to a
            zero-trust ledger, and continuously monitors compliance — so you
            can hire instantly.
          </motion.p>

          {/* CTAs */}
          <motion.div
            className="mt-10 flex flex-wrap items-center justify-center gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <MagneticButton className="bg-[var(--ag-primary)] px-8 py-3.5 text-sm text-white hover:bg-[var(--ag-primary-light)]">
              <Link href="/demo" className="flex items-center gap-2">
                Try VitalCV
                <ArrowRight className="h-4 w-4" />
              </Link>
            </MagneticButton>
            <MagneticButton className="border border-[var(--ag-border)] bg-white/80 px-8 py-3.5 text-sm text-[var(--ag-text)] backdrop-blur hover:bg-white">
              <Link href="/developers" className="flex items-center gap-2">
                <Terminal className="h-4 w-4" />
                API Docs
              </Link>
            </MagneticButton>
          </motion.div>

          {/* Trust badges */}
          <motion.div
            className="mt-8 flex flex-wrap items-center justify-center gap-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.7 }}
          >
            {['SOC 2', 'HIPAA', 'NCQA', 'ES256'].map((badge) => (
              <span
                key={badge}
                className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ag-text-subtle)]"
              >
                <Shield className="h-3 w-3" />
                {badge}
              </span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── 2. TRUST PREVIEW ────────────────────────────────── */}
      <section className="relative px-6 py-20">
        <div className="mx-auto max-w-5xl">
          <RevealOnScroll>
            <GlassCard className="mx-auto max-w-3xl overflow-hidden">
              <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
                {/* Trust score ring */}
                <div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
                  <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50" cy="50" r="42"
                      fill="none"
                      stroke="var(--ag-bg-alt)"
                      strokeWidth="6"
                    />
                    <circle
                      cx="50" cy="50" r="42"
                      fill="none"
                      stroke="var(--ag-accent)"
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray="264"
                      strokeDashoffset="40"
                      className="transition-all duration-1000"
                    />
                  </svg>
                  <span className="absolute text-2xl font-bold text-[var(--ag-text)]">
                    94
                  </span>
                </div>

                <div className="flex-1 text-center sm:text-left">
                  <h3 className="text-xl font-semibold text-[var(--ag-text)]">
                    Composite Trust Score
                  </h3>
                  <p className="mt-1 text-sm text-[var(--ag-text-muted)]">
                    Real-time aggregation of license status, board certification,
                    exclusion checks, and continuous monitoring signals.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {[
                      { label: 'License Active', color: 'bg-emerald-100 text-emerald-700' },
                      { label: 'Board Certified', color: 'bg-blue-100 text-blue-700' },
                      { label: 'No Exclusions', color: 'bg-teal-100 text-teal-700' },
                      { label: 'Monitoring Active', color: 'bg-amber-100 text-amber-700' },
                    ].map((tag) => (
                      <span
                        key={tag.label}
                        className={`rounded-full px-3 py-1 text-xs font-medium ${tag.color}`}
                      >
                        {tag.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </GlassCard>
          </RevealOnScroll>
        </div>
      </section>

      {/* ─── 3. NETWORK ACTIVITY ─────────────────────────────── */}
      <section className="relative overflow-hidden border-y border-[var(--ag-border)] bg-[var(--ag-bg-alt)] py-4">
        {/* Fade edges */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-[var(--ag-bg-alt)] to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-[var(--ag-bg-alt)] to-transparent" />

        <motion.div
          className="flex w-max gap-8"
          animate={{ x: ['0%', '-50%'] }}
          transition={{ x: { duration: 45, repeat: Infinity, ease: 'linear' } }}
        >
          {[
            { hash: '0x7f3a…9bc1', event: 'CA Medical License Verified', accent: 'text-emerald-600' },
            { hash: '0x4be2…11d0', event: 'Start Attestation Anchored', accent: 'text-blue-600' },
            { hash: '0x9a17…f3c8', event: 'NPDB Check Cleared', accent: 'text-emerald-600' },
            { hash: '0xc41b…7ea9', event: 'DEA Registration Confirmed', accent: 'text-emerald-600' },
            { hash: '0x2d8f…c4a2', event: 'Board Certification Verified', accent: 'text-blue-600' },
            { hash: '0xe573…0b17', event: 'OIG/LEIE Exclusion Passed', accent: 'text-emerald-600' },
            { hash: '0x88a1…d9f5', event: 'TX-TMB License Verified', accent: 'text-emerald-600' },
            { hash: '0x3fc9…2e84', event: 'Merkle Root Published', accent: 'text-violet-600' },
            { hash: '0x7f3a…9bc1', event: 'CA Medical License Verified', accent: 'text-emerald-600' },
            { hash: '0x4be2…11d0', event: 'Start Attestation Anchored', accent: 'text-blue-600' },
            { hash: '0x9a17…f3c8', event: 'NPDB Check Cleared', accent: 'text-emerald-600' },
            { hash: '0xc41b…7ea9', event: 'DEA Registration Confirmed', accent: 'text-emerald-600' },
            { hash: '0x2d8f…c4a2', event: 'Board Certification Verified', accent: 'text-blue-600' },
            { hash: '0xe573…0b17', event: 'OIG/LEIE Exclusion Passed', accent: 'text-emerald-600' },
            { hash: '0x88a1…d9f5', event: 'TX-TMB License Verified', accent: 'text-emerald-600' },
            { hash: '0x3fc9…2e84', event: 'Merkle Root Published', accent: 'text-violet-600' },
          ].map((item, i) => (
            <div key={`${item.hash}-${i}`} className="flex shrink-0 items-center gap-3">
              <Shield className="h-3 w-3 text-[var(--ag-text-subtle)]" />
              <span className="font-mono text-[11px] text-[var(--ag-text-subtle)]">
                [{item.hash}]
              </span>
              <span className={`text-xs font-medium ${item.accent}`}>
                {item.event}
              </span>
            </div>
          ))}
        </motion.div>
      </section>

      {/* ─── 4. HOW IT WORKS ─────────────────────────────────── */}
      <section className="px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-5xl">
          <RevealOnScroll>
            <div className="mb-16 text-center">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.3em] text-[var(--ag-accent)]">
                How It Works
              </p>
              <h2
                className="font-heading font-bold tracking-tight text-[var(--ag-text)]"
                style={{ fontSize: 'var(--ag-text-section)' }}
              >
                Three steps to instant trust
              </h2>
            </div>
          </RevealOnScroll>

          <div className="grid gap-12 sm:grid-cols-3">
            <RevealOnScroll delay={0}>
              <Step
                number="01"
                title="Upload Credentials"
                description="Clinicians submit documents or we pull directly from primary sources via API. Zero manual data entry."
                icon={Zap}
              />
            </RevealOnScroll>
            <RevealOnScroll delay={0.15}>
              <Step
                number="02"
                title="Automated Verification"
                description="Our engines query NPPES, state boards, NPDB, OIG/LEIE, and DEA. Every claim verified at origin."
                icon={Eye}
              />
            </RevealOnScroll>
            <RevealOnScroll delay={0.3}>
              <Step
                number="03"
                title="Continuous Monitoring"
                description="A background daemon watches for license changes, exclusions, and adverse actions 24/7. Instant alerts."
                icon={Shield}
              />
            </RevealOnScroll>
          </div>
        </div>
      </section>

      {/* ─── 5. METRICS ──────────────────────────────────────── */}
      <section className="border-y border-[var(--ag-border)] bg-[var(--ag-bg-alt)] px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <RevealOnScroll>
            <div className="grid gap-8 sm:grid-cols-4">
              <AnimatedStat end={94} suffix="%" label="Trust Score Average" />
              <AnimatedStat end={3} suffix="min" label="Avg Verification Time" />
              <AnimatedStat end={50} suffix="+" label="State Boards Connected" />
              <AnimatedStat end={99} suffix=".9%" label="Uptime SLA" />
            </div>
          </RevealOnScroll>
        </div>
      </section>

      {/* ─── 6. GRAPH PREVIEW ────────────────────────────────── */}
      <section className="px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-5xl">
          <RevealOnScroll>
            <div className="mb-16 text-center">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.3em] text-[var(--ag-accent)]">
                Trust Graph
              </p>
              <h2
                className="font-heading font-bold tracking-tight text-[var(--ag-text)]"
                style={{ fontSize: 'var(--ag-text-section)' }}
              >
                A living knowledge graph of trust
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-[var(--ag-text-muted)]">
                Every credential, verification event, and monitoring signal feeds into
                an authority-bound knowledge graph that reasons over compliance in real time.
              </p>
            </div>
          </RevealOnScroll>

          <RevealOnScroll delay={0.2}>
            <GlassCard className="relative overflow-hidden p-8">
              {/* Graph nodes visualization */}
              <div className="flex items-center justify-center gap-8">
                {[
                  { label: 'Clinician', color: 'bg-blue-500' },
                  { label: 'License', color: 'bg-emerald-500' },
                  { label: 'Board Cert', color: 'bg-teal-500' },
                  { label: 'Exclusion', color: 'bg-amber-500' },
                  { label: 'Employer', color: 'bg-violet-500' },
                ].map((node, i) => (
                  <motion.div
                    key={node.label}
                    className="flex flex-col items-center gap-2"
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1, type: 'spring', stiffness: 100 }}
                  >
                    <motion.div
                      className={`h-10 w-10 rounded-full ${node.color} opacity-80 sm:h-14 sm:w-14`}
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 3, delay: i * 0.5, repeat: Infinity }}
                    />
                    <span className="text-[10px] font-medium text-[var(--ag-text-muted)] sm:text-xs">
                      {node.label}
                    </span>
                  </motion.div>
                ))}
              </div>

              {/* Connection lines hint */}
              <div className="mt-6 flex items-center justify-center gap-2 text-xs text-[var(--ag-text-subtle)]">
                <Link2 className="h-3.5 w-3.5" />
                <span>12 verified connections &middot; 3 active monitors &middot; 1 trust anchor</span>
              </div>
            </GlassCard>
          </RevealOnScroll>
        </div>
      </section>

      {/* ─── 7. CTA ──────────────────────────────────────────── */}
      <section className="px-6 py-24 sm:py-32">
        <RevealOnScroll>
          <div className="mx-auto max-w-3xl text-center">
            <h2
              className="font-heading font-bold tracking-tight text-[var(--ag-text)]"
              style={{ fontSize: 'var(--ag-text-section)' }}
            >
              Ready to eliminate credentialing delays?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-[var(--ag-text-muted)]">
              Join healthcare organizations that have cut onboarding from months to minutes
              with cryptographic trust infrastructure.
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <MagneticButton className="bg-[var(--ag-primary)] px-8 py-3.5 text-sm text-white hover:bg-[var(--ag-primary-light)]">
                <Link href="/demo" className="flex items-center gap-2">
                  Request Demo
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </MagneticButton>
              <MagneticButton className="border border-[var(--ag-border)] bg-white/80 px-8 py-3.5 text-sm text-[var(--ag-text)] backdrop-blur hover:bg-white">
                <Link href="/developers" className="flex items-center gap-2">
                  <Terminal className="h-4 w-4" />
                  Explore API
                </Link>
              </MagneticButton>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-sm text-[var(--ag-text-muted)]">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-[var(--ag-accent)]" />
                Free pilot program
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-[var(--ag-accent)]" />
                SOC 2 compliant
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-[var(--ag-accent)]" />
                HIPAA ready
              </span>
            </div>
          </div>
        </RevealOnScroll>
      </section>

      {/* ─── 8. FOOTER ───────────────────────────────────────── */}
      <footer className="border-t border-[var(--ag-border)] px-6 py-12">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-heading text-lg font-semibold text-[var(--ag-text)]">
              VitalCV
            </p>
            <p className="mt-1 text-xs text-[var(--ag-text-subtle)]">
              Trust infrastructure for healthcare credentialing.
            </p>
          </div>
          <div className="flex flex-wrap gap-6 text-sm text-[var(--ag-text-muted)]">
            <Link href="/developers" className="transition-colors hover:text-[var(--ag-primary)]">
              Developers
            </Link>
            <Link href="/demo" className="transition-colors hover:text-[var(--ag-primary)]">
              Demo
            </Link>
            <Link href="/holder" className="transition-colors hover:text-[var(--ag-primary)]">
              Clinicians
            </Link>
            <Link href="/verifier" className="transition-colors hover:text-[var(--ag-primary)]">
              Employers
            </Link>
          </div>
          <p className="text-xs text-[var(--ag-text-subtle)]">
            &copy; {new Date().getFullYear()} VitalCV. All rights reserved.
          </p>
        </div>
      </footer>
    </main>
  );
}
