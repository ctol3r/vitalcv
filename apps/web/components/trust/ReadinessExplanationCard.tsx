import React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { TrustStatusBadge } from '@/components/ui/trust-status-badge';
import type { ReadinessExplanation } from '@/lib/trust/readiness-explainer';

void React;

interface ReadinessExplanationCardProps {
  explanation: ReadinessExplanation;
  title?: string;
  description?: string;
  className?: string;
}

export function ReadinessExplanationCard({
  explanation,
  title = 'Readiness explanation',
  description = 'Identity, exclusion, licensure, and enrollment stay visible so the current state never stands alone.',
  className,
}: ReadinessExplanationCardProps) {
  return (
    <Card className={className ?? 'gap-0 rounded-2xl border-white/8 bg-white/[0.03] py-0 shadow-none'}>
      <CardHeader className="border-b border-white/6 px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-sm font-semibold text-white/82">{title}</CardTitle>
            <CardDescription className="text-xs leading-relaxed text-white/42">
              {description}
            </CardDescription>
          </div>
          <div className="text-left sm:text-right">
            <TrustStatusBadge
              status={explanation.badgeStatus}
              label={explanation.label}
              size="sm"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 px-5 py-4">
        <div className="rounded-2xl border border-white/8 bg-black/15 px-4 py-4">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/24">Core lanes shown separately</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {explanation.dimensions.map((dimension) => (
              <div
                key={dimension.id}
                className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 text-xs text-white/56"
              >
                {dimension.label}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/8 bg-black/15 px-4 py-4">
          <p className="text-[10px] uppercase tracking-[0.18em] text-white/24">What is missing</p>
          {explanation.whatIsMissing.length > 0 ? (
            <div className="mt-3 space-y-2">
              {explanation.whatIsMissing.map((item) => (
                <div key={item} className="flex items-start gap-2">
                  <span className="mt-px text-xs text-white/22" aria-hidden>•</span>
                  <span className="text-xs leading-relaxed text-white/56">{item}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-xs leading-relaxed text-white/42">
              Nothing is missing across the core launch sources.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default ReadinessExplanationCard;
