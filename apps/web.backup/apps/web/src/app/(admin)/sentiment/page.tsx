'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function SentimentPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const region = 'US'; // Replace with actual region
    fetch(`${API_BASE}/api/workforce-sentiment/${region}`)
      .then((res) => res.json())
      .then((data) => {
        setData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load sentiment', err);
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
          <CardTitle>Global Workforce Sentiment Engine</CardTitle>
          <CardDescription>Analyze global clinician sentiment to predict workforce shifts, burnout, and retention</CardDescription>
        </CardHeader>
        <CardContent>
          {data ? (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2">Aggregated Sentiment</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Overall</div>
                    <Progress value={(data.aggregatedSentiment?.overall + 1) * 50} />
                    <span className="text-sm">{(data.aggregatedSentiment?.overall * 100).toFixed(0)}%</span>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Burnout</div>
                    <Progress value={data.aggregatedSentiment?.burnout * 100} />
                    <span className="text-sm">{(data.aggregatedSentiment?.burnout * 100).toFixed(0)}%</span>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Satisfaction</div>
                    <Progress value={data.aggregatedSentiment?.satisfaction * 100} />
                    <span className="text-sm">{(data.aggregatedSentiment?.satisfaction * 100).toFixed(0)}%</span>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Retention</div>
                    <Progress value={data.aggregatedSentiment?.retention * 100} />
                    <span className="text-sm">{(data.aggregatedSentiment?.retention * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Burnout Potential</h3>
                <div className="space-y-2">
                  {data.burnoutPotential?.map((item: any, idx: number) => (
                    <div key={idx} className="p-3 border rounded">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={item.risk === 'high' ? 'destructive' : 'secondary'}>
                          {item.risk}
                        </Badge>
                        <span className="font-medium">{item.specialty}</span>
                      </div>
                      <div className="space-y-1">
                        {item.factors?.map((factor: string, i: number) => (
                          <div key={i} className="text-xs text-muted-foreground">• {factor}</div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Job Satisfaction Predictions</h3>
                <div className="space-y-2">
                  <div className="p-3 border rounded">
                    <div className="flex items-center justify-between mb-2">
                      <span>Predicted Retention</span>
                      <Badge>{(data.jobSatisfaction?.predictedRetention * 100).toFixed(0)}%</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Departure Risk</span>
                      <Badge variant="destructive">{(data.jobSatisfaction?.departureRisk * 100).toFixed(0)}%</Badge>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Sentiment Time Series</h3>
                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {data.timeSeries?.map((point: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between p-2 border rounded text-sm">
                      <span>{new Date(point.date).toLocaleDateString()}</span>
                      <div className="flex gap-4">
                        <span>Sentiment: {(point.sentiment * 100).toFixed(0)}%</span>
                        <span>Burnout: {(point.burnout * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div>No sentiment data available</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}








