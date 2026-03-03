'use client';

import { cardReveal, pageWrap, staggerContainer } from '@/animations/motionVariants';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import * as React from 'react';

interface HeroSectionProps {
  title: React.ReactNode;
  subtitle: React.ReactNode;
  primaryAction?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  className?: string;
}

export function HeroSection({
  title,
  subtitle,
  primaryAction,
  secondaryAction,
  className,
}: HeroSectionProps) {
  return (
    <motion.section
      variants={pageWrap}
      initial="hidden"
      animate="visible"
      className={cn(
        'relative flex min-h-[70vh] flex-col items-center justify-center px-4 py-20 text-center overflow-hidden',
        className
      )}
    >
      <div className="noise-overlay" />

      {/* Bioluminescent glow artifact */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none -z-10">
        <div className="h-[600px] w-[600px] rounded-full bg-[var(--sage)] opacity-20 blur-[120px] animate-glow-breathe" />
      </div>

      <motion.div variants={staggerContainer} className="relative z-10 max-w-4xl mx-auto space-y-8">
        <motion.h1
          variants={cardReveal}
          className="font-heading text-5xl font-extrabold tracking-tight md:text-7xl lg:text-8xl text-balance"
        >
          {title}
        </motion.h1>

        <motion.p
          variants={cardReveal}
          className="mx-auto max-w-2xl text-xl text-[var(--muted-foreground)] md:text-2xl text-balance"
        >
          {subtitle}
        </motion.p>

        {(primaryAction || secondaryAction) && (
          <motion.div
            variants={cardReveal}
            className="flex flex-col items-center justify-center gap-4 sm:flex-row mt-10"
          >
            {primaryAction}
            {secondaryAction}
          </motion.div>
        )}
      </motion.div>
    </motion.section>
  );
}
