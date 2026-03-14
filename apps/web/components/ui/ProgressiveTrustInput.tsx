'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { easings, durations } from '../../design/tokens';
import { cn } from '../../lib/utils';
import { ArrowRight, Loader2 } from 'lucide-react';

interface ProgressiveTrustInputProps {
  placeholder?: string;
  label?: string;
  onSubmit: (value: string) => Promise<void>;
  isLoading?: boolean;
  className?: string;
  pattern?: string;
  maxLength?: number;
}

export function ProgressiveTrustInput({
  placeholder = 'Enter value...',
  label,
  onSubmit,
  isLoading = false,
  className,
  pattern,
  maxLength,
}: ProgressiveTrustInputProps) {
  const [value, setValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus on mount for that immediate readiness feel
  useEffect(() => {
    // Small delay to allow enter animations to finish
    const timer = setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim() && !isLoading) {
      await onSubmit(value.trim());
    }
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: 30, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: durations.slow, ease: easings.easeOut, delay: 0.3 }}
      onSubmit={handleSubmit}
      className={cn('w-full max-w-3xl mx-auto flex flex-col items-center gap-8', className)}
    >
      {label && (
        <motion.label
          initial={{ opacity: 0 }}
          animate={{ opacity: isFocused || value ? 1 : 0.6 }}
          className="text-lg md:text-xl text-muted-foreground font-medium uppercase tracking-widest"
        >
          {label}
        </motion.label>
      )}

      <div className="relative w-full group">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={isFocused ? '' : placeholder}
          pattern={pattern}
          maxLength={maxLength}
          disabled={isLoading}
          className="w-full bg-transparent border-b-2 border-muted-foreground/30 text-center font-sans font-light text-5xl md:text-7xl lg:text-9xl py-4 md:py-8 focus:outline-none focus:border-foreground transition-colors duration-500 placeholder:text-muted-foreground/30 disabled:opacity-50"
        />

        {/* Dynamic underline/focus state */}
        <motion.div
          className="absolute bottom-0 left-0 h-0.5 bg-foreground"
          initial={{ width: '0%', left: '50%' }}
          animate={{
            width: isFocused || value ? '100%' : '0%',
            left: isFocused || value ? '0%' : '50%',
          }}
          transition={{ duration: durations.slow, ease: easings.easeOut }}
        />

        {/* Action Button that fades in when there is input */}
        <AnimatePresence>
          {value.length > 0 && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8, x: -20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.8, x: -20 }}
              transition={{ duration: durations.normal, ease: easings.easeOut }}
              type="submit"
              disabled={isLoading}
              className="absolute right-0 top-1/2 -translate-y-1/2 p-4 rounded-full bg-primary text-primary-foreground hover:scale-105 active:scale-95 transition-transform disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="w-8 h-8 md:w-12 md:h-12 animate-spin" />
              ) : (
                <ArrowRight className="w-8 h-8 md:w-12 md:h-12" />
              )}
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </motion.form>
  );
}
