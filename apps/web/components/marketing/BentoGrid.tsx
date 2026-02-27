"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";

const ACCENT_CLASSES = {
  teal: {
    badge: "bg-teal-500/15 text-teal-400",
    stat: "text-teal-400",
  },
  blue: {
    badge: "bg-blue-500/15 text-blue-400",
    stat: "text-blue-400",
  },
  violet: {
    badge: "bg-violet-500/15 text-violet-400",
    stat: "text-violet-400",
  },
} as const;

type Accent = keyof typeof ACCENT_CLASSES;

interface CardData {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  accent: Accent;
  stat: string;
  statLabel: string;
  badge: string;
}

const CARDS: CardData[] = [
  {
    id: "oidc4vp",
    eyebrow: "Zero-Latency Verification",
    title: "OIDC4VP Protocol",
    body: "Credentials flow directly between wallets and verifiers over OpenID for Verifiable Presentations. No intermediary, no delay. Sub-second cryptographic handshakes.",
    accent: "teal",
    stat: "<1s",
    statLabel: "avg verification time",
    badge: "Live",
  },
  {
    id: "sha256",
    eyebrow: "Cryptographic Audit Trails",
    title: "SHA-256 Artifact Hashing",
    body: "Every issued credential and verification event is SHA-256 hashed, timestamped, and stored immutably. Compliance teams get deterministic, tamper-evident audit bundles.",
    accent: "blue",
    stat: "100%",
    statLabel: "tamper-evident events",
    badge: "NCQA-Aligned",
  },
  {
    id: "sdjwt",
    eyebrow: "Privacy by Design",
    title: "SD-JWT Selective Disclosure",
    body: "Clinicians share only what verifiers need. SD-JWT lets holders disclose individual claims without revealing the full credential — zero unnecessary PII exposure.",
    accent: "violet",
    stat: "0",
    statLabel: "PII over-disclosed",
    badge: "W3C VC 2.0",
  },
];

export default function BentoGrid() {
  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef, { once: true, margin: "-60px" });

  return (
    <section ref={sectionRef} className="py-24 px-6 bg-slate-950">
      <div className="max-w-5xl mx-auto">
        <p className="text-teal-400 text-xs font-semibold uppercase tracking-widest">
          Architecture
        </p>
        <h2 className="mt-2 text-3xl md:text-4xl font-black text-white">
          Built on open standards.
        </h2>
        <p className="mt-3 text-lg text-slate-400 max-w-xl">
          No proprietary lock-in. Every layer of VitalCV is grounded in W3C,
          IETF, and NIST specifications.
        </p>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          {CARDS.map((card, index) => {
            const accent = ACCENT_CLASSES[card.accent];
            return (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, y: 20 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="group relative bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-6 hover:scale-[1.02] hover:border-white/20 transition-all duration-300 cursor-default"
              >
                <span
                  className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${accent.badge} mb-4`}
                >
                  {card.badge}
                </span>
                <p className="text-xs uppercase tracking-widest text-slate-500 mb-1">
                  {card.eyebrow}
                </p>
                <h3 className="text-xl font-bold text-white">{card.title}</h3>
                <p className="mt-3 text-base text-slate-400 leading-relaxed">
                  {card.body}
                </p>
                <div className="mt-6 pt-4 border-t border-white/5">
                  <p className={`text-3xl font-black ${accent.stat}`}>
                    {card.stat}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {card.statLabel}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
