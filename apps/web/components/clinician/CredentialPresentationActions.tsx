'use client';

/**
 * CredentialPresentationActions.tsx — Wave 98: Credential Wallet & Presentation
 *
 * Allows a clinician to create a Verifiable Presentation from their
 * wallet credentials and either download it as JSON or copy a share link.
 */

import { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  Download,
  FileKey2,
  Loader2,
  Share2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// ── Demo credential IDs — replace with real wallet fetch ──────────────
const DEMO_CREDENTIALS = [
  { id: 'cred-demo-001', label: 'Medical License — California', selected: true },
  { id: 'cred-demo-002', label: 'Board Certification — ABIM', selected: true },
  { id: 'cred-demo-003', label: 'DEA Registration', selected: false },
];

interface CredentialPresentationActionsProps {
  holderNpi?: string;
  className?: string;
}

export function CredentialPresentationActions({
  holderNpi = '1234567890',
  className = '',
}: CredentialPresentationActionsProps) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(DEMO_CREDENTIALS.filter((c) => c.selected).map((c) => c.id)),
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ presentationId: string; json: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? process.env.NEXT_PUBLIC_BACKEND_URL ?? '';
  const base = API_BASE.endsWith('/') ? API_BASE.slice(0, -1) : API_BASE;

  const toggleCredential = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await fetch(`${base}/api/credentials/present`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          holder: holderNpi,
          credentialIds: Array.from(selected),
          expiresAt: '24h',
        }),
      });
      const data = await r.json() as { presentation?: { presentationId: string } };
      if (!r.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${r.status}`);
      setResult({
        presentationId: data.presentation!.presentationId,
        json: JSON.stringify(data.presentation, null, 2),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create presentation');
    } finally {
      setLoading(false);
    }
  }, [base, holderNpi, selected]);

  const handleDownload = useCallback(() => {
    if (!result) return;
    const blob = new Blob([result.json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vitalcv-presentation-${result.presentationId.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [result]);

  const handleCopyLink = useCallback(async () => {
    if (!result) return;
    const shareUrl = `${window.location.origin}/verify/presentation/${result.presentationId}`;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [result]);

  return (
    <div className={className}>
      <Button
        variant="outline"
        size="default"
        onClick={() => setOpen(true)}
        className="gap-2"
      >
        <FileKey2 className="h-4 w-4" />
        Create Presentation
      </Button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />

            {/* Modal */}
            <motion.div
              key="modal"
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 mx-auto max-w-md bg-white rounded-2xl border border-infra-border shadow-xl overflow-hidden dark:bg-zinc-900 dark:border-zinc-800"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-infra-border dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <FileKey2 className="h-5 w-5 text-infra-blue" />
                  <h2 className="font-bold text-foreground">Verifiable Presentation</h2>
                </div>
                <button
                  onClick={() => { setOpen(false); setResult(null); setError(null); }}
                  className="rounded-lg p-1.5 hover:bg-secondary transition-colors"
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>

              <div className="px-5 py-4 space-y-4">
                {!result ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Select credentials to include in the presentation. The bundle will be cryptographically signed and valid for 24 hours.
                    </p>

                    {/* Credential selector */}
                    <div className="space-y-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        Select Credentials
                      </p>
                      {DEMO_CREDENTIALS.map((cred) => (
                        <label
                          key={cred.id}
                          className="flex items-center gap-3 rounded-xl border border-infra-border bg-infra-surface px-3 py-2.5 cursor-pointer hover:border-infra-blue/50 transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={selected.has(cred.id)}
                            onChange={() => toggleCredential(cred.id)}
                            className="h-4 w-4 accent-infra-blue"
                          />
                          <span className="text-sm text-foreground">{cred.label}</span>
                        </label>
                      ))}
                    </div>

                    {error && (
                      <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">
                        {error}
                      </p>
                    )}

                    <Button
                      className="w-full gap-2"
                      onClick={() => void handleCreate()}
                      disabled={loading || selected.size === 0}
                    >
                      {loading
                        ? <><Loader2 className="h-4 w-4 animate-spin" />Creating…</>
                        : <><FileKey2 className="h-4 w-4" />Create Signed Presentation</>
                      }
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-50 rounded-xl px-3 py-2.5">
                      <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                      Presentation created — ID: <code className="font-mono text-xs">{result.presentationId.slice(0, 12)}…</code>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Your verifiable presentation is ready. Download the JSON file or copy a shareable link.
                    </p>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1 gap-2"
                        onClick={handleDownload}
                      >
                        <Download className="h-4 w-4" />
                        Download JSON
                      </Button>
                      <Button
                        className="flex-1 gap-2"
                        onClick={() => void handleCopyLink()}
                      >
                        {copied
                          ? <><CheckCircle2 className="h-4 w-4" />Copied!</>
                          : <><Share2 className="h-4 w-4" />Share Link</>
                        }
                      </Button>
                    </div>

                    <button
                      onClick={() => { setResult(null); setError(null); }}
                      className="text-xs text-muted-foreground hover:text-foreground underline w-full text-center"
                    >
                      Create another presentation
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
