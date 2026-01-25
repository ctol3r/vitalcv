'use client';

import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { FileText, Search, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

const steps = [
  {
    title: 'Verify credential',
    description: 'Confirm credential status and issuance details.',
    icon: Search,
  },
  {
    title: 'Review status',
    description: 'Check revocation state and readiness signals.',
    icon: ShieldCheck,
  },
  {
    title: 'Audit receipt',
    description: 'Capture verification receipts for compliance files.',
    icon: FileText,
  },
];

const fadeUp = {
  initial: { opacity: 0, y: 14 },
  whileInView: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: 'easeOut' },
  viewport: { once: true, amount: 0.6 },
};

export default function EmployerPage() {
  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <section className="border-b border-neutral-200/80 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <div className="container mx-auto px-6 py-14 md:py-20">
          <motion.p
            {...fadeUp}
            className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-700 dark:text-blue-400"
          >
            Role / Employer / Verifier
          </motion.p>
          <motion.h1 {...fadeUp} className="mt-4 text-3xl md:text-4xl font-semibold tracking-tight">
            Employer verification
          </motion.h1>
          <motion.p
            {...fadeUp}
            className="mt-4 max-w-2xl text-sm md:text-base text-neutral-600 dark:text-neutral-300"
          >
            Verify clinician credentials, review revocation status, and archive audit receipts.
          </motion.p>
          <motion.div {...fadeUp} className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="bg-blue-700 text-white hover:bg-blue-800">
              <Link href="/verify">Verify credential</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="border-neutral-300">
              <Link href="/verifier/dashboard">Open verifier dashboard</Link>
            </Button>
          </motion.div>
        </div>
      </section>

      <section className="py-12 md:py-16">
        <div className="container mx-auto px-6">
          <motion.h2 {...fadeUp} className="text-xl md:text-2xl font-semibold tracking-tight">
            Workflow
          </motion.h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.title}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: 'easeOut', delay: index * 0.08 }}
                  viewport={{ once: true, amount: 0.4 }}
                  className="rounded-2xl border border-neutral-200/80 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold">{step.title}</h3>
                  <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-300">
                    {step.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
