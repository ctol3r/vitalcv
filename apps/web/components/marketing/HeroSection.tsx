"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Search } from "lucide-react";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
} as const;
const item = {
  hidden: { opacity: 0, y: 24 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" as const } },
};

export default function HeroSection() {
  const [npi, setNpi] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!npi.trim()) return;
    setLoading(true);
    setResult(null);
    await new Promise((r) => setTimeout(r, 1200));
    setResult(`NPI ${npi.trim()} — Clinician found. CRS Score: 82/100 · L3 Verified`);
    setLoading(false);
  };

  return (
    <section className="min-h-screen flex items-center pt-24 pb-16">
      <div className="max-w-5xl mx-auto px-6 w-full">
        <motion.div variants={container} initial="hidden" animate="show" className="flex flex-col gap-6 max-w-3xl">
          <motion.div variants={item}>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold tracking-widest uppercase">
              Cryptographic Credentialing
            </span>
          </motion.div>

          <motion.h1 variants={item} className="text-5xl md:text-7xl font-black text-white leading-tight">
            Start clinicians{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
              3–6 weeks faster.
            </span>
          </motion.h1>

          <motion.p variants={item} className="text-lg text-gray-300 max-w-xl leading-relaxed">
            VitalCV automates primary source verification and generates cryptographic proof bundles — so health systems can onboard verified clinicians in days, not months.
          </motion.p>

          <motion.form
            variants={item}
            onSubmit={handleLookup}
            className="flex gap-3 mt-2 max-w-lg"
          >
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={npi}
                onChange={(e) => setNpi(e.target.value)}
                placeholder="Enter NPI number..."
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:border-blue-400 focus:bg-white/15 transition-all text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-all disabled:opacity-60 min-h-[44px]"
            >
              {loading ? "Checking..." : <>Lookup <ArrowRight className="w-4 h-4" /></>}
            </button>
          </motion.form>

          {result && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="px-4 py-3 rounded-xl bg-green-500/20 border border-green-400/30 text-green-300 text-sm font-medium"
            >
              {result}
            </motion.div>
          )}

          <motion.p variants={item} className="text-xs text-gray-500">
            Trusted by forward-thinking health systems. NCQA CR1-CR5 aligned.
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}
