'use client';

/**
 * ApiSandbox — Wave 30: Developer Sandbox
 *
 * Split-pane interactive cURL composer.
 * Left  → NPI input + preview-only domain toggles.
 * Right → Live-updating syntax-highlighted cURL command.
 * "Run Request" → Animated simulated preview payload.
 *
 * Syntax highlighting is hand-rolled with styled <span> elements —
 * no external parser, no hydration risk.
 */

import React from 'react';
import { useState, useCallback, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckSquare2, Play, Square, Terminal } from 'lucide-react';
import { getPublicApiBase } from '@/lib/api';

// ── Types ─────────────────────────────────────────────────────────────────

interface CredentialScope {
  id: string;
  label: string;
  field: string;
}

// ── Constants ─────────────────────────────────────────────────────────────

const SCOPES: CredentialScope[] = [
  { id: 'license',  label: 'State License',     field: 'state_license' },
  { id: 'board',    label: 'Board Certification',field: 'board_cert'    },
  { id: 'dea',      label: 'DEA Registration',  field: 'dea_reg'       },
  { id: 'sanctions',label: 'Sanctions Check',   field: 'sanctions'     },
];

// ── Mock response generator ───────────────────────────────────────────────

function buildMockResponse(npi: string, scopes: string[]): object {
  return {
    object: 'trust_profile_preview',
    mode: 'demo',
    npi: npi || '0000000000',
    requested_domains: scopes.length > 0 ? scopes : ['state_license'],
    status: 'preview_only',
    note: 'Simulated preview payload. Use the configured API host for live results.',
    generated_at: new Date().toISOString(),
  };
}

// ── Syntax highlighter ────────────────────────────────────────────────────
// Tokenises a cURL string into coloured <span> elements.

type Token = { kind: 'cmd' | 'flag' | 'url' | 'string' | 'dim' | 'key' | 'plain'; text: string };

function tokeniseCurl(cmd: string): Token[] {
  const tokens: Token[] = [];
  const parts = cmd.split(/(\s+)/);

  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (!p) continue;
    if (p === 'curl') {
      tokens.push({ kind: 'cmd', text: p });
    } else if (/^\s+$/.test(p)) {
      tokens.push({ kind: 'plain', text: p });
    } else if (p.startsWith('--')) {
      tokens.push({ kind: 'flag', text: p });
    } else if (p.startsWith('-')) {
      tokens.push({ kind: 'flag', text: p });
    } else if (p.startsWith('https://') || p.startsWith('http://')) {
      tokens.push({ kind: 'url', text: p });
    } else if (p.startsWith("'") || p.startsWith('"')) {
      tokens.push({ kind: 'string', text: p });
    } else if (p.startsWith('\\')) {
      tokens.push({ kind: 'dim', text: p });
    } else {
      tokens.push({ kind: 'plain', text: p });
    }
  }
  return tokens;
}

const TOKEN_COLORS: Record<Token['kind'], string> = {
  cmd:    'text-violet-400 font-bold',
  flag:   'text-sky-400',
  url:    'text-emerald-400',
  string: 'text-amber-300',
  dim:    'text-slate-500',
  key:    'text-pink-400',
  plain:  'text-slate-300',
};

function HighlightedCurl({ cmd }: { cmd: string }) {
  const tokens = tokeniseCurl(cmd);
  return (
    <code className="whitespace-pre-wrap break-all font-mono text-xs leading-relaxed">
      {tokens.map((t, i) => (
        <span key={i} className={TOKEN_COLORS[t.kind]}>
          {t.text}
        </span>
      ))}
    </code>
  );
}

// ── JSON syntax highlighter ───────────────────────────────────────────────

function HighlightedJson({ obj }: { obj: object }) {
  const json = JSON.stringify(obj, null, 2);

  // Colour JSON keys, strings, numbers, booleans
  const highlighted = json.replace(
    /("(?:[^"\\]|\\.)*")\s*:|("(?:[^"\\]|\\.)*")|(\b\d+\.?\d*\b)|(true|false|null)/g,
    (match, key, str, num, kw) => {
      if (key)  return `<span class="json-key">${key}</span>:`;
      if (str)  return `<span class="json-str">${str}</span>`;
      if (num)  return `<span class="json-num">${num}</span>`;
      if (kw)   return `<span class="json-kw">${kw}</span>`;
      return match;
    },
  );

  return (
    <pre
      className="font-mono text-xs leading-relaxed text-slate-300 [&_.json-key]:text-sky-400 [&_.json-str]:text-emerald-300 [&_.json-num]:text-amber-300 [&_.json-kw]:text-violet-400"
      dangerouslySetInnerHTML={{ __html: highlighted }}
    />
  );
}

// ── Component ─────────────────────────────────────────────────────────────

export function ApiSandbox() {
  const uid = useId();
  const baseUrl = getPublicApiBase();
  const [npi, setNpi] = useState('1234567890');
  const [selectedScopes, setSelectedScopes] = useState<Set<string>>(
    new Set(['state_license', 'board_cert']),
  );
  const [response, setResponse] = useState<object | null>(null);
  const [running, setRunning] = useState(false);

  const toggleScope = useCallback((field: string) => {
    setSelectedScopes((prev) => {
      const next = new Set(prev);
      if (next.has(field)) {
        if (next.size > 1) next.delete(field); // keep at least one
      } else {
        next.add(field);
      }
      return next;
    });
  }, []);

  const scopeArr = Array.from(selectedScopes);

  // Build the cURL command — updates live as inputs change
  const curlCmd = [
    `curl --request GET \\`,
    `  --url '${baseUrl}/api/public/profile/npi/${npi || '<NPI>'}' \\`,
    `  --header 'Authorization: Bearer vcv_test_••••••••••••' \\`,
    `  --header 'Accept: application/json'`,
  ].join('\n');

  const runRequest = useCallback(async () => {
    setRunning(true);
    setResponse(null);
    await new Promise((r) => setTimeout(r, 780));
    setResponse(buildMockResponse(npi, scopeArr));
    setRunning(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [npi, scopeArr.join(',')]);

  return (
    <section
      aria-label="Interactive cURL Sandbox"
      className="rounded-2xl border border-border bg-slate-950/80 backdrop-blur-xl overflow-hidden"
    >
      {/* Panel header */}
      <div className="flex items-center gap-3 border-b border-white/8 px-6 py-4">
        <Terminal className="h-4 w-4 text-emerald-400" />
        <h2 className="text-sm font-semibold text-foreground">Interactive cURL Sandbox</h2>
        <span className="ml-auto rounded-full bg-sky-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-sky-300 ring-1 ring-sky-500/30">
          Preview
        </span>
      </div>

      {/* Split pane */}
      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-white/8">

        {/* ── Left pane: Inputs ──────────────────────────── */}
        <div className="p-6 space-y-5">
          <div>
            <label
              htmlFor={`${uid}-npi`}
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400"
            >
              Target NPI
            </label>
            <input
              id={`${uid}-npi`}
              type="text"
              maxLength={10}
              value={npi}
              onChange={(e) => setNpi(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder="10-digit NPI…"
              className="w-full rounded-xl border border-border bg-slate-900/60 px-4 py-2.5 font-mono text-sm text-slate-200 placeholder:text-slate-600 outline-none transition focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Preview Domains
            </p>
            <p className="mb-3 text-xs leading-relaxed text-slate-500">
              These toggles change the preview payload below. The public lookup route above remains NPI-only.
            </p>
            <div className="space-y-2">
              {SCOPES.map((scope) => {
                const checked = selectedScopes.has(scope.field);
                return (
                  <button
                    key={scope.id}
                    type="button"
                    onClick={() => toggleScope(scope.field)}
                    className="flex w-full items-center gap-3 rounded-xl border border-white/8 bg-slate-900/40 px-4 py-2.5 text-left text-sm transition hover:border-emerald-500/30 hover:bg-slate-800/60"
                    aria-pressed={checked}
                  >
                    {checked ? (
                      <CheckSquare2 className="h-4 w-4 shrink-0 text-emerald-400" />
                    ) : (
                      <Square className="h-4 w-4 shrink-0 text-slate-600" />
                    )}
                    <span className={checked ? 'text-emerald-300' : 'text-slate-400'}>
                      {scope.label}
                    </span>
                    <span className="ml-auto font-mono text-[10px] text-slate-600">
                      {scope.field}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={runRequest}
            disabled={running}
            className="mt-2 flex w-full items-center justify-center gap-2.5 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-black shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:opacity-60"
          >
            <motion.span
              animate={running ? { scale: [1, 0.85, 1] } : {}}
              transition={running ? { duration: 0.5, repeat: Infinity } : {}}
            >
              <Play className="h-4 w-4" />
            </motion.span>
            {running ? 'Running…' : 'Run Request'}
          </button>
        </div>

        {/* ── Right pane: Terminal ───────────────────────── */}
        <div className="flex flex-col">
          {/* Window chrome */}
          <div className="flex items-center gap-2 border-b border-white/8 bg-slate-900/60 px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
            <span className="ml-3 font-mono text-[10px] text-slate-600">terminal</span>
          </div>

          {/* cURL command */}
          <div className="flex-1 overflow-auto p-5">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 font-mono text-xs text-slate-600 select-none">$</span>
              <HighlightedCurl cmd={curlCmd} />
            </div>
          </div>

          {/* Response area */}
          <AnimatePresence>
            {response && (
              <motion.div
                key="response"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.32, ease: 'easeOut' }}
                className="border-t border-white/8 bg-slate-900/40 overflow-hidden"
              >
                <div className="flex items-center gap-2 px-5 py-2 border-b border-white/5">
                  <span className="h-2 w-2 rounded-full bg-sky-300" />
                  <span className="font-mono text-[10px] text-sky-300">preview payload</span>
                  <span className="ml-auto font-mono text-[10px] text-slate-600">
                    application/json
                  </span>
                </div>
                <div className="max-h-52 overflow-auto p-5">
                  <HighlightedJson obj={response} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
