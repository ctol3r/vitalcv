'use client';

/**
 * VerificationArtifacts.tsx — Wave 88: Passport Artifact Display
 *
 * Shows credential, issuer, verification timestamp, artifact hash.
 */

import { motion } from 'framer-motion';

export interface ArtifactEntry {
  id: string;
  issuer: string;
  hash: string | null;
  timestamp: string;
  decisionGrade?: boolean;
}

interface VerificationArtifactsProps {
  artifacts: ArtifactEntry[];
  className?: string;
}

export function VerificationArtifacts({ artifacts, className = '' }: VerificationArtifactsProps) {
  if (artifacts.length === 0) {
    return <p className="text-xs text-vt-neutral-600 py-4 text-center">No verification artifacts</p>;
  }

  return (
    <div className={`space-y-1 ${className}`}>
      {artifacts.map((art, i) => (
        <motion.div
          key={art.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05, duration: 0.2 }}
          className="px-3 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.05]"
        >
          <div className="flex items-center justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <span className="text-[11px] text-vt-neutral-300 font-medium truncate">{art.issuer}</span>
              {art.decisionGrade === true ? (
                <span className="inline-flex shrink-0 rounded-full border border-[var(--vt-badge-success-border)] bg-[var(--vt-badge-success-bg)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--vt-badge-success-text)]">
                  Source-backed
                </span>
              ) : null}
              {art.decisionGrade === false ? (
                <span className="inline-flex shrink-0 rounded-full border border-[var(--vt-badge-neutral-border)] bg-[var(--vt-badge-neutral-bg)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--vt-badge-neutral-text)]">
                  Informational only
                </span>
              ) : null}
            </div>
            <span className="text-[9px] text-vt-neutral-600">{new Date(art.timestamp).toLocaleDateString()}</span>
          </div>
          {art.hash && (
            <p className="text-[9px] text-vt-neutral-600 font-mono mt-1 truncate">{art.hash}</p>
          )}
        </motion.div>
      ))}
    </div>
  );
}

export default VerificationArtifacts;
