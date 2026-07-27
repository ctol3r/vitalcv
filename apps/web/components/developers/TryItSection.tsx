'use client';

import { useState, useCallback } from 'react';
import { Copy, Check, Play } from 'lucide-react';

export function TryItSection({ publicApiBase }: { publicApiBase: string }) {
  const [npi, setNpi] = useState('0000000000');
  const [copied, setCopied] = useState(false);

  const curlCommand = `curl -s '${publicApiBase}/api/passport/npi/${npi}' | python3 -m json.tool`;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(curlCommand);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  }, [curlCommand]);

  return (
    <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Play className="h-4 w-4 text-emerald-400" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-400">
          Try it
        </p>
      </div>
      <p className="text-sm text-muted-foreground">
        Fetch a passport for any NPI. Paste this command into your terminal.
      </p>
      <div className="flex gap-2 items-center">
        <label htmlFor="try-npi" className="text-xs font-medium text-muted-foreground shrink-0">NPI:</label>
        <input
          id="try-npi"
          type="text"
          inputMode="numeric"
          maxLength={10}
          value={npi}
          onChange={e => setNpi(e.target.value.replace(/\D/g, ''))}
          className="rounded-lg border border-border bg-background px-3 py-1.5 font-mono text-sm text-foreground w-32"
        />
      </div>
      <div className="relative group">
        <pre className="rounded-xl border border-border/80 bg-background px-4 py-3 font-mono text-xs text-foreground/80 overflow-x-auto">
          {curlCommand}
        </pre>
        <button
          type="button"
          onClick={handleCopy}
          className="absolute top-2 right-2 rounded-lg border border-border bg-card p-1.5 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:text-foreground"
          aria-label="Copy to clipboard"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
    </section>
  );
}
