'use client';

import { useState } from 'react';

interface CopyableDIDProps {
  did: string;
  className?: string;
}

/**
 * CopyableDID
 *
 * Renders a DID in a select-all code element with a clipboard copy button.
 * Button text changes to "copied" for 1.5s, then reverts. No external deps.
 */

/**
 * 9px type with `leading-none` renders a 9px-tall button — measured at 33×9 on
 * production /verify, well under the 24px floor in WCAG 2.2 AA 2.5.8. This is a
 * real control, not a decorative label, and it sits on the employer-facing
 * verification record.
 *
 * The type size is deliberate, so the hit area is expanded with a transparent
 * `::before` overlay rather than padding: padding would break the
 * `items-baseline` alignment with the DID code beside it. Width (33px) already
 * clears the floor, so only height is lifted. The overlay is invisible and
 * affects no layout.
 */
const COPY_BUTTON_CLASS =
  "relative text-[9px] font-mono text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0 leading-none " +
  "before:absolute before:left-0 before:top-1/2 before:h-6 before:w-full before:-translate-y-1/2 before:content-['']";
export function CopyableDID({ did, className }: CopyableDIDProps) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(did).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <span className={`inline-flex items-baseline gap-1.5 ${className ?? ''}`}>
      <code className="font-mono text-xs break-all select-all text-gray-900">{did}</code>
      <button
        type="button"
        onClick={handleCopy}
        className={COPY_BUTTON_CLASS}
        title="Copy DID"
      >
        {copied ? 'copied' : '[copy]'}
      </button>
    </span>
  );
}
