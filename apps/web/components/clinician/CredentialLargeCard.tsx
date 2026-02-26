'use client';

import type { CredentialItem, CredentialStatus, ClaimLevel } from '@/lib/api';
import { AnimatePresence, motion } from 'framer-motion';
import { useState, useRef, useEffect } from 'react';

/* ------------------------------------------------------------------ */
/*  Status & Claim helpers                                             */
/* ------------------------------------------------------------------ */

const STATUS_STYLES: Record<CredentialStatus, string> = {
  Valid: 'bg-green-100 text-green-800',
  Expiring: 'bg-yellow-100 text-yellow-800',
  Revoked: 'bg-red-100 text-red-800',
  Pending: 'bg-gray-100 text-gray-600',
};

const CLAIM_LABELS: Record<ClaimLevel, string> = {
  L0: 'Unverified',
  L1: 'Self-Reported',
  L2: 'Doc Verified',
  L3: 'PSV Verified',
};

const CLAIM_STYLES: Record<ClaimLevel, string> = {
  L0: 'bg-gray-100 text-gray-700',
  L1: 'bg-blue-50 text-blue-700',
  L2: 'bg-indigo-100 text-indigo-800',
  L3: 'bg-emerald-100 text-emerald-800',
};

/* ------------------------------------------------------------------ */
/*  Ellipsis menu                                                      */
/* ------------------------------------------------------------------ */

function EllipsisMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className="flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg hover:bg-gray-100 transition-colors text-xl font-bold text-gray-500"
        aria-label="More actions"
      >
        ⋯
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 rounded-xl border border-gray-200 bg-white shadow-lg z-20 py-1">
          {['Share', 'Copy CRS link', 'Show QR'].map((action) => (
            <button
              key={action}
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
              }}
              className="block w-full text-left px-4 py-2.5 min-h-[44px] text-lg hover:bg-gray-50 transition-colors"
            >
              {action}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  AuditScrapbook timeline                                            */
/* ------------------------------------------------------------------ */

function AuditScrapbook({ credential }: { credential: CredentialItem }) {
  const audit = credential.audit;

  const entries = [
    {
      label: 'PSV Artifact Trace',
      value: audit?.psvArtifactTrace ?? 'trace://psv/ca-medical-board/2024-Q3',
    },
    {
      label: 'Source Queried',
      value: audit?.sourceQueried ?? 'Medical Board of California — BREEZE API',
    },
    {
      label: 'Queried At',
      value: audit?.sourceQueriedAt ?? '2024-08-15T14:32:00Z',
    },
    {
      label: 'Raw Snapshot Hash (SHA-256)',
      value:
        audit?.rawSnapshotHash ??
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    },
    {
      label: 'Verifier DID',
      value: credential.verifierDID ?? 'did:web:vitalcv.com:verifier:psv-engine-v2',
    },
    {
      label: 'Methodology Version',
      value: credential.methodologyVersion ?? 'MethodologySpec v2.3.1',
    },
  ];

  return (
    <div className="space-y-4">
      <h4 className="text-lg font-semibold text-gray-900">Audit Scrapbook</h4>
      <div className="relative pl-6 border-l-2 border-gray-200 space-y-4">
        {entries.map((entry) => (
          <div key={entry.label} className="relative">
            <div className="absolute -left-[25px] top-1.5 w-3 h-3 rounded-full bg-gray-300" />
            <p className="text-sm font-medium uppercase tracking-wider text-gray-500">
              {entry.label}
            </p>
            <p className="text-lg text-gray-900 break-all">{entry.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  CredentialLargeCard                                                */
/* ------------------------------------------------------------------ */

export function CredentialLargeCard({
  credential,
  onFocusMode,
}: {
  credential: CredentialItem;
  onFocusMode?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const expiryFormatted = credential.expirationDate
    ? new Date(credential.expirationDate).toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      })
    : 'No expiry';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setExpanded((prev) => !prev)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setExpanded((prev) => !prev);
        }
      }}
      className="w-full rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer"
    >
      {/* Collapsed header */}
      <div className="px-6 py-5 flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0 space-y-3">
          {/* Row 1: Issuer + badges */}
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-bold text-gray-900 truncate">
              {credential.issuer}
            </h3>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${STATUS_STYLES[credential.status]}`}
            >
              {credential.status}
            </span>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${CLAIM_STYLES[credential.claimLevel]}`}
            >
              {credential.claimLevel} — {CLAIM_LABELS[credential.claimLevel]}
            </span>
          </div>

          {/* Row 2: Scope + Expiry + PoU */}
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-lg text-gray-700">
            <span>
              <span className="text-gray-500">Scope:</span> {credential.scope}
            </span>
            <span>
              <span className="text-gray-500">Exp:</span> {expiryFormatted}
            </span>
            {credential.pouBinding && (
              <span>
                <span className="text-gray-500">PoU:</span> {credential.pouBinding}
              </span>
            )}
          </div>
        </div>

        {/* Right side: actions */}
        <div className="flex items-center gap-1 shrink-0">
          {onFocusMode && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onFocusMode();
              }}
              className="flex items-center justify-center min-h-[44px] min-w-[44px] rounded-lg hover:bg-gray-100 transition-colors text-gray-500 text-sm font-medium"
              aria-label="Focus mode"
            >
              Focus
            </button>
          )}
          <EllipsisMenu />
        </div>
      </div>

      {/* Expanded: AuditScrapbook */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="audit"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-6 pt-2 border-t border-gray-100">
              <AuditScrapbook credential={credential} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
