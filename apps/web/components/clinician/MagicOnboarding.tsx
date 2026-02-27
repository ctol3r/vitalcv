'use client';

import { AnimatePresence, motion, type Variants } from 'framer-motion';
import { CheckCircle2, FileSearch, Wallet } from 'lucide-react';
import { useState } from 'react';
import { DocumentDropzone } from './DocumentDropzone';
import { ExtractedDataReview } from './ExtractedDataReview';

/* ------------------------------------------------------------------ */
/*  State machine                                                      */
/* ------------------------------------------------------------------ */

type MagicPhase = 'dropzone' | 'review' | 'complete';

/* ------------------------------------------------------------------ */
/*  Panel transition variants                                          */
/* ------------------------------------------------------------------ */

const panelVariants: Variants = {
  enter:  { opacity: 0, y: 14, scale: 0.98 },
  center: { opacity: 1, y: 0,  scale: 1,   transition: { duration: 0.38, ease: 'easeOut' } },
  exit:   { opacity: 0, y: -10, scale: 0.98, transition: { duration: 0.22 } },
};

/* ================================================================== */
/*  MagicOnboarding — parent orchestrator                             */
/* ================================================================== */

export function MagicOnboarding() {
  const [phase, setPhase]       = useState<MagicPhase>('dropzone');
  const [filename, setFilename] = useState('');

  function handleScanComplete(name: string) {
    setFilename(name);
    setPhase('review');
  }

  function handleConfirm() {
    setPhase('complete');
  }

  function handleReset() {
    setFilename('');
    setPhase('dropzone');
  }

  return (
    <div className="w-full">
      {/* Step indicator */}
      <StepIndicator phase={phase} />

      {/* Main panel — AnimatePresence swaps between phases */}
      <div className="mt-7">
        <AnimatePresence mode="wait">
          {phase === 'dropzone' && (
            <motion.div key="dropzone" variants={panelVariants} initial="enter" animate="center" exit="exit">
              <DocumentDropzone onComplete={handleScanComplete} />
            </motion.div>
          )}

          {phase === 'review' && (
            <motion.div key="review" variants={panelVariants} initial="enter" animate="center" exit="exit">
              <ExtractedDataReview filename={filename} onConfirm={handleConfirm} />
            </motion.div>
          )}

          {phase === 'complete' && (
            <motion.div key="complete" variants={panelVariants} initial="enter" animate="center" exit="exit">
              <CompletionBanner onReset={handleReset} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  StepIndicator                                                      */
/* ================================================================== */

const STEPS: { id: MagicPhase | 'dropzone'; label: string; icon: React.ElementType }[] = [
  { id: 'dropzone', label: 'Upload',    icon: FileSearch },
  { id: 'review',   label: 'Review',   icon: CheckCircle2 },
  { id: 'complete', label: 'In Wallet', icon: Wallet },
];

const PHASE_ORDER: MagicPhase[] = ['dropzone', 'review', 'complete'];

function StepIndicator({ phase }: { phase: MagicPhase }) {
  const currentIndex = PHASE_ORDER.indexOf(phase);

  return (
    <div className="flex items-center justify-center gap-0">
      {STEPS.map((step, i) => {
        const stepIndex = PHASE_ORDER.indexOf(step.id as MagicPhase);
        const isComplete = stepIndex < currentIndex;
        const isActive   = stepIndex === currentIndex;
        const Icon       = step.icon;

        return (
          <div key={step.id} className="flex items-center">
            {/* Step circle */}
            <motion.div
              animate={{
                backgroundColor: isComplete || isActive
                  ? 'var(--foreground)'
                  : 'transparent',
                borderColor: isComplete || isActive
                  ? 'var(--foreground)'
                  : 'rgba(0,0,0,0.15)',
              }}
              transition={{ duration: 0.3 }}
              className="relative h-8 w-8 rounded-full border-2 flex items-center justify-center"
            >
              <Icon
                className="h-3.5 w-3.5"
                style={{ color: isComplete || isActive ? 'var(--background)' : 'rgba(0,0,0,0.3)' }}
              />

              {/* Active pulse ring */}
              {isActive && (
                <motion.span
                  className="absolute inset-0 rounded-full"
                  style={{ border: '2px solid var(--foreground)' }}
                  initial={{ opacity: 0.6, scale: 1 }}
                  animate={{ opacity: 0, scale: 1.55 }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }}
                />
              )}
            </motion.div>

            {/* Label */}
            <span
              className="ml-1.5 text-xs font-medium"
              style={{ color: isComplete || isActive ? 'var(--foreground)' : 'rgba(0,0,0,0.3)' }}
            >
              {step.label}
            </span>

            {/* Connector line */}
            {i < STEPS.length - 1 && (
              <div className="mx-3 flex-1 relative h-px w-12">
                <div className="absolute inset-0 bg-border/40 rounded-full" />
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ backgroundColor: 'var(--foreground)' }}
                  animate={{ width: stepIndex < currentIndex ? '100%' : '0%' }}
                  transition={{ duration: 0.4, ease: 'easeInOut' }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ================================================================== */
/*  CompletionBanner                                                   */
/* ================================================================== */

function CompletionBanner({ onReset }: { onReset: () => void }) {
  return (
    <div className="text-center py-4">
      {/* Large checkmark */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 280, damping: 18 }}
        className="inline-flex h-20 w-20 rounded-full items-center justify-center mb-6 mx-auto"
        style={{
          backgroundColor: 'color-mix(in oklch, var(--trust-green) 12%, transparent)',
          border: '2px solid color-mix(in oklch, var(--trust-green) 35%, transparent)',
        }}
      >
        <span className="text-4xl leading-none" style={{ color: 'var(--trust-green)' }}>
          &#10003;
        </span>
      </motion.div>

      {/* Glass receipt card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.35, ease: 'easeOut' }}
        className="bg-white/80 backdrop-blur-md rounded-2xl border border-white/40 shadow-lg p-6 mb-6 text-left"
      >
        <p
          className="text-xs font-semibold uppercase tracking-widest mb-1"
          style={{ color: 'var(--trust-green)' }}
        >
          Credential Added
        </p>
        <h3 className="text-xl font-bold text-foreground">Dr. Robert Kim — CA License</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Medical License CA-98765 is now in your VitalCV wallet.
          Share it with any employer in one tap.
        </p>

        <div className="mt-4 pt-4 border-t border-border/20 grid grid-cols-2 gap-3 text-sm">
          {[
            { label: 'Trust Level', value: 'L3' },
            { label: 'Status',      value: 'Active' },
            { label: 'Expires',     value: 'Mar 2026' },
            { label: 'NPI',         value: '1003000126' },
          ].map((item) => (
            <div key={item.label}>
              <p className="text-xs text-muted-foreground">{item.label}</p>
              <p className="font-semibold text-foreground">{item.value}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Actions */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.3 }}
        className="flex flex-col gap-3"
      >
        <button
          className="w-full min-h-[48px] rounded-xl bg-foreground text-background text-base font-bold
                     hover:opacity-90 transition-opacity
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2"
        >
          Go to My Wallet
        </button>
        <button
          onClick={onReset}
          className="w-full min-h-[44px] rounded-xl border border-border/50 text-base text-muted-foreground
                     hover:bg-muted/30 transition-colors
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2"
        >
          Demo Again
        </button>
      </motion.div>
    </div>
  );
}
