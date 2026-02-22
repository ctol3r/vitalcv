'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ClaimBadge } from '@/components/ui/claim-badge';
import { CRSRing } from '@/components/ui/crs-ring';
import { GlassCard, GlassCardContent } from '@/components/ui/glass-card';
import { TrustBandIndicator } from '@/components/ui/trust-band-indicator';
import type { TrustBand } from '@/components/trust-state/types';
import type { ClaimLevel } from '@/components/trust-state/types';
import { CheckCircle2, FileText, MapPin } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface CandidateMatch {
  id: string;
  name: string;
  specialty: string;
  location: string;
  matchScore: number;
  trustBand: TrustBand;
  crsScore: number;
  verifiedCredentials: {
    name: string;
    claimLevel: ClaimLevel;
  }[];
  matchDrivers: string[];
}

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface CandidateResultCardProps {
  candidate: CandidateMatch;
  rank: number;
  onExplain: (candidate: CandidateMatch) => void;
  onViewProfile: (candidate: CandidateMatch) => void;
}

/* ------------------------------------------------------------------ */
/*  CandidateResultCard                                                */
/* ------------------------------------------------------------------ */

export function CandidateResultCard({
  candidate,
  rank,
  onExplain,
  onViewProfile,
}: CandidateResultCardProps) {
  return (
    <GlassCard className="group hover:border-[var(--accent)]/30 transition-colors">
      <GlassCardContent>
        <div className="flex gap-4">
          {/* Rank + CRS Ring */}
          <div className="flex flex-col items-center gap-2 shrink-0">
            <span className="text-xs font-medium text-muted-foreground">#{rank}</span>
            <CRSRing band={candidate.trustBand} percentage={candidate.crsScore} size={64} />
            <TrustBandIndicator band={candidate.trustBand} size="sm" />
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0 space-y-3">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-heading font-semibold text-base">
                  {candidate.name}
                </h3>
                <p className="text-sm text-muted-foreground">{candidate.specialty}</p>
              </div>
              <MatchScoreBadge score={candidate.matchScore} />
            </div>

            {/* Location */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {candidate.location}
            </div>

            {/* Verified credentials */}
            <div className="flex flex-wrap gap-2">
              {candidate.verifiedCredentials.map((cred) => (
                <div
                  key={cred.name}
                  className="flex items-center gap-1.5 text-xs"
                >
                  <CheckCircle2 className="h-3 w-3 text-[var(--trust-green)]" />
                  <span>{cred.name}</span>
                  <ClaimBadge level={cred.claimLevel} />
                </div>
              ))}
            </div>

            {/* Match drivers */}
            <div className="flex flex-wrap gap-1.5">
              {candidate.matchDrivers.map((driver) => (
                <Badge
                  key={driver}
                  variant="outline"
                  className="text-[10px] h-5 px-1.5 bg-[var(--accent)]/5 border-[var(--accent)]/20"
                >
                  {driver}
                </Badge>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onExplain(candidate)}
                className="text-xs"
              >
                <FileText className="h-3 w-3 mr-1" />
                Explain Match
              </Button>
              <Button
                size="sm"
                onClick={() => onViewProfile(candidate)}
                className="text-xs"
              >
                View Profile
              </Button>
            </div>
          </div>
        </div>
      </GlassCardContent>
    </GlassCard>
  );
}

/* ------------------------------------------------------------------ */
/*  MatchScoreBadge                                                    */
/* ------------------------------------------------------------------ */

function MatchScoreBadge({ score }: { score: number }) {
  const color =
    score >= 90
      ? 'text-[var(--trust-green)] border-[var(--trust-green)]/20 bg-[var(--trust-green)]/5'
      : score >= 70
        ? 'text-[var(--trust-yellow)] border-[var(--trust-yellow)]/20 bg-[var(--trust-yellow)]/5'
        : 'text-muted-foreground border-border bg-muted/20';

  return (
    <div
      className={`rounded-lg border px-2.5 py-1 text-center ${color}`}
    >
      <span className="text-lg font-heading font-bold tabular-nums">{score}</span>
      <span className="text-[10px] block uppercase tracking-wider font-medium">Match</span>
    </div>
  );
}
