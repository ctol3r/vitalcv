"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.14 } },
} as const;

const item = {
  hidden: { opacity: 0, y: 28 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
  },
};

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden bg-slate-950">
      {/* ── Animated background orbs ──────────────────── */}
      <motion.div
        aria-hidden
        className="absolute top-[-20%] left-[10%] w-[600px] h-[600px] rounded-full bg-teal-500/20 blur-[120px] pointer-events-none"
        animate={{ x: [0, 40, 0], y: [0, -30, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="absolute bottom-[-10%] right-[5%] w-[500px] h-[500px] rounded-full bg-blue-600/15 blur-[100px] pointer-events-none"
        animate={{ x: [0, -30, 0], y: [0, 40, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* ── Main content ─────────────────────────────── */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 py-32">
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="flex flex-col"
        >
          {/* Eyebrow badge */}
          <motion.div variants={item}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-teal-500/30 bg-teal-500/10 text-teal-400 text-xs font-semibold tracking-widest uppercase">
              Infrastructure · Healthcare Trust
            </div>
          </motion.div>

          {/* Headline */}
          <motion.h1
            variants={item}
            className="mt-6 text-5xl md:text-7xl lg:text-8xl font-black text-white leading-[0.95] tracking-tight"
          >
            Infrastructure
            <br className="hidden sm:block" />
            for Healthcare
            <br className="hidden sm:block" />
            Trust.
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            variants={item}
            className="mt-8 text-xl md:text-2xl text-slate-400 max-w-2xl leading-relaxed"
          >
            Verify clinicians in seconds, not months. Cryptographically secure.
            Universally accepted.
          </motion.p>

          {/* CTAs */}
          <motion.div
            variants={item}
            className="mt-10 flex flex-wrap gap-4"
          >
            <Link
              href="/verifier"
              className="inline-flex items-center gap-2 min-h-[52px] px-8 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 text-lg font-bold transition-colors"
            >
              See the Demo →
            </Link>
            <Link
              href="https://docs.vitalcv.com"
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-2 min-h-[52px] px-8 rounded-xl border border-white/20 text-white hover:bg-white/10 text-lg font-medium transition-colors"
            >
              Read the Docs
            </Link>
          </motion.div>

          {/* Trust signals */}
          <motion.div
            variants={item}
            className="mt-12 flex flex-wrap gap-6 text-sm text-slate-500"
          >
            {["ES256 Signed", "OIDC4VP Compatible", "Zero PII in Transit"].map(
              (text) => (
                <span key={text} className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-teal-500 inline-block" />
                  {text}
                </span>
              )
            )}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
