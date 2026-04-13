import React from 'react';
import { Card } from '@/components/ui/card';
import { TrustStatusBadge } from '@/components/ui/trust-status-badge';
import type { PassportData } from '@/lib/trust/passport-contract';
import {
  resolveRecommendation,
  RECOMMENDATION_CONFIG,
} from '@/lib/trust/employer-decision-posture';
import { formatProofDate } from '@/lib/trust/proof-language';

void React;

export function EmployerDecisionPosture({ passport }: { passport: PassportData }) {
  const recommendation = resolveRecommendation(passport);
  const config = RECOMMENDATION_CONFIG[recommendation];

  const proven = passport.decisionPosture?.proven ?? [];
  const missingFromPosture = passport.decisionPosture?.missing ?? [];

  const gaps = [
    ...missingFromPosture.map((m) => ({
      id: `missing-${m.sourceId}`,
      label: `${m.dimension} — ${m.sourceId}`,
      detail: m.reason,
    })),
    ...passport.trustPosture.missingItems
      .filter((item) => !missingFromPosture.some((m) => m.sourceId === item))
      .map((item) => ({
        id: `posture-missing-${item}`,
        label: item,
        detail: 'Missing or unresolved',
      })),
    ...passport.trustPosture.gatedItems
      .filter((item) => !missingFromPosture.some((m) => m.sourceId === item))
      .map((item) => ({
        id: `posture-gated-${item}`,
        label: item,
        detail: 'Requires institutional access',
      })),
  ];

  return (
    <Card className="gap-0 rounded-2xl py-0 shadow-none overflow-hidden">
      {/* Recommendation hero */}
      <div className={`px-5 py-5 ${config.cardClass}`}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/50">
          Decision posture
        </p>
        <p className="mt-2 text-lg font-semibold text-foreground/90">
          {config.label}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-foreground/60">
          {config.description}
        </p>
      </div>

      {/* Verified signals */}
      {proven.length > 0 && (
        <div className="border-t border-white/6 px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/30">
            Verified signals
          </p>
          <div className="mt-3 space-y-2">
            {proven.map((source) => (
              <div
                key={source.sourceId}
                className="flex items-start justify-between gap-3 rounded-lg border border-white/6 bg-white/[0.02] px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm text-foreground/70">
                    {source.dimension} — {source.sourceId}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{source.reason}</p>
                  {source.checkedAt && (
                    <p className="mt-0.5 text-[10px] text-muted-foreground/40">
                      Checked {formatProofDate(source.checkedAt)}
                    </p>
                  )}
                </div>
                <TrustStatusBadge status="checked" size="sm" className="shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Unresolved gaps */}
      {gaps.length > 0 && (
        <div className="border-t border-white/6 px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/30">
            Unresolved gaps
          </p>
          <div className="mt-3 space-y-2">
            {gaps.map((gap) => (
              <div
                key={gap.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-white/6 bg-white/[0.02] px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-sm text-foreground/70">{gap.label}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{gap.detail}</p>
                </div>
                <TrustStatusBadge status="access_required" size="sm" className="shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Audit footer */}
      <div className="border-t border-white/6 px-5 py-3">
        <p className="text-[10px] text-muted-foreground/40">
          This recommendation reflects source-backed evidence as of {formatProofDate(passport.lastCheckedAt) ?? 'unknown'}.
          It does not replace institutional credentialing or privileging processes.
        </p>
      </div>
    </Card>
  );
}
