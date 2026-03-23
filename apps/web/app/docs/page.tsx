import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BookOpen, Code2, Shield, Webhook, Zap, Globe } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Documentation | VitalCV',
  description: 'Everything you need to build on the VitalCV Trust Protocol.',
};

const SECTIONS = [
  {
    icon: BookOpen,
    title: 'API Reference',
    desc: 'Complete endpoint documentation for credential issuance, verification, revocation, and the federation protocol.',
    href: '/docs/api',
    badge: 'REST · JSON',
  },
  {
    icon: Code2,
    title: 'SDKs',
    desc: 'Official client libraries for Node.js, Python, and Go with drop-in verification and wallet management.',
    href: '/docs/sdk',
    badge: 'Node · Python · Go',
  },
  {
    icon: Webhook,
    title: 'Webhooks',
    desc: 'Automated event delivery for credential lifecycle changes, trust state alerts, and revocation events.',
    href: '/docs/webhooks',
    badge: 'Events',
  },
  {
    icon: Shield,
    title: 'Design System',
    desc: 'Canonical tokens, themes, components, layouts, and graph rules for VitalCV product surfaces.',
    href: '/docs/design-system',
    badge: 'VDS',
  },
] as const;

const QUICK_LINKS = [
  { label: 'Verify a credential',    href: '/docs/api#verify' },
  { label: 'Issue a credential',     href: '/docs/api#issue' },
  { label: 'Install the Node SDK',   href: '/docs/sdk#node' },
  { label: 'Subscribe to webhooks',  href: '/docs/webhooks#subscribe' },
  { label: 'Revoke a credential',    href: '/docs/api#revoke' },
  { label: 'Selective disclosure',   href: '/docs/api#selective-disclosure' },
] as const;

const PRINCIPLES = [
  { icon: Shield, text: 'Zero-knowledge selective disclosure — reveal only what you choose' },
  { icon: Zap,    text: 'Sub-100ms verification via in-memory trust substrate' },
  { icon: Globe,  text: 'Federation-native — interoperates with Nursys, CAQH, ABMS' },
] as const;

export default function DocsPage() {
  return (
    <article className="max-w-2xl space-y-14">
      {/* Header */}
      <header className="space-y-4">
        <p className="text-[11px] font-mono font-semibold uppercase tracking-[0.2em] text-[var(--vt-text-3)]">
          Documentation
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--vt-text-1)]">
          Build on VitalCV
        </h1>
        <p className="text-[var(--vt-text-2)] leading-relaxed">
          The VitalCV Trust Protocol provides cryptographic healthcare credentialing as a service.
          Verify clinician licenses, board certifications, and NPI attestations in a single API call.
        </p>
      </header>

      {/* Principles */}
      <section className="space-y-2">
        {PRINCIPLES.map(({ icon: Icon, text }) => (
          <div key={text} className="flex items-center gap-3 text-sm text-[var(--vt-text-2)]">
            <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--vt-text-3)]" />
            <span>{text}</span>
          </div>
        ))}
      </section>

      {/* Divider */}
      <hr className="border-[var(--vt-border)]" />

      {/* Section cards */}
      <section className="space-y-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vt-text-3)]">
          Reference
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {SECTIONS.map(({ icon: Icon, title, desc, href, badge }) => (
            <Link
              key={href}
              href={href}
              className="group flex flex-col gap-4 rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-5 transition hover:border-[var(--vt-accent)]/30 hover:bg-[var(--vt-surface-2)]"
            >
              <div className="flex items-start justify-between gap-2">
                <Icon className="h-5 w-5 text-[var(--vt-text-3)]" />
                <span className="font-mono text-[10px] text-[var(--vt-text-3)]">{badge}</span>
              </div>
              <div className="space-y-1.5">
                <h3 className="text-sm font-semibold text-[var(--vt-text-1)]">{title}</h3>
                <p className="text-xs leading-5 text-[var(--vt-text-2)]">{desc}</p>
              </div>
              <div className="mt-auto flex items-center gap-1 text-xs text-[var(--vt-text-3)] group-hover:text-[var(--vt-accent)] transition-colors">
                <span>Read docs</span>
                <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Quick links */}
      <section className="space-y-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vt-text-3)]">
          Quick Links
        </h2>
        <div className="grid gap-1 sm:grid-cols-2">
          {QUICK_LINKS.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-center justify-between rounded-lg border border-[var(--vt-border)] px-4 py-2.5 text-sm text-[var(--vt-text-2)] transition hover:border-[var(--vt-border-2)] hover:bg-[var(--vt-surface)] hover:text-[var(--vt-text-1)]"
            >
              <span>{label}</span>
              <ArrowRight className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100" />
            </Link>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-[var(--vt-text-1)]">Ready to integrate?</h3>
            <p className="text-sm text-[var(--vt-text-2)]">Get an API key and start verifying credentials in minutes.</p>
          </div>
          <Link
            href="/developers"
            className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[var(--vt-accent)] px-4 py-2 text-sm font-medium text-white transition hover:opacity-90"
          >
            Get API Key
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>
    </article>
  );
}
