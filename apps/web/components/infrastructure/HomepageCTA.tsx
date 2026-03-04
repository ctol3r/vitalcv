'use client';

/**
 * HomepageCTA.tsx — Wave 64: Homepage Call to Action
 */

import Link from 'next/link';
import { motion } from 'framer-motion';

export function HomepageCTA({ className = '' }: { className?: string }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
      className={`glass rounded-2xl p-10 text-center ${className}`}
    >
      <h2 className="text-2xl font-bold text-zinc-100 mb-2">
        Ready to eliminate credentialing delays?
      </h2>
      <p className="text-sm text-zinc-500 max-w-md mx-auto mb-6">
        Automate primary source verification, generate real-time trust scores,
        and make instant hiring decisions backed by cryptographic proof.
      </p>
      <div className="flex items-center justify-center gap-3">
        <Link href="/demo/run"
          className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-semibold text-white transition-colors">
          Try VitalCV
        </Link>
        <Link href="/developers"
          className="px-6 py-2.5 bg-white/[0.06] hover:bg-white/[0.1] rounded-lg text-sm font-medium text-zinc-300 transition-colors">
          API Docs
        </Link>
      </div>
    </motion.section>
  );
}

export default HomepageCTA;
