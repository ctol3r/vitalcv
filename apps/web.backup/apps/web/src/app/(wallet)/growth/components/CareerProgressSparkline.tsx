/**
 * Task 16: Career Progress Sparkline (timeline trustScore evolution)
 */

'use client';

import { TrendingUp, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { TrustScoreEvolution } from '@/lib/growth/models';

interface CareerProgressSparklineProps {
  history: TrustScoreEvolution[];
  currentScore: number;
}

export function CareerProgressSparkline({
  history,
  currentScore,
}: CareerProgressSparklineProps) {
  if (history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Career Progress
          </CardTitle>
          <CardDescription>Trust score evolution over time</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No historical data available
          </p>
        </CardContent>
      </Card>
    );
  }

  // Prepare data for sparkline
  const sorted = [...history].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
  const minScore = Math.min(...sorted.map((h) => h.score), currentScore);
  const maxScore = Math.max(...sorted.map((h) => h.score), currentScore);
  const range = maxScore - minScore || 1;

  // Calculate trend
  const recent = sorted.slice(-3);
  const older = sorted.slice(0, -3);
  const recentAvg = recent.reduce((sum, h) => sum + h.score, 0) / recent.length;
  const olderAvg =
    older.length > 0 ? older.reduce((sum, h) => sum + h.score, 0) / older.length : recentAvg;
  const trend = recentAvg > olderAvg ? 'up' : recentAvg < olderAvg ? 'down' : 'stable';
  const trendPercent = Math.abs(((recentAvg - olderAvg) / olderAvg) * 100);

  // Get recent milestones
  const milestones = sorted.filter((h) => h.event).slice(-3);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Career Progress
        </CardTitle>
        <CardDescription>Trust score evolution over time</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Score */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Current Trust Score</p>
            <p className="text-3xl font-bold">{(currentScore * 100).toFixed(1)}%</p>
          </div>
          <Badge
            variant={trend === 'up' ? 'default' : trend === 'down' ? 'destructive' : 'secondary'}
            className="flex items-center gap-1"
          >
            {trend === 'up' ? (
              <>
                <TrendingUp className="h-3 w-3" />
                +{trendPercent.toFixed(1)}%
              </>
            ) : trend === 'down' ? (
              <>
                <TrendingUp className="h-3 w-3 rotate-180" />
                -{trendPercent.toFixed(1)}%
              </>
            ) : (
              'Stable'
            )}
          </Badge>
        </div>

        {/* Sparkline Visualization */}
        <div className="relative h-32 bg-muted/30 rounded-lg p-4 overflow-hidden">
          <svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${Math.max(sorted.length * 20, 200)} 100`}
            preserveAspectRatio="none"
            className="absolute inset-0"
          >
            {/* Grid lines */}
            {[0, 25, 50, 75, 100].map((y) => (
              <line
                key={y}
                x1="0"
                y1={y}
                x2="100%"
                y2={y}
                stroke="currentColor"
                strokeWidth="0.5"
                opacity="0.1"
              />
            ))}

            {/* Data line */}
            <polyline
              points={sorted
                .map(
                  (h, i) =>
                    `${(i / (sorted.length - 1 || 1)) * 100},${
                      100 - ((h.score - minScore) / range) * 100
                    }`,
                )
                .join(' ')}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-primary"
            />

            {/* Data points */}
            {sorted.map((h, i) => (
              <circle
                key={i}
                cx={(i / (sorted.length - 1 || 1)) * 100}
                cy={100 - ((h.score - minScore) / range) * 100}
                r="2"
                fill="currentColor"
                className="text-primary"
              />
            ))}

            {/* Current score point */}
            <circle
              cx="100"
              cy={100 - ((currentScore - minScore) / range) * 100}
              r="4"
              fill="currentColor"
              className="text-primary"
            />
          </svg>

          {/* Labels */}
          <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-muted-foreground px-4 pb-1">
            <span>{new Date(sorted[0]?.date || '').toLocaleDateString()}</span>
            <span>Now</span>
          </div>
        </div>

        {/* Recent Milestones */}
        {milestones.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Recent Milestones</p>
            <div className="space-y-1">
              {milestones.map((milestone, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-xs text-muted-foreground"
                >
                  <Sparkles className="h-3 w-3" />
                  <span>{milestone.event}</span>
                  <span className="ml-auto">
                    {new Date(milestone.date).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 pt-4 border-t">
          <div>
            <p className="text-xs text-muted-foreground">Peak</p>
            <p className="text-sm font-semibold">
              {(maxScore * 100).toFixed(1)}%
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Average</p>
            <p className="text-sm font-semibold">
              {((sorted.reduce((sum, h) => sum + h.score, 0) / sorted.length) * 100).toFixed(1)}%
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Data Points</p>
            <p className="text-sm font-semibold">{sorted.length}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

