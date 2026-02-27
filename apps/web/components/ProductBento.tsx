"use client";
import { motion } from "framer-motion";

// ── Animated CRS Ring (SVG) ────────────────────────────────
function CrsRingCard() {
  const score = 82;
  const r = 52; const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3">
      <svg width="128" height="128" viewBox="0 0 128 128">
        <circle cx="64" cy="64" r={r} fill="none" stroke="#e2e8f0" strokeWidth="12" />
        <motion.circle
          cx="64" cy="64" r={r} fill="none"
          stroke="url(#grad)" strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.4, ease: "easeOut", delay: 0.3 }}
          style={{ rotate: -90, transformOrigin: "64px 64px" }}
        />
        <defs>
          <linearGradient id="grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#0ea5e9" />
          </linearGradient>
        </defs>
        <text x="64" y="68" textAnchor="middle" className="text-2xl font-bold" fill="#1e40af" fontSize="22" fontWeight="bold">{score}</text>
      </svg>
      <p className="text-xs font-semibold text-blue-700 uppercase tracking-widest">CRS Score</p>
    </div>
  );
}

// ── L0-L3 Status Timeline ──────────────────────────────────
function TrustLevelCard() {
  const levels = [
    { label: "L3", desc: "Cryptographically Proven", active: true, color: "text-green-400 bg-green-400/20" },
    { label: "L2", desc: "PSV Verified", active: true, color: "text-blue-400 bg-blue-400/20" },
    { label: "L1", desc: "Self-Attested", active: true, color: "text-yellow-400 bg-yellow-400/20" },
    { label: "L0", desc: "Pending", active: false, color: "text-gray-500 bg-gray-500/20" },
  ];
  return (
    <div className="flex flex-col gap-2 h-full justify-center">
      <p className="text-xs font-bold text-blue-300 uppercase tracking-widest mb-1">Trust Levels</p>
      {levels.map((l, i) => (
        <motion.div
          key={l.label}
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.15 }}
          className={`flex items-center gap-3 rounded-lg px-3 py-2 ${l.active ? l.color : "text-gray-600 bg-gray-800/30"}`}
        >
          <span className="font-mono font-bold text-sm w-6">{l.label}</span>
          <span className="text-xs">{l.desc}</span>
          {l.active && <span className="ml-auto w-2 h-2 rounded-full bg-current animate-pulse" />}
        </motion.div>
      ))}
    </div>
  );
}

// ── 90-day vs 2-day progress comparison ───────────────────
function SpeedCard() {
  return (
    <div className="flex flex-col gap-4 justify-center h-full">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Credentialing Speed</p>
      {[
        { label: "Traditional", days: "90 days", pct: 100, color: "bg-red-400" },
        { label: "VitalCV", days: "2 days", pct: 2.2, color: "bg-green-400" },
      ].map((item) => (
        <div key={item.label}>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-300">{item.label}</span>
            <span className="font-bold text-white">{item.days}</span>
          </div>
          <div className="h-2 rounded-full bg-gray-700">
            <motion.div
              className={`h-2 rounded-full ${item.color}`}
              initial={{ width: "0%" }}
              animate={{ width: `${item.pct}%` }}
              transition={{ duration: 1.2, ease: "easeOut", delay: 0.4 }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Generic stat card ──────────────────────────────────────
function StatCard({ value, label, sub }: { value: string; label: string; sub: string }) {
  return (
    <div className="flex flex-col justify-center h-full">
      <p className="text-4xl font-black text-white">{value}</p>
      <p className="text-sm font-semibold text-blue-300 mt-1">{label}</p>
      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
    </div>
  );
}

const CARDS = [
  { id: "crs",    span: "col-span-1 row-span-2", bg: "bg-white/70 backdrop-blur-md",            content: <CrsRingCard /> },
  { id: "trust",  span: "col-span-1 row-span-2", bg: "bg-gray-900/90 backdrop-blur-md",          content: <TrustLevelCard /> },
  { id: "speed",  span: "col-span-1 row-span-1", bg: "bg-gray-900/90 backdrop-blur-md",          content: <SpeedCard /> },
  { id: "stat1",  span: "col-span-1 row-span-1", bg: "bg-blue-600/90 backdrop-blur-md",          content: <StatCard value="3–6wk" label="Faster Onboarding" sub="vs traditional credentialing" /> },
  { id: "stat2",  span: "col-span-1 row-span-1", bg: "bg-white/70 backdrop-blur-md",            content: <StatCard value="100%" label="PSV Coverage" sub="All major primary sources" /> },
  { id: "stat3",  span: "col-span-1 row-span-1", bg: "bg-indigo-600/90 backdrop-blur-md",        content: <StatCard value="L3" label="Cryptographic Proof" sub="Zero-knowledge verified" /> },
];

export default function ProductBento() {
  return (
    <section className="max-w-5xl mx-auto px-6 py-16">
      <h2 className="text-3xl font-black text-center text-white mb-10">
        The Infrastructure Stack
      </h2>
      <div className="grid grid-cols-3 grid-rows-3 gap-4 h-[520px]">
        {CARDS.map((card, i) => (
          <motion.div
            key={card.id}
            className={`${card.span} ${card.bg} rounded-2xl p-6 border border-white/10 shadow-glass overflow-hidden`}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08, duration: 0.5 }}
          >
            {card.content}
          </motion.div>
        ))}
      </div>
    </section>
  );
}
