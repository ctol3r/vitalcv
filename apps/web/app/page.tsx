'use client';

import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { ArrowRight, Building2, ShieldCheck, Stethoscope } from 'lucide-react';
import Link from 'next/link';

const roles = [
  {
    title: 'Clinician',
    description: 'Verify NPI, maintain a credential record, and share a verification package.',
    href: '/clinician',
    cta: 'Clinician workspace',
    icon: Stethoscope,
  },
  {
    title: 'Employer / Verifier',
    description: 'Check credential status, revocation, and audit receipts with a single view.',
    href: '/employer',
    cta: 'Employer verification',
    icon: Building2,
  },
  {
    title: 'Issuer / Authority',
    description: 'Issue and revoke credentials with governed attestation workflows.',
    href: '/issuer',
    cta: 'Issuer operations',
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
          <motion.div
            {...fadeUp}
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.35em] text-blue-700 dark:text-blue-400"
          >
            VitalCV
          </motion.div>
          <motion.h1 {...fadeUp} className="mt-4 text-4xl md:text-5xl font-semibold tracking-tight">
            Credential verification for regulated healthcare teams
          </motion.h1>
          <motion.p
            {...fadeUp}
            className="mt-5 max-w-2xl text-base md:text-lg text-neutral-600 dark:text-neutral-300"
          >
            Role-based access to clinician credentials, issuance controls, and audit status.
          </motion.p>
          <motion.div {...fadeUp} className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="bg-blue-700 text-white hover:bg-blue-800">
              <Link href="/clinician">Enter Clinician</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="border-neutral-300">
              <Link href="/employer">Employer / Verifier</Link>
            </Button>
          </motion.div>
          <motion.div
            {...fadeUp}
            className="mt-10 grid gap-4 text-xs text-neutral-500 dark:text-neutral-400 md:grid-cols-3"
          >
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-700 dark:bg-blue-400" />
              Verified credential records
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-700 dark:bg-blue-400" />
              Revocation and status checks
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-700 dark:bg-blue-400" />
              Audit receipts on demand
            </div>
          </motion.div>
        </div>
      </section>

      <section className="py-16 md:py-20">
        <div className="container mx-auto px-6">
          <motion.div {...fadeUp} className="max-w-2xl">
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">Role entry points</h2>
            <p className="mt-3 text-sm md:text-base text-neutral-600 dark:text-neutral-300">
              Three routes, each aligned to a specific responsibility in credentialing.
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
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
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
                Credential record
              </h3>
              <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">
                Verified source data, status history, and issuance metadata.
              </p>
            </motion.div>
            <motion.div {...fadeUp}>
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500 dark:text-neutral-400">
                Operational controls
              </h3>
              <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">
                Role-based access, scoped sharing, and time-bound verification.
              </p>
            </motion.div>
            <motion.div {...fadeUp}>
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500 dark:text-neutral-400">
                Audit visibility
              </h3>
              <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">
                Receipts for issuance, verification, and revocation events.
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
