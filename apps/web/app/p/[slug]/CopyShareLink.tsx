'use client';

import { useState } from 'react';
import { toast } from 'sonner';

export function CopyShareLink({ npi }: { npi: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle');

  const handleCopy = async () => {
    if (state === 'copied') return;
    const url =
      typeof window !== 'undefined'
        ? `${window.location.origin}/p/${encodeURIComponent(npi)}`
        : `https://app.vitalcv.com/p/${encodeURIComponent(npi)}`;
    try {
      await navigator.clipboard.writeText(url);
      setState('copied');
      toast.success('Link copied to clipboard');
      setTimeout(() => setState('idle'), 2500);
    } catch {
      setState('error');
      toast.error('Clipboard unavailable');
      setTimeout(() => setState('idle'), 2500);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-muted"
    >
      <span aria-hidden>🔗</span>
      <span>{state === 'copied' ? 'Link copied' : 'Copy share link'}</span>
    </button>
  );
}
