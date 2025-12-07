'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function TemporalAlignmentPage() {
  const [alignment, setAlignment] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const credentialId = 'default';
    fetch(`${API_BASE}/api/temporal-alignment/${credentialId}`)
      .then((res) => res.json())
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton className="h-64 w-full" />;
  if (!alignment) return <div>No temporal alignment data</div>;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Credential Temporal Alignment</CardTitle>
          <CardDescription>Ensuring all credential timestamps, validity windows, renewals, and expirations align across systems</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">Consistency Score</span>
              <span className="text-sm font-bold">{alignment.consistency?.score?.toFixed(1) || 0}/100</span>
            </div>
            <Progress value={alignment.consistency?.score || 0} />
          </div>
          {alignment.consistency?.conflicts?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Conflicts</h3>
              {alignment.consistency.conflicts.map((c: any, i: number) => (
                <Badge key={i} variant="outline" className="mr-2">
                  {c.field}: {c.values.join(', ')}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}








