import type { Metadata } from 'next';
import Link from 'next/link';
import { BookOpen, Code2, Webhook, ArrowRight, Shield, Zap, Globe } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Documentation | VitalCV',
  description: 'Everything you need to build on the VitalCV Trust Protocol.',
};

const SECTIONS = [
  {
    icon: BookOpen,
    title: 'API Reference',
    desc: 'Complete endpoint documentation for the VitalCV Trust API. Covers credential issuance, verification, revocation, and the federation protocol.',
    href: '/docs/api',
    color: 'text-violet-400',
    bg: 'bg-violet-500/10 border-violet-500/20',
    badge: 'REST',
  },
  {
    icon: Code2,
    title: 'SDKs',
    desc: 'Official client libraries for Node.js, Python, and Go. Drop-in verification, issuance, and wallet management.',
    href: '/docs/sdk',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    badge: 'Node · Python · Go',
  },
  {
    icon: Webhook,
    title: 'Webhooks',
    desc: 'Real-time event delivery for credential lifecycle changes. Trust state alerts, revocation events, and issuer health notifications.',
    href: '/docs/webhooks',
    color: 'text-sky-400',
    bg: 'bg-sky-500/10 border-sky-500/20',
    badge: 'Events',
  },
];

const QUICK_LINKS = [
  { label: 'Verify a credential',       href: '/docs/api#verify' },
  { label: 'Issue a credential',        href: '/docs/api#issue' },
  { label: 'Install the Node SDK',      href: '/docs/sdk#node' },
  { label: 'Subscribe to webhooks',     href: '/docs/webhooks#subscribe' },
  { label: 'Revoke a credential',       href: '/docs/api#revoke' },
  { label: 'Selective disclosure',      href: '/docs/api#selective-disclosure' },
];

const PRINCIPLES = [
  { icon: Shield, label: 'Zero-knowledge selective disclosure — reveal only what you choose' },
  { icon: Zap,    label: 'Sub-100ms verification via in-memory trust substrate' },
  { icon: Globe,  label: 'Federation-native — interoperates with Nursys, CAQH, ABMS' },
];

export default function DocsPage() {
  return (
    <div className="space-y-16">
      {/* Hero */}
      <div className="max-w-2xl">
        <p className="text-xs font-mono uppercase tracking-widest text-violet-400 mb-3">Documentation</p>
        <h1 className="text-3xl font-bold tracking-tight mb-4">Build on VitalCV</h1>
        <p className="text-zinc-400 leading-relaxed">
          The VitalCV Trust Protocol provides cryptographic healthcare credentialing as a service.
          Verify clinician licenses, board certifications, and NPI attestations in a single API call.
        </p>
      </div>

      {/* Principles */}
      <div className="flex flex-wrap gap-4">
        {PRINCIPLES.map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-2 text-sm text-zinc-400">
            <Icon className="h-4 w-4 text-zinc-600 flex-shrink-0" />
            <span>{label}</span>
          </div>
        ))}
      </div>

      {/* Section cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {SECTIONS.map(({ icon: Icon, title, desc, href, color, bg, badge }) => (
          <Link
            key={href}
            href={href}
            className={`group rounded-xl border p-6 space-y-4 hover:scale-[1.01] transition-transform ${bg}`}
          >
            <div className="flex items-start justify-between">
              <Icon className={`h-6 w-6 ${color}`} />
              <span className={`text-xs font-mono px-2 py-0.5 rounded-full border ${bg} ${color}`}>
                {badge}
              </span>
            </div>
            <div>
              <h2 className="font-semibold mb-1 group-hover:text-white transition-colors">{title}</h2>
              <p className="text-sm text-zinc-500 leading-relaxed">{desc}</p>
            </div>
            <div className={`flex items-center gap-1 text-sm ${color} font-medium`}>
              <span>Read docs</span>
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        ))}
      </div>

      {/* Quick links */}
      <div>
        <h2 className="text-sm font-semibold text-zinc-300 mb-4 uppercase tracking-wider">Quick Links</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {QUICK_LINKS.map(({ label, href }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center justify-between px-4 py-3 rounded-lg border border-white/5 bg-white/3 hover:bg-white/5 hover:border-white/10 transition-colors text-sm text-zinc-400 hover:text-white group"
            >
              <span>{label}</span>
              <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          ))}
        </div>
      </div>

      {/* Get started callout */}
      <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="font-semibold mb-1">Ready to integrate?</h3>
          <p className="text-sm text-zinc-400">Get an API key and start verifying credentials in minutes.</p>
        </div>
        <Link
          href="/developers"
          className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-sm font-medium transition-colors"
        >
          Get API Key <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
