'use client';

import { AnimatePresence, motion, type Variants } from 'framer-motion';
import { CheckCircle2, Sparkles } from 'lucide-react';
import { useState } from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ExtractedField {
  id: string;
  section: 'Identity' | 'License' | 'Practice';
  label: string;
  value: string;
  confidence: number; // 0–100
}

type ConfirmState = 'idle' | 'loading' | 'done';

/* ------------------------------------------------------------------ */
/*  Mock data — Dr. Robert Kim, CA License                            */
/* ------------------------------------------------------------------ */

const MOCK_EXTRACTED: ExtractedField[] = [
  { id: 'name',         section: 'Identity', label: 'Full Name',           value: 'Dr. Robert Kim',              confidence: 99 },
  { id: 'npi',          section: 'Identity', label: 'NPI Number',          value: '1003000126',                  confidence: 99 },
  { id: 'license',      section: 'License',  label: 'License Number',      value: 'CA-98765',                    confidence: 98 },
  { id: 'license_type', section: 'License',  label: 'License Type',        value: 'Physician & Surgeon',         confidence: 97 },
  { id: 'issuer',       section: 'License',  label: 'Issuing Authority',   value: 'California Medical Board',    confidence: 99 },
  { id: 'issue_date',   section: 'License',  label: 'Issue Date',          value: 'March 15, 2022',              confidence: 96 },
  { id: 'exp_date',     section: 'License',  label: 'Expiration Date',     value: 'March 15, 2026',              confidence: 96 },
  { id: 'specialty',    section: 'Practice', label: 'Specialty',           value: 'Internal Medicine',           confidence: 94 },
  { id: 'status',       section: 'Practice', label: 'License Status',      value: 'Active',                      confidence: 99 },
];

/* ------------------------------------------------------------------ */
/*  Animation variants                                                 */
/* ------------------------------------------------------------------ */

const containerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.065, delayChildren: 0.12 } },
};

const rowVariants: Variants = {
  hidden: { opacity: 0, x: -10 },
  show:   { opacity: 1, x: 0,  transition: { duration: 0.28, ease: 'easeOut' } },
};

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface ExtractedDataReviewProps {
  filename: string;
  onConfirm: () => void;
}

/* ================================================================== */
/*  ExtractedDataReview                                                */
/* ================================================================== */

export function ExtractedDataReview({ filename, onConfirm }: ExtractedDataReviewProps) {
  const [confirmState, setConfirmState] = useState<ConfirmState>('idle');

  function handleConfirm() {
    if (confirmState !== 'idle') return;
    setConfirmState('loading');
    setTimeout(() => {
      setConfirmState('done');
      setTimeout(() => onConfirm(), 700);
    }, 900);
  }

  // Group fields by section, preserving insertion order
  const sections = MOCK_EXTRACTED.reduce<Record<string, ExtractedField[]>>((acc, f) => {
    if (!acc[f.section]) acc[f.section] = [];
    acc[f.section].push(f);
    return acc;
  }, {});

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.38, ease: 'easeOut' }}
      className="w-full"
    >
      {/* ── Header ───────────────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-4 w-4" style={{ color: 'var(--trust-green)' }} />
            <p
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: 'var(--trust-green)' }}
            >
              AI Extraction Complete
            </p>
          </div>
          <h2 className="text-xl font-bold text-foreground">Review Extracted Data</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Confirm the fields below before adding to your wallet.
          </p>
        </div>

        <div
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border"
          style={{
            backgroundColor: 'color-mix(in oklch, var(--trust-green) 10%, transparent)',
            borderColor: 'color-mix(in oklch, var(--trust-green) 25%, transparent)',
          }}
        >
          <CheckCircle2 className="h-3.5 w-3.5" style={{ color: 'var(--trust-green)' }} />
          <span className="text-xs font-semibold" style={{ color: 'var(--trust-green)' }}>
            {MOCK_EXTRACTED.length} fields
          </span>
        </div>
      </div>

      {/* ── Glass card ───────────────────────────────────────────── */}
      <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-white/40 shadow-lg overflow-hidden">

        {/* Source file strip */}
        <div className="px-5 py-2.5 bg-muted/30 border-b border-border/30 flex items-center gap-2">
          <motion.span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: 'var(--trust-green)' }}
            animate={{ opacity: [1, 0.35, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <p className="text-xs font-mono text-muted-foreground truncate flex-1">{filename}</p>
          <span
            className="ml-auto text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--trust-green)', opacity: 0.8 }}
          >
            Parsed
          </span>
        </div>

        {/* Sections + rows */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="divide-y divide-border/20"
        >
          {Object.entries(sections).map(([sectionName, fields]) => (
            <div key={sectionName}>
              {/* Section label */}
              <div className="px-5 py-2 bg-muted/20">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                  {sectionName}
                </p>
              </div>

              {/* Field rows */}
              {fields.map((field) => (
                <motion.div
                  key={field.id}
                  variants={rowVariants}
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/10 transition-colors"
                >
                  <div className="flex-1 min-w-0 pr-3">
                    <p className="text-xs text-muted-foreground mb-0.5">{field.label}</p>
                    <p
                      className="text-base font-semibold truncate"
                      style={{
                        color: field.id === 'status' ? 'var(--trust-green)' : undefined,
                      }}
                    >
                      {field.value}
                    </p>
                  </div>
                  <ConfidenceBadge confidence={field.confidence} />
                </motion.div>
              ))}
            </div>
          ))}
        </motion.div>
      </div>

      {/* ── CTA ──────────────────────────────────────────────────── */}
      <div className="mt-5">
        <AnimatePresence mode="wait">
          {confirmState === 'done' ? (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="flex items-center justify-center gap-2.5 min-h-[52px] rounded-xl border text-base font-semibold"
              style={{
                backgroundColor: 'color-mix(in oklch, var(--trust-green) 8%, transparent)',
                borderColor: 'color-mix(in oklch, var(--trust-green) 30%, transparent)',
                color: 'var(--trust-green)',
              }}
            >
              <CheckCircle2 className="h-5 w-5" />
              Added to Wallet
            </motion.div>
          ) : (
            <motion.button
              key="cta"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleConfirm}
              disabled={confirmState === 'loading'}
              className="w-full min-h-[52px] rounded-xl bg-foreground text-background
                         text-base font-bold hover:opacity-90 active:opacity-80
                         transition-opacity disabled:opacity-60
                         focus-visible:outline-none focus-visible:ring-2
                         focus-visible:ring-foreground focus-visible:ring-offset-2
                         flex items-center justify-center gap-2.5"
            >
              {confirmState === 'loading' ? (
                <>
                  <motion.span
                    className="inline-block h-4 w-4 rounded-full border-2"
                    style={{ borderColor: 'rgba(255,255,255,0.25)', borderTopColor: 'rgba(255,255,255,0.9)' }}
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.75, repeat: Infinity, ease: 'linear' }}
                  />
                  Adding to Wallet…
                </>
              ) : (
                'Confirm & Add to Wallet'
              )}
            </motion.button>
          )}
        </AnimatePresence>

        <p className="text-xs text-muted-foreground text-center mt-3">
          Fields are editable after import&nbsp;·&nbsp;Encrypted at rest
        </p>
      </div>
    </motion.div>
  );
}

/* ================================================================== */
/*  ConfidenceBadge                                                    */
/* ================================================================== */

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const isHigh = confidence >= 95;
  return (
    <div
      className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold border"
      style={
        isHigh
          ? {
              backgroundColor: 'color-mix(in oklch, var(--trust-green) 10%, transparent)',
              borderColor:     'color-mix(in oklch, var(--trust-green) 25%, transparent)',
              color:           'var(--trust-green)',
            }
          : {
              backgroundColor: 'oklch(0.97 0.04 85)',
              borderColor:     'oklch(0.85 0.09 85)',
              color:           'oklch(0.45 0.12 60)',
            }
      }
    >
      <CheckCircle2 className="h-3 w-3" />
      {confidence}%
    </div>
  );
}
