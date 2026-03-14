'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { cardReveal } from '@/animations/motionVariants';
import { MagneticButton } from '../ui/MagneticButton';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import Link from 'next/link';

export type ReadinessState = 'ready' | 'conditionally_ready' | 'not_ready';

interface ReadinessCardProps {
  state: ReadinessState;
  title: string;
  summary: string;
  passportId: string;
  className?: string;
}

const stateConfig = {
  ready: {
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
    border: 'border-emerald-500/20',
    icon: CheckCircle2,
    label: 'READY',
  },
  conditionally_ready: {
    color: 'text-yellow-400',
    bg: 'bg-yellow-400/10',
    border: 'border-yellow-500/20',
    icon: AlertTriangle,
    label: 'CONDITIONALLY READY',
  },
  not_ready: {
    color: 'text-red-400',
    bg: 'bg-red-400/10',
    border: 'border-red-500/20',
    icon: XCircle,
    label: 'NOT READY',
  },
};

export function ReadinessCard({ state, title, summary, passportId, className }: ReadinessCardProps) {
  const config = stateConfig[state];
  const Icon = config.icon;

  return (
    <motion.div
      variants={cardReveal}
      initial="hidden"
      animate="visible"
      className={cn("w-full max-w-2xl mx-auto flex flex-col items-center", className)}
    >
      <div className={cn(
        "w-full glass-heavy p-10 md:p-16 rounded-3xl text-center border relative overflow-hidden",
        config.border
      )}>
        {/* Subtle background glow */}
        <div className={cn("absolute inset-0 opacity-20 blur-[100px]", config.bg)} />

        <div className="relative z-10 flex flex-col items-center space-y-8">
          <div className={cn("flex items-center gap-3 px-4 py-2 rounded-full border bg-white/5", config.border)}>
            <Icon className={cn("h-5 w-5", config.color)} />
            <span className={cn("text-sm font-bold tracking-[0.2em] uppercase", config.color)}>
              {config.label}
            </span>
          </div>

          <h2 className="text-4xl md:text-5xl font-heading font-extrabold text-white text-balance">
            {title}
          </h2>

          <p className="text-xl text-white/60 max-w-lg mx-auto leading-relaxed">
            {summary}
          </p>

          <div className="pt-8 w-full border-t border-white/10 mt-8 flex justify-center">
            <MagneticButton>
              <Link href={`/passport/${passportId}`} className="glue-btn glue-btn-primary">
                View your credentials
              </Link>
            </MagneticButton>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
