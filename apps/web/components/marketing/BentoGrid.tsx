'use client';

import { motion, useInView } from 'framer-motion';
import { Brain, Eye, Link2, Search } from 'lucide-react';
import { useRef } from 'react';

/* ── Engine data ───────────────────────────────────────────── */

const ENGINES = [
  {
    icon: Brain,
    title: 'The Superbrain',
    subtitle: 'GraphRAG Ontology',
    description:
      'A self-evolving knowledge graph maps every credential requirement across all 50 states. The ontology reasons over licensure, board certification, and scope-of-practice rules — resolving compliance in milliseconds, not months.',
    accent: 'emerald',
    span: 'lg:col-span-2',
    visual: SuperbrainVisual,
  },
  {
    icon: Search,
    title: 'Primary Source Orchestrator',
    subtitle: 'Zero Human Data Entry',
    description:
      'Direct API integrations with NPPES, state medical boards, NPDB, OIG/LEIE, and DEA. Every credential is verified at its origin — no manual lookups, no phone calls, no faxes.',
    accent: 'cyan',
    span: 'lg:col-span-1',
    visual: OrchestratorVisual,
  },
  {
    icon: Eye,
    title: 'Continuous Trust Daemon',
    subtitle: 'Instant Revocation',
    description:
      'A background process monitors every credentialed clinician 24/7. License suspensions, exclusions, and adverse actions are detected within minutes — not the next recredentialing cycle.',
    accent: 'amber',
    span: 'lg:col-span-1',
    visual: DaemonVisual,
  },
  {
    icon: Link2,
    title: 'Audit Scrapbook',
    subtitle: 'Merkle-Anchored Compliance',
    description:
      'Every verification event is hashed, timestamped, and anchored to a Merkle tree. Produces an immutable, cryptographically-provable audit trail that satisfies the most demanding regulators.',
    accent: 'violet',
    span: 'lg:col-span-2',
    visual: AuditVisual,
  },
] as const;

/* ── Accent color maps ─────────────────────────────────────── */

const ACCENT_CLASSES: Record<string, { glow: string; border: string; text: string; bg: string; dot: string }> = {
  emerald: {
    glow: 'bg-emerald-500/[0.06]',
    border: 'border-emerald-500/20 hover:border-emerald-500/35',
    text: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    dot: 'bg-emerald-500',
  },
  cyan: {
    glow: 'bg-cyan-500/[0.06]',
    border: 'border-cyan-500/20 hover:border-cyan-500/35',
    text: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    dot: 'bg-cyan-500',
  },
  amber: {
    glow: 'bg-amber-500/[0.06]',
    border: 'border-amber-500/20 hover:border-amber-500/35',
    text: 'text-amber-400',
    bg: 'bg-amber-500/10',
    dot: 'bg-amber-500',
  },
  violet: {
    glow: 'bg-violet-500/[0.06]',
    border: 'border-violet-500/20 hover:border-violet-500/35',
    text: 'text-violet-400',
    bg: 'bg-violet-500/10',
    dot: 'bg-violet-500',
  },
};

/* ── Mini visuals ──────────────────────────────────────────── */

function SuperbrainVisual() {
  return (
    <div className="relative flex items-center justify-center h-32">
      {/* Node constellation */}
      {[
        { x: '20%', y: '25%' },
        { x: '50%', y: '15%' },
        { x: '80%', y: '30%' },
        { x: '35%', y: '60%' },
        { x: '65%', y: '55%' },
        { x: '50%', y: '85%' },
      ].map((pos, i) => (
        <motion.div
          key={i}
          className="absolute h-2 w-2 rounded-full bg-emerald-400/60"
          style={{ left: pos.x, top: pos.y }}
          animate={{ scale: [1, 1.5, 1], opacity: [0.4, 0.9, 0.4] }}
          transition={{ duration: 2.5, delay: i * 0.3, repeat: Infinity }}
        />
      ))}
      {/* Central pulse */}
      <motion.div
        className="h-6 w-6 rounded-full bg-emerald-500/30 ring-1 ring-emerald-500/40"
        animate={{ scale: [1, 1.3, 1] }}
        transition={{ duration: 3, repeat: Infinity }}
      />
    </div>
  );
}

function OrchestratorVisual() {
  const sources = ['NPPES', 'CA-BRN', 'NPDB', 'OIG'];
  return (
    <div className="flex flex-col gap-1.5 h-32 justify-center">
      {sources.map((src, i) => (
        <motion.div
          key={src}
          className="flex items-center gap-2"
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 + i * 0.15 }}
        >
          <motion.span
            className="h-1.5 w-1.5 rounded-full bg-cyan-400"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 2, delay: i * 0.4, repeat: Infinity }}
          />
          <span className="font-mono text-[10px] text-cyan-400/70">{src}</span>
          <span className="flex-1 border-t border-dashed border-cyan-500/15" />
          <span className="text-[10px] text-white/30">✓</span>
        </motion.div>
      ))}
    </div>
  );
}

function DaemonVisual() {
  return (
    <div className="flex items-center justify-center h-32">
      <div className="relative">
        <motion.div
          className="h-16 w-16 rounded-full border border-amber-500/30"
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
        >
          <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-amber-400" />
        </motion.div>
        <motion.div
          className="absolute inset-2 rounded-full border border-amber-500/20"
          animate={{ rotate: -360 }}
          transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
        >
          <span className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 h-1.5 w-1.5 rounded-full bg-amber-300" />
        </motion.div>
        <div className="absolute inset-0 flex items-center justify-center">
          <Eye className="h-5 w-5 text-amber-400/50" />
        </div>
      </div>
    </div>
  );
}

function AuditVisual() {
  const hashes = [
    '0x7f3a…9bc1',
    '0x4be2…11d0',
    '0x9a17…f3c8',
    '0xc41b…7ea9',
  ];
  return (
    <div className="flex flex-col gap-1 h-32 justify-center">
      {hashes.map((hash, i) => (
        <motion.div
          key={hash}
          className="flex items-center gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 + i * 0.12 }}
        >
          <span className="font-mono text-[10px] text-violet-400/60">{hash}</span>
          <span className="flex-1 border-t border-violet-500/10" />
          {i < hashes.length - 1 && (
            <motion.span
              className="text-[10px] text-violet-400/40"
              animate={{ opacity: [0.2, 0.7, 0.2] }}
              transition={{ duration: 3, delay: i * 0.5, repeat: Infinity }}
            >
              ↓
            </motion.span>
          )}
          {i === hashes.length - 1 && (
            <span className="text-[10px] font-mono text-violet-400/70">root</span>
          )}
        </motion.div>
      ))}
    </div>
  );
}

/* ── BentoGrid ─────────────────────────────────────────────── */

export function BentoGrid() {
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section ref={ref} className="relative px-6 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl">
        {/* Section header */}
        <motion.div
          className="mb-14 text-center"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
        >
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.3em] text-emerald-400/80">
            Architecture
          </p>
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Four engines. One trust layer.
          </h2>
          <p className="mt-4 text-base text-white/40 max-w-2xl mx-auto">
            Purpose-built infrastructure that replaces manual credentialing with
            cryptographic certainty.
          </p>
        </motion.div>

        {/* Grid */}
        <div className="grid gap-4 lg:grid-cols-3">
          {ENGINES.map((engine, i) => {
            const a = ACCENT_CLASSES[engine.accent];
            const Visual = engine.visual;
            return (
              <motion.article
                key={engine.title}
                className={[
                  engine.span,
                  'group relative overflow-hidden rounded-2xl border bg-black/40 backdrop-blur-md p-6 transition-colors duration-300',
                  a.border,
                ].join(' ')}
                initial={{ opacity: 0, y: 24 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.1 * i }}
              >
                {/* Subtle corner glow */}
                <div
                  className={`pointer-events-none absolute -top-20 -right-20 h-40 w-40 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${a.glow}`}
                  aria-hidden="true"
                />

                <div className="relative z-10 flex flex-col h-full">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg ${a.bg}`}>
                        <engine.icon className={`h-4.5 w-4.5 ${a.text}`} />
                      </div>
                      <h3 className="text-lg font-semibold text-white">
                        {engine.title}
                      </h3>
                      <p className={`mt-0.5 text-xs font-semibold uppercase tracking-[0.2em] ${a.text} opacity-70`}>
                        {engine.subtitle}
                      </p>
                    </div>

                    {/* Mini visual on larger cards */}
                    <div className="hidden sm:block w-36 shrink-0">
                      <Visual />
                    </div>
                  </div>

                  <p className="text-sm leading-relaxed text-white/45 mt-auto">
                    {engine.description}
                  </p>
                </div>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
