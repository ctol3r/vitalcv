'use client';

import * as React from 'react';
import { useState, useEffect } from 'react';
import { Check, Loader2, Database, Shield, Zap, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ResolverStep {
  id: string;
  label: string;
  icon: React.ElementType;
}

const DEFAULT_STEPS: ResolverStep[] = [
  { id: 'npi', label: 'Recognizing', icon: Database },
  { id: 'safety', label: 'Reading', icon: Shield },
  { id: 'readiness', label: 'Building', icon: FileText },
  { id: 'handoff', label: 'Opening', icon: Zap },
];

export function ResolverProgressIndicator({
  onComplete,
  durationPerStep = 540,
}: {
  onComplete?: () => void;
  durationPerStep?: number;
}) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  useEffect(() => {
    if (currentStepIndex >= DEFAULT_STEPS.length) {
      setTimeout(() => {
        onComplete?.();
      }, 300); // short delay before transition
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
        <h3 className="mb-2 text-xl font-semibold tracking-[-0.04em] text-white sm:text-2xl">
          Recognizing
        </h3>
        <p className="text-sm uppercase tracking-[0.22em] text-white/45">
          One step
        </p>
      </div>

      <div className="space-y-3">
        {DEFAULT_STEPS.map((step, index) => {
          const isCompleted = index < currentStepIndex;
          const isCurrent = index === currentStepIndex;
          const Icon = step.icon;

          return (
            <div
              key={step.id}
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
                  <div className="mt-2 h-0.5 w-full rounded-full bg-emerald-500/50" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
