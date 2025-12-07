'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function SafetyExchangePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const clinicianId = 'demo-clinician-id'; // Replace with actual ID

    fetch(`${API_BASE}/api/safety-exchange/${clinicianId}`)
      .then((res) => res.json())
      .then((data) => {
        setData(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load safety exchange', err);
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
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>Safety & Sanctions Exchange</CardTitle>
          <CardDescription>National safety and sanctions data</CardDescription>
        </CardHeader>
        <CardContent>
          {data ? (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">
                  Sanctions ({data.sanctions?.length ?? 0})
                </h3>
                <div className="space-y-2">
                  {data.sanctions?.map((sanction: any, i: number) => (
                    <div key={i} className="p-3 border rounded">
                      <div className="font-medium">{sanction.description}</div>
                      <div className="text-sm text-muted-foreground">
                        {sanction.source} • {sanction.severity} • {sanction.eventDate}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {data.predictions && data.predictions.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Predictions</h3>
                  <div className="space-y-2">
                    {data.predictions.map((pred: any, i: number) => (
                      <div key={i} className="p-3 border rounded">
                        <div className="font-medium">{pred.type}</div>
                        <div className="text-sm text-muted-foreground">
                          Predicted: {pred.predictedDate} • Confidence: {(pred.confidence * 100).toFixed(0)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>No safety exchange data available</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

