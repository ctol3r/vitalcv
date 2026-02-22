'use client';

import { Button } from '@/components/ui/button';
import { GlassCard, GlassCardContent } from '@/components/ui/glass-card';
import { ArrowRight, Lightbulb } from 'lucide-react';

export interface NextBestActionData {
  title: string;
  description: string;
  action: string;
  href?: string;
  onClick?: () => void;
}

export function NextBestAction({ action }: { action: NextBestActionData }) {
  return (
    <GlassCard weight="heavy" className="border-primary/20">
      <GlassCardContent className="pt-4 pb-4">
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--accent)]/20 text-primary shrink-0 mt-0.5">
            <Lightbulb className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-heading font-semibold text-sm">{action.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 text-xs h-7 px-2 gap-1"
              onClick={action.onClick}
            >
              {action.action}
              <ArrowRight className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </GlassCardContent>
    </GlassCard>
  );
}
