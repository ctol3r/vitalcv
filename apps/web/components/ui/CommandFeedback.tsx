'use client';

import { cn } from '@/lib/utils';
import { systemVoice } from '@/lib/systemVoice';
import { motion, AnimatePresence } from 'framer-motion';
import * as React from 'react';
import { useCallback, useState } from 'react';

interface CommandFeedbackProps {
  /** Toast message shown after action */
  message?: string;
  className?: string;
}

/**
 * CommandFeedback — Moment of Power confirmation overlay.
 *
 * When triggered:
 * 1. Radial gradient pulse from center
 * 2. Fades out in 400ms
 * 3. System-voice toast appears simultaneously
 *
 * The user feels: "I changed the system."
 */
export function useCommandFeedback() {
  const [feedback, setFeedback] = useState<{
    message: string;
    key: number;
  } | null>(null);

  const trigger = useCallback((message?: string) => {
    setFeedback({
      message: message ?? systemVoice.toast.commandResolved,
      key: Date.now(),
    });
  }, []);

  const FeedbackOverlay = useCallback(
    ({ className }: CommandFeedbackProps) => (
      <AnimatePresence>
        {feedback && (
          <motion.div
            key={feedback.key}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1, ease: [0.16, 1, 0.3, 1] }}
            onAnimationComplete={() => {
              setTimeout(() => setFeedback(null), 1800);
            }}
            className={cn(
              'fixed inset-0 z-50 pointer-events-none flex items-end justify-center pb-8',
              className
            )}
          >
            {/* Radial pulse */}
            <motion.div
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 0.06, 0] }}
              transition={{ duration: 0.4, ease: [0.33, 1, 0.68, 1] }}
              style={{
                background:
                  'radial-gradient(circle at 50% 50%, var(--control-accent, oklch(0.55 0.20 255)) 0%, transparent 70%)',
              }}
            />

            {/* System toast */}
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1], delay: 0.06 }}
              className={cn(
                'relative px-4 py-2.5 rounded-lg',
                'bg-[var(--control-surface-raised,oklch(0.09_0.006_255))]',
                'border border-[var(--control-border,oklch(0.20_0.008_255))]',
                'shadow-lg backdrop-blur-sm'
              )}
            >
              <div className="flex items-center gap-2">
                {/* Green pulse dot */}
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--control-success)] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--control-success)]" />
                </span>
                <span className="text-xs font-medium text-[var(--control-text)] tracking-wide">
                  {feedback.message}
                </span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    ),
    [feedback]
  );

  return { trigger, FeedbackOverlay };
}
