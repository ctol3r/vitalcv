'use client';

import { UX_EVENTS } from '@/lib/analytics/ux-events';
import { trackPilotEvent } from '@/lib/pilot-ops/client';
import { Button } from '@/components/ui/button';
import { GlassCard, GlassCardContent } from '@/components/ui/glass-card';
import { Badge } from '@/components/ui/badge';
import {
  getNextBestActionEvidenceLabel,
  getNextBestActionKindLabel,
  type NormalizedNextBestAction,
} from '@/lib/next-best-action';
import { ArrowRight, Lightbulb } from 'lucide-react';
import Link from 'next/link';

export interface NextBestActionData extends NormalizedNextBestAction {}

const KIND_TONE: Record<'ESCALATE' | 'REVERIFY' | 'PROCEED' | 'REVIEW_MANUALLY', string> = {
  ESCALATE: 'border-rose-500/20 bg-rose-500/8 text-rose-300',
  REVERIFY: 'border-amber-500/20 bg-amber-500/8 text-amber-200',
  PROCEED: 'border-emerald-500/20 bg-emerald-500/8 text-emerald-200',
  REVIEW_MANUALLY: 'border-border bg-muted/30 text-muted-foreground',
};

export function NextBestAction({ action }: { action?: NextBestActionData | null }) {
  if (!action) {
    return null;
  }

  const handleActionClick = () => {
    void trackPilotEvent({
      eventType: action.href ? UX_EVENTS.NAV_ITEM_CLICKED : UX_EVENTS.SHARE_CTA_CLICKED,
      oncePerSession: false,
      details: {
        surface: 'clinician_next_best_action',
        kind: action.kind,
        title: action.title,
        target: action.href ?? 'inline_action',
      },
    });

    action.onClick?.();
  };

  return (
    <GlassCard weight="heavy" className="border-primary/20">
      <GlassCardContent className="pt-4 pb-4">
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--accent)]/20 text-primary shrink-0 mt-0.5">
            <Lightbulb className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-heading font-semibold text-sm">{action.title}</p>
              <Badge className={KIND_TONE[action.kind]}>
                {getNextBestActionKindLabel(action.kind)}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {getNextBestActionEvidenceLabel(action.evidenceCount)}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{action.description}</p>
            {action.highlights && action.highlights.length > 0 ? (
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {action.highlights.slice(0, 3).map((highlight) => (
                  <li key={highlight} className="flex gap-2">
                    <span className="text-primary">•</span>
                    <span>{highlight}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {action.blockers && action.blockers.length > 0 ? (
              <div className="mt-2 rounded-md border border-amber-500/20 bg-amber-500/8 px-2 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-200">
                  Current blockers
                </p>
                <ul className="mt-1 space-y-1 text-xs text-amber-100">
                  {action.blockers.slice(0, 3).map((blocker) => (
                    <li key={blocker} className="flex gap-2">
                      <span>•</span>
                      <span>{blocker}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {(action.onClick || action.href) ? (
              action.href ? (
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="mt-2 text-xs h-7 px-2 gap-1"
                >
                  <Link href={action.href} onClick={handleActionClick}>
                    {action.actionLabel}
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 text-xs h-7 px-2 gap-1"
                  onClick={handleActionClick}
                >
                  {action.actionLabel}
                  <ArrowRight className="h-3 w-3" />
                </Button>
              )
            ) : null}
          </div>
        </div>
      </GlassCardContent>
    </GlassCard>
  );
}
