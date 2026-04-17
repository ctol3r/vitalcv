import type { Metadata } from 'next';
import Link from 'next/link';
import { Shield, FileCheck, Lock, ArrowUpRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Compliance & Security',
  description:
    'VitalCV compliance posture: HIPAA alignment, NIST 800-63 digital identity, and data minimization for healthcare credentialing verification.',
  openGraph: {
    title: 'Compliance & Security',
    description:
      'HIPAA-aligned, NIST 800-63 compliant healthcare credentialing. Only publicly available data — no PHI stored.',
    url: 'https://vitalcv.com/compliance',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Compliance & Security',
    description:
      'HIPAA-aligned, NIST 800-63 compliant healthcare credentialing verification.',
  },
};

const SECTIONS = [
  {
    icon: Shield,
    title: 'HIPAA Alignment',
    description:
      'VitalCV processes only publicly available credentialing data (NPI, exclusion lists, licensure status). No PHI is stored or transmitted.',
    status: 'Aligned',
  },
  {
    icon: FileCheck,
    title: 'NIST 800-63 Digital Identity',
    description:
      'Credential presentation follows selective disclosure principles. Wallet supports biometric authentication and passkey-based ownership.',
    status: 'Compliant',
  },
  {
    icon: Lock,
    title: 'Data Minimization',
    description:
      'Only the minimum data necessary for each verification check is requested and stored. No bulk data harvesting.',
    status: 'Enforced',
  },
] as const;

const RESOURCES = [
  {
    title: 'OpenID Self-Certification',
    description: 'VitalCV OpenID for Verifiable Credentials self-certification',
    href: '/compliance/openid-self-cert',
  },
  {
    title: 'API Security',
    description: 'Authentication, authorization, and rate limiting documentation',
    href: '/developers',
  },
  {
    title: 'Developer Documentation',
    description: 'SDK reference, integration guides, and webhook setup',
    href: '/developers',
  },
] as const;

export default function CompliancePage() {
  return (
    <article className="mx-auto max-w-5xl space-y-14 px-6 pt-12 pb-20">
      <header className="space-y-4">
        <p className="text-[11px] font-mono font-semibold uppercase tracking-[0.2em] text-[var(--vt-text-3)]">
          Compliance & Security
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--vt-text-1)]">
          Built for healthcare trust
        </h1>
        <p className="text-[var(--vt-text-2)] leading-relaxed">
          VitalCV is designed from the ground up for healthcare credentialing workflows.
          Every architectural decision prioritizes security, privacy, and regulatory alignment.
        </p>
      </header>

      <hr className="border-[var(--vt-border)]" />

      <section className="space-y-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vt-text-3)]">
          Security Posture
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {SECTIONS.map(({ icon: Icon, title, description, status }) => (
            <div
              key={title}
              className="flex flex-col gap-4 rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-5"
            >
              <div className="flex items-start justify-between gap-2">
                <Icon className="h-5 w-5 text-[var(--vt-text-3)]" />
                <span className="font-mono text-[10px] text-emerald-500">{status}</span>
              </div>
              <div className="space-y-1.5">
                <h3 className="text-sm font-semibold text-[var(--vt-text-1)]">{title}</h3>
                <p className="text-xs leading-5 text-[var(--vt-text-2)]">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--vt-text-3)]">
          Resources
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {RESOURCES.map(({ title, description, href }) => (
            <Link
              key={title}
              href={href}
              className="group flex flex-col gap-3 rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-5 text-sm text-[var(--vt-text-2)] transition hover:border-[var(--vt-border-2)] hover:text-[var(--vt-text-1)]"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold text-[var(--vt-text-1)]">{title}</span>
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[var(--vt-text-3)] transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
              <span className="text-xs leading-5 text-[var(--vt-text-3)]">{description}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-[var(--vt-border)] bg-[var(--vt-surface)] p-6">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-[var(--vt-text-1)]">Security questions?</h3>
          <p className="text-sm text-[var(--vt-text-2)]">
            Contact our team for a detailed security assessment, SOC 2 report, or custom compliance documentation.
          </p>
          <a
            href="mailto:security@vitalcv.com"
            className="mt-4 inline-block text-sm font-medium underline underline-offset-2 text-[var(--vt-text-2)] hover:text-[var(--vt-text-1)]"
          >
            Contact the security team →
          </a>
        </div>
      </section>
    </article>
  );
}
