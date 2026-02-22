'use client';

import {
  GlassCard,
  GlassCardContent,
  GlassCardHeader,
  GlassCardTitle,
} from '@/components/ui/glass-card';
import { cn } from '@/lib/utils';
import {
  ArrowUpRight,
  CheckCircle2,
  FileText,
  ShieldCheck,
  Upload,
  Zap,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type VitaEventKind =
  | 'CREDENTIAL_VERIFIED'
  | 'DOCUMENT_UPLOADED'
  | 'PROFILE_COMPLETED'
  | 'CREDENTIAL_SHARED'
  | 'CREDENTIAL_RENEWED';

export interface VitaEvent {
  id: string;
  kind: VitaEventKind;
  label: string;
  tokens: number;
  timestamp: string; // ISO 8601
}

interface VitaTokenDashboardProps {
  balance: number;
  events: VitaEvent[];
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const EVENT_ICON: Record<VitaEventKind, React.ElementType> = {
  CREDENTIAL_VERIFIED: ShieldCheck,
  DOCUMENT_UPLOADED: Upload,
  PROFILE_COMPLETED: CheckCircle2,
  CREDENTIAL_SHARED: ArrowUpRight,
  CREDENTIAL_RENEWED: FileText,
};

const EVENT_COLOR: Record<VitaEventKind, string> = {
  CREDENTIAL_VERIFIED: 'text-[var(--trust-green)]',
  DOCUMENT_UPLOADED: 'text-[var(--accent)]',
  PROFILE_COMPLETED: 'text-[var(--trust-green)]',
  CREDENTIAL_SHARED: 'text-[var(--sage)]',
  CREDENTIAL_RENEWED: 'text-[var(--accent)]',
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/* ------------------------------------------------------------------ */
/*  VitaTokenDashboard                                                 */
/* ------------------------------------------------------------------ */

export function VitaTokenDashboard({
  balance,
  events,
  className,
}: VitaTokenDashboardProps) {
  return (
    <GlassCard className={cn('overflow-hidden', className)}>
      <GlassCardHeader>
        <GlassCardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-[var(--accent)]" />
          Value Creation
        </GlassCardTitle>
      </GlassCardHeader>

      <GlassCardContent className="space-y-5">
        {/* Balance hero */}
        <div className="flex items-baseline gap-2">
          <span className="font-heading text-4xl font-bold tabular-nums">
            {balance.toLocaleString()}
          </span>
          <span className="text-sm text-muted-foreground font-medium">
            VITA earned
          </span>
        </div>

        {/* Tier progress — subtle, not gamified */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Progress</span>
            <span className="text-muted-foreground tabular-nums">
              {balance} / {nextTierTarget(balance)}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-all duration-700 ease-out"
              style={{
                width: `${Math.min(100, (balance / nextTierTarget(balance)) * 100)}%`,
              }}
            />
          </div>
        </div>

        {/* Activity log */}
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
            Recent Activity
          </p>
          <div className="divide-y divide-border/30">
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground py-3 text-center">
                Complete actions to earn VITA tokens
              </p>
            ) : (
              events.slice(0, 8).map((event) => {
                const Icon = EVENT_ICON[event.kind];
                return (
                  <div
                    key={event.id}
                    className="flex items-center gap-3 py-2.5"
                  >
                    <div
                      className={cn(
                        'flex-shrink-0 rounded-lg p-1.5 bg-muted/30',
                        EVENT_COLOR[event.kind],
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{event.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {relativeTime(event.timestamp)}
                      </p>
                    </div>
                    <span className="text-xs font-medium text-[var(--accent)] tabular-nums flex-shrink-0">
                      +{event.tokens}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </GlassCardContent>
    </GlassCard>
  );
}

/* ------------------------------------------------------------------ */
/*  Tier helpers                                                       */
/* ------------------------------------------------------------------ */

function nextTierTarget(balance: number): number {
  const tiers = [50, 150, 500, 1000, 2500];
  return tiers.find((t) => t > balance) ?? tiers[tiers.length - 1];
}
