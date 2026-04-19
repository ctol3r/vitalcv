'use client';

/**
 * KeyManagerCard — API key lifecycle for employer IT / integration teams.
 *
 * Doctrine
 * --------
 *   - Secret material is shown exactly once, at generation, and is cleared
 *     from component state when the banner is dismissed
 *   - Revocation is a two-step in-row commit (first click arms the row for
 *     3 seconds, second click inside that window commits). Fast enough for
 *     an oncall rotation, not so fast a stray click nukes a pipeline.
 *   - Revoked keys remain in the ledger, dimmed, with a danger-tinted badge
 *     so audits can still see the lifecycle
 *   - Key prefixes, creation dates, and last-used timestamps render in
 *     JetBrains Mono with tabular-nums so rotations don't jitter the grid
 */

import React, { useMemo, useState } from 'react';
import { Check, Copy, KeyRound, Plus, ShieldAlert } from 'lucide-react';
import { cn } from '@/lib/utils';

void React;

export interface ApiKey {
  id: string;
  label: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

interface KeyManagerCardProps {
  initialKeys: ApiKey[];
  className?: string;
  /** Optional real-server mint hook. Falls back to a client-side dev mint. */
  onGenerate?: (label: string) => Promise<{ key: ApiKey; secret: string }>;
  /** Optional real-server revoke hook. Falls back to local state mutation. */
  onRevoke?: (id: string) => Promise<void>;
}

// Dev-only mint — replace with the server route once it exists. Keeps the
// UI functional for design review without a backend dependency.
function mintDevSecret(label: string): { key: ApiKey; secret: string } {
  const random = Array.from({ length: 40 }, () =>
    Math.floor(Math.random() * 36).toString(36),
  ).join('');
  const prefix = `vcv_live_${random.slice(0, 6)}`;
  const secret = `${prefix}_${random.slice(6)}`;
  const now = new Date().toISOString();
  return {
    key: {
      id: `key_${random.slice(0, 10)}`,
      label: label.trim() || 'Untitled key',
      prefix,
      createdAt: now,
      lastUsedAt: null,
      revokedAt: null,
    },
    secret,
  };
}

function formatCreatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * formatLastUsed — Render the "Last used" column for an API key.
 *
 * TODO(user, see conversation): implement this.
 *
 * Why this matters: this formatter runs for every key on every render. It
 * sets the rhythm of the whole table — whether a sleepy integration screams
 * "stale" at you, or whether a healthy one fades politely into the chrome.
 *
 * Trade-offs to consider:
 *   - Relative ("3 min ago", "2 days ago") is scannable but drifts without a
 *     re-render trigger; absolute ("Apr 18, 11:02") is stable but noisier.
 *   - "Never used" should read as neutral, not alarming — a freshly-minted
 *     key has no last-used yet and that's expected.
 *   - Stale keys (e.g. > 90 days unused) may deserve a visual nudge; that
 *     decision is out of scope for the formatter but shapes its return shape.
 *   - All other timestamps on the card use `toLocaleDateString` with
 *     month/day/year — staying consistent is cheap and helps scanability.
 *
 * Replace the stub below with your preferred formatting.
 */
function formatLastUsed(iso: string | null): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function KeyManagerCard({
  initialKeys,
  className,
  onGenerate,
  onRevoke,
}: KeyManagerCardProps) {
  const [keys, setKeys] = useState<ApiKey[]>(initialKeys);
  const [label, setLabel] = useState('');
  const [revealed, setRevealed] = useState<{ id: string; secret: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pendingRevokeId, setPendingRevokeId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const activeCount = useMemo(
    () => keys.filter((k) => !k.revokedAt).length,
    [keys],
  );

  async function handleGenerate() {
    if (busy || label.trim().length === 0) return;
    setBusy(true);
    try {
      const minted = onGenerate
        ? await onGenerate(label.trim())
        : mintDevSecret(label);
      setKeys((prev) => [minted.key, ...prev]);
      setRevealed({ id: minted.key.id, secret: minted.secret });
      setLabel('');
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke(id: string) {
    if (pendingRevokeId !== id) {
      setPendingRevokeId(id);
      setTimeout(() => {
        setPendingRevokeId((current) => (current === id ? null : current));
      }, 3000);
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      await onRevoke?.(id);
      const now = new Date().toISOString();
      setKeys((prev) =>
        prev.map((k) => (k.id === id ? { ...k, revokedAt: now } : k)),
      );
      setPendingRevokeId(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy(secret: string) {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked — the secret is still visible for manual select.
    }
  }

  function handleDismissSecret() {
    setRevealed(null);
    setCopied(false);
  }

  return (
    <section
      data-slot="key-manager-card"
      className={cn(
        'rounded-2xl border border-[var(--vt-border)] bg-card px-5 py-4',
        className,
      )}
      aria-label="API key manager"
    >
      <header className="flex flex-col gap-2 border-b border-white/6 pb-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/60">
            API keys
          </p>
          <p className="mt-1 text-xs text-foreground/60 leading-relaxed">
            Mint, rotate, and revoke keys used by HRIS and credentialing
            pipelines. Secret material is shown exactly once.
          </p>
        </div>
        <p className="font-mono text-[11px] tabular-nums text-muted-foreground/70">
          <span className="text-foreground/80">{activeCount}</span>
          <span className="text-muted-foreground/40"> / </span>
          <span className="text-muted-foreground/70">{keys.length}</span>
          <span className="ml-1 text-muted-foreground/40">active</span>
        </p>
      </header>

      <form
        className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center"
        onSubmit={(e) => {
          e.preventDefault();
          void handleGenerate();
        }}
      >
        <label className="sr-only" htmlFor="developer-key-label">
          New key label
        </label>
        <input
          id="developer-key-label"
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (e.g. Epic HRIS bridge)"
          disabled={busy}
          className={cn(
            'flex-1 rounded-md border border-[var(--vt-border)] bg-transparent px-3 py-2 text-xs text-foreground/90 transition-colors',
            'placeholder:text-muted-foreground/40',
            'focus:border-foreground/40 focus:outline-none',
          )}
        />
        <button
          type="submit"
          disabled={busy || label.trim().length === 0}
          className={cn(
            'inline-flex items-center justify-center gap-1.5 rounded-md border border-[var(--vt-border)] bg-transparent px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-foreground/80 transition-colors',
            'hover:border-foreground/40 hover:text-foreground',
            'disabled:cursor-not-allowed disabled:border-white/6 disabled:text-muted-foreground/40',
          )}
        >
          <Plus className="h-3 w-3" aria-hidden="true" />
          Generate
        </button>
      </form>

      {revealed && (
        <div
          data-slot="key-reveal"
          className={cn(
            'mt-3 rounded-xl border px-4 py-3',
            'border-[color:color-mix(in_oklch,var(--vt-success)_40%,transparent)]',
            'bg-[color:color-mix(in_oklch,var(--vt-success)_8%,transparent)]',
          )}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-[var(--vt-success)]">
              New key · shown once
            </p>
            <button
              type="button"
              onClick={handleDismissSecret}
              className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60 transition-colors hover:text-foreground"
            >
              Dismiss
            </button>
          </div>
          <div className="mt-2 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <code className="flex-1 overflow-x-auto rounded-md border border-[var(--vt-border)] bg-black/20 px-3 py-2 font-mono text-xs tabular-nums text-foreground/90">
              {revealed.secret}
            </code>
            <button
              type="button"
              onClick={() => handleCopy(revealed.secret)}
              className={cn(
                'inline-flex items-center justify-center gap-1.5 rounded-md border bg-transparent px-2.5 py-2 font-mono text-[10px] uppercase tracking-widest transition-colors',
                copied
                  ? 'border-[color:color-mix(in_oklch,var(--vt-success)_40%,transparent)] text-[var(--vt-success)]'
                  : 'border-[var(--vt-border)] text-foreground/70 hover:border-foreground/40 hover:text-foreground',
              )}
              aria-label={copied ? 'Copied' : 'Copy secret'}
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3" aria-hidden="true" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" aria-hidden="true" />
                  Copy
                </>
              )}
            </button>
          </div>
          <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground/60">
            Store this in your secret manager now. VitalCV will never show the
            full key again — only the prefix.
          </p>
        </div>
      )}

      {keys.length === 0 ? (
        <p className="mt-3 py-6 text-center text-xs text-muted-foreground/50">
          No API keys have been minted yet.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left">
            <thead>
              <tr className="border-b border-white/6 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/40">
                <th scope="col" className="py-2 pr-3 font-semibold">Label</th>
                <th scope="col" className="py-2 pr-3 font-semibold">Prefix</th>
                <th scope="col" className="py-2 pr-3 font-semibold">Created</th>
                <th scope="col" className="py-2 pr-3 font-semibold">Last used</th>
                <th scope="col" className="py-2 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => {
                const revoked = Boolean(k.revokedAt);
                const pending = pendingRevokeId === k.id;
                return (
                  <tr
                    key={k.id}
                    className={cn(
                      'border-b border-white/4 align-top last:border-0',
                      revoked && 'opacity-50',
                    )}
                    data-key-id={k.id}
                    data-key-status={revoked ? 'revoked' : 'active'}
                  >
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-2">
                        <KeyRound
                          className="h-3 w-3 shrink-0 text-muted-foreground/50"
                          aria-hidden="true"
                        />
                        <span className="font-medium text-foreground/90 leading-tight">
                          {k.label}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 pr-3">
                      <code className="font-mono text-[11px] tabular-nums text-foreground/70">
                        {k.prefix}
                        <span className="text-muted-foreground/40">…</span>
                      </code>
                    </td>
                    <td className="py-3 pr-3">
                      <time
                        dateTime={k.createdAt}
                        className="font-mono text-[11px] tabular-nums text-muted-foreground/70"
                      >
                        {formatCreatedAt(k.createdAt)}
                      </time>
                    </td>
                    <td className="py-3 pr-3">
                      <span className="font-mono text-[11px] tabular-nums text-muted-foreground/70">
                        {formatLastUsed(k.lastUsedAt)}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      {revoked ? (
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-md border bg-transparent px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest',
                            'border-[color:color-mix(in_oklch,var(--vt-danger)_35%,transparent)]',
                            'text-[var(--vt-danger)]',
                          )}
                        >
                          <ShieldAlert className="h-3 w-3" aria-hidden="true" />
                          Revoked
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleRevoke(k.id)}
                          disabled={busy}
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-md border bg-transparent px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest transition-colors',
                            pending
                              ? 'border-[color:color-mix(in_oklch,var(--vt-danger)_50%,transparent)] text-[var(--vt-danger)] hover:bg-[color:color-mix(in_oklch,var(--vt-danger)_10%,transparent)]'
                              : 'border-[var(--vt-border)] text-foreground/70 hover:border-foreground/40 hover:text-foreground',
                            'disabled:cursor-not-allowed disabled:border-white/6 disabled:text-muted-foreground/40',
                          )}
                          aria-label={pending ? 'Confirm revoke' : 'Revoke key'}
                        >
                          {pending ? 'Confirm revoke' : 'Revoke'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default KeyManagerCard;
