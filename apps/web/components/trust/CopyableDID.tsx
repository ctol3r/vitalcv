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
        className="text-[9px] font-mono text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0 leading-none"
        title="Copy DID"
      >
        {copied ? 'copied' : '[copy]'}
      </button>
    </span>
  );
}
