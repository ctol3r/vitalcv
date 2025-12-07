/**
 * Task 13: License Expiration Countdown + Renewal CTA
 */

'use client';

import { Clock, AlertCircle, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { RenewalPrediction } from '@/lib/growth/models';

interface LicenseExpirationCountdownProps {
  predictions: RenewalPrediction[];
}

export function LicenseExpirationCountdown({ predictions }: LicenseExpirationCountdownProps) {
  const critical = predictions.filter((p) => p.urgency === 'critical');
  const high = predictions.filter((p) => p.urgency === 'high');

  const getUrgencyColor = (urgency: RenewalPrediction['urgency']) => {
    switch (urgency) {
      case 'critical':
        return 'text-red-600 border-red-200 bg-red-50 dark:bg-red-950/20';
      case 'high':
        return 'text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-950/20';
      case 'medium':
        return 'text-blue-600 border-blue-200 bg-blue-50 dark:bg-blue-950/20';
      default:
        return 'text-muted-foreground';
    }
  };

  const sorted = [...predictions].sort((a, b) => a.daysUntilExpiration - b.daysUntilExpiration);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          License & Credential Expiration
        </CardTitle>
        <CardDescription>
          {critical.length > 0 && (
            <span className="text-red-600 font-medium">
              {critical.length} critical renewal(s) needed
            </span>
          )}
          {critical.length === 0 && high.length > 0 && (
            <span className="text-amber-600">
              {high.length} renewal(s) approaching
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {sorted.slice(0, 5).map((pred) => {
          const daysPercent = Math.min((pred.daysUntilExpiration / 90) * 100, 100);
          const isUrgent = pred.urgency === 'critical' || pred.urgency === 'high';

          return (
            <Card
              key={pred.credentialId}
              className={`border-2 ${getUrgencyColor(pred.urgency)}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{pred.credentialName}</h3>
                      <Badge variant={pred.urgency === 'critical' ? 'destructive' : 'secondary'}>
                        {pred.type.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>
                        Expires: {new Date(pred.expiresAt).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {pred.daysUntilExpiration} days remaining
                      </span>
                    </div>
                  </div>
                  {isUrgent && (
                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0" />
                  )}
                </div>

                <Progress
                  value={daysPercent}
                  className={`h-2 mb-3 ${
                    pred.urgency === 'critical' ? 'bg-red-200' : ''
                  }`}
                />

                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    Renewal window: {new Date(pred.renewalWindowStart).toLocaleDateString()} -{' '}
                    {new Date(pred.renewalWindowEnd).toLocaleDateString()}
                  </div>
                  <Button
                    size="sm"
                    variant={isUrgent ? 'default' : 'outline'}
                    className="ml-4"
                    onClick={() => {
                      // Navigate to renewal page
                      window.location.href = `/credentials/${pred.credentialId}/renew`;
                    }}
                  >
                    Renew Now
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </Button>
                </div>

                {pred.estimatedProcessingDays > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Estimated processing: {pred.estimatedProcessingDays} days
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}

        {predictions.length > 5 && (
          <div className="text-center pt-2">
            <Button variant="ghost" size="sm">
              View all {predictions.length} credentials
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

