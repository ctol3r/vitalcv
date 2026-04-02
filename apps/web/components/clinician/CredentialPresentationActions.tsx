'use client';

/**
 * CredentialPresentationActions.tsx — Wave 98 + 103: Credential Wallet & Presentation
 *
 * Allows a clinician to create a Verifiable Presentation from their
 * wallet credentials — with full or selective disclosure of claims.
 * Wave 103: adds per-field claim selection for selective disclosure.
 */

import { useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getApiBase } from '@/lib/api';
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  EyeOff,
  FileKey2,
  Loader2,
  Share2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// ── Demo claim fields per credential (Wave 103) ───────────────────────
const DEMO_CLAIM_FIELDS: Record<string, string[]> = {
  'cred-demo-001': ['licenseNumber', 'state', 'expiryDate', 'specialty', 'npi'],
  'cred-demo-002': ['certificationId', 'specialty', 'boardName', 'issuedDate', 'expiryDate'],
  'cred-demo-003': ['deaNumber', 'schedules', 'expiryDate', 'state'],
};

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
  const [mode, setMode] = useState<'full' | 'selective'>('full');
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(DEMO_CREDENTIALS.filter((c) => c.selected).map((c) => c.id)),
  );
  // Wave 103: per-credential revealed fields (selective disclosure)
  const [revealedFields, setRevealedFields] = useState<Record<string, Set<string>>>({});
  const [expandedCred, setExpandedCred] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ presentationId: string; json: string; hiddenFields?: string[] } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const base = getApiBase();

  const toggleCredential = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Wave 103: toggle individual claim field for selective disclosure
  const toggleField = (credId: string, field: string) => {
    setRevealedFields((prev) => {
      const fields = new Set(prev[credId] ?? DEMO_CLAIM_FIELDS[credId] ?? []);
      if (fields.has(field)) fields.delete(field);
      else fields.add(field);
      return { ...prev, [credId]: fields };
    });
  };

  const getRevealedForCred = (credId: string): string[] => {
    return Array.from(revealedFields[credId] ?? DEMO_CLAIM_FIELDS[credId] ?? []);
  };

  const handleCreate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    // Wave 103: selective disclosure uses first selected credential with field filtering
    if (mode === 'selective') {
      const credId = Array.from(selected)[0];
      if (!credId) { setError('Select a credential first'); setLoading(false); return; }
      const fields = getRevealedForCred(credId);
      try {
        const r = await fetch(`${base}/api/credentials/present/selective`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ holder: holderNpi, credentialId: credId, revealFields: fields }),
        });
        const data = await r.json() as { presentation?: { presentationId: string }; hiddenFields?: string[] };
        if (!r.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${r.status}`);
        setResult({
          presentationId: data.presentation!.presentationId,
          json: JSON.stringify(data, null, 2),
          hiddenFields: data.hiddenFields,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed');
      } finally {
        setLoading(false);
      }
      return;
    }

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

              <div className="px-5 py-4 space-y-4 overflow-y-auto max-h-[70vh]">
                {!result ? (
                  <>
                    {/* Wave 103: Mode toggle */}
                    <div className="flex rounded-xl border border-infra-border overflow-hidden text-xs font-bold">
                      <button
                        onClick={() => setMode('full')}
                        className={`flex-1 py-2 transition-colors ${mode === 'full' ? 'bg-infra-blue text-white' : 'bg-infra-surface text-muted-foreground hover:text-foreground'}`}
                      >
                        Full Disclosure
                      </button>
                      <button
                        onClick={() => setMode('selective')}
                        className={`flex-1 py-2 gap-1.5 flex items-center justify-center transition-colors ${mode === 'selective' ? 'bg-violet-600 text-white' : 'bg-infra-surface text-muted-foreground hover:text-foreground'}`}
                      >
                        <EyeOff className="h-3 w-3" />
                        Selective
                      </button>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      {mode === 'full'
                        ? 'All credential claims will be included. The bundle is cryptographically signed and valid for 24 hours.'
                        : 'Choose exactly which claim fields to reveal. Hidden fields are replaced with cryptographic commitments.'
                      }
                    </p>

                    {/* Credential selector */}
                    <div className="space-y-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        {mode === 'selective' ? 'Select Credential & Claims' : 'Select Credentials'}
                      </p>
                      {DEMO_CREDENTIALS.map((cred) => (
                        <div key={cred.id} className="rounded-xl border border-infra-border bg-infra-surface overflow-hidden">
                          <label className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-card transition-colors">
                          <input
                            type="checkbox"
                            checked={selected.has(cred.id)}
                            onChange={() => toggleCredential(cred.id)}
                            className="h-4 w-4 accent-infra-blue"
                          />
                          <span className="text-sm text-foreground flex-1">{cred.label}</span>
                          {/* Wave 103: expand claims in selective mode */}
                          {mode === 'selective' && selected.has(cred.id) && (
                            <button
                              type="button"
                              onClick={(e) => { e.preventDefault(); setExpandedCred(expandedCred === cred.id ? null : cred.id); }}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              {expandedCred === cred.id
                                ? <ChevronDown className="h-3.5 w-3.5" />
                                : <ChevronRight className="h-3.5 w-3.5" />
                              }
                            </button>
                          )}
                          </label>
                          {/* Claim field selector (Wave 103) */}
                          {mode === 'selective' && expandedCred === cred.id && (
                            <div className="px-3 pb-2.5 pt-0 border-t border-infra-border/50">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                                Reveal Claims
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {(DEMO_CLAIM_FIELDS[cred.id] ?? []).map((field) => {
                                  const revealed = getRevealedForCred(cred.id).includes(field);
                                  return (
                                    <button
                                      key={field}
                                      type="button"
                                      onClick={() => toggleField(cred.id, field)}
                                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full border transition-colors ${
                                        revealed
                                          ? 'bg-emerald-100 border-emerald-300 text-emerald-700'
                                          : 'bg-zinc-100 border-zinc-300 text-zinc-400 line-through'
                                      }`}
                                    >
                                      {field}
                                    </button>
                                  );
                                })}
                              </div>
                              <p className="text-[9px] text-muted-foreground mt-1">
                                {getRevealedForCred(cred.id).length} of {(DEMO_CLAIM_FIELDS[cred.id] ?? []).length} claims revealed
                              </p>
                            </div>
                          )}
                        </div>
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
                      {mode === 'selective' ? 'Selective presentation' : 'Presentation'} created — ID: <code className="font-mono text-xs">{result.presentationId.slice(0, 12)}…</code>
                    </div>

                    {mode === 'selective' && result.hiddenFields && result.hiddenFields.length > 0 && (
                      <div className="flex items-center gap-2 text-xs text-violet-600 bg-violet-50 rounded-xl px-3 py-2">
                        <EyeOff className="h-3.5 w-3.5 flex-shrink-0" />
                        <span><strong>{result.hiddenFields.length}</strong> claim(s) hidden with cryptographic commitments: {result.hiddenFields.join(', ')}</span>
                      </div>
                    )}

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
