'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';

export default function TalentEquilibriumPage() {
  const [equilibrium, setEquilibrium] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const region = 'us-west';
    fetch(`${API_BASE}/api/talent-equilibrium/${region}`)
      .then((res) => res.json())
      .then((data) => {
        setEquilibrium(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton className="h-64 w-full" />;
  if (!equilibrium) return <div>No equilibrium data</div>;

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Talent Equilibrium Network</CardTitle>
          <CardDescription>Equilibrium model predicting talent flows between employers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="flex justify-between mb-2">
              <span className="text-sm font-medium">Equilibrium Score</span>
              <span className="text-sm font-bold">{equilibrium.equilibrium?.toFixed(1) || 0}/100</span>
            </div>
            <Progress value={equilibrium.equilibrium || 0} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

