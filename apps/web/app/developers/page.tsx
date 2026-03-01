/**
 * Developer Portal — Wave 30: The API Wedge
 *
 * Wide-canvas, Stripe-tier developer dashboard using the Antigravity Aesthetic:
 * tactile grain (from layout.tsx), dark glass surfaces, emerald glow accents.
 *
 * Server component — all three panels are client components with their own
 * 'use client' boundaries, so this page itself has zero hydration risk.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  Code2,
  GitBranch,
  Globe,
  Lock,
  Webhook,
  Zap,
} from 'lucide-react';
import { ApiKeyManager } from '@/components/developers/ApiKeyManager';
import { ApiSandbox } from '@/components/developers/ApiSandbox';
import { WebhookLog } from '@/components/developers/WebhookLog';
import { DropInSection } from '@/components/developers/DropInSection';

export const metadata: Metadata = {
  title: 'Developer Portal | VitalCV',
  description:
    'Build hospital integrations on top of the VitalCV Trust Protocol. API keys, interactive sandbox, and live webhook testing.',
};

// ── Quick-stat cards ──────────────────────────────────────────────────────

const STATS = [
  { icon: Zap,      label: 'Avg. Response',  value: '< 80 ms' },
  { icon: Globe,    label: 'Uptime SLA',      value: '99.9%'   },
  { icon: Lock,     label: 'Encryption',      value: 'TLS 1.3' },
  { icon: GitBranch,label: 'API Version',     value: 'v1 stable'},
];

// ── Resource links ────────────────────────────────────────────────────────

const RESOURCES = [
  { icon: BookOpen, label: 'API Reference',   href: '#', desc: 'Full endpoint documentation' },
  { icon: Code2,    label: 'SDKs',            href: '#', desc: 'Node, Python, Go clients'    },
  { icon: Webhook,  label: 'Webhook Guide',   href: '#', desc: 'Event types & signatures'    },
];

// ── Page ──────────────────────────────────────────────────────────────────

export default function DeveloperPortalPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">

      {/* ── Nav ──────────────────────────────────────────── */}
      <nav className="sticky top-0 z-40 border-b border-white/8 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
          <Link href="/" className="font-fraunces text-base font-semibold tracking-tight text-white">
            VitalCV
          </Link>
          <div className="hidden items-center gap-6 text-sm text-slate-400 md:flex">
            <Link href="/developers" className="text-white font-medium">Developers</Link>
            <Link href="/demo" className="hover:text-white transition-colors">Demo</Link>
            <Link href="/verifier" className="hover:text-white transition-colors">Verifier</Link>
          </div>
          <Link
            href="/sign-in"
            className="rounded-xl bg-white/5 px-4 py-1.5 text-sm font-medium text-white ring-1 ring-white/10 transition hover:bg-white/10"
          >
            Sign In
          </Link>
        </div>
      </nav>

      {/* ── Hero header ──────────────────────────────────── */}
      <header className="relative overflow-hidden border-b border-white/8 px-6 py-20 text-center">
        {/* Ambient glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            background:
              'radial-gradient(ellipse 70% 50% at 50% 0%, oklch(0.68 0.12 180 / 0.12), transparent 70%)',
            filter: 'blur(40px)',
          }}
        />

        <div className="relative z-10 mx-auto max-w-3xl">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-emerald-400 ring-1 ring-emerald-500/30">
            <Code2 className="h-3.5 w-3.5" />
            Developer Portal
          </span>

          <h1 className="mt-4 font-fraunces text-4xl font-semibold tracking-tighter text-white md:text-5xl lg:text-6xl">
            Build with the
            <br />
            <span className="text-emerald-400">Trust Protocol.</span>
          </h1>

          <p className="mt-5 text-base text-slate-400 md:text-lg max-w-xl mx-auto leading-relaxed">
            Integrate real-time clinician credential verification into your hospital&apos;s
            EHR, scheduling, or onboarding systems in minutes — not months.
          </p>

          <div className="mt-8 flex items-center justify-center gap-4">
            <Link
              href="#sandbox"
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-black shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
            >
              Try the Sandbox
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="#"
              className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-6 py-3 text-sm font-semibold text-white ring-1 ring-white/10 transition hover:bg-white/10"
            >
              <BookOpen className="h-4 w-4" />
              Read the Docs
            </Link>
          </div>
        </div>
      </header>

      {/* ── Stats row ────────────────────────────────────── */}
      <div className="border-b border-white/8 bg-slate-900/40">
        <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-y divide-white/8 md:grid-cols-4 md:divide-y-0">
          {STATS.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center gap-3 px-8 py-5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-slate-500">{label}</p>
                <p className="text-sm font-semibold text-white">{value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────── */}
      <main className="mx-auto max-w-7xl space-y-10 px-6 py-14">

        {/* Section label */}
        <div className="flex items-center gap-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Developer Tools
          </p>
          <div className="flex-1 h-px bg-white/5" />
        </div>

        {/* Row 1: API Key + Webhook side-by-side */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <ApiKeyManager />
          <WebhookLog />
        </div>

        {/* Row 2: Full-width cURL Sandbox */}
        <div id="sandbox" className="scroll-mt-20">
          <ApiSandbox />
        </div>

        {/* Row 3: Drop-in Widget SDK — Wave 34: Plaid Wedge */}
        <DropInSection />

        {/* ── Resource links ──────────────────────────────── */}
        <div>
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">
            Resources
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {RESOURCES.map(({ icon: Icon, label, href, desc }) => (
              <Link
                key={label}
                href={href}
                className="group flex items-start gap-4 rounded-2xl border border-white/8 bg-slate-900/40 p-5 transition hover:border-emerald-500/30 hover:bg-slate-800/60"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 transition group-hover:bg-emerald-500/20">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{label}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{desc}</p>
                </div>
                <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-slate-700 transition group-hover:text-emerald-400" />
              </Link>
            ))}
          </div>
        </div>
      </main>

      {/* ── Footer ───────────────────────────────────────── */}
      <footer className="border-t border-white/8 bg-slate-950/60 py-8 px-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-xs text-slate-600 sm:flex-row">
          <p>&copy; {new Date().getFullYear()} VitalCV. All rights reserved.</p>
          <div className="flex items-center gap-5">
            <Link href="/developers" className="text-slate-500 hover:text-white transition-colors">Developers</Link>
            <Link href="/#security" className="hover:text-white transition-colors">Security</Link>
            <Link href="/sign-in" className="hover:text-white transition-colors">Sign In</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
