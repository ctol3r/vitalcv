/**
 * Task 12: Identity Health Meter (compliance + anchor + trust)
 */

'use client';

import { Shield, AlertTriangle, CheckCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import type { IdentityHealthScore } from '@/lib/growth/models';

interface IdentityHealthMeterProps {
  health: IdentityHealthScore;
}

export function IdentityHealthMeter({ health }: IdentityHealthMeterProps) {
  const getHealthColor = (score: number) => {
    if (score >= 0.8) return 'text-emerald-600';
    if (score >= 0.6) return 'text-amber-600';
    return 'text-red-600';
  };

  const getHealthLabel = (score: number) => {
    if (score >= 0.8) return 'Excellent';
    if (score >= 0.6) return 'Good';
    if (score >= 0.4) return 'Fair';
    return 'Needs Attention';
  };

  const TrendIcon = health.breakdown.trust.trend === 'up'
    ? TrendingUp
    : health.breakdown.trust.trend === 'down'
    ? TrendingDown
    : Minus;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Identity Health Score
        </CardTitle>
        <CardDescription>
          Overall health of your professional identity and credentials
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Score */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Overall Health</span>
            <Badge className={getHealthColor(health.overall)}>
              {getHealthLabel(health.overall)}
            </Badge>
          </div>
          <Progress value={health.overall * 100} className="h-3" />
          <div className="text-3xl font-bold mt-2">{Math.round(health.overall * 100)}%</div>
        </div>

        {/* Breakdown */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Compliance */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Compliance</span>
              {health.breakdown.compliance.score >= 0.8 ? (
                <CheckCircle className="h-4 w-4 text-emerald-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              )}
            </div>
            <Progress value={health.breakdown.compliance.score * 100} className="h-2" />
            {health.breakdown.compliance.issues.length > 0 && (
              <ul className="text-xs text-muted-foreground list-disc list-inside">
                {health.breakdown.compliance.issues.slice(0, 2).map((issue, i) => (
                  <li key={i}>{issue}</li>
                ))}
              </ul>
            )}
          </div>

          {/* Credentials */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Credential Freshness</span>
              <Badge variant="outline" className="text-xs">
                {health.breakdown.credentials.expired} expired, {health.breakdown.credentials.expiring} expiring
              </Badge>
            </div>
            <Progress value={health.breakdown.credentials.score * 100} className="h-2" />
            <div className="text-xs text-muted-foreground">
              {health.breakdown.credentials.stale} stale credentials
            </div>
          </div>

          {/* Chain Integrity */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Chain Integrity</span>
              <Badge variant="outline" className="text-xs">
                {health.breakdown.chain.staleness} days old
              </Badge>
            </div>
            <Progress value={health.breakdown.chain.score * 100} className="h-2" />
            <div className="text-xs text-muted-foreground">
              Last updated: {new Date(health.breakdown.chain.lastUpdate).toLocaleDateString()}
            </div>
          </div>

          {/* Trust Score */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Trust Score</span>
              <TrendIcon className={`h-4 w-4 ${
                health.breakdown.trust.trend === 'up' ? 'text-emerald-600' :
                health.breakdown.trust.trend === 'down' ? 'text-red-600' :
                'text-muted-foreground'
              }`} />
            </div>
            <Progress value={health.breakdown.trust.score * 100} className="h-2" />
            <div className="text-xs text-muted-foreground">
              Trend: {health.breakdown.trust.trend}
            </div>
          </div>
        </div>

        {/* Anchor Age */}
        {health.anchorAge > 0 && (
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Chain Anchor Age</span>
              <Badge variant={health.anchorAge > 90 ? 'destructive' : 'outline'}>
                {health.anchorAge} days
              </Badge>
            </div>
            {health.anchorAge > 90 && (
              <p className="text-xs text-amber-600 mt-1">
                Consider refreshing your chain anchor for better trust score
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

