'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { easings, durations } from '../../design/tokens';
import { cn } from '../../lib/utils';

interface AntigravityHeroProps {
  headline: string;
  subhead?: string;
  className?: string;
  headlineClassName?: string;
  subheadClassName?: string;
  align?: 'left' | 'center' | 'right';
}

export function AntigravityHero({
  headline,
  subhead,
  className,
  headlineClassName,
  subheadClassName,
  align = 'center',
}: AntigravityHeroProps) {
  const alignClass =
    align === 'center'
      ? 'text-center items-center'
      : align === 'right'
      ? 'text-right items-end'
      : 'text-left items-start';

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 40, filter: 'blur(12px)' },
    visible: {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      transition: {
        duration: durations.slow,
        ease: easings.easeOut,
      },
    },
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={cn('flex flex-col gap-6 md:gap-10 w-full max-w-[90vw] mx-auto', alignClass, className)}
    >
      <motion.h1
        variants={itemVariants}
        className={cn(
          'font-heading text-5xl md:text-8xl lg:text-10xl xl:text-11xl leading-none text-foreground tracking-tight',
          headlineClassName
        )}
      >
        {headline}
      </motion.h1>

      {subhead && (
        <motion.p
          variants={itemVariants}
          className={cn(
            'font-sans text-xl md:text-2xl lg:text-3xl text-muted-foreground font-light max-w-3xl leading-relaxed',
            subheadClassName
          )}
        >
          {subhead}
        </motion.p>
      )}
    </motion.div>
  );
}
