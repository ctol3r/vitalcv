'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function TimelinePage() {
  const [timeline, setTimeline] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get clinicianId from context or params
    const clinicianId = 'demo-clinician-id'; // Replace with actual ID

    fetch(`${API_BASE}/api/timeline/${clinicianId}`)
      .then((res) => res.json())
      .then((data) => {
        setTimeline(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load timeline', err);
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
          <CardTitle>Experience Timeline</CardTitle>
          <CardDescription>Your complete career arc</CardDescription>
        </CardHeader>
        <CardContent>
          {timeline ? (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Events ({timeline.events?.length ?? 0})</h3>
                <div className="space-y-2">
                  {timeline.events?.map((event: any, i: number) => (
                    <div key={i} className="p-3 border rounded">
                      <div className="font-medium">{event.normalizedTitle}</div>
                      <div className="text-sm text-muted-foreground">
                        {event.normalizedType} • {event.normalizedDates.start}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {timeline.milestones && timeline.milestones.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Milestones</h3>
                  <div className="space-y-2">
                    {timeline.milestones.map((milestone: any, i: number) => (
                      <div key={i} className="p-3 border rounded">
                        <div className="font-medium">{milestone.title}</div>
                        <div className="text-sm text-muted-foreground">
                          {milestone.type} • Confidence: {(milestone.confidence * 100).toFixed(0)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {timeline.compliance && (
                <div>
                  <h3 className="font-semibold mb-2">
                    Compliance Score: {timeline.compliance.score}/100
                  </h3>
                  {timeline.compliance.issues.length > 0 && (
                    <div className="text-sm text-destructive">
                      {timeline.compliance.issues.length} issues found
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div>No timeline data available</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

