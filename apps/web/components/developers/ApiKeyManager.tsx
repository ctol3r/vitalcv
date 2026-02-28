'use client';

/**
 * ApiKeyManager — Wave 30: Developer Sandbox
 *
 * Hospital developers can roll a mock test key, toggle its visibility,
 * and copy it to clipboard with one click.
 * "Test Mode Active" badge prevents any confusion with production keys.
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Copy, Eye, EyeOff, RefreshCw, ShieldCheck, Zap } from 'lucide-react';

// ── Helpers ───────────────────────────────────────────────────────────────

function generateTestKey(): string {
  const hex = Array.from(
    { length: 32 },
    () => Math.floor(Math.random() * 16).toString(16),
  ).join('');
  return `vcv_test_${hex}`;
}

const OBSCURE_SUFFIX = '••••••••••••••••••••••••••••••••';

function displayKey(key: string, visible: boolean): string {
  if (!key) return '';
  const prefix = key.slice(0, 9); // "vcv_test_"
  return visible ? key : `${prefix}${OBSCURE_SUFFIX}`;
}

// ── Component ─────────────────────────────────────────────────────────────

export function ApiKeyManager() {
  const [apiKey, setApiKey] = useState<string>('');
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const [rolling, setRolling] = useState(false);

  const rollKey = useCallback(async () => {
    setRolling(true);
    await new Promise((r) => setTimeout(r, 420));
    setApiKey(generateTestKey());
    setVisible(false);
    setCopied(false);
    setRolling(false);
  }, []);

  const copyKey = useCallback(async () => {
    if (!apiKey) return;
    await navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [apiKey]);

  return (
    <section
      aria-label="API Key Manager"
      className="rounded-2xl border border-white/10 bg-slate-950/80 p-6 backdrop-blur-xl"
    >
      {/* Header row */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-semibold text-white">API Keys</h2>
          </div>
          <p className="text-xs text-slate-400">
            Generate a test key to authenticate against the VitalCV sandbox environment.
          </p>
        </div>

        {/* Test Mode badge */}
        <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-400 ring-1 ring-amber-500/30">
          <Zap className="h-3 w-3" />
          Test Mode Active
        </span>
      </div>

      {/* Key display */}
      <div className="relative mb-4 flex items-center gap-2 rounded-xl border border-white/8 bg-slate-900/60 px-4 py-3 font-mono text-sm">
        <AnimatePresence mode="wait">
          {apiKey ? (
            <motion.span
              key={apiKey}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
              className="flex-1 truncate select-all text-emerald-300"
            >
              {displayKey(apiKey, visible)}
            </motion.span>
          ) : (
            <motion.span
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 text-slate-600"
            >
              — no key generated yet —
            </motion.span>
          )}
        </AnimatePresence>

        {/* Visibility toggle */}
        {apiKey && (
          <button
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Hide key' : 'Show key'}
            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}

        {/* Copy button */}
        {apiKey && (
          <button
            onClick={copyKey}
            aria-label="Copy API key"
            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            <AnimatePresence mode="wait">
              {copied ? (
                <motion.span
                  key="check"
                  initial={{ scale: 0.7 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0.7 }}
                >
                  <Check className="h-4 w-4 text-emerald-400" />
                </motion.span>
              ) : (
                <motion.span key="copy" initial={{ scale: 0.7 }} animate={{ scale: 1 }}>
                  <Copy className="h-4 w-4" />
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        )}
      </div>

      {/* Action row */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={rollKey}
          disabled={rolling}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-400 ring-1 ring-emerald-500/30 transition-all hover:bg-emerald-500/20 hover:ring-emerald-500/50 disabled:opacity-50"
        >
          <motion.span
            animate={rolling ? { rotate: 360 } : { rotate: 0 }}
            transition={rolling ? { duration: 0.6, repeat: Infinity, ease: 'linear' } : {}}
          >
            <RefreshCw className="h-4 w-4" />
          </motion.span>
          {rolling ? 'Rolling…' : apiKey ? 'Rotate Key' : 'Roll Test Key'}
        </button>

        {copied && (
          <motion.p
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            className="text-xs text-emerald-400"
          >
            Copied to clipboard ✓
          </motion.p>
        )}
      </div>

      {/* Scopes legend */}
      <div className="mt-5 border-t border-white/5 pt-4">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Test Key Scopes
        </p>
        <div className="flex flex-wrap gap-2">
          {['read:profile', 'read:trust_state', 'read:crs', 'write:verifier_request'].map((scope) => (
            <span
              key={scope}
              className="rounded-md bg-slate-800/60 px-2.5 py-0.5 font-mono text-[10px] text-slate-400"
            >
              {scope}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
