'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, TrendingUp, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CouplingAlert {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium';
  affectedDepartments: string[];
  riskType: 'propagation' | 'cascade' | 'bottleneck';
  recommendation?: string;
}

interface CouplingAlertsProps {
  alerts: CouplingAlert[];
  title?: string;
  description?: string;
}

export function CouplingAlerts({
  alerts,
  title = 'Coupling Alerts',
  description = 'High-propagation-risk areas requiring attention',
}: CouplingAlertsProps) {
  const sortedAlerts = useMemo(() => {
    const severityOrder = { critical: 3, high: 2, medium: 1 };
    return [...alerts].sort((a, b) => severityOrder[b.severity] - severityOrder[a.severity]);
  }, [alerts]);

  const getSeverityColor = (severity: CouplingAlert['severity']) => {
    if (severity === 'critical') return 'bg-rose-500 text-white border-rose-600';
    if (severity === 'high') return 'bg-orange-500 text-white border-orange-600';
    return 'bg-amber-500 text-white border-amber-600';
  };

  const getRiskTypeIcon = (riskType: CouplingAlert['riskType']) => {
    if (riskType === 'propagation') return <TrendingUp className="h-4 w-4" />;
    if (riskType === 'cascade') return <Activity className="h-4 w-4" />;
    return <AlertTriangle className="h-4 w-4" />;
  };

  if (alerts.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32 text-center text-muted-foreground">
          <div>
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No alerts at this time</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-rose-500" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {sortedAlerts.map((alert) => (
          <div
            key={alert.id}
            className={cn(
              'rounded-lg border p-4 transition-all hover:shadow-md',
              alert.severity === 'critical'
                ? 'border-rose-500/50 bg-rose-50 dark:bg-rose-950/20'
                : alert.severity === 'high'
                  ? 'border-orange-500/50 bg-orange-50 dark:bg-orange-950/20'
                  : 'border-amber-500/50 bg-amber-50 dark:bg-amber-950/20'
            )}
          >
            <div className="flex items-start justify-between gap-4 mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold">{alert.title}</h4>
                  <Badge className={getSeverityColor(alert.severity)} variant="outline">
                    {alert.severity}
                  </Badge>
                  <Badge variant="outline" className="flex items-center gap-1">
                    {getRiskTypeIcon(alert.riskType)}
                    {alert.riskType}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{alert.description}</p>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              <div>
                <span className="text-xs font-medium text-muted-foreground">Affected Departments:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {alert.affectedDepartments.map((dept) => (
                    <Badge key={dept} variant="outline" className="text-xs">
                      {dept}
                    </Badge>
                  ))}
                </div>
              </div>

              {alert.recommendation && (
                <div className="rounded bg-muted/50 p-2 mt-2">
                  <span className="text-xs font-medium text-muted-foreground">Recommendation:</span>
                  <p className="text-xs mt-1">{alert.recommendation}</p>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Summary Stats */}
        <div className="mt-4 rounded-lg border bg-muted/30 p-3">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Total Alerts:</span>
              <span className="ml-2 font-semibold">{alerts.length}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Critical:</span>
              <span className="ml-2 font-semibold text-rose-600">
                {alerts.filter((a) => a.severity === 'critical').length}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">High:</span>
              <span className="ml-2 font-semibold text-orange-600">
                {alerts.filter((a) => a.severity === 'high').length}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

