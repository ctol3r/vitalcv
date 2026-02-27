'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import { cn } from '@/lib/utils';
import type { HolderCredential } from '@/types/holder';
import { AuditScrapbook } from './AuditScrapbook';
import { StatusPill } from './StatusPill';

/* ------------------------------------------------------------------ */
/*  CredentialCard — Liquid Glass credential tile with audit expand    */
/* ------------------------------------------------------------------ */

const TRUST_LABELS: Record<string, string> = {
  L0: 'Unverified',
  L1: 'Self-Attested',
  L2: 'Source-Checked',
  L3: 'PSV Verified',
};

interface CredentialCardProps {
  credential: HolderCredential;
  onFocusMode: (c: HolderCredential) => void;
  className?: string;
}

export function CredentialCard({
  credential,
  onFocusMode,
  className,
}: CredentialCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={cn(
        'bg-white/80 backdrop-blur-md rounded-2xl border border-white/30 shadow-lg',
        'p-6 flex flex-col gap-4 cursor-pointer select-none',
        className,
      )}
      onClick={() => setExpanded((prev) => !prev)}
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setExpanded((prev) => !prev);
        }
      }}
    >
      {/* Top row — type badge + status */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium uppercase tracking-wider text-gray-500">
          {credential.type}
        </span>
        <StatusPill state={credential.state} />
      </div>

      {/* Title + issuer */}
      <div>
        <h3 className="text-2xl font-semibold text-gray-900">
          {credential.name}
        </h3>
        <p className="text-lg text-gray-600 mt-1">{credential.issuer}</p>
      </div>

      {/* Details row */}
      <div className="flex flex-wrap gap-x-6 gap-y-1">
        {credential.licenseNumber && (
          <p className="text-lg text-gray-700">
            <span className="text-gray-400">License #</span>{' '}
            {credential.licenseNumber}
          </p>
        )}
        {credential.npi && (
          <p className="text-lg text-gray-700">
            <span className="text-gray-400">NPI</span> {credential.npi}
          </p>
        )}
        <p className="text-lg text-gray-700">
          <span className="text-gray-400">Trust</span>{' '}
          {TRUST_LABELS[credential.trustLevel] ?? credential.trustLevel}
        </p>
      </div>

      {/* Dates */}
      <div className="flex flex-wrap gap-x-6 gap-y-1">
        <p className="text-base text-gray-500">
          Issued {credential.issueDate}
        </p>
        {credential.expirationDate && (
          <p className="text-base text-gray-500">
            Expires {credential.expirationDate}
          </p>
        )}
      </div>

      {/* Expandable audit section */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="audit-expand"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="pt-4 border-t border-gray-200">
              <AuditScrapbook credential={credential} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer — Show QR button */}
      <button
        type="button"
        className={cn(
          'min-h-[44px] w-full rounded-xl',
          'bg-gray-900 text-white text-lg font-medium',
          'hover:bg-gray-800 active:bg-gray-700 transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 focus-visible:ring-offset-2',
        )}
        onClick={(e) => {
          e.stopPropagation();
          onFocusMode(credential);
        }}
      >
        Show QR
      </button>
    </motion.div>
  );
}
