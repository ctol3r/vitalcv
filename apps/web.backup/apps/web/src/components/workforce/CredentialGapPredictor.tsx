/**
 * Credential Gap Predictor Component
 * Phase 3: Task 22 - Credential gap predictor for unit (next 30/60/90 days)
 */

'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { CredentialGap } from '@/lib/workforce/models';
import { Calendar, TrendingDown } from 'lucide-react';

interface CredentialGapPredictorProps {
  gaps: CredentialGap[];
}

export function CredentialGapPredictor({ gaps }: CredentialGapPredictorProps) {
  if (gaps.length === 0) {
    return <p className="text-muted-foreground">No credential gaps predicted in the next 90 days.</p>;
  }

  const gapsByTimeframe = {
    '0-30': gaps.filter((g) => g.daysUntilGap <= 30),
    '31-60': gaps.filter((g) => g.daysUntilGap > 30 && g.daysUntilGap <= 60),
    '61-90': gaps.filter((g) => g.daysUntilGap > 60 && g.daysUntilGap <= 90),
  };

  return (
    <div className="space-y-4">
      {Object.entries(gapsByTimeframe).map(([timeframe, timeframeGaps]) => {
        if (timeframeGaps.length === 0) return null;

        return (
          <Card key={timeframe}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-semibold flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Next {timeframe} Days
                </h4>
                <Badge variant="outline">{timeframeGaps.length} gaps</Badge>
              </div>
              <div className="space-y-2">
                {timeframeGaps.map((gap) => (
                  <div
                    key={gap.id}
                    className="flex items-center justify-between p-2 border rounded hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium capitalize">{gap.type.replace(/_/g, ' ')}</span>
                        <Badge variant="secondary" className="text-xs">
                          {gap.daysUntilGap} days
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        Affects {gap.affectedCount} clinician(s)
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Forecast date: {new Date(gap.forecastDate).toLocaleDateString()}
                      </p>
                    </div>
                    <TrendingDown className="h-4 w-4 text-muted-foreground" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}








