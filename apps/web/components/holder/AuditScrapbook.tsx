'use client';

import { motion } from 'framer-motion';

import type { HolderCredential } from '@/types/holder';

/* ------------------------------------------------------------------ */
/*  AuditScrapbook — expanded credential audit timeline + integrity    */
/* ------------------------------------------------------------------ */

function truncateHash(hash: string, chars = 12): string {
  if (hash.length <= chars * 2 + 3) return hash;
  return `${hash.slice(0, chars)}…${hash.slice(-chars)}`;
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

interface AuditScrapbookProps {
  credential: HolderCredential;
}

export function AuditScrapbook({ credential }: AuditScrapbookProps) {
  const { auditTrail, methodologyVersion, rawSnapshotHash, verifierDID } =
    credential;

  const hasTimeline = auditTrail.length > 0;

  /* Static integrity entries built from credential metadata */
  const integrityEntries = [
    methodologyVersion && {
      label: 'Methodology Version',
      value: methodologyVersion,
    },
    rawSnapshotHash && {
      label: 'Artifact Hash (SHA-256)',
      value: truncateHash(rawSnapshotHash),
      full: rawSnapshotHash,
    },
    verifierDID && {
      label: 'Verifier DID',
      value: verifierDID,
    },
  ].filter(Boolean) as { label: string; value: string; full?: string }[];

  return (
    <div className="space-y-6">
      {/* Audit trail timeline */}
      {hasTimeline && (
        <div>
          <h4 className="text-lg font-semibold text-gray-900 mb-4">
            Verification Timeline
          </h4>
          <div className="relative pl-6 border-l-2 border-neutral-200 space-y-5">
            {auditTrail.map((event, index) => (
              <motion.div
                key={`${event.timestamp}-${index}`}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="relative"
              >
                {/* Timeline dot */}
                <div className="absolute -left-[25px] top-1.5 h-3 w-3 rounded-full bg-[var(--trust-green)]" />

                <p className="text-sm font-medium uppercase tracking-wider text-gray-500">
                  {formatTimestamp(event.timestamp)}
                </p>
                <p className="text-lg text-gray-900 mt-0.5">
                  {event.action}
                </p>
                <p className="text-sm text-gray-500 mt-0.5">
                  {event.actor}
                  {event.hash && (
                    <span className="ml-2 font-mono text-xs text-gray-400">
                      {truncateHash(event.hash, 8)}
                    </span>
                  )}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Integrity block */}
      {integrityEntries.length > 0 && (
        <div>
          {hasTimeline && (
            <h4 className="text-lg font-semibold text-gray-900 mb-4">
              Integrity Data
            </h4>
          )}
          {!hasTimeline && (
            <h4 className="text-lg font-semibold text-gray-900 mb-4">
              Audit Scrapbook
            </h4>
          )}
          <div className="space-y-3">
            {integrityEntries.map((entry) => (
              <div key={entry.label}>
                <p className="text-sm font-medium uppercase tracking-wider text-gray-500">
                  {entry.label}
                </p>
                <p
                  className="text-lg text-gray-900 break-all"
                  title={entry.full}
                >
                  {entry.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!hasTimeline && integrityEntries.length === 0 && (
        <p className="text-lg text-gray-500">
          No audit data available for this credential.
        </p>
      )}
    </div>
  );
}
