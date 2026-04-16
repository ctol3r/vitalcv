'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfidenceScore } from '@/components/ui/confidence-score';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { AlertTriangle, CheckCircle2, Clock, Eye } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface HitlReviewItem {
  id: string;
  clinicianName: string;
  credentialType: string;
  source: string;
  avgConfidence: number;
  fieldsToReview: number;
  submittedAt: string;
  status: 'PENDING' | 'IN_REVIEW' | 'APPROVED' | 'CORRECTED' | 'REJECTED';
}

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface HitlReviewQueueProps {
  items: HitlReviewItem[];
  onSelectItem: (item: HitlReviewItem) => void;
}

/* ------------------------------------------------------------------ */
/*  Status config                                                      */
/* ------------------------------------------------------------------ */

const STATUS_CONFIG: Record<
  HitlReviewItem['status'],
  { label: string; color: string; icon: React.ReactNode }
> = {
  PENDING: {
    label: 'Pending',
    color: 'text-[var(--trust-yellow)] border-[var(--trust-yellow)]/20 bg-[var(--trust-yellow)]/5',
    icon: <Clock className="h-3 w-3" />,
  },
  IN_REVIEW: {
    label: 'In Review',
    color: 'text-[var(--accent)] border-[var(--accent)]/20 bg-[var(--accent)]/5',
    icon: <Eye className="h-3 w-3" />,
  },
  APPROVED: {
    label: 'Approved',
    color: 'text-[var(--trust-green)] border-[var(--trust-green)]/20 bg-[var(--trust-green)]/5',
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  CORRECTED: {
    label: 'Corrected',
    color: 'text-[var(--accent)] border-[var(--accent)]/20 bg-[var(--accent)]/5',
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  REJECTED: {
    label: 'Rejected',
    color: 'text-destructive border-destructive/20 bg-destructive/5',
    icon: <AlertTriangle className="h-3 w-3" />,
  },
};

/* ------------------------------------------------------------------ */
/*  HitlReviewQueue                                                    */
/* ------------------------------------------------------------------ */

export function HitlReviewQueue({ items, onSelectItem }: HitlReviewQueueProps) {
  const pendingCount = items.filter(
    (i) => i.status === 'PENDING' || i.status === 'IN_REVIEW',
  ).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-[var(--accent)]" />
          <CardTitle>Human Review Queue</CardTitle>
        </div>
        {pendingCount > 0 && (
          <Badge variant="outline" className="text-xs">
            {pendingCount} awaiting review
          </Badge>
        )}
      </CardHeader>

      <CardContent>
        {items.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle2 className="h-8 w-8 text-[var(--trust-green)] mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              All items reviewed. Queue is clear.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item) => {
              const statusCfg = STATUS_CONFIG[item.status];
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectItem(item)}
                  className="w-full text-left rounded-xl border border-[var(--vt-border)] bg-background/50 p-3 hover:border-[var(--accent)]/30 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">
                          {item.clinicianName}
                        </span>
                        <Badge
                          variant="outline"
                          className={`text-[10px] h-4 px-1.5 gap-0.5 ${statusCfg.color}`}
                        >
                          {statusCfg.icon}
                          {statusCfg.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.credentialType} — {item.source}
                      </p>
                    </div>
                    <div className="shrink-0 text-right space-y-1">
                      <ConfidenceScore value={item.avgConfidence} />
                      <p className="text-[10px] text-muted-foreground">
                        {item.fieldsToReview} field{item.fieldsToReview !== 1 ? 's' : ''} flagged
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
