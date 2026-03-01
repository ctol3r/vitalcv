'use client';

import { AnimatePresence, motion, type Variants } from 'framer-motion';
import { FileText, UploadCloud } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ScanPhase = 'idle' | 'dragover' | 'processing' | 'done';

const STATUS_SEQUENCE = [
  'Reading document structure…',
  'Extracting NPI and license entities…',
  'Verifying cryptographic signature…',
  'Mapping to NPPES registry…',
  'Parsing complete.',
] as const;

const MOCK_FILENAME = 'medical_license_CA_2026.pdf';

/* ------------------------------------------------------------------ */
/*  Shared motion config                                               */
/* ------------------------------------------------------------------ */

const panelVariants: Variants = {
  enter: { opacity: 0, scale: 0.97, y: 8 },
  center: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
  exit: { opacity: 0, scale: 0.97, y: -8, transition: { duration: 0.2 } },
};

/* ================================================================== */
/*  DocumentDropzone — public export                                   */
/* ================================================================== */

export interface DocumentDropzoneProps {
  /** Called when the scan + "Parsing complete" flash finishes (≈3.1s). */
  onComplete: (filename: string) => void;
}

export function DocumentDropzone({ onComplete }: DocumentDropzoneProps) {
  const [phase, setPhase] = useState<ScanPhase>('idle');
  const [filename, setFilename] = useState('');
  const [statusIndex, setStatusIndex] = useState(0);

  const statusTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function startProcessing(name: string) {
    setFilename(name);
    setPhase('processing');
    setStatusIndex(0);

    let idx = 0;
    statusTimerRef.current = setInterval(() => {
      idx += 1;
      if (idx < STATUS_SEQUENCE.length) {
        setStatusIndex(idx);
      } else {
        clearInterval(statusTimerRef.current ?? undefined);
      }
    }, 480);

    // After 2.5s: flash "done", then call parent
    completeTimerRef.current = setTimeout(() => {
      clearInterval(statusTimerRef.current ?? undefined);
      setStatusIndex(STATUS_SEQUENCE.length - 1);
      setPhase('done');
      setTimeout(() => onComplete(name), 650);
    }, 2500);
  }

  useEffect(() => {
    return () => {
      if (statusTimerRef.current) clearInterval(statusTimerRef.current);
      if (completeTimerRef.current) clearTimeout(completeTimerRef.current);
    };
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (phase === 'idle') setPhase('dragover');
  };
  const handleDragLeave = () => {
    if (phase === 'dragover') setPhase('idle');
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) startProcessing(file.name);
  };
  const handleClick = () => {
    if (phase !== 'idle' && phase !== 'dragover') return;
    startProcessing(MOCK_FILENAME);
  };

  return (
    <div className="relative w-full">
      <AnimatePresence mode="wait">
        {phase === 'idle' || phase === 'dragover' ? (
          <DropzoneIdle
            key="idle"
            isDragOver={phase === 'dragover'}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleClick}
          />
        ) : (
          <ScanningPanel
            key="scanning"
            filename={filename}
            statusText={STATUS_SEQUENCE[statusIndex]}
            isDone={phase === 'done'}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ================================================================== */
/*  DropzoneIdle                                                       */
/* ================================================================== */

interface DropzoneIdleProps {
  isDragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onClick: () => void;
}

function DropzoneIdle({ isDragOver, onDragOver, onDragLeave, onDrop, onClick }: DropzoneIdleProps) {
  return (
    <motion.div
      variants={panelVariants}
      initial="enter"
      animate="center"
      exit="exit"
    >
      <motion.button
        type="button"
        role="button"
        aria-label="Upload or drop a medical credential document"
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={onClick}
        animate={{
          borderColor: isDragOver ? 'var(--accent)' : 'rgba(0,0,0,0.12)',
          backgroundColor: isDragOver ? 'rgba(191,211,231,0.12)' : 'rgba(0,0,0,0.01)',
          scale: isDragOver ? 1.015 : 1,
        }}
        whileHover={{
          borderColor: 'var(--accent)',
          backgroundColor: 'rgba(191,211,231,0.08)',
          scale: 1.01,
        }}
        transition={{ duration: 0.2 }}
        className={`
          w-full min-h-[220px] rounded-2xl border-2 border-dashed
          flex flex-col items-center justify-center gap-4
          cursor-pointer focus-visible:outline-none
          focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2
          px-6 py-10
        `}
        style={{ borderColor: 'rgba(0,0,0,0.12)' }}
      >
        {/* Icon */}
        <motion.div
          animate={{ y: isDragOver ? -4 : 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          className="flex flex-col items-center gap-3"
        >
          <div className="h-14 w-14 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center">
            <UploadCloud className="h-7 w-7 text-[var(--accent)] opacity-70" />
          </div>

          <div className="text-center">
            <p className="text-base font-semibold text-foreground">
              {isDragOver ? 'Release to scan' : 'Drop your credential document'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              PDF, DOCX · Medical license, DEA, Board cert
            </p>
          </div>
        </motion.div>

        {/* Mock file prompt */}
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-muted/50 border border-border/40">
          <FileText className="h-4 w-4 text-muted-foreground/60 shrink-0" />
          <span className="text-xs text-muted-foreground/70">
            No file? Click to demo with a mock license
          </span>
        </div>
      </motion.button>
    </motion.div>
  );
}

/* ================================================================== */
/*  ScanningPanel                                                      */
/* ================================================================== */

interface ScanningPanelProps {
  filename: string;
  statusText: string;
  isDone: boolean;
}

// Fake text-line widths inside the document silhouette
const DOCUMENT_LINES = [
  '70%', '90%', '55%', '85%', '40%', '78%',
  '60%', '88%', '50%', '72%', '65%', '80%',
];

function ScanningPanel({ filename, statusText, isDone }: ScanningPanelProps) {
  return (
    <motion.div
      variants={panelVariants}
      initial="enter"
      animate="center"
      exit="exit"
      className={`
        w-full rounded-2xl border px-6 py-8 flex flex-col items-center gap-6
        transition-colors duration-500
        ${isDone
          ? 'bg-[var(--trust-green)]/5 border-[var(--trust-green)]/30'
          : 'bg-muted/30 border-border/40'
        }
      `}
    >
      {/* Filename chip */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-background border border-border/50 shadow-sm">
        <FileText className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
        <span className="text-xs font-mono text-muted-foreground truncate max-w-[200px]">
          {filename}
        </span>
      </div>

      {/* Document silhouette + laser */}
      <DocumentSilhouette isDone={isDone} />

      {/* Status text */}
      <AnimatePresence mode="wait">
        <motion.p
          key={statusText}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
          className={`text-sm font-medium text-center ${
            isDone ? 'text-[var(--trust-green)]' : 'text-muted-foreground'
          }`}
        >
          {isDone ? '✓ ' : ''}{statusText}
        </motion.p>
      </AnimatePresence>

      {/* Progress bar */}
      {!isDone && (
        <div className="w-full max-w-xs h-1 bg-border/30 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'var(--accent)' }}
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 2.5, ease: 'easeInOut' }}
          />
        </div>
      )}
    </motion.div>
  );
}

/* ================================================================== */
/*  DocumentSilhouette — the "Aha!" visual core                       */
/* ================================================================== */

function DocumentSilhouette({ isDone }: { isDone: boolean }) {
  // Document total inner height for laser travel
  const DOC_HEIGHT = 256; // px — matches h-64 below

  return (
    <div className="relative select-none" style={{ width: 180, height: DOC_HEIGHT }}>
      {/* Paper card */}
      <motion.div
        className="absolute inset-0 rounded-lg shadow-md overflow-hidden"
        animate={{
          boxShadow: isDone
            ? '0 0 0 2px rgba(var(--trust-green-rgb, 94,186,125), 0.4), 0 4px 24px rgba(0,0,0,0.08)'
            : '0 4px 24px rgba(0,0,0,0.08)',
        }}
        style={{ backgroundColor: 'white' }}
      >
        {/* Document header stripe */}
        <div className="h-10 px-3 flex flex-col justify-center border-b border-gray-100 bg-gray-50/80">
          <div className="h-2 w-20 bg-gray-300 rounded-full" />
          <div className="h-1.5 w-12 bg-gray-200 rounded-full mt-1" />
        </div>

        {/* Document body — fake text lines */}
        <div className="px-3 pt-3 space-y-[7px]">
          {DOCUMENT_LINES.map((w, i) => (
            <motion.div
              key={i}
              className="rounded-full"
              style={{ width: w, height: 6 }}
              animate={isDone
                ? { backgroundColor: 'rgba(94,186,125,0.25)' }
                : { backgroundColor: 'rgb(229,231,235)' }
              }
              transition={{ delay: isDone ? i * 0.04 : 0, duration: 0.3 }}
            />
          ))}
        </div>
      </motion.div>

      {/* Laser scan line — only visible during processing */}
      {!isDone && (
        <motion.div
          className="absolute left-0 right-0 pointer-events-none"
          style={{ height: 3 }}
          initial={{ y: 0 }}
          animate={{ y: [0, DOC_HEIGHT - 3, 0] }}
          transition={{
            duration: 1.6,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          {/* Core laser line */}
          <div
            className="w-full h-full"
            style={{
              background:
                'linear-gradient(to right, transparent 0%, rgba(45,212,191,0.9) 35%, rgba(45,212,191,1) 50%, rgba(45,212,191,0.9) 65%, transparent 100%)',
              boxShadow: '0 0 8px 3px rgba(45,212,191,0.55), 0 0 2px 1px rgba(45,212,191,0.9)',
            }}
          />
        </motion.div>
      )}

      {/* Done checkmark overlay */}
      <AnimatePresence>
        {isDone && (
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 18 }}
            className="absolute inset-0 flex items-center justify-center rounded-lg"
            style={{ backgroundColor: 'rgba(255,255,255,0.65)', backdropFilter: 'blur(2px)' }}
          >
            <div
              className="h-14 w-14 rounded-full flex items-center justify-center"
              style={{ backgroundColor: 'rgba(94,186,125,0.15)', border: '2px solid rgba(94,186,125,0.5)' }}
            >
              <motion.span
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 400, damping: 15 }}
                className="text-3xl leading-none"
                style={{ color: 'var(--trust-green)' }}
              >
                &#10003;
              </motion.span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
