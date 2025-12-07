'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function RegulatoryIntelligencePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const region = 'US'; // Replace with actual region
    fetch(`${API_BASE}/api/regulatory-intelligence/${region}`)
      .then((res) => res.json())
      .then((data) => {
        setData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load regulatory intelligence', err);
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
          <CardTitle>Real-Time Regulatory Intelligence</CardTitle>
          <CardDescription>Live regulatory change detection + instant compliance mapping</CardDescription>
        </CardHeader>
        <CardContent>
          {data ? (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2">Region</h3>
                <Badge>{data.region}</Badge>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Regulatory Changes</h3>
                <div className="space-y-2">
                  {data.changes?.map((change: any, idx: number) => (
                    <div key={idx} className="p-3 border rounded">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={change.changeType === 'new' ? 'default' : 'secondary'}>
                          {change.changeType}
                        </Badge>
                        <span className="font-medium">{change.authority}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{change.summary}</p>
                      <div className="mt-2 flex gap-2">
                        {change.impact?.map((impact: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {impact}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Drift Flags</h3>
                <div className="space-y-2">
                  {data.driftFlags?.map((flag: any, idx: number) => (
                    <div key={idx} className="p-3 border rounded">
                      <div className="flex items-center gap-2">
                        <Badge variant={flag.severity === 'high' ? 'destructive' : 'secondary'}>
                          {flag.severity}
                        </Badge>
                        <span className="text-sm">{flag.reason}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">AI Summary</h3>
                <p className="text-sm text-muted-foreground">{data.aiSummary}</p>
              </div>
            </div>
          ) : (
            <div>No regulatory intelligence data available</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}








