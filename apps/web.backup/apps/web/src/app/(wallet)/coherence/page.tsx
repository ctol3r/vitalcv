'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function CoherencePage() {
  const [coherence, setCoherence] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const clinicianId = 'self';
    fetch(`${API_BASE}/api/coherence/${clinicianId}`)
      .then((res) => res.json())
      .then((data) => {
        setCoherence(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton className="h-64 w-full" />;
  if (!coherence) return <div>No coherence data</div>;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Credential Harmonic Coherence</CardTitle>
          <CardDescription>Ensuring credentials harmonize logically across timelines, issuers, roles, and evidence</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">Resonance Score</span>
              <span className="text-sm font-bold">{coherence.resonanceScore?.toFixed(1) || 0}/100</span>
            </div>
            <Progress value={coherence.resonanceScore || 0} />
          </div>
          {coherence.errors?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Errors</h3>
              {coherence.errors.map((e: any, i: number) => (
                <Badge key={i} variant={e.severity === 'high' ? 'destructive' : 'outline'} className="mr-2">
                  {e.type}: {e.description}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

