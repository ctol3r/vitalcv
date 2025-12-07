'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function FusionGridPage() {
  const [fusion, setFusion] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const clinicianId = 'self';
    fetch(`${API_BASE}/api/competency-role-fusion/${clinicianId}`)
      .then((res) => res.json())
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton className="h-64 w-full" />;
  if (!fusion) return <div>No fusion grid data</div>;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Competency-Role Fusion Grid</CardTitle>
          <CardDescription>Fuse competencies, skills, experience, training, and privileges into a role fusion grid</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {Object.entries(fusion.readiness?.scores || {}).map(([role, score]: [string, any]) => (
            <div key={role}>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">{role}</span>
                <span className="text-sm font-bold">{score?.toFixed(1) || 0}/100</span>
              </div>
              <Progress value={score || 0} />
            </div>
          ))}
          {fusion.drift?.detected && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Fusion Drift Detected</h3>
              <Badge variant={fusion.drift.severity === 'high' ? 'destructive' : 'outline'}>
                Severity: {fusion.drift.severity}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}








