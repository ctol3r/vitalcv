'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2, Database, Shield, Zap, FileText, Network } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ResolverStep {
  id: string;
  label: string;
  icon: React.ElementType;
}

const DEFAULT_STEPS: ResolverStep[] = [
  { id: 'npi', label: 'Locating NPI record', icon: Database },
  { id: 'board', label: 'Verifying Board Certifications', icon: FileText },
  { id: 'dea', label: 'Checking DEA Registration', icon: Shield },
  { id: 'sanctions', label: 'Scanning Sanctions Database', icon: Zap },
  { id: 'graph', label: 'Generating Trust Graph', icon: Network },
];

export function ResolverProgressIndicator({
  onComplete,
  durationPerStep = 600,
}: {
  onComplete?: () => void;
  durationPerStep?: number;
}) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  useEffect(() => {
    if (currentStepIndex >= DEFAULT_STEPS.length) {
      setTimeout(() => {
        onComplete?.();
      }, 500); // short delay before transition
      return;
    }

    const timer = setTimeout(() => {
      setCurrentStepIndex((prev) => prev + 1);
    }, durationPerStep);

    return () => clearTimeout(timer);
  }, [currentStepIndex, durationPerStep, onComplete]);

  return (
    <div className="mx-auto w-full max-w-md space-y-5">
      <div className="mb-6 text-center">
        <h3 className="mb-2 text-xl font-heading font-bold text-foreground sm:text-2xl">Activating trust profile</h3>
        <p className="text-foreground/70 text-sm font-mono tracking-widest uppercase">Syncing verified records</p>
      </div>

      <div className="space-y-3">
        {DEFAULT_STEPS.map((step, index) => {
          const isCompleted = index < currentStepIndex;
          const isCurrent = index === currentStepIndex;
          const isPending = index > currentStepIndex;
          const Icon = step.icon;

          return (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3.5 transition-all duration-500 sm:gap-4 sm:p-4",
                isCompleted ? "bg-emerald-500/10 border-emerald-500/20" :
                isCurrent ? "bg-muted border-border" :
                "bg-transparent border-transparent opacity-40"
              )}
            >
              <div className={cn(
                "h-9 w-9 rounded-full flex items-center justify-center shrink-0 transition-colors duration-500 sm:h-10 sm:w-10",
                isCompleted ? "bg-emerald-500 text-foreground" :
                isCurrent ? "bg-muted text-foreground" :
                "bg-transparent text-muted-foreground"
              )}>
                {isCompleted ? (
                  <Check className="w-5 h-5" />
                ) : isCurrent ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Icon className="w-5 h-5" />
                )}
              </div>

              <div className="flex-1">
                <span className={cn(
                  "font-medium tracking-wide transition-colors duration-500",
                  isCompleted ? "text-emerald-50" :
                  isCurrent ? "text-white" :
                  "text-muted-foreground"
                )}>
                  {step.label}
                </span>
                {isCurrent && (
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: "100%" }}
                    transition={{ duration: durationPerStep / 1000, ease: "linear" }}
                    className="h-0.5 bg-emerald-500/50 mt-2 rounded-full"
                  />
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
