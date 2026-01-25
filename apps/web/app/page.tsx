'use client';

import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { ArrowRight, Building2, ShieldCheck, Stethoscope } from 'lucide-react';
import Link from 'next/link';

const roles = [
  {
    title: 'Clinician / Holder',
    description:
      'Share verified credentials and check employment readiness status with revocation-first validation.',
    href: '/holder',
    cta: 'Enter Holder Dashboard',
    icon: Stethoscope,
  },
  {
    title: 'Employer / Verifier',
    description: 'Verify clinician credentials with deterministic readiness checks and audit trails.',
    href: '/verify',
    cta: 'Open Verification Suite',
    icon: Building2,
  },
  {
    title: 'Issuer / Authority',
    description: 'Issue, attest, and revoke credentials with governed authority operations.',
    href: '/issuer',
    cta: 'Launch Issuer Console',
    icon: ShieldCheck,
  },
];

const fadeUp = {
  initial: { opacity: 0, y: 14 },
  whileInView: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: 'easeOut' },
  viewport: { once: true, amount: 0.6 },
};

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <section className="border-b border-neutral-200/80 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <div className="container mx-auto px-6 py-16 md:py-24">
          <motion.p
            {...fadeUp}
            className="text-xs font-semibold uppercase tracking-[0.3em] text-neutral-500 dark:text-neutral-400"
          >
            VitalCV Platform
          </motion.p>
          <motion.h1 {...fadeUp} className="mt-4 text-4xl md:text-5xl font-semibold tracking-tight">
            Institutional credentialing for modern healthcare networks
          </motion.h1>
          <motion.p
            {...fadeUp}
            className="mt-5 max-w-2xl text-base md:text-lg text-neutral-600 dark:text-neutral-300"
          >
            Role-based access to verified clinician credentials, issued and audited through secure
            attestations.
          </motion.p>
          <motion.div {...fadeUp} className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/holder">Holder Dashboard</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/verify">Verify Credentials</Link>
            </Button>
          </motion.div>
          <motion.div
            {...fadeUp}
            className="mt-10 flex flex-wrap gap-4 text-xs text-neutral-500 dark:text-neutral-400"
          >
            <span className="rounded-full border border-neutral-200/80 bg-white px-3 py-1 dark:border-neutral-800 dark:bg-neutral-900">
              SOC2-ready audit trails
            </span>
            <span className="rounded-full border border-neutral-200/80 bg-white px-3 py-1 dark:border-neutral-800 dark:bg-neutral-900">
              Verifiable credential standards
            </span>
            <span className="rounded-full border border-neutral-200/80 bg-white px-3 py-1 dark:border-neutral-800 dark:bg-neutral-900">
              Enterprise readiness score
            </span>
          </motion.div>
        </div>
      </section>

      <section className="py-16 md:py-20">
        <div className="container mx-auto px-6">
          <motion.div {...fadeUp} className="max-w-2xl">
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">Choose your role</h2>
            <p className="mt-3 text-sm md:text-base text-neutral-600 dark:text-neutral-300">
              Each entry point delivers a tailored workflow with the right level of access,
              auditability, and control.
            </p>
          </motion.div>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {roles.map((role, index) => {
              const Icon = role.icon;
              return (
                <motion.div
                  key={role.title}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: 'easeOut', delay: index * 0.08 }}
                  viewport={{ once: true, amount: 0.4 }}
                  className="h-full"
                >
                  <Link
                    href={role.href}
                    className="group flex h-full flex-col justify-between rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm transition hover:border-neutral-300 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700"
                    aria-label={`${role.title} entry`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
                          <Icon className="h-5 w-5" />
                        </div>
                        <span className="text-xs uppercase tracking-[0.2em] text-neutral-400">
                          Entry
                        </span>
                      </div>
                      <h3 className="mt-6 text-lg font-semibold">{role.title}</h3>
                      <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">
                        {role.description}
                      </p>
                    </div>
                    <div className="mt-8 inline-flex items-center text-sm font-medium text-neutral-900 dark:text-neutral-100">
                      {role.cta}
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-t border-neutral-200/80 bg-white py-14 dark:border-neutral-800 dark:bg-neutral-950">
        <div className="container mx-auto px-6">
          <div className="grid gap-8 md:grid-cols-3">
            <motion.div {...fadeUp}>
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500 dark:text-neutral-400">
                Institutional core
              </h3>
              <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">
                Verified credentials, revocation signals, and compliance artifacts in one shared
                ledger.
              </p>
            </motion.div>
            <motion.div {...fadeUp}>
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500 dark:text-neutral-400">
                Operational visibility
              </h3>
              <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">
                Audit-ready logs, readiness scoring, and structured proof chains for hiring and
                licensing workflows.
              </p>
            </motion.div>
            <motion.div {...fadeUp}>
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500 dark:text-neutral-400">
                Secure by design
              </h3>
              <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">
                Selective disclosure and privacy-preserving proofs built on modern credential
                standards.
              </p>
            </motion.div>
          </div>
          <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-neutral-200/80 pt-6 text-xs text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
            <span>© 2026 VitalCV. All rights reserved.</span>
            <div className="flex gap-4">
              <Link href="/support" className="hover:text-neutral-900 dark:hover:text-neutral-100">
                Support
              </Link>
              <Link href="/status" className="hover:text-neutral-900 dark:hover:text-neutral-100">
                Status
              </Link>
              <Link href="/changelog" className="hover:text-neutral-900 dark:hover:text-neutral-100">
                Changelog
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
