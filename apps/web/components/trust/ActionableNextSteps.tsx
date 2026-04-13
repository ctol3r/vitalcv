import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { TrustStatusBadge } from '@/components/ui/trust-status-badge';
import type { PassportData } from '@/lib/trust/passport-contract';

void React;

const PRIORITY_CLASS: Record<string, string> = {
  HIGH: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
  MEDIUM: 'border-amber-500/30 bg-amber-500/10 text-amber-100',
  LOW: 'border-sky-500/30 bg-sky-500/10 text-sky-100',
};

type NextAction = PassportData['readiness']['nextActions'][number];

function groupByPriority(actions: NextAction[]): Record<string, NextAction[]> {
  const groups: Record<string, NextAction[]> = { HIGH: [], MEDIUM: [], LOW: [] };
  for (const action of actions) {
    const bucket = groups[action.priority];
    if (bucket) {
      bucket.push(action);
    } else {
      groups.LOW!.push(action);
    }
  }
  return groups;
}

export function ActionableNextSteps({
  readiness,
  trustPosture,
  divergence,
  mode,
}: {
  readiness: PassportData['readiness'];
  trustPosture: PassportData['trustPosture'];
  divergence?: PassportData['divergence'];
  mode: 'clinician' | 'employer';
}) {
  const allActions = [...readiness.nextActions];

  if (divergence && divergence.activeCount > 0) {
    allActions.push({
      id: 'resolve-divergence',
      title: 'Resolve cross-source conflicts',
      detail: `${divergence.activeCount} active divergence${divergence.activeCount === 1 ? '' : 's'} applying -${divergence.totalPenalty} CRS penalty. Resolution restores the penalty.`,
      priority: divergence.highCount > 0 ? 'HIGH' : 'MEDIUM',
    });
  }

  if (allActions.length === 0 && readiness.blockers.length === 0) {
    return null;
  }

  const grouped = groupByPriority(allActions);
  const priorityOrder: Array<{ key: string; label: string }> = [
    { key: 'HIGH', label: 'Urgent' },
    { key: 'MEDIUM', label: 'Recommended' },
    { key: 'LOW', label: 'Optional' },
  ];

  return (
    <Card className="gap-0 rounded-2xl border-white/8 bg-white/[0.03] py-0 shadow-none">
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/40">
              {mode === 'clinician' ? 'What should happen next' : 'Recommended actions'}
            </p>
            <p className="text-sm text-foreground/70">
              {readiness.level} · {readiness.score}% ready
            </p>
          </div>
          <TrustStatusBadge
            status={
              readiness.status === 'BLOCKED' ? 'blocked'
              : readiness.status === 'PARTIAL' ? 'stale'
              : 'checked'
            }
            size="sm"
          />
        </div>
      </div>

      {/* Blockers — always shown first */}
      {readiness.blockers.length > 0 && (
        <div className="border-t border-rose-500/15 bg-rose-500/[0.04] px-5 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-300/60">
            {readiness.blockers.length} blocker{readiness.blockers.length === 1 ? '' : 's'}
          </p>
          <div className="mt-2 space-y-1.5">
            {readiness.blockers.map((blocker) => (
              <div key={blocker} className="flex items-start gap-2">
                <span className="mt-0.5 text-xs text-rose-300/40">—</span>
                <p className="text-sm text-rose-100/80">{blocker}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Priority-grouped actions */}
      <div className="divide-y divide-white/6">
        {priorityOrder.map(({ key, label }) => {
          const actions = grouped[key];
          if (!actions || actions.length === 0) return null;

          return (
            <div key={key} className="px-5 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/30">
                {label}
              </p>
              <div className="mt-2 space-y-2">
                {actions.map((action) => (
                  <div key={action.id} className="flex items-start gap-3">
                    <Badge
                      variant="outline"
                      className={[
                        'mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[9px]',
                        PRIORITY_CLASS[action.priority] ?? PRIORITY_CLASS.LOW,
                      ].join(' ')}
                    >
                      {action.priority}
                    </Badge>
                    <div className="min-w-0">
                      <p className="text-sm text-foreground/70">
                        {mode === 'employer' ? `Employer action: ${action.title}` : action.title}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{action.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
