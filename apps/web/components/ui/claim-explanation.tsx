import * as React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

export interface ExplanationStep {
  title: string;
  description: string;
}

export interface ClaimExplanationProps extends React.ComponentPropsWithoutRef<typeof Card> {
  claimLabel: string;
  steps: ExplanationStep[];
}

/**
 * ClaimExplanation
 * 
 * Transparent breakdown of how a claim was evaluated.
 * Uses simple, zero-jargon language with a stark layout.
 */
export const ClaimExplanation = React.forwardRef<HTMLDivElement, ClaimExplanationProps>(
  ({ className, claimLabel, steps, ...props }, ref) => {
    return (
      <Card 
        ref={ref} 
        className={cn('bg-black/20 border border-white/5 rounded-xl text-white', className)} 
        {...props}
      >
        <div className="px-4 py-3 border-b border-white/5 bg-white/[0.02]">
          <h4 className="text-sm font-semibold tracking-tight text-white/90">
            Why we verified <span className="text-white/40 italic">"{claimLabel}"</span>
          </h4>
        </div>
        <CardContent className="pt-4 pb-5">
          <ul className="space-y-4">
            {steps.map((step, index) => (
              <li key={index} className="flex gap-4">
                <div className="flex flex-col items-center mt-0.5">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold text-white/70 shadow-[0_0_0_1px_rgba(255,255,255,0.05)_inset]">
                    {index + 1}
                  </div>
                  {index < steps.length - 1 && (
                    <div className="w-[1px] h-full bg-white/5 my-1" />
                  )}
                </div>
                <div className="pb-4">
                  <h5 className="text-sm font-medium text-white/90 mb-1">{step.title}</h5>
                  <p className="text-xs text-white/50 leading-relaxed block max-w-[90%]">
                    {step.description}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    );
  }
);

ClaimExplanation.displayName = 'ClaimExplanation';
