'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SNIPPET_HTML = [
  '<!-- 1. Add the script (once per page) -->',
  '<script src="https://vitalcv.com/vitalcv-widget.js" defer></script>',
  '',
  '<!-- 2. Place the button wherever you want it -->',
  '<div id="vitalcv-apply-button"',
  '     data-client-id="YOUR_CLIENT_ID">',
  '</div>',
].join('\n');

export function DropInSection() {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(SNIPPET_HTML);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section id="drop-in" className="scroll-mt-20">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Drop-in Widget SDK
          </p>
          <h2 className="mt-1 font-fraunces text-xl font-semibold text-white">
            One tag. One div. Done.
          </h2>
          <p className="mt-1.5 max-w-md text-sm text-slate-400">
            Embed a cryptographic &ldquo;Apply with VitalCV&rdquo; button on any hospital
            career page. No EHR integration, no enterprise contract required.
          </p>
        </div>

        {/* Live button preview pill — triggers actual OIDC4VP popup */}
        <button
          type="button"
          title="Preview the Apply with VitalCV popup"
          onClick={() => {
            const w    = 400;
            const h    = 600;
            const left = (window.screen.width  - w) / 2;
            const top  = (window.screen.height - h) / 2;
            window.open(
              '/widget/authorize?clientId=demo_preview',
              'vitalcv_apply',
              `width=${w},height=${h},top=${top},left=${left},resizable=yes,scrollbars=no,status=no`,
            );
          }}
          className="hidden lg:flex h-10 items-center gap-2 rounded-xl border border-white/8 bg-slate-800/60 px-4 text-sm font-semibold text-slate-200 shadow-inner cursor-pointer transition-opacity hover:opacity-80 active:opacity-60"
        >
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(74,222,128,0.7)]" />
          Apply with VitalCV
        </button>
      </div>

      {/* ── Code block ─────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-white/8 bg-slate-900">
        {/* Chrome bar */}
        <div className="flex items-center justify-between border-b border-white/8 px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-red-500/60"    />
            <span className="h-3 w-3 rounded-full bg-yellow-500/60" />
            <span className="h-3 w-3 rounded-full bg-green-500/60"  />
          </div>
          <span className="text-xs text-slate-600">careers.hospital.com</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleCopy}
            className="h-7 gap-1.5 px-2 text-xs text-slate-400 hover:text-white"
          >
            {copied
              ? <Check className="h-3.5 w-3.5 text-emerald-400" />
              : <Copy  className="h-3.5 w-3.5" />}
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </div>

        {/* Syntax-coloured pre */}
        <pre className="overflow-x-auto px-5 py-5 font-mono text-sm leading-relaxed">
          <code>
            <span className="text-slate-600">{'<!-- 1. Add the script (once per page) -->'}</span>{'\n'}
            <span className="text-slate-400">{'<'}</span>
            <span className="text-emerald-400">{'script'}</span>
            {' '}
            <span className="text-sky-400">{'src'}</span>
            <span className="text-slate-400">{'="'}</span>
            <span className="text-amber-300">{'https://vitalcv.com/vitalcv-widget.js'}</span>
            <span className="text-slate-400">{'"'}</span>
            {' '}
            <span className="text-sky-400">{'defer'}</span>
            <span className="text-slate-400">{'></script>'}</span>
            {'\n\n'}
            <span className="text-slate-600">{'<!-- 2. Place the button wherever you want it -->'}</span>{'\n'}
            <span className="text-slate-400">{'<'}</span>
            <span className="text-emerald-400">{'div'}</span>
            {' '}
            <span className="text-sky-400">{'id'}</span>
            <span className="text-slate-400">{'="'}</span>
            <span className="text-amber-300">{'vitalcv-apply-button'}</span>
            <span className="text-slate-400">{'"'}</span>
            {'\n     '}
            <span className="text-sky-400">{'data-client-id'}</span>
            <span className="text-slate-400">{'="'}</span>
            <span className="text-violet-400">{'YOUR_CLIENT_ID'}</span>
            <span className="text-slate-400">{'"'}</span>
            {'>\n'}
            <span className="text-slate-400">{'</div>'}</span>
          </code>
        </pre>

        {/* Right-edge overflow fade */}
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-slate-900" />
      </div>

      {/* ── Feature pills ──────────────────────────────── */}
      <div className="mt-4 flex flex-wrap gap-2">
        {[
          'Zero dependencies',
          '< 3 KB gzipped',
          'Works in any CMS',
          'HMAC-signed callbacks',
          'Auto-centered popup',
        ].map((f) => (
          <span
            key={f}
            className="rounded-full border border-white/8 bg-slate-800/40 px-3 py-1 text-xs text-slate-400"
          >
            {f}
          </span>
        ))}
      </div>
    </section>
  );
}
