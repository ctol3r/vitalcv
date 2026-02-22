'use client';

import { Badge } from '@/components/ui/badge';
import {
  GlassModal,
  GlassModalHeader,
  GlassModalTitle,
  GlassModalBody,
  GlassModalFooter,
} from '@/components/ui/glass-modal';
import { Button } from '@/components/ui/button';
import {
  Award,
  Brain,
  CheckCircle2,
  FileSearch,
  Shield,
} from 'lucide-react';
import type { CandidateMatch } from './CandidateResultCard';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface ExplainMatchModalProps {
  open: boolean;
  onClose: () => void;
  candidate: CandidateMatch | null;
}

/* ------------------------------------------------------------------ */
/*  Match criteria — prioritized explanation                           */
/* ------------------------------------------------------------------ */

interface MatchCriterion {
  priority: 'PRIMARY' | 'SECONDARY' | 'CONTEXT';
  icon: React.ReactNode;
  label: string;
  detail: string;
  contribution: number; // percentage of match score
}

function deriveCriteria(candidate: CandidateMatch): MatchCriterion[] {
  const criteria: MatchCriterion[] = [];
  const highLevel = candidate.verifiedCredentials.filter(
    (c) => c.claimLevel === 'L3',
  );
  const midLevel = candidate.verifiedCredentials.filter(
    (c) => c.claimLevel === 'L2',
  );

  if (highLevel.length > 0) {
    criteria.push({
      priority: 'PRIMARY',
      icon: <Shield className="h-4 w-4 text-[var(--trust-green)]" />,
      label: 'PSV-Verified Credentials',
      detail: `${highLevel.length} credential${highLevel.length > 1 ? 's' : ''} verified at L3 (Primary Source): ${highLevel.map((c) => c.name).join(', ')}`,
      contribution: 40,
    });
  }

  if (midLevel.length > 0) {
    criteria.push({
      priority: 'SECONDARY',
      icon: <Award className="h-4 w-4 text-[var(--accent)]" />,
      label: 'Electronically Verified',
      detail: `${midLevel.length} credential${midLevel.length > 1 ? 's' : ''} at L2: ${midLevel.map((c) => c.name).join(', ')}`,
      contribution: 25,
    });
  }

  criteria.push({
    priority: 'SECONDARY',
    icon: <CheckCircle2 className="h-4 w-4 text-[var(--accent)]" />,
    label: 'Trust Band',
    detail: `CRS score: ${candidate.crsScore} — Band: ${candidate.trustBand}`,
    contribution: 20,
  });

  criteria.push({
    priority: 'CONTEXT',
    icon: <Brain className="h-4 w-4 text-muted-foreground" />,
    label: 'Semantic Context',
    detail: `Profile-to-job alignment based on specialty, location, and verified qualifications.`,
    contribution: 15,
  });

  return criteria;
}

const PRIORITY_LABEL: Record<MatchCriterion['priority'], { text: string; color: string }> = {
  PRIMARY: { text: 'Primary Driver', color: 'text-[var(--trust-green)] border-[var(--trust-green)]/20 bg-[var(--trust-green)]/5' },
  SECONDARY: { text: 'Secondary Driver', color: 'text-[var(--accent)] border-[var(--accent)]/20 bg-[var(--accent)]/5' },
  CONTEXT: { text: 'Semantic Context', color: 'text-muted-foreground border-border bg-muted/20' },
};

/* ------------------------------------------------------------------ */
/*  ExplainMatchModal                                                  */
/* ------------------------------------------------------------------ */

export function ExplainMatchModal({ open, onClose, candidate }: ExplainMatchModalProps) {
  if (!candidate) return null;

  const criteria = deriveCriteria(candidate);

  return (
    <GlassModal open={open} onClose={onClose} className="max-w-xl">
      <GlassModalHeader>
        <div className="flex items-center gap-2">
          <FileSearch className="h-5 w-5 text-[var(--accent)]" />
          <GlassModalTitle>Match Explanation</GlassModalTitle>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Why <span className="font-medium text-foreground">{candidate.name}</span> matches
          your search criteria
        </p>
      </GlassModalHeader>

      <GlassModalBody className="space-y-4">
        {/* Overall score */}
        <div className="flex items-center gap-3 rounded-xl bg-muted/20 p-3 border border-[var(--glass-border)]">
          <span className="text-3xl font-heading font-bold tabular-nums">
            {candidate.matchScore}
          </span>
          <div>
            <p className="text-sm font-medium">Overall Match Score</p>
            <p className="text-xs text-muted-foreground">
              Based on verified credentials, trust state, and profile alignment
            </p>
          </div>
        </div>

        {/* Criteria breakdown */}
        <div className="space-y-3">
          {criteria.map((criterion) => {
            const priorityStyle = PRIORITY_LABEL[criterion.priority];
            return (
              <div
                key={criterion.label}
                className="flex items-start gap-3 rounded-xl bg-background/50 p-3 border border-[var(--glass-border)]"
              >
                <div className="mt-0.5 shrink-0">{criterion.icon}</div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{criterion.label}</span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] h-4 px-1.5 ${priorityStyle.color}`}
                    >
                      {priorityStyle.text}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{criterion.detail}</p>
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-sm font-heading font-bold tabular-nums">
                    {criterion.contribution}%
                  </span>
                  <span className="text-[10px] block text-muted-foreground">weight</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bias audit link */}
        <BiasAuditLink />
      </GlassModalBody>

      <GlassModalFooter>
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </GlassModalFooter>
    </GlassModal>
  );
}

/* ------------------------------------------------------------------ */
/*  BiasAuditLink — inline component                                   */
/* ------------------------------------------------------------------ */

function BiasAuditLink() {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground border-t border-[var(--glass-border)] pt-3">
      <Shield className="h-3.5 w-3.5" />
      <span>
        Matching criteria are auditable.{' '}
        <button
          type="button"
          className="underline underline-offset-2 hover:text-foreground transition-colors"
        >
          View Bias Audit Report
        </button>
      </span>
    </div>
  );
}
