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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (type === 'nps' && score === null) return;
    setSubmitting(true);
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, score: score ?? undefined, message, email: email || undefined }),
      });
    } catch { /* best-effort */ }
    setSubmitted(true);
    setSubmitting(false);
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
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50"
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
              <div className="p-8 text-center">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}>
                  <div className="text-4xl mb-3">🙏</div>
                  <h3 className="font-semibold text-slate-900 mb-1">Thank you!</h3>
                  <p className="text-sm text-slate-400">Your feedback helps us improve VitalCV.</p>
                </motion.div>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                  <h3 className="font-semibold text-slate-900 text-sm">Send Feedback</h3>
                  <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
                </div>

                <div className="p-5 space-y-4">
                  {/* Type selector */}
                  <div className="flex gap-2">
                    {([['nps', '⭐ Rate'], ['bug', '🐛 Bug'], ['feature', '💡 Feature']] as [FeedbackType, string][]).map(([t, label]) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setType(t)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          type === t ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* NPS score selector */}
                  {type === 'nps' && (
                    <div>
                      <p className="text-xs text-slate-500 mb-2">How likely are you to recommend VitalCV?</p>
                      <div className="flex gap-1 flex-wrap">
                        {Array.from({ length: 11 }, (_, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setScore(i)}
                            className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all ${
                              score === i ? scoreColor(i) : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                            }`}
                          >
                            {i}
                          </button>
                        ))}
                      </div>
                      {score !== null && (
                        <p className="text-xs text-slate-400 mt-1">{SCORE_LABELS[score]}</p>
                      )}
                    </div>
                  )}

                  {/* Message */}
                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder={
                      type === 'nps' ? 'What could we improve? (optional)'
                        : type === 'bug' ? 'Describe the bug...'
                          : 'Describe the feature you need...'
                    }
                    required={type !== 'nps'}
                    rows={3}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 resize-none"
                  />

                  {/* Email */}
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="Email (optional — for follow-up)"
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                  />

                  <button
                    type="submit"
                    disabled={submitting || (type === 'nps' && score === null)}
                    className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white font-medium py-2.5 rounded-xl text-sm transition-colors"
                  >
                    {submitting ? 'Sending...' : 'Submit Feedback'}
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
