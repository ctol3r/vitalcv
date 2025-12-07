'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function ComplianceNavigatorPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const orgId = 'demo-org-id'; // Replace with actual org ID
    fetch(`${API_BASE}/api/compliance-navigator/${orgId}`)
      .then((res) => res.json())
      .then((data) => {
        setData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load compliance navigator', err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Employer Compliance Navigator</CardTitle>
          <CardDescription>Map of every compliance requirement, risk, and corrective action</CardDescription>
        </CardHeader>
        <CardContent>
          {data ? (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2">Compliance Score</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span>Overall Score</span>
                    <span className="text-2xl font-bold">{data.complianceScore}/100</span>
                  </div>
                  <Progress value={data.complianceScore} />
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Compliance Gaps</h3>
                <div className="space-y-2">
                  {data.gaps?.map((gap: any, idx: number) => (
                    <div key={idx} className="p-3 border rounded">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={
                          gap.severity === 'critical' ? 'destructive' :
                          gap.severity === 'high' ? 'destructive' :
                          gap.severity === 'medium' ? 'secondary' : 'outline'
                        }>
                          {gap.severity}
                        </Badge>
                        <span className="font-medium">{gap.type}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{gap.description}</p>
                      <div className="space-y-1">
                        {gap.correctiveActions?.map((action: string, i: number) => (
                          <div key={i} className="text-xs text-muted-foreground">• {action}</div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Action Plan</h3>
                <div className="space-y-2">
                  {data.actionPlan?.map((step: any, idx: number) => (
                    <div key={idx} className="p-3 border rounded">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">{step.step}</span>
                        <Badge>Priority {step.priority}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Estimated: {step.estimatedDays} days
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Compliance Trends</h3>
                <div className="space-y-2">
                  {data.trends?.map((trend: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <span className="text-sm">{new Date(trend.date).toLocaleDateString()}</span>
                        <Badge variant={trend.direction === 'improving' ? 'default' : 'secondary'} className="ml-2">
                          {trend.direction}
                        </Badge>
                      </div>
                      <span className="font-bold">{trend.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div>No compliance navigator data available</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}








