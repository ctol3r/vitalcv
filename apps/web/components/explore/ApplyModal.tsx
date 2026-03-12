'use client';

/**
 * ApplyModal — Wave 229
 * Clinician applies to an opportunity. Shows confirmation + optional cover note.
 */

import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Loader2, X } from 'lucide-react';
import { useState } from 'react';

interface Opportunity {
  id: string;
  title: string;
  specialty: string;
  hiringType: string;
  state: string;
  organizationName?: string;
}

interface Props {
  opportunity: Opportunity | null;
  onClose: () => void;
}

type Phase = 'form' | 'submitting' | 'success' | 'error';

export default function ApplyModal({ opportunity, onClose }: Props) {
  const [npi, setNpi] = useState('');
  const [coverNote, setCoverNote] = useState('');
  const [phase, setPhase] = useState<Phase>('form');
  const [errorMsg, setErrorMsg] = useState('');

  if (!opportunity) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!npi.trim()) return;
    setPhase('submitting');

    try {
      const res = await fetch(`/api/opportunities/${opportunity!.id}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ npi: npi.trim(), coverNote: coverNote.trim() || undefined }),
      });

      if (res.ok || res.status === 409) {
        // 409 = already applied — treat as success
        setPhase('success');
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data?.error || 'Something went wrong. Please try again.');
        setPhase('error');
      }
    } catch {
      setErrorMsg('Network error. Please check your connection and try again.');
      setPhase('error');
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          className="relative z-10 w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden"
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          {/* Header */}
          <div className="flex items-start justify-between p-6 pb-4 border-b border-zinc-100">
            <div>
              <h2 className="text-lg font-bold text-zinc-900">Apply for this role</h2>
              <p className="text-sm text-zinc-500 mt-0.5">{opportunity.title} · {opportunity.state}</p>
            </div>
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-zinc-600 transition-colors p-1 rounded-lg hover:bg-zinc-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Opportunity summary */}
          <div className="px-6 py-4 bg-zinc-50 border-b border-zinc-100">
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-white border border-zinc-200 px-3 py-1 font-medium text-zinc-600">
                {opportunity.specialty}
              </span>
              <span className="rounded-full bg-white border border-zinc-200 px-3 py-1 font-medium text-zinc-600">
                {opportunity.hiringType}
              </span>
              {opportunity.organizationName && (
                <span className="rounded-full bg-white border border-zinc-200 px-3 py-1 font-medium text-zinc-600">
                  {opportunity.organizationName}
                </span>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {phase === 'success' ? (
              <motion.div
                className="text-center py-4"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
                <h3 className="text-lg font-bold text-zinc-900 mb-1">Application submitted!</h3>
                <p className="text-sm text-zinc-500 mb-6">
                  The employer will be notified. You can track your application status in your dashboard.
                </p>
                <button
                  onClick={onClose}
                  className="w-full rounded-xl bg-zinc-900 text-white font-semibold py-3 hover:bg-zinc-800 transition-colors"
                >
                  Done
                </button>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-zinc-700 block mb-1.5">
                    NPI Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={npi}
                    onChange={e => setNpi(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="10-digit NPI"
                    maxLength={10}
                    required
                    className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition"
                  />
                  <p className="text-xs text-zinc-400 mt-1">Your credentials will be verified automatically via NPPES.</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-zinc-700 block mb-1.5">
                    Cover note <span className="text-zinc-400 font-normal">(optional)</span>
                  </label>
                  <textarea
                    value={coverNote}
                    onChange={e => setCoverNote(e.target.value)}
                    rows={3}
                    placeholder="Briefly introduce yourself or highlight relevant experience…"
                    className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition resize-none"
                  />
                </div>

                {phase === 'error' && (
                  <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
                    {errorMsg}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={phase === 'submitting' || npi.length < 10}
                  className="w-full rounded-xl bg-zinc-900 text-white font-semibold py-3 hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {phase === 'submitting' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Submitting…
                    </>
                  ) : (
                    'Submit Application'
                  )}
                </button>

                <p className="text-[11px] text-zinc-400 text-center">
                  Your NPI and credentials are verified cryptographically. No data is shared without your consent.
                </p>
              </form>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
