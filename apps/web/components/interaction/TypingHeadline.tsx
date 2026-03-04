'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const PHRASES = [
  'Start clinicians 3–6 weeks faster.',
  'Verified Once. Accepted Everywhere.',
  'Trust Infrastructure for Healthcare.',
];

const TYPE_SPEED = 45;
const DELETE_SPEED = 30;
const PAUSE_AFTER_TYPE = 2500;
const PAUSE_AFTER_DELETE = 400;

export function TypingHeadline() {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const tick = useCallback(() => {
    const currentPhrase = PHRASES[phraseIndex];

    if (!isDeleting) {
      // Typing
      if (displayText.length < currentPhrase.length) {
        return {
          next: currentPhrase.slice(0, displayText.length + 1),
          delay: TYPE_SPEED,
          deleting: false,
        };
      }
      // Finished typing — pause then start deleting
      return { next: displayText, delay: PAUSE_AFTER_TYPE, deleting: true };
    }

    // Deleting
    if (displayText.length > 0) {
      return {
        next: displayText.slice(0, -1),
        delay: DELETE_SPEED,
        deleting: true,
      };
    }

    // Finished deleting — move to next phrase
    return { next: '', delay: PAUSE_AFTER_DELETE, deleting: false, advance: true };
  }, [displayText, isDeleting, phraseIndex]);

  useEffect(() => {
    const result = tick();
    const timer = setTimeout(() => {
      setDisplayText(result.next);
      setIsDeleting(result.deleting);
      if (result.advance) {
        setPhraseIndex((prev) => (prev + 1) % PHRASES.length);
      }
    }, result.delay);

    return () => clearTimeout(timer);
  }, [tick]);

  return (
    <h1
      className="font-heading font-bold leading-[1.05] tracking-tight"
      style={{ fontSize: 'var(--ag-text-hero)' }}
    >
      <AnimatePresence mode="popLayout">
        <motion.span
          key={phraseIndex}
          initial={{ opacity: 0.8 }}
          animate={{ opacity: 1 }}
          className="bg-gradient-to-r from-[var(--ag-primary)] to-[var(--ag-accent)] bg-clip-text text-transparent"
        >
          {displayText}
        </motion.span>
      </AnimatePresence>
      <span className="animate-blink ml-0.5 inline-block h-[0.9em] w-[3px] translate-y-[0.1em] rounded-full bg-[var(--ag-primary)]" />
    </h1>
  );
}
