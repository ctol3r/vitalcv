'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function RegConfidencePage() {
  const [confidence, setConfidence] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const clinicianId = 'self';
    fetch(`${API_BASE}/api/regulatory-confidence/${clinicianId}`)
      .then((res) => res.json())
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton className="h-64 w-full" />;
  if (!confidence) return <div>No regulatory confidence data</div>;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Regulatory Confidence Map</CardTitle>
          <CardDescription>Score how confident VitalCV is in regulatory decisions for each clinician across jurisdictions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">Overall Confidence</span>
              <span className="text-sm font-bold">{confidence.overall?.toFixed(1) || 0}/100</span>
            </div>
            <Progress value={confidence.overall || 0} />
          </div>
          {confidence.conflicts?.detected && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Regulator Conflicts</h3>
              <Badge variant="destructive">
                {confidence.conflicts.mismatches?.length || 0} mismatches detected
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}








