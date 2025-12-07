'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function RegImpactGridPage() {
  const [impact, setImpact] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const region = 'us';
    fetch(`${API_BASE}/api/reg-impact-grid/${region}`)
      .then((res) => res.json())
      .then((data) => {
        setImpact(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton className="h-64 w-full" />;
  if (!impact) return <div>No impact data</div>;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Regulator Impact Propagation Grid</CardTitle>
          <CardDescription>Modeling how rule changes propagate through workflows and compliance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <span className="text-sm font-medium">Severity: </span>
            <Badge variant={impact.severity >= 4 ? 'destructive' : 'outline'}>{impact.severity || 0}/5</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

