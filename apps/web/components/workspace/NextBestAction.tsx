'use client';

import { UX_EVENTS } from '@/lib/analytics/ux-events';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { trackPilotEvent } from '@/lib/pilot-ops/client';
import {
  getNextBestActionEvidenceLabel,
  getNextBestActionKindLabel,
  normalizeNextBestAction,
} from '@/lib/next-best-action';
import { ArrowRight } from 'lucide-react';

interface Action {
  kind: 'ESCALATE' | 'REVERIFY' | 'PROCEED' | 'REVIEW_MANUALLY';
  title: string;
  description: string;
  confidence: number;
  href: string;
  priority?: 'high' | 'medium' | 'low';
  icon?: string;
}

interface NextBestActionProps {
  actions: Action[];
  heading?: string;
}

const KIND_STYLE: Record<'ESCALATE' | 'REVERIFY' | 'PROCEED' | 'REVIEW_MANUALLY', string> = {
  ESCALATE: 'border-rose-500/20 bg-rose-500/8',
  REVERIFY: 'border-vt-warning/30 bg-vt-warning/8',
  PROCEED: 'border-vt-success/30 bg-vt-success/8',
  REVIEW_MANUALLY: 'border-vt-neutral-800 bg-vt-surface-ops-raised/20',
};

const DOT_STYLE: Record<'ESCALATE' | 'REVERIFY' | 'PROCEED' | 'REVIEW_MANUALLY', string> = {
  ESCALATE: 'bg-rose-400 shadow-[0_0_10px_rgba(251,113,133,0.45)]',
  REVERIFY: 'bg-vt-warning shadow-[0_0_10px_rgba(245,158,11,0.5)]',
  PROCEED: 'bg-vt-success shadow-[0_0_10px_rgba(16,185,129,0.5)]',
  REVIEW_MANUALLY: 'bg-vt-neutral-600',
};

export default function NextBestAction({ actions, heading = 'Recommended next step' }: NextBestActionProps) {
  const primaryAction = actions
    .map((action) => {
      const normalized = normalizeNextBestAction({
        action: action.kind,
        reason: action.description,
        confidence: action.confidence,
      });

      if (!normalized) {
        return null;
      }

      return {
        ...normalized,
        title: action.title,
        href: action.href,
      };
    })
    .find((action): action is NonNullable<typeof action> => action !== null);

  if (!primaryAction) {
    return null;
  }

  return (
    <aside className="rounded-2xl border border-vt-neutral-800 bg-vt-surface-ops-raised/30 p-5 shadow-sm">
      <h2 className="text-[10px] font-semibold tracking-widest uppercase text-vt-neutral-400 mb-4">{heading}</h2>
      <Link
        href={primaryAction.href}
        onClick={() => {
          void trackPilotEvent({
            eventType: UX_EVENTS.NAV_ITEM_CLICKED,
            oncePerSession: false,
            details: {
              surface: 'workspace_next_best_action',
              kind: primaryAction.kind,
              title: primaryAction.title,
              target: primaryAction.href,
            },
          });
        }}
        className={`flex items-start sm:items-center min-h-[64px] gap-4 rounded-xl border p-4 transition-all hover:bg-black/20 active:scale-[0.98] ${KIND_STYLE[primaryAction.kind]}`}
      >
        <span className={`mt-1.5 sm:mt-0 h-2 w-2 shrink-0 rounded-full ${DOT_STYLE[primaryAction.kind]}`} aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground leading-tight">{primaryAction.title}</p>
            <Badge variant="outline" className="text-[10px]">{getNextBestActionKindLabel(primaryAction.kind)}</Badge>
            <Badge variant="outline" className="text-[10px]">
              {getNextBestActionEvidenceLabel(primaryAction.evidenceCount)}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-vt-neutral-300 leading-relaxed">{primaryAction.description}</p>
        </div>
        <ArrowRight className="mt-0.5 sm:mt-0 h-4 w-4 shrink-0 text-foreground/70" />
      </Link>
    </aside>
  );
}
