'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { fadeInUp, staggerContainer } from '@/animations/motionVariants';
import { Check, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function ActivationSuccessPage() {
  const [passportId, setPassportId] = useState('');

  useEffect(() => {
    const npi = sessionStorage.getItem('onboarding_npi') ?? '';
    setPassportId(npi);
  }, []);

  if (!passportId) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 py-20 text-foreground">
        <div className="w-full max-w-2xl rounded-3xl border border-zinc-800 bg-zinc-900/70 p-8 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Activation session required
          </h1>
          <p className="mt-4 text-base leading-7 text-zinc-400">
            This screen only reflects a completed onboarding activation. Guest preview mode does not create a passport or a persisted workspace.
          </p>
          <div className="mt-8 flex justify-center">
            <Link
              href="/onboarding"
              className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-black transition hover:bg-emerald-400"
            >
              Return to onboarding
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="w-full flex flex-col items-center justify-center text-center py-20"
    >
      <motion.div
        variants={fadeInUp}
        className="relative mb-12 flex items-center justify-center group"
      >
        <div className="absolute inset-0 bg-emerald-500/20 blur-[80px] rounded-full group-hover:bg-emerald-400/30 transition-colors duration-1000" />
        <div className="absolute inset-0 scale-150 rounded-full border border-emerald-500/10 pointer-events-none" />
        <div className="absolute inset-0 scale-[2] rounded-full border border-emerald-500/5 pointer-events-none" />

        <div className="relative w-32 h-32 md:w-40 md:h-40 rounded-full bg-emerald-500/10 border border-emerald-400/20 flex items-center justify-center backdrop-blur-xl shrink-0">
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', delay: 0.3, stiffness: 200, damping: 20 }}
          >
            <Check className="w-16 h-16 md:w-20 md:h-20 text-emerald-400" strokeWidth={3} />
          </motion.div>
        </div>
      </motion.div>

      <motion.div variants={fadeInUp} className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-5xl md:text-7xl font-heading font-extrabold text-foreground tracking-tight">
          Profile Activated
        </h1>
        <p className="text-xl md:text-2xl text-foreground/70 leading-relaxed max-w-xl mx-auto font-medium">
          Your credentials have been securely registered to the VitalCV trust network. You're ready to go.
        </p>
      </motion.div>

      <motion.div variants={fadeInUp} className="mt-16 relative">
        <Link
            href={`/passport/${passportId}`}
            className="group flex items-center gap-4 bg-white hover:bg-white/90 text-slate-900 px-8 py-5 rounded-full text-lg md:text-xl font-bold transition-all shadow-[0_0_40px_rgba(255,255,255,0.1)] hover:shadow-[0_0_60px_rgba(255,255,255,0.2)]"
          >
            Enter your Passport
            <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
        </Link>
      </motion.div>
    </motion.div>
  );
}
