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
    <div className="w-full max-w-md mx-auto space-y-6">
      <div className="text-center mb-8">
        <h3 className="text-2xl font-heading font-bold text-white mb-2">Activating Trust State</h3>
        <p className="text-white/50 text-sm font-mono tracking-widest uppercase">Resolving Verifiable Credentials</p>
      </div>

      <div className="space-y-4">
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
                "flex items-center gap-4 p-4 rounded-xl border transition-all duration-500",
                isCompleted ? "bg-emerald-500/10 border-emerald-500/20" :
                isCurrent ? "bg-white/5 border-white/10" :
                "bg-transparent border-transparent opacity-40"
              )}
            >
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors duration-500",
                isCompleted ? "bg-emerald-500 text-white" :
                isCurrent ? "bg-white/10 text-white" :
                "bg-transparent text-white/40"
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
                  "text-white/40"
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
