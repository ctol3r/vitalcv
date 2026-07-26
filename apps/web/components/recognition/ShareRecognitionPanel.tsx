'use client';

/**
 * Share panel — the holder-facing answer to "How do I share or prove it?".
 *
 * "Present VitalCV Recognition" (canonical holder-facing verb, MASTER_PROMPT
 * copy discipline): hands the clinician the existing public verifier link for
 * their NPI. No new tokens, no new backend — the /verify/[npi] surface is
 * already public and read-only, and shows recorded acceptances alongside
 * source-backed status. The link is shown in full so the clinician always
 * sees exactly what they are sharing.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, ExternalLink, Send } from 'lucide-react';

export function ShareRecognitionPanel({ npi }: { npi: string }) {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState<'idle' | 'copied' | 'manual'>('idle');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Origin is only knowable client-side; render the full URL once mounted.
    setShareUrl(`${window.location.origin}/verify/${encodeURIComponent(npi)}`);
  }, [npi]);

  async function copyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied('copied');
    } catch {
      inputRef.current?.select();
      setCopied('manual');
    }
  }

  return (
    <section
      aria-label="Present VitalCV Recognition"
      className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5"
    >
      <div className="flex items-center gap-2">
        <Send className="h-4 w-4 text-emerald-400" aria-hidden />
        <h2 className="text-sm font-semibold text-zinc-200">Present VitalCV Recognition</h2>
      </div>
      <p className="text-sm leading-6 text-zinc-400">
        Anyone with this link can open your read-only verifier view — your source-backed
        status and any recorded acceptances — without creating an account. Nothing is
        shared until you send the link.
      </p>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          ref={inputRef}
          readOnly
          value={shareUrl ?? 'Preparing link…'}
          aria-label="Your verifier link"
          onFocus={(event) => { event.currentTarget.select(); }}
          className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-300"
        />
        <div className="flex gap-2">
          <button
            onClick={() => { void copyLink(); }}
            disabled={!shareUrl}
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-emerald-700 hover:text-emerald-300 disabled:opacity-50"
          >
            {copied === 'copied'
              ? (<><Check className="h-3.5 w-3.5" aria-hidden /> Copied</>)
              : (<><Copy className="h-3.5 w-3.5" aria-hidden /> Copy link</>)}
          </button>
          <a
            href={`/verify/${encodeURIComponent(npi)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-emerald-700 hover:text-emerald-300"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Open
          </a>
        </div>
      </div>

      {copied === 'manual' && (
        <p className="text-xs text-zinc-500">
          Copy didn&apos;t reach your clipboard — the link is selected above, copy it manually.
        </p>
      )}
    </section>
  );
}
