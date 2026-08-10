'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface NpsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SCORE_LABELS: Record<number, string> = {
  0: 'Terrible', 1: 'Very Bad', 2: 'Bad', 3: 'Poor', 4: 'Below Average',
  5: 'Average', 6: 'Okay', 7: 'Good', 8: 'Great', 9: 'Very Good', 10: 'Amazing',
};

function scoreColor(n: number): string {
  if (n <= 3) return 'bg-red-500 text-white';
  if (n <= 6) return 'bg-amber-400 text-white';
  return 'bg-emerald-500 text-white';
}

type FeedbackType = 'nps' | 'bug' | 'feature';

export default function NpsModal({ isOpen, onClose }: NpsModalProps) {
  const [type, setType] = useState<FeedbackType>('nps');
  const [score, setScore] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  /** The note did not reach the server. Nothing was received. */
  const [failed, setFailed] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (type === 'nps' && score === null) return;
    setSubmitting(true);
    setFailed(false);
    // "Message received" is a claim about what the server did. It may only be
    // shown when the server actually accepted the note — a swallowed error
    // followed by an unconditional success screen tells someone their feedback
    // arrived when it did not.
    let ok = false;
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, score: score ?? undefined, message, email: email || undefined }),
      });
      ok = response.ok;
    } catch {
      ok = false;
    }
    setSubmitting(false);
    if (!ok) {
      setFailed(true);
      return;
    }
    setSubmitted(true);
    setTimeout(onClose, 2000);
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-muted backdrop-blur-sm z-50"
          />
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 60, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-24 right-6 z-50 w-[360px] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
          >
            {submitted ? (
              <div className="p-8 text-center bg-zinc-50 rounded-2xl">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}>
                  <div className="text-4xl mb-4">🙏</div>
                  <h3 className="font-semibold text-zinc-900 mb-2">Message received</h3>
                  <p className="text-sm text-zinc-600 leading-relaxed">Our product team reads every note.<br/>Thank you for helping us improve.</p>
                </motion.div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="bg-white">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
                  <h3 className="font-semibold text-zinc-900 text-sm">Help improve VitalCV</h3>
                  <button type="button" onClick={onClose} className="flex items-center justify-center w-8 h-8 rounded-full bg-zinc-50 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition-colors">
                    <span className="text-lg leading-none">×</span>
                  </button>
                </div>

                <div className="p-5 space-y-5">
                  {failed ? (
                    <p role="status" className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      Not sent — your note didn&rsquo;t reach us. Nothing was recorded. Try again.
                    </p>
                  ) : null}

                  {/* Type selector */}
                  <div className="flex gap-2">
                    {([['nps', '⭐ Rate'], ['bug', '🐛 Bug'], ['feature', '💡 Idea']] as [FeedbackType, string][]).map(([t, label]) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setType(t)}
                        className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all border ${
                          type === t ? 'bg-zinc-900 text-foreground border-zinc-900 shadow-md' : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50 hover:border-zinc-300'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* NPS score selector */}
                  {type === 'nps' && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                      <p className="text-xs font-medium text-zinc-600 mb-3">How likely are you to recommend VitalCV to a colleague?</p>
                      <div className="flex gap-1 flex-wrap justify-between">
                        {Array.from({ length: 11 }, (_, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setScore(i)}
                            className={`w-7 h-8 rounded-lg text-xs font-bold transition-all border ${
                              score === i ? 'bg-zinc-900 text-foreground border-zinc-900 scale-110 shadow-md' : 'bg-white text-zinc-500 border-zinc-200 hover:bg-zinc-50 hover:border-zinc-300'
                            }`}
                          >
                            {i}
                          </button>
                        ))}
                      </div>
                      {score !== null && (
                        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs font-medium text-zinc-500 mt-3 text-center">
                          {SCORE_LABELS[score]}
                        </motion.p>
                      )}
                    </motion.div>
                  )}

                  {/* Message */}
                  <div className="space-y-3">
                    <textarea
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      placeholder={
                        type === 'nps' ? 'What would make this experience better? (optional)'
                          : type === 'bug' ? 'What went wrong? We\'ll fix it.'
                            : 'What would you like us to build next?'
                      }
                      required={type !== 'nps'}
                      rows={3}
                      className="w-full text-sm border border-zinc-200 bg-zinc-50/50 rounded-xl px-4 py-3 text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-500 focus:bg-white resize-none transition-all"
                    />

                    {/* Email */}
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="Email (optional, if you'd like a reply)"
                      className="w-full text-sm border border-zinc-200 bg-zinc-50/50 rounded-xl px-4 py-3 text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-500 focus:bg-white transition-all"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || (type === 'nps' && score === null)}
                    className="w-full flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 disabled:bg-zinc-100 disabled:text-zinc-400 text-foreground font-bold py-3 rounded-xl text-sm transition-all active:scale-[0.98]"
                  >
                    {submitting ? 'Sending...' : 'Share with product team'}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
